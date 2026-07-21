import { describe, expect, it } from "vitest";
import { GESTURES } from "../types";
import { GestureGate, GestureStabilizer, matchesTriggerHand, MIN_GESTURE_HOLD_MS, resolveCompositeGesture, resolveGesture, type Landmark } from "./gesture";

function landmarks(extended: number[], thumbExtended = false) {
  const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.65 }));
  points[0] = { x: 0.5, y: 0.88 };
  [5, 9, 13, 17].forEach((index, finger) => {
    const x = 0.36 + finger * 0.09;
    points[index] = { x, y: 0.59 };
    points[index + 1] = { x, y: extended.includes(finger) ? 0.46 : 0.5 };
    points[index + 2] = { x: extended.includes(finger) ? x : x + 0.04, y: extended.includes(finger) ? 0.34 : 0.56 };
    points[index + 3] = { x: extended.includes(finger) ? x : x + 0.05, y: extended.includes(finger) ? 0.22 : 0.62 };
  });
  points[1] = { x: 0.43, y: 0.72 };
  points[2] = { x: 0.38, y: 0.66 };
  points[3] = thumbExtended ? { x: 0.3, y: 0.61 } : { x: 0.41, y: 0.63 };
  points[4] = thumbExtended ? { x: 0.2, y: 0.57 } : { x: 0.45, y: 0.64 };
  return points;
}

describe("gesture recognition rules", () => {
  it("maps Pointing_Up to one finger and Victory to two fingers", () => {
    expect(resolveGesture("Pointing_Up", 0.95).gesture).toBe("one");
    expect(resolveGesture("Victory", 0.92).gesture).toBe("two");
  });

  it("reserves Closed_Fist for hiding", () => {
    expect(resolveGesture("Closed_Fist", 0.86).gesture).toBe("fist");
  });

  it("filters activation gestures by the selected trigger hand", () => {
    expect(matchesTriggerHand("any", "Left")).toBe(true);
    expect(matchesTriggerHand("left", "Left")).toBe(true);
    expect(matchesTriggerHand("right", "Left")).toBe(false);
  });

  it("infers three and four fingers from the 21 hand landmarks", () => {
    expect(resolveGesture("None", 0.8, landmarks([0, 1, 2])).gesture).toBe("three");
    expect(resolveGesture("None", 0.8, landmarks([0, 1, 2, 3])).gesture).toBe("four");
  });

  it("keeps a confident MediaPipe Open_Palm result from being overridden by finger inference", () => {
    expect(resolveGesture("Open_Palm", 0.9, landmarks([0, 1, 2, 3])).gesture).toBe("palm");
    expect(GESTURES.some((gesture) => gesture.id === ("palm" as never))).toBe(false);
  });

  it("adds deliberate two-hand combinations without confusing their single-hand forms", () => {
    const victory = resolveGesture("Victory", 0.94, landmarks([0, 1]));
    const thumb = resolveGesture("Thumb_Up", 0.93, landmarks([], true));
    expect(resolveCompositeGesture([victory, victory])?.gesture).toBe("double-two");
    expect(resolveCompositeGesture([thumb, thumb])?.gesture).toBe("double-thumb");
    expect(resolveCompositeGesture([thumb, victory])?.gesture).toBe("thumb-two");
    expect(resolveCompositeGesture([victory])).toBeNull();
  });

  it("holds briefly, requires re-arm, and lets fist hide while unarmed", () => {
    const gate = new GestureGate({ holdMs: 400, cooldownMs: 800, rearmMs: 200 });
    gate.update("one", 0);
    expect(gate.update("one", 410).trigger).toBe("one");
    expect(gate.update("one", 500).trigger).toBeUndefined();
    expect(gate.update("fist", 520).hide).toBe(true);
  });

  it("never repeats while the originally triggered gesture remains held", () => {
    const gate = new GestureGate({ holdMs: 200, cooldownMs: 500, rearmMs: 300 });
    gate.update("one", 0);
    expect(gate.update("one", 200).trigger).toBe("one");
    expect(gate.update("one", 900).armed).toBe(false);
    expect(gate.update("one", 3000).trigger).toBeUndefined();
    expect(gate.update("one", 5000).armed).toBe(false);
  });

  it("does not count a post-activation suppression window as hand release", () => {
    const gate = new GestureGate({ holdMs: 200, cooldownMs: 500, rearmMs: 300 });
    gate.update("one", 0);
    expect(gate.update("one", 200).trigger).toBe("one");
    expect(gate.suppress().armed).toBe(false);
    expect(gate.suppress().armed).toBe(false);
    expect(gate.update("one", 1500).armed).toBe(false);
  });

  it("can re-arm through a deliberately held different gesture", () => {
    const gate = new GestureGate({ holdMs: 200, cooldownMs: 500, rearmMs: 300 });
    gate.update("one", 0);
    expect(gate.update("one", 200).trigger).toBe("one");
    expect(gate.update("two", 500).armed).toBe(false);
    expect(gate.update("two", 800).armed).toBe(true);
    expect(gate.update("two", 999).trigger).toBeUndefined();
    expect(gate.update("two", 1000).trigger).toBe("two");
  });

  it("supports a 150ms minimum hold without bypassing cooldown and re-arm", () => {
    const gate = new GestureGate({ holdMs: 50, cooldownMs: 300, rearmMs: 100 });
    gate.update("one", 0);
    expect(gate.update("one", MIN_GESTURE_HOLD_MS - 1).trigger).toBeUndefined();
    expect(gate.update("one", MIN_GESTURE_HOLD_MS).trigger).toBe("one");
    expect(gate.update("one", 200).trigger).toBeUndefined();

    expect(gate.update(null, 300).armed).toBe(false);
    expect(gate.update(null, 450).armed).toBe(true);
    gate.update("one", 451);
    expect(gate.update("one", 600).trigger).toBeUndefined();
    expect(gate.update("one", 601).trigger).toBe("one");
  });

  it("rejects a single noisy frame and stabilizes a repeated gesture", () => {
    const stabilizer = new GestureStabilizer();
    expect(stabilizer.update({ gesture: "one", confidence: 0.92 }, 0).gesture).toBeNull();
    expect(stabilizer.update({ gesture: "four", confidence: 0.8 }, 70).gesture).toBeNull();
    stabilizer.update({ gesture: "one", confidence: 0.9 }, 140);
    expect(stabilizer.update({ gesture: "one", confidence: 0.94 }, 210).gesture).toBeNull();
    expect(stabilizer.update({ gesture: "one", confidence: 0.95 }, 280).gesture).toBe("one");
  });

  it("does not turn neutral hand movement into an activation intent", () => {
    const stabilizer = new GestureStabilizer();
    [0, 70, 140, 210, 280].forEach((at) => {
      expect(stabilizer.update({ gesture: null, confidence: 0.2, quality: 0.9 }, at).gesture).toBeNull();
    });
  });

  it("requires two consecutive fist observations but keeps hide responsive", () => {
    const stabilizer = new GestureStabilizer();
    expect(stabilizer.update({ gesture: "fist", confidence: 0.95 }, 0).gesture).toBeNull();
    expect(stabilizer.update({ gesture: "fist", confidence: 0.96 }, 70).gesture).toBe("fist");
  });
});
