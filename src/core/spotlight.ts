import type { Rect } from "./compositor";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const snapshots = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

function snapshotCanvas(source: HTMLCanvasElement) {
  let snapshot = snapshots.get(source);
  if (!snapshot) {
    snapshot = document.createElement("canvas");
    snapshots.set(source, snapshot);
  }
  return snapshot;
}

/** Dims only the area outside the target. No frame copies or extra media
 * decoding are required, so spotlight adds a few rectangle draws per frame. */
export function drawStageSpotlight(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  rect: Rect,
  progress: number
) {
  const eased = Math.pow(clamp(progress), 0.72);
  if (eased <= 0.03) return;
  const padding = Math.min(canvas.width, canvas.height) * 0.016;
  const canLift = rect.width * rect.height <= canvas.width * canvas.height * 0.38 && eased >= 0.38;
  const lift = canLift ? 1 + 0.055 * eased : 1;
  const liftedWidth = rect.width * lift;
  const liftedHeight = rect.height * lift;
  const liftedX = Math.max(0, Math.min(canvas.width - liftedWidth, rect.x + rect.width / 2 - liftedWidth / 2));
  const liftedY = Math.max(0, Math.min(canvas.height - liftedHeight, rect.y + rect.height / 2 - liftedHeight / 2));
  const x = Math.max(0, liftedX - padding);
  const y = Math.max(0, liftedY - padding);
  const right = Math.min(canvas.width, liftedX + liftedWidth + padding);
  const bottom = Math.min(canvas.height, liftedY + liftedHeight + padding);
  let snapshot: HTMLCanvasElement | null = null;
  if (canLift) {
    const scale = Math.min(1, 960 / Math.max(1, rect.width), 640 / Math.max(1, rect.height));
    snapshot = snapshotCanvas(canvas);
    const snapshotWidth = Math.max(1, Math.round(rect.width * scale));
    const snapshotHeight = Math.max(1, Math.round(rect.height * scale));
    if (snapshot.width !== snapshotWidth) snapshot.width = snapshotWidth;
    if (snapshot.height !== snapshotHeight) snapshot.height = snapshotHeight;
    snapshot.getContext("2d")?.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, snapshot.width, snapshot.height);
  }
  context.save();
  context.fillStyle = `rgba(3, 8, 18, ${0.43 * eased})`;
  context.fillRect(0, 0, canvas.width, y);
  context.fillRect(0, bottom, canvas.width, canvas.height - bottom);
  context.fillRect(0, y, x, bottom - y);
  context.fillRect(right, y, canvas.width - right, bottom - y);
  if (snapshot) context.drawImage(snapshot, liftedX, liftedY, liftedWidth, liftedHeight);
  context.globalAlpha = eased;
  context.strokeStyle = "rgba(77, 210, 255, .96)";
  context.lineWidth = Math.max(2, Math.min(canvas.width, canvas.height) * 0.0032);
  context.shadowColor = "rgba(77, 210, 255, .78)";
  context.shadowBlur = Math.min(canvas.width, canvas.height) * 0.025;
  context.strokeRect(x, y, right - x, bottom - y);
  context.restore();
}
