import { describe, expect, it } from "vitest";
import type { Landmark } from "./gesture";
import { observePinch, PinchConfirmTracker } from "./pinch";

function hand(pinched: boolean) {
  const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  points[0] = { x: 0.5, y: 0.8 };
  points[5] = { x: 0.38, y: 0.56 };
  points[9] = { x: 0.5, y: 0.5 };
  points[17] = { x: 0.66, y: 0.58 };
  points[4] = { x: pinched ? 0.48 : 0.3, y: 0.32 };
  points[8] = { x: 0.5, y: 0.31 };
  return points;
}

describe("pinch confirmation", () => {
  it("normalizes fingertip distance by hand size", () => {
    expect(observePinch(hand(true)).present).toBe(true);
    expect(observePinch(hand(false)).present).toBe(false);
  });

  it("accepts a comfortable near-touch instead of requiring perfect overlap", () => {
    const points = hand(true);
    points[4] = { x: 0.405, y: 0.31 };
    expect(observePinch(points).present).toBe(true);
    expect(observePinch(points).confidence).toBeGreaterThan(0.58);
  });

  it("confirms on the first confident frame and stays latched until release", () => {
    const tracker = new PinchConfirmTracker();
    expect(tracker.update(true, 0.9, 0).confirm).toBe(true);
    expect(tracker.update(true, 0.9, 300).confirm).toBe(false);
    tracker.update(false, 0, 400);
    tracker.update(false, 0, 570);
    expect(tracker.update(true, 0.9, 600).confirm).toBe(true);
  });
});
