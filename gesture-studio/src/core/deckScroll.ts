export type DeckAxis = "x" | "y";

export interface DeckScrollFrame {
  offset: number;
  moving: boolean;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/** Continuous, gesture-driven filmstrip motion measured in card units. */
export class DeckScrollController {
  private offset = 0;
  private target = 0;
  private velocity = 0;
  private lastPoint: number | null = null;
  private lastAt = 0;
  private dragging = false;
  private frameAt = 0;

  value() { return this.offset; }

  reset(offset = 0) {
    this.offset = Math.max(0, offset);
    this.target = this.offset;
    this.velocity = 0;
    this.lastPoint = null;
    this.lastAt = 0;
    this.dragging = false;
    this.frameAt = 0;
  }

  drag(point: number, now: number, maximumOffset: number): DeckScrollFrame {
    if (this.lastPoint === null || !this.dragging) {
      this.lastPoint = point;
      this.lastAt = now;
      this.dragging = true;
      this.velocity = 0;
      this.offset = clamp(this.offset, 0, maximumOffset);
      this.target = this.offset;
      return { offset: this.offset, moving: false };
    }
    const elapsed = Math.max(8, now - this.lastAt);
    // Roughly 8% of the camera frame equals one card of travel. A deliberate
    // flick should throw the belt immediately rather than trail the hand.
    // hand toward the start reveals earlier cards; moving away reveals later.
    const rawDeltaCards = -(point - this.lastPoint) / 0.08;
    // Reject tiny landmark chatter and cap a single inference spike. The
    // remaining motion is interpolated by the canvas loop.
    const deltaCards = Math.abs(rawDeltaCards) < 0.012
      ? 0
      : clamp(rawDeltaCards, -2.1, 2.1);
    this.target = clamp(this.target + deltaCards, 0, maximumOffset);
    const instantaneous = deltaCards / elapsed;
    this.velocity = this.velocity * 0.45 + instantaneous * 0.55;
    if (this.target === 0 || this.target === maximumOffset) this.velocity *= 0.25;
    this.lastPoint = point;
    this.lastAt = now;
    // Input frames update the target; render frames interpolate the belt.
    this.offset += (this.target - this.offset) * 0.84;
    return { offset: this.offset, moving: Math.abs(deltaCards) > 0.002 };
  }

  release(now: number, maximumOffset: number): DeckScrollFrame {
    if (this.dragging) {
      this.dragging = false;
      this.lastPoint = null;
      this.lastAt = now;
      return { offset: this.offset, moving: Math.abs(this.velocity) > 0.00008 };
    }
    if (!this.lastAt) this.lastAt = now;
    const elapsed = Math.min(48, Math.max(0, now - this.lastAt));
    this.lastAt = now;
    this.target = clamp(this.target + this.velocity * elapsed, 0, maximumOffset);
    this.offset += (this.target - this.offset) * 0.42;
    this.velocity *= Math.pow(0.935, elapsed / 16.67);
    if (this.offset === 0 || this.offset === maximumOffset || Math.abs(this.velocity) < 0.00008) this.velocity = 0;
    return { offset: this.offset, moving: this.velocity !== 0 };
  }

  /** Called by the canvas loop so motion stays fluid between gesture frames. */
  frame(now: number, maximumOffset: number): DeckScrollFrame {
    const elapsed = this.frameAt ? Math.min(40, Math.max(0, now - this.frameAt)) : 16.67;
    this.frameAt = now;
    if (!this.dragging && this.velocity) {
      this.target = clamp(this.target + this.velocity * elapsed, 0, maximumOffset);
      this.velocity *= Math.pow(0.935, elapsed / 16.67);
      if (this.target === 0 || this.target === maximumOffset || Math.abs(this.velocity) < 0.00008) this.velocity = 0;
    }
    const alpha = 1 - Math.exp(-elapsed / (this.dragging ? 20 : 34));
    this.offset = clamp(this.offset + (this.target - this.offset) * alpha, 0, maximumOffset);
    return { offset: this.offset, moving: Math.abs(this.target - this.offset) > 0.0005 || this.velocity !== 0 };
  }
}
