import type { Rect } from "./compositor";

export interface MorphGestureUpdate {
  progress: number;
  trigger?: string;
}

interface TrackedPoint {
  x: number;
  y: number;
  at: number;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const distance = (a: Pick<TrackedPoint, "x" | "y">, b: Pick<TrackedPoint, "x" | "y">) => Math.hypot(a.x - b.x, a.y - b.y);

/** Recognises one deliberate fingertip orbit around an already-focused asset.
 * Static poses, straight swipes and camera jitter cannot complete the orbit. */
export class CircleMorphTracker {
  private targetId: string | null = null;
  private points: TrackedPoint[] = [];
  private latched: string | null = null;

  reset() {
    this.targetId = null;
    this.points = [];
    this.latched = null;
  }

  update(targetId: string | null, point: { x: number; y: number } | null, now: number): MorphGestureUpdate {
    if (!targetId || !point) {
      this.targetId = null;
      this.points = [];
      this.latched = null;
      return { progress: 0 };
    }
    if (targetId !== this.targetId) {
      this.targetId = targetId;
      this.points = [{ ...point, at: now }];
      if (this.latched !== targetId) this.latched = null;
      return { progress: 0 };
    }
    if (this.latched === targetId) return { progress: 1 };
    const last = this.points.at(-1);
    if (!last || distance(last, point) >= 0.007) this.points.push({ ...point, at: now });
    this.points = this.points.filter((item) => now - item.at <= 1_800).slice(-28);
    if (this.points.length < 6) return { progress: 0 };

    const first = this.points[0];
    const duration = now - first.at;
    const xs = this.points.map((item) => item.x);
    const ys = this.points.map((item) => item.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const center = {
      x: this.points.reduce((sum, item) => sum + item.x, 0) / this.points.length,
      y: this.points.reduce((sum, item) => sum + item.y, 0) / this.points.length
    };
    let signedAngle = 0;
    let absoluteAngle = 0;
    let pathLength = 0;
    for (let index = 1; index < this.points.length; index += 1) {
      const previous = this.points[index - 1];
      const current = this.points[index];
      pathLength += distance(previous, current);
      const a = Math.atan2(previous.y - center.y, previous.x - center.x);
      const b = Math.atan2(current.y - center.y, current.x - center.x);
      let delta = b - a;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      signedAngle += delta;
      absoluteAngle += Math.abs(delta);
    }
    const orbit = Math.abs(signedAngle);
    const progress = clamp(orbit / (Math.PI * 1.55), 0, 1);
    const aspect = height > 0 ? width / height : Number.POSITIVE_INFINITY;
    const closure = distance(first, this.points.at(-1)!);
    const diameter = Math.max(width, height);
    const deliberate = this.points.length >= 9
      && duration >= 420
      && duration <= 1_800
      && width >= 0.045
      && height >= 0.045
      && width <= 0.3
      && height <= 0.3
      && aspect >= 0.5
      && aspect <= 2
      && pathLength >= 0.17
      && orbit >= Math.PI * 1.32
      && absoluteAngle > 0
      && orbit / absoluteAngle >= 0.62
      && closure <= diameter * 1.05;
    if (!deliberate) return { progress };
    this.latched = targetId;
    return { progress: 1, trigger: targetId };
  }
}

export interface AssetMorphExit {
  id: string;
  assetId: string;
  name: string;
  startedAt: number;
  durationMs: number;
  rect: Rect;
  snapshot: CanvasImageSource;
}

function easeInOut(value: number) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function starPath(context: CanvasRenderingContext2D, centerX: number, centerY: number, outer: number, inner: number, rotation: number) {
  context.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 ? inner : outer;
    const angle = rotation - Math.PI / 2 + index * Math.PI / 5;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (!index) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

/** Draws a short GPU-friendly Canvas2D exit. The main compositor remains
 * unchanged and pays nothing when no morph is active. */
export function drawAssetMorphExit(context: CanvasRenderingContext2D, morph: AssetMorphExit, now: number) {
  const progress = clamp((now - morph.startedAt) / Math.max(1, morph.durationMs), 0, 1);
  if (progress >= 1) return true;
  const collapse = easeInOut(clamp(progress / 0.58, 0, 1));
  const centerX = morph.rect.x + morph.rect.width / 2;
  const centerY = morph.rect.y + morph.rect.height / 2;
  const scale = 1 - collapse * 0.76;
  const width = morph.rect.width * scale;
  const height = morph.rect.height * scale;
  const assetAlpha = progress < 0.48 ? 1 : clamp((0.72 - progress) / 0.24, 0, 1);
  context.save();
  context.translate(centerX, centerY);
  context.rotate(collapse * 0.13);
  context.globalAlpha = assetAlpha;
  context.shadowColor = "rgba(53, 201, 242, .72)";
  context.shadowBlur = Math.max(10, Math.min(morph.rect.width, morph.rect.height) * 0.07);
  context.drawImage(morph.snapshot, -width / 2, -height / 2, width, height);
  context.restore();

  const symbolProgress = clamp((progress - 0.28) / 0.44, 0, 1);
  if (symbolProgress > 0) {
    const base = Math.min(morph.rect.width, morph.rect.height);
    const radius = base * (0.08 + Math.sin(symbolProgress * Math.PI) * 0.16);
    const alpha = Math.sin(symbolProgress * Math.PI);
    context.save();
    context.globalAlpha = alpha;
    context.shadowColor = "rgba(102, 224, 255, .95)";
    context.shadowBlur = base * 0.12;
    starPath(context, centerX, centerY, radius, radius * 0.46, progress * 1.8);
    context.fillStyle = "rgba(102, 224, 255, .92)";
    context.fill();
    context.strokeStyle = "rgba(178, 137, 255, .95)";
    context.lineWidth = Math.max(2, base * 0.012);
    context.stroke();
    context.restore();
  }

  const burst = clamp((progress - 0.46) / 0.54, 0, 1);
  if (burst > 0) {
    const base = Math.min(morph.rect.width, morph.rect.height);
    const fade = 1 - burst;
    for (let index = 0; index < 14; index += 1) {
      const angle = index / 14 * Math.PI * 2 + (index % 3) * 0.08;
      const travel = base * (0.12 + (index % 4) * 0.035) * easeInOut(burst);
      const x = centerX + Math.cos(angle) * travel;
      const y = centerY + Math.sin(angle) * travel;
      const radius = Math.max(2, base * (0.006 + (index % 3) * 0.0025) * fade);
      context.save();
      context.globalAlpha = fade;
      context.fillStyle = index % 3 === 0 ? "#b789ff" : index % 3 === 1 ? "#66e0ff" : "#fff4b0";
      context.shadowColor = context.fillStyle;
      context.shadowBlur = radius * 4;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
  return false;
}
