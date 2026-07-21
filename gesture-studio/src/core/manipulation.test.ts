import { describe, expect, it } from "vitest";
import type { Landmark } from "./gesture";
import { ManipulationTracker, mapControlPointForMirror, mapPointForMovementReach, palmControlPoint, PalmSignalTracker, type ControlPoint } from "./manipulation";

const point = (x: number, y: number): ControlPoint => ({ x, y });
const target = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
const transform = { x: 0.5, y: 0.5, scale: 1 };

function openPalmLandmarks(): Landmark[] {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  landmarks[0] = { x: 0.5, y: 0.8 };
  landmarks[5] = { x: 0.35, y: 0.55 };
  landmarks[9] = { x: 0.5, y: 0.45 };
  landmarks[17] = { x: 0.65, y: 0.55 };
  landmarks[4] = { x: 0.22, y: 0.42 };
  landmarks[8] = { x: 0.36, y: 0.22 };
  return landmarks;
}

describe("open-palm manipulation", () => {
  it("uses the stable center of the palm", () => {
    expect(palmControlPoint(openPalmLandmarks())).toMatchObject({ x: 0.5 });
  });

  it("maps palm movement into mirrored camera coordinates", () => {
    expect(mapControlPointForMirror(point(0.2, 0.6), true)).toEqual({ x: 0.8, y: 0.6 });
    expect(mapControlPointForMirror(point(0.2, 0.6), false)).toEqual({ x: 0.2, y: 0.6 });
  });

  it("maps a comfortable central workspace across the complete stage", () => {
    const centre = mapPointForMovementReach(point(0.5, 0.5), "comfort", "landscape");
    expect(centre.x).toBeCloseTo(0.5);
    expect(centre.y).toBeCloseTo(0.5);
    expect(mapPointForMovementReach(point(0.18, 0.16), "comfort", "landscape")).toEqual(point(0, 0));
    expect(mapPointForMovementReach(point(0.82, 0.84), "comfort", "landscape")).toEqual(point(1, 1));
    expect(mapPointForMovementReach(point(0.16, 0.18), "comfort", "portrait")).toEqual(point(0, 0));
    expect(mapPointForMovementReach(point(0.84, 0.82), "comfort", "portrait")).toEqual(point(1, 1));
    expect(mapPointForMovementReach(point(0.2, 0.7), "direct", "landscape")).toEqual(point(0.2, 0.7));
  });

  it("smooths jitter per hand identity and limits one-frame jumps", () => {
    const tracker = new PalmSignalTracker();
    expect(tracker.update([{ id: "left", point: point(0.5, 0.5) }], 0)[0]).toEqual(point(0.5, 0.5));
    const jittered = tracker.update([{ id: "left", point: point(0.51, 0.49) }], 70)[0];
    expect(jittered.x).toBeGreaterThan(0.505);
    expect(jittered.x).toBeLessThan(0.508);
    const jumped = tracker.update([{ id: "left", point: point(0.95, 0.1) }], 140)[0];
    expect(Math.hypot(jumped.x - jittered.x, jumped.y - jittered.y)).toBeLessThan(0.16);
  });

  it("requires a stable palm over the asset before dragging", () => {
    const tracker = new ManipulationTracker({ armMs: 300, releaseGraceMs: 120, hitPadding: 0.02 });
    expect(tracker.update([point(0.5, 0.5)], 0, target, transform).mode).toBe("arming-drag");
    expect(tracker.update([point(0.5, 0.5)], 250, target, transform).mode).toBe("arming-drag");
    expect(tracker.update([point(0.5, 0.5)], 310, target, transform).mode).toBe("dragging");
    const moved = tracker.update([point(0.65, 0.6)], 360, target, transform).transform;
    expect(moved?.x).toBeCloseTo(0.65);
    expect(moved?.y).toBeCloseTo(0.6);
    expect(moved?.scale).toBe(1);
  });

  it("uses comfort-space points for edge acquisition and faster drag travel", () => {
    const tracker = new ManipulationTracker({ armMs: 300, releaseGraceMs: 120, hitPadding: 0.02 });
    const edgeTarget = { x: 0.82, y: 0.08, width: 0.16, height: 0.28 };
    const startRaw = point(0.75, 0.3);
    const startStage = mapPointForMovementReach(startRaw, "comfort", "landscape");
    const edgeTransform = { x: 0.9, y: 0.22, scale: 1 };
    expect(tracker.update([startRaw], 0, edgeTarget, edgeTransform, [startStage]).mode).toBe("arming-drag");
    expect(tracker.update([startRaw], 310, edgeTarget, edgeTransform, [startStage]).mode).toBe("dragging");
    const movedRaw = point(0.78, 0.3);
    const movedStage = mapPointForMovementReach(movedRaw, "comfort", "landscape");
    const moved = tracker.update([movedRaw], 360, edgeTarget, edgeTransform, [movedStage]).transform;
    expect(moved!.x - edgeTransform.x).toBeGreaterThan(movedRaw.x - startRaw.x);
    expect(moved?.y).toBeCloseTo(edgeTransform.y);
  });

  it("still grabs when the physical palm is directly behind an asset", () => {
    const tracker = new ManipulationTracker({ armMs: 300, releaseGraceMs: 120, hitPadding: 0.02 });
    const edgeTarget = { x: 0.76, y: 0.35, width: 0.16, height: 0.3 };
    const directPalm = point(0.84, 0.5);
    const comfortPalm = mapPointForMovementReach(directPalm, "comfort", "landscape");
    expect(comfortPalm.x).toBeGreaterThan(edgeTarget.x + edgeTarget.width);
    expect(tracker.update([directPalm], 0, edgeTarget, { x: 0.84, y: 0.5, scale: 1 }, [comfortPalm], [directPalm]).mode).toBe("arming-drag");
    expect(tracker.update([directPalm], 310, edgeTarget, { x: 0.84, y: 0.5, scale: 1 }, [comfortPalm], [directPalm]).mode).toBe("dragging");
  });

  it("allows an open palm outside the asset without grabbing it", () => {
    const tracker = new ManipulationTracker({ armMs: 300, releaseGraceMs: 120, hitPadding: 0.02 });
    expect(tracker.update([point(0.05, 0.05)], 0, target, transform)).toMatchObject({
      mode: "idle",
      suppressActivation: false
    });
  });

  it("requires two stable palms and scales from their distance", () => {
    const tracker = new ManipulationTracker({ armMs: 300, releaseGraceMs: 120, hitPadding: 0.02 });
    const start = [point(0.35, 0.5), point(0.65, 0.5)];
    expect(tracker.update(start, 0, target, transform).mode).toBe("arming-scale");
    expect(tracker.update(start, 310, target, transform).mode).toBe("scaling");
    const result = tracker.update([point(0.2, 0.5), point(0.8, 0.5)], 360, target, transform);
    expect(result.transform?.scale).toBeCloseTo(2);
    expect(result.transform?.x).toBeCloseTo(0.5);
  });

  it("preserves the previous two-palm resize sensitivity in comfort mode", () => {
    const tracker = new ManipulationTracker({ armMs: 300, releaseGraceMs: 120, hitPadding: 0.02 });
    const start = [point(0.35, 0.5), point(0.65, 0.5)];
    const startStage = start.map((item) => mapPointForMovementReach(item, "comfort", "landscape"));
    tracker.update(start, 0, target, transform, startStage);
    expect(tracker.update(start, 310, target, transform, startStage).mode).toBe("scaling");
    const end = [point(0.2, 0.5), point(0.8, 0.5)];
    const endStage = end.map((item) => mapPointForMovementReach(item, "comfort", "landscape"));
    const result = tracker.update(end, 360, target, transform, endStage);
    expect(result.transform?.scale).toBeCloseTo(2);
  });

  it("shrinks media when two open palms move closer together", () => {
    const tracker = new ManipulationTracker({ armMs: 300, releaseGraceMs: 120, hitPadding: 0.02 });
    const start = [point(0.2, 0.5), point(0.8, 0.5)];
    tracker.update(start, 0, target, transform);
    expect(tracker.update(start, 310, target, transform).mode).toBe("scaling");
    const result = tracker.update([point(0.35, 0.5), point(0.65, 0.5)], 360, target, transform);
    expect(result.transform?.scale).toBeCloseTo(0.5);
  });

  it("lets one hand anchor a small asset while the second hand scales outside it", () => {
    const tracker = new ManipulationTracker({ armMs: 300, releaseGraceMs: 120, hitPadding: 0.02 });
    const smallTarget = { x: 0.72, y: 0.08, width: 0.22, height: 0.18 };
    const start = [point(0.82, 0.16), point(0.45, 0.55)];

    expect(tracker.update(start, 0, smallTarget, transform).mode).toBe("arming-scale");
    expect(tracker.update(start, 310, smallTarget, transform).mode).toBe("scaling");
    const result = tracker.update([point(0.88, 0.12), point(0.28, 0.68)], 360, smallTarget, transform);
    expect(result.transform?.scale).toBeGreaterThan(1.4);
  });

  it("can transition from a one-hand drag into two-hand scaling", () => {
    const tracker = new ManipulationTracker({ armMs: 300, releaseGraceMs: 120, hitPadding: 0.02 });
    tracker.update([point(0.5, 0.5)], 0, target, transform);
    expect(tracker.update([point(0.5, 0.5)], 310, target, transform).mode).toBe("dragging");
    expect(tracker.update([point(0.5, 0.5), point(0.9, 0.5)], 360, target, transform).mode).toBe("arming-scale");
    expect(tracker.update([point(0.5, 0.5), point(0.9, 0.5)], 670, target, transform).mode).toBe("scaling");
  });
});
