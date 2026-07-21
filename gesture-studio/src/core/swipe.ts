export interface SwipePoint { x: number; y: number }
export type SwipeDirection = "left" | "right";

/** Deliberate, one-palm horizontal swipe detector. It rejects slow travel,
 * large vertical arcs and repeat frames from a held hand. */
export class SwipeTracker {
  private start: { point: SwipePoint; at: number } | null = null;
  private latched = false;
  private cooldownUntil = 0;

  reset() {
    this.start = null;
    this.latched = false;
  }

  update(point: SwipePoint | null, now: number): SwipeDirection | null {
    if (!point) {
      this.start = null;
      this.latched = false;
      return null;
    }
    if (this.latched || now < this.cooldownUntil) return null;
    if (!this.start) {
      this.start = { point: { ...point }, at: now };
      return null;
    }
    const elapsed = now - this.start.at;
    if (elapsed > 460) {
      this.start = { point: { ...point }, at: now };
      return null;
    }
    const dx = point.x - this.start.point.x;
    const dy = point.y - this.start.point.y;
    if (elapsed < 80 || Math.abs(dx) < 0.2 || Math.abs(dy) > 0.13) return null;
    this.latched = true;
    this.cooldownUntil = now + 720;
    return dx < 0 ? "left" : "right";
  }
}
