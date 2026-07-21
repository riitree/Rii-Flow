import type { Landmark } from "./gesture";

export interface PinchObservation {
  present: boolean;
  confidence: number;
  point: { x: number; y: number } | null;
}

const distance = (left: Landmark, right: Landmark) => Math.hypot(left.x - right.x, left.y - right.y, (left.z ?? 0) - (right.z ?? 0));

export function observePinch(landmarks: readonly Landmark[]): PinchObservation {
  if (landmarks.length < 21) return { present: false, confidence: 0, point: null };
  const thumb = landmarks[4];
  const index = landmarks[8];
  const palmScale = Math.max(distance(landmarks[5], landmarks[17]), distance(landmarks[0], landmarks[9]), 0.035);
  const ratio = distance(thumb, index) / palmScale;
  // Real webcam landmarks rarely let both tips overlap perfectly. A slightly
  // wider normalized capture zone makes an ordinary comfortable pinch work,
  // while the short hold and release latch still reject fly-by contact.
  const confidence = Math.max(0, Math.min(1, (0.56 - ratio) / 0.28));
  return {
    present: ratio <= 0.38,
    confidence,
    point: { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 }
  };
}

export class PinchConfirmTracker {
  private latched = false;
  private releaseSince = 0;

  reset() {
    this.latched = false;
    this.releaseSince = 0;
  }

  update(present: boolean, confidence: number, now: number) {
    const accepted = present && confidence >= 0.58;
    if (!accepted) {
      if (this.latched) {
        if (!this.releaseSince) this.releaseSince = now;
        if (now - this.releaseSince >= 160) this.reset();
      }
      return { confirm: false, progress: 0, latched: this.latched };
    }
    this.releaseSince = 0;
    if (this.latched) return { confirm: false, progress: 1, latched: true };
    // Speech has already selected the safe action, so waiting for multiple
    // inference frames only makes confirmation feel broken. Confirm on the
    // first confident frame and keep the release latch to prevent repeats.
    this.latched = true;
    return { confirm: true, progress: 1, latched: true };
  }
}
