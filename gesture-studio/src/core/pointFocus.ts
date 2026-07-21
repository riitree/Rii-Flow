export interface PointFocusUpdate {
  targetId: string | null;
  progress: number;
  activate?: string;
}

/** Converts a stabilized pointing pose into one deliberate focus selection. */
export class PointFocusTracker {
  private candidate: string | null = null;
  private since = 0;
  private latched: string | null = null;

  constructor(private dwellMs = 120) {}

  reset() {
    this.candidate = null;
    this.latched = null;
    this.since = 0;
  }

  update(targetId: string | null, now: number): PointFocusUpdate {
    if (!targetId) {
      this.candidate = null;
      this.latched = null;
      return { targetId: null, progress: 0 };
    }
    if (targetId !== this.candidate) {
      this.candidate = targetId;
      this.since = now;
      if (targetId !== this.latched) this.latched = null;
      return { targetId, progress: 0 };
    }
    if (this.latched === targetId) return { targetId, progress: 1 };
    const progress = Math.min(1, Math.max(0, (now - this.since) / Math.max(1, this.dwellMs)));
    if (progress < 1) return { targetId, progress };
    this.latched = targetId;
    return { targetId, progress: 1, activate: targetId };
  }
}
