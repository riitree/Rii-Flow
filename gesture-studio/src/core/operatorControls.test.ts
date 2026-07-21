import { describe, expect, it } from "vitest";
import { MAX_OPERATOR_SHELF_ITEMS, operatorShelfRects, operatorShelfTargetAt, PalmCommandTracker } from "./operatorControls";

describe("operator shelf", () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}`, kind: "asset" as const, name: `Item ${index}`, triggerWord: `item ${index}` }));

  it("keeps the visual shelf bounded and caps cognitive load", () => {
    const rects = operatorShelfRects(items, false);
    expect(rects).toHaveLength(MAX_OPERATOR_SHELF_ITEMS);
    rects.forEach((rect) => {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1);
    });
  });

  it("maps a fingertip to its exact card", () => {
    const rect = operatorShelfRects(items.slice(0, 3))[1];
    expect(operatorShelfTargetAt([rect], { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })).toBe("item-1");
  });
});

describe("palm command", () => {
  it("fires once per deliberate palm hold and rearms after release", () => {
    const tracker = new PalmCommandTracker();
    expect(tracker.update(true, 100, 200).trigger).toBe(false);
    expect(tracker.update(true, 310, 200).trigger).toBe(true);
    expect(tracker.update(true, 520, 200).trigger).toBe(false);
    tracker.update(false, 600, 200);
    tracker.update(false, 920, 200);
    tracker.update(true, 1_000, 200);
    expect(tracker.update(true, 1_220, 200).trigger).toBe(true);
  });

  it("does not rearm during a brief tracking dropout", () => {
    const tracker = new PalmCommandTracker();
    tracker.update(true, 100, 70);
    expect(tracker.update(true, 180, 70).trigger).toBe(true);
    tracker.update(false, 260, 70);
    tracker.update(true, 360, 70);
    expect(tracker.update(true, 700, 70).trigger).toBe(false);
  });
});
