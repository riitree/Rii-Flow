import { describe, expect, it } from "vitest";
import { compositionFrameBudget, compositionHealth, normalizedCompositionFps, shouldComposeFrame } from "./performance";

describe("studio performance scheduling", () => {
  it("caps composition at the granted recording rate", () => {
    expect(normalizedCompositionFps(30)).toBe(30);
    expect(normalizedCompositionFps(60)).toBe(60);
    expect(normalizedCompositionFps(120)).toBe(60);
    expect(compositionFrameBudget(30)).toBeCloseTo(33.333, 2);
  });

  it("does not compose duplicate display-refresh frames for 30 fps output", () => {
    expect(shouldComposeFrame(0, Number.NEGATIVE_INFINITY, 30)).toBe(true);
    expect(shouldComposeFrame(16.7, 0, 30)).toBe(false);
    expect(shouldComposeFrame(33.4, 0, 30)).toBe(true);
  });

  it("allows normal 60 fps requestAnimationFrame cadence", () => {
    expect(shouldComposeFrame(16.7, 0, 60)).toBe(true);
  });

  it("reports compositor cost against the frame budget", () => {
    expect(compositionHealth(30, 300, 1000, 30, 2)).toEqual({
      fps: 30,
      averageMs: 10,
      budgetPercent: 30,
      overBudgetFrames: 2
    });
  });
});
