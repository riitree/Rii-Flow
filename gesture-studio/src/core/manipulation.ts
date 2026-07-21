import type { AssetTransform } from "../types";
import type { Landmark } from "./gesture";

export interface ControlPoint { x: number; y: number }
export interface PalmObservation { id: string; point: ControlPoint }
export interface NormalizedRect { x: number; y: number; width: number; height: number }
export type ManipulationMode = "idle" | "arming-drag" | "dragging" | "arming-scale" | "scaling";
export type MovementReachMode = "comfort" | "direct";
export type MovementReachAspect = "landscape" | "portrait";

export interface ManipulationSettings {
  armMs: number;
  releaseGraceMs: number;
  hitPadding: number;
}

export interface ManipulationUpdate {
  mode: ManipulationMode;
  progress: number;
  suppressActivation: boolean;
  transform?: AssetTransform;
  ended?: boolean;
  endedMode?: "dragging" | "scaling";
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: ControlPoint, b: ControlPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

function mapComfortAxis(value: number, minimum: number, maximum: number) {
  const linear = (value - minimum) / Math.max(0.01, maximum - minimum);
  // Keep tracking beyond the comfort workspace instead of saturating at 0/1.
  // This leaves enough continuous travel to finish an edge placement when the
  // palm originally locked onto an asset that was already near that edge.
  if (linear <= 0 || linear >= 1) return linear;
  const centered = linear - 0.5;
  const eased = 0.5 + Math.sign(centered) * Math.pow(Math.abs(centered) * 2, 1.28) * 0.5;
  // Mostly linear for predictable placement, with slightly more acceleration
  // near the limits and calmer fine control around the centre.
  return linear * 0.78 + eased * 0.22;
}

/** Maps a comfortable central hand workspace onto the complete stage. Direct
 * mode is intentionally the exact legacy one-to-one control path. */
export function mapPointForMovementReach(
  point: ControlPoint,
  mode: MovementReachMode,
  aspect: MovementReachAspect
): ControlPoint {
  if (mode === "direct") return { ...point };
  const horizontal = aspect === "landscape" ? [0.18, 0.82] as const : [0.16, 0.84] as const;
  const vertical = aspect === "portrait" ? [0.18, 0.82] as const : [0.16, 0.84] as const;
  return {
    x: mapComfortAxis(point.x, horizontal[0], horizontal[1]),
    y: mapComfortAxis(point.y, vertical[0], vertical[1])
  };
}

/**
 * Keeps each physical hand attached to a stable control point and filters
 * landmark jitter without making deliberate large movements feel sluggish.
 */
export class PalmSignalTracker {
  private tracks = new Map<string, { point: ControlPoint; at: number }>();

  reset() { this.tracks.clear(); }

