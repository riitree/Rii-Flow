import { describe, expect, it } from "vitest";
import { normalizeVideoPlaybackMode, videoBoundaryAction } from "./videoPlayback";

describe("video playback", () => {
  const trim = { start: 2, end: 5 };

  it("preserves looping as the backwards-compatible default", () => {
    expect(normalizeVideoPlaybackMode(undefined)).toBe("loop");
    expect(normalizeVideoPlaybackMode("loop")).toBe("loop");
    expect(normalizeVideoPlaybackMode("once")).toBe("once");
  });

  it("restarts looping videos at their trim endpoint", () => {
    expect(videoBoundaryAction("loop", 4.9, trim, false)).toBe("none");
    expect(videoBoundaryAction("loop", 5, trim, false)).toBe("restart");
    expect(videoBoundaryAction("loop", 4.8, trim, true)).toBe("restart");
  });

  it("completes play-once videos instead of restarting them", () => {
    expect(videoBoundaryAction("once", 5, trim, false)).toBe("complete");
    expect(videoBoundaryAction("once", 4.8, trim, true)).toBe("complete");
  });

  it("repairs a playhead before the trim start in either mode", () => {
    expect(videoBoundaryAction("once", 1, trim, false)).toBe("restart");
  });
});
