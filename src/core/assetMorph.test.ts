import { describe, expect, it } from "vitest";
import { CircleMorphTracker } from "./assetMorph";

describe("circle morph gesture", () => {
  it("triggers after one deliberate fingertip orbit", () => {
    const tracker = new CircleMorphTracker();
    let trigger: string | undefined;
    for (let index = 0; index <= 18; index += 1) {
      const angle = index / 18 * Math.PI * 2;
      const update = tracker.update("asset-a", { x: 0.5 + Math.cos(angle) * 0.08, y: 0.5 + Math.sin(angle) * 0.08 }, index * 70);
      trigger = trigger ?? update.trigger;
    }
    expect(trigger).toBe("asset-a");
  });

  it("does not trigger for a straight swipe", () => {
    const tracker = new CircleMorphTracker();
    let trigger: string | undefined;
    for (let index = 0; index < 18; index += 1) {
      trigger = trigger ?? tracker.update("asset-a", { x: 0.2 + index * 0.02, y: 0.5 }, index * 70).trigger;
    }
    expect(trigger).toBeUndefined();
  });

  it("does not trigger from ordinary fingertip jitter", () => {
    const tracker = new CircleMorphTracker();
    let trigger: string | undefined;
    for (let index = 0; index < 24; index += 1) {
      trigger = trigger ?? tracker.update("asset-a", { x: 0.5 + (index % 2) * 0.003, y: 0.5 }, index * 70).trigger;
    }
    expect(trigger).toBeUndefined();
  });

  it("resets its path when focus moves to another asset", () => {
    const tracker = new CircleMorphTracker();
    tracker.update("asset-a", { x: 0.5, y: 0.4 }, 0);
    expect(tracker.update("asset-b", { x: 0.6, y: 0.5 }, 100).progress).toBe(0);
  });
});
