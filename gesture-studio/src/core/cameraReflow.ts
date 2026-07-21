import type { AssetSize, StudioLayer } from "../types";

export interface CameraReflowTarget {
  key: string;
  layerId: string;
  assetSide: "left" | "right";
  panelRatio: number;
}

export interface CameraReflowFrame {
  x: number;
  width: number;
  target: CameraReflowTarget | null;
  transitioning: boolean;
}

export interface CameraViewport { x: number; y: number; width: number; height: number }

const FULL_CAMERA = { x: 0, width: 1 };
export const CAMERA_REFLOW_DURATION_MS = 110;

export function cameraReflowPanelRatio(size: AssetSize) {
  if (size === "full") return 0.5;
  if (size === "medium") return 0.4;
  return 0.3;
}

export function cameraReflowPanelRatioForSide(
  layers: readonly StudioLayer[],
  side: "left" | "right"
) {
  return layers.reduce<number | null>((largest, candidate) => {
    const size = candidate.kind === "asset"
      ? candidate.asset.cameraReflow === "make-room" && candidate.asset.placement === side ? candidate.asset.size : null
      : candidate.scene.revealSide === side ? candidate.scene.size : null;
    if (!size) return largest;
    const ratio = cameraReflowPanelRatio(size);
    return largest === null ? ratio : Math.max(largest, ratio);
  }, null);
}

/** The most recently raised live make-room asset owns the side and background.
 * The panel itself must stay large enough for every still-live asset on that
 * side, so a later small cue never collapses an earlier large visual. */
export function cameraReflowTarget(layers: readonly StudioLayer[]): CameraReflowTarget | null {
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    const side = layer.kind === "asset"
      ? layer.asset.cameraReflow === "make-room" && (layer.asset.placement === "left" || layer.asset.placement === "right") ? layer.asset.placement : null
      : layer.scene.revealSide === "left" || layer.scene.revealSide === "right" ? layer.scene.revealSide : null;
    if (!side) continue;
    const size = layer.kind === "asset" ? layer.asset.size : layer.scene.size;
    const panelRatio = cameraReflowPanelRatioForSide(layers, side) ?? cameraReflowPanelRatio(size);
    return {
      key: `${layer.id}:${side}:${panelRatio}`,
      layerId: layer.id,
      assetSide: side,
      panelRatio
    };
  }
  return null;
}

/** Every live cue remains drawable. The newest make-room asset owns only the
 * camera viewport; it must not remove older Keep earlier cue layers. */
export function visibleLayersForComposition(layers: readonly StudioLayer[]) {
  return [...layers];
}

function targetFrame(target: CameraReflowTarget | null) {
  if (!target) return FULL_CAMERA;
  const width = 1 - target.panelRatio;
  return { x: target.assetSide === "left" ? target.panelRatio : 0, width };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** During a transition the coloured panel follows the camera's current edge,
 * rather than jumping ahead to the next asset's final size. */
export function cameraReflowPanelRatioForFrame(frame?: CameraReflowFrame) {
  if (!frame?.target) return undefined;
  return clamp01(1 - frame.width);
}

const fastEaseOut = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);

/** Keeps entry, side changes, and fist restoration smooth without React renders. */
export class CameraReflowController {
  private key = "full";
  private from = { ...FULL_CAMERA };
  private to = { ...FULL_CAMERA };
  private current = { ...FULL_CAMERA };
  private startedAt = 0;

  constructor(private durationMs = CAMERA_REFLOW_DURATION_MS) {}

  reset() {
    this.key = "full";
    this.from = { ...FULL_CAMERA };
    this.to = { ...FULL_CAMERA };
    this.current = { ...FULL_CAMERA };
    this.startedAt = 0;
  }

  update(target: CameraReflowTarget | null, now: number): CameraReflowFrame {
    const key = target?.key ?? "full";
    if (key !== this.key) {
      this.from = { ...this.current };
      this.to = targetFrame(target);
      this.startedAt = now;
      this.key = key;
    }
    const progress = this.durationMs <= 0 ? 1 : clamp01((now - this.startedAt) / this.durationMs);
    const eased = fastEaseOut(progress);
    this.current = {
      x: this.from.x + (this.to.x - this.from.x) * eased,
      width: this.from.width + (this.to.width - this.from.width) * eased
    };
    return { ...this.current, target, transitioning: progress < 1 };
  }
}

export function applyCameraReflow(viewport: CameraViewport, frame?: CameraReflowFrame): CameraViewport {
  if (!frame) return viewport;
  return {
    x: viewport.x + viewport.width * frame.x,
    y: viewport.y,
    width: Math.max(1, viewport.width * frame.width),
    height: viewport.height
  };
}
