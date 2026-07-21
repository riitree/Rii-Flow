import { describe, expect, it } from "vitest";
import { activeWordAnimationAt, buildWordAnimationCues, VoiceEmphasisTracker } from "./wordCues";

const segments = [
  { id: "one", text: "Today we launch something incredible", start: 0, end: 3 },
  { id: "two", text: "Here are three reasons", start: 4, end: 6.5 },
  { id: "three", text: "The result is faster", start: 8, end: 10 }
];

describe("word animation cues", () => {
  it("pairs microphone emphasis with a meaningful nearby word", () => {
    const cues = buildWordAnimationCues(segments, [{ id: "v1", time: 1.3, strength: 0.9 }], 10);
    expect(cues).toHaveLength(1);
    expect(["launch", "something", "incredible"]).toContain(cues[0].text.toLowerCase());
  });

  it("provides sparse automatic fallbacks for takes without live markers", () => {
    const cues = buildWordAnimationCues(segments, [], 45);
    expect(cues.length).toBeGreaterThanOrEqual(1);
    expect(cues.length).toBeLessThanOrEqual(3);
    expect(new Set(cues.map((cue) => cue.text.toLowerCase())).size).toBe(cues.length);
  });

  it("finds only the cue active at the current edit time", () => {
    const cue = buildWordAnimationCues(segments, [{ id: "v1", time: 4.8, strength: 1 }], 10)[0];
    expect(activeWordAnimationAt([cue], cue.start + 0.2)?.id).toBe(cue.id);
    expect(activeWordAnimationAt([cue], cue.end + 0.1)).toBeNull();
  });
});

describe("voice emphasis tracker", () => {
  it("requires a sustained microphone lift and applies a cooldown", () => {
    const tracker = new VoiceEmphasisTracker();
    tracker.update(0.03, 0);
    tracker.update(0.04, 400);
    expect(tracker.update(0.5, 900)).toBeNull();
    const marker = tracker.update(0.48, 1_100);
    expect(marker?.time).toBe(1.1);
    expect(tracker.update(0.5, 1_300)).toBeNull();
  });

  it("ignores normal room noise", () => {
    const tracker = new VoiceEmphasisTracker();
    for (let time = 0; time <= 3_000; time += 200) expect(tracker.update(0.04, time)).toBeNull();
  });
});
