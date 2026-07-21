import { describe, expect, it } from "vitest";
import { PointFocusTracker } from "./pointFocus";

describe("point-to-focus", () => {
  it("requires a short dwell and triggers once per continuous target", () => {
    const tracker = new PointFocusTracker(120);
    expect(tracker.update("scene:a", 0).progress).toBe(0);
    expect(tracker.update("scene:a", 119).activate).toBeUndefined();
    expect(tracker.update("scene:a", 120).activate).toBe("scene:a");
    expect(tracker.update("scene:a", 500).activate).toBeUndefined();
  });

  it("can focus another target without lowering the hand", () => {
    const tracker = new PointFocusTracker(100);
    tracker.update("scene:a", 0);
    tracker.update("scene:a", 100);
    tracker.update("scene:b", 110);
    expect(tracker.update("scene:b", 210).activate).toBe("scene:b");
  });

  it("allows the same target again after pointing away", () => {
    const tracker = new PointFocusTracker(100);
    tracker.update("scene:a", 0);
    tracker.update("scene:a", 100);
    tracker.update(null, 110);
    tracker.update("scene:a", 120);
    expect(tracker.update("scene:a", 220).activate).toBe("scene:a");
  });
});