  update(observations: PalmObservation[], now: number): ControlPoint[] {
    const active = new Set(observations.map((item) => item.id));
    for (const [id, track] of this.tracks) {
      if (!active.has(id) && now - track.at > 220) this.tracks.delete(id);
    }
    return observations.map(({ id, point }) => {
      const previous = this.tracks.get(id);
      if (!previous) {
        this.tracks.set(id, { point, at: now });
        return point;
      }
      const movement = distance(previous.point, point);
      const elapsed = Math.max(1, now - previous.at);
      // One-frame landmark jumps are clamped; sustained movement catches up on
      // the following frames instead of throwing the live overlay across stage.
      const maximumMovement = elapsed < 130 ? 0.17 : 0.3;
      const ratio = movement > maximumMovement ? maximumMovement / movement : 1;
      const safe = {
        x: previous.point.x + (point.x - previous.point.x) * ratio,
        y: previous.point.y + (point.y - previous.point.y) * ratio
      };
      // Respond quickly to intentional motion while retaining enough filtering
      // to prevent a resting palm from visibly shaking the overlay.
      const alpha = Math.min(0.92, Math.max(0.56, 0.48 + movement * 4 + Math.min(0.1, elapsed / 700)));
      const filtered = {
        x: previous.point.x + (safe.x - previous.point.x) * alpha,
        y: previous.point.y + (safe.y - previous.point.y) * alpha
      };
      this.tracks.set(id, { point: filtered, at: now });
      return filtered;
    });
  }
}

export function palmControlPoint(landmarks: Landmark[]): ControlPoint | null {
  if (landmarks.length < 18) return null;
  const palm = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  return {
    x: palm.reduce((total, point) => total + point.x, 0) / palm.length,
    y: palm.reduce((total, point) => total + point.y, 0) / palm.length
  };
}

export function mapControlPointForMirror(point: ControlPoint, mirrored: boolean): ControlPoint {
  return mirrored ? { x: 1 - point.x, y: point.y } : point;
}

/** Maps the detected palm centre to where that palm is visibly drawn on the
 * stage. This keeps direct-hit selection accurate when the camera has a frame. */
export function mapControlPointToStageViewport(
  point: ControlPoint,
  viewport: { x: number; y: number; width: number; height: number },
  stageWidth: number,
  stageHeight: number,
  sourceWidth = viewport.width,
  sourceHeight = viewport.height
): ControlPoint {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const coverScale = Math.max(viewport.width / safeSourceWidth, viewport.height / safeSourceHeight);
  const visibleSourceWidth = viewport.width / coverScale;
  const visibleSourceHeight = viewport.height / coverScale;
  const sourceX = (safeSourceWidth - visibleSourceWidth) / 2;
  const sourceY = (safeSourceHeight - visibleSourceHeight) / 2;
  return {
    x: (viewport.x + ((clamp(point.x) * safeSourceWidth - sourceX) / visibleSourceWidth) * viewport.width) / Math.max(1, stageWidth),
    y: (viewport.y + ((clamp(point.y) * safeSourceHeight - sourceY) / visibleSourceHeight) * viewport.height) / Math.max(1, stageHeight)
  };
}

function inside(point: ControlPoint, rect: NormalizedRect, padding: number) {
  return point.x >= rect.x - padding
    && point.x <= rect.x + rect.width + padding
    && point.y >= rect.y - padding
    && point.y <= rect.y + rect.height + padding;
}

export class ManipulationTracker {
  private mode: ManipulationMode = "idle";
  private candidate: "drag" | "scale" | null = null;
  private candidateSince = 0;
  private missingSince: number | null = null;
  private startTransform: AssetTransform = { x: 0.5, y: 0.5, scale: 1 };
  private startPoint = { x: 0.5, y: 0.5 };
  private lastPoint = { x: 0.5, y: 0.5 };
  private startMidpoint = { x: 0.5, y: 0.5 };
  private startDistance = 1;

  constructor(private settings: ManipulationSettings) {}

  configure(settings: ManipulationSettings) { this.settings = settings; }

  currentMode() { return this.mode; }

  reset() {
    this.mode = "idle";
    this.candidate = null;
    this.candidateSince = 0;
    this.missingSince = null;
  }

  private finish(suppressActivation: boolean): ManipulationUpdate {
    const endedMode = this.mode === "dragging" || this.mode === "scaling" ? this.mode : undefined;
    this.reset();
    return { mode: "idle", progress: 0, suppressActivation, ended: Boolean(endedMode), endedMode };
  }

