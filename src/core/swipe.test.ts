import { describe, expect, it } from "vitest";
import { SwipeTracker } from "./swipe";

describe("one-palm scene swipe", () => {
  it("maps a fast horizontal swipe and latches until release", () => {
    const tracker = new SwipeTracker();
    expect(tracker.update({ x: 0.7, y: 0.5 }, 0)).toBeNull();
    expect(tracker.update({ x: 0.47, y: 0.52 }, 130)).toBe("left");
    expect(tracker.update({ x: 0.2, y: 0.51 }, 220)).toBeNull();
    tracker.update(null, 300);
    expect(tracker.update({ x: 0.25, y: 0.5 }, 1_100)).toBeNull();
    expect(tracker.update({ x: 0.5, y: 0.49 }, 1_230)).toBe("right");
  });

  it("rejects slow movement and diagonal arm travel", () => {
    const slow = new SwipeTracker();
    slow.update({ x: 0.75, y: 0.5 }, 0);
    expect(slow.update({ x: 0.5, y: 0.5 }, 600)).toBeNull();
    const diagonal = new SwipeTracker();
    diagonal.update({ x: 0.75, y: 0.25 }, 0);
    expect(diagonal.update({ x: 0.5, y: 0.55 }, 140)).toBeNull();
  });
});
