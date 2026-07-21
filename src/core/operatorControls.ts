export interface OperatorShelfItem {
  id: string;
  kind: "asset" | "scene";
  name: string;
  triggerWord: string;
}

export interface OperatorShelfRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MAX_OPERATOR_SHELF_ITEMS = 8;

/** Normalized screen geometry shared by the DOM shelf and fingertip hit test. */
export function operatorShelfRects(items: readonly OperatorShelfItem[], portrait = false): OperatorShelfRect[] {
  const visible = items.slice(0, MAX_OPERATOR_SHELF_ITEMS);
  const columns = portrait ? 2 : Math.min(4, Math.max(1, visible.length));
  const rows = Math.ceil(visible.length / columns);
  const panel = portrait
    ? { x: 0.075, y: 0.37, width: 0.85, height: 0.53 }
    : { x: 0.055, y: 0.59, width: 0.89, height: 0.34 };
  const gapX = portrait ? 0.024 : 0.016;
  const gapY = portrait ? 0.02 : 0.026;
  const width = (panel.width - gapX * (columns - 1)) / columns;
  const height = (panel.height - gapY * Math.max(0, rows - 1)) / Math.max(1, rows);
  return visible.map((item, index) => ({
    id: item.id,
    x: panel.x + (index % columns) * (width + gapX),
    y: panel.y + Math.floor(index / columns) * (height + gapY),
    width,
    height
  }));
}

export function operatorShelfTargetAt(rects: readonly OperatorShelfRect[], point: { x: number; y: number }) {
  return rects.find((rect) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height)?.id ?? null;
}

export class PalmCommandTracker {
  private since = 0;
  private latched = false;
  private releaseSince = 0;

  constructor(private readonly releaseGraceMs = 300) {}

  reset() {
    this.since = 0;
    this.latched = false;
    this.releaseSince = 0;
  }

  update(present: boolean, now: number, holdMs: number) {
    if (!present) {
      if (this.latched) {
        if (!this.releaseSince) this.releaseSince = now;
        if (now - this.releaseSince >= this.releaseGraceMs) this.reset();
      } else {
        this.since = 0;
        this.releaseSince = 0;
      }
      return { progress: 0, trigger: false };
    }
    this.releaseSince = 0;
    if (this.latched) return { progress: 1, trigger: false };
    if (!this.since) {
      this.since = now;
      return { progress: 0, trigger: false };
    }
    const progress = Math.min(1, (now - this.since) / Math.max(1, holdMs));
    if (progress < 1) return { progress, trigger: false };
    this.latched = true;
    return { progress: 1, trigger: true };
  }
}