  update(
    points: ControlPoint[],
    now: number,
    target: NormalizedRect,
    currentTransform: AssetTransform,
    stagePoints: ControlPoint[] = points,
    directHitPoints: ControlPoint[] = stagePoints
  ): ManipulationUpdate {
    const ordered = points
      .map((raw, index) => ({ raw, stage: stagePoints[index] ?? raw, directHit: directHitPoints[index] ?? stagePoints[index] ?? raw }))
      .sort((a, b) => a.stage.x - b.stage.x);

    if (this.mode === "dragging") {
      if (ordered.length >= 2) {
        this.mode = "arming-scale";
        this.candidate = "scale";
        this.candidateSince = now;
        this.missingSince = null;
        return { mode: "arming-scale", progress: 0, suppressActivation: true };
      }
      if (ordered.length) {
        this.missingSince = null;
        const point = ordered.reduce((closest, candidate) => distance(candidate.stage, this.lastPoint) < distance(closest.stage, this.lastPoint) ? candidate : closest, ordered[0]).stage;
        this.lastPoint = point;
        return {
          mode: "dragging",
          progress: 1,
          suppressActivation: true,
          transform: {
            x: this.startTransform.x + point.x - this.startPoint.x,
            y: this.startTransform.y + point.y - this.startPoint.y,
            scale: this.startTransform.scale,
            rotation: this.startTransform.rotation
          }
        };
      }
      if (this.missingSince === null) this.missingSince = now;
      if (now - this.missingSince < this.settings.releaseGraceMs) return { mode: "dragging", progress: 1, suppressActivation: true };
      return this.finish(false);
    }

    if (this.mode === "scaling") {
      if (ordered.length >= 2) {
        this.missingSince = null;
        const first = ordered[0];
        const second = ordered[ordered.length - 1];
        const currentMidpoint = midpoint(first.raw, second.raw);
        return {
          mode: "scaling",
          progress: 1,
          suppressActivation: true,
          transform: {
            x: this.startTransform.x + currentMidpoint.x - this.startMidpoint.x,
            y: this.startTransform.y + currentMidpoint.y - this.startMidpoint.y,
            scale: this.startTransform.scale * (distance(first.raw, second.raw) / this.startDistance),
            rotation: this.startTransform.rotation
          }
        };
      }
      if (this.missingSince === null) this.missingSince = now;
      if (now - this.missingSince < this.settings.releaseGraceMs) return { mode: "scaling", progress: 1, suppressActivation: true };
      return this.finish(ordered.length > 0);
    }

    // A creator can grab either through the compressed comfort workspace or
    // by placing their real palm directly over the visible asset. Movement
    // still starts from the stage point, preventing a jump after lock.
    const eligible = ordered.filter((point) => inside(point.stage, target, this.settings.hitPadding) || inside(point.directHit, target, this.settings.hitPadding));
    // Scaling only needs one anchored palm on the asset. Requiring both hands to
    // fit inside a small overlay makes the control nearly impossible to acquire.
    const candidate = ordered.length >= 2 && eligible.length >= 1
      ? "scale"
      : ordered.length === 1 && eligible.length === 1
        ? "drag"
        : null;
    if (!candidate) {
      this.reset();
      return { mode: "idle", progress: 0, suppressActivation: eligible.length > 0 };
    }

    if (this.candidate !== candidate) {
      this.candidate = candidate;
      this.candidateSince = now;
      this.mode = candidate === "drag" ? "arming-drag" : "arming-scale";
      return { mode: this.mode, progress: 0, suppressActivation: true };
    }

    const progress = Math.min(1, (now - this.candidateSince) / this.settings.armMs);
    this.mode = candidate === "drag" ? "arming-drag" : "arming-scale";
    if (progress < 1) return { mode: this.mode, progress, suppressActivation: true };

    this.startTransform = { ...currentTransform };
    this.missingSince = null;
    if (candidate === "drag") {
      this.mode = "dragging";
      this.startPoint = { ...eligible[0].stage };
      this.lastPoint = this.startPoint;
    } else {
      this.mode = "scaling";
      const first = ordered[0];
      const second = ordered[ordered.length - 1];
      this.startMidpoint = midpoint(first.raw, second.raw);
      this.startDistance = Math.max(0.02, distance(first.raw, second.raw));
    }
    return { mode: this.mode, progress: 1, suppressActivation: true };
  }
}
