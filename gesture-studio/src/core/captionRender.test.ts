import { describe, expect, it } from "vitest";
import { captionedFileName, editedFileName, normalizeRenderRange } from "./captionRender";

describe("captioned take rendering", () => {
  it("creates an unambiguous captioned MP4 name", () => {
    expect(captionedFileName("Creator Take 01.mp4")).toBe("Creator Take 01-captioned.mp4");
  });

  it("names trim-only and combined edits clearly", () => {
    expect(editedFileName("Take.mp4", { captions: false, trimmed: true })).toBe("Take-trimmed.mp4");
    expect(editedFileName("Take.mp4", { captions: true, trimmed: true })).toBe("Take-edited.mp4");
    expect(editedFileName("Take.mp4", { captions: false, trimmed: false, wordCues: true })).toBe("Take-animated.mp4");
  });

  it("normalizes a safe render range inside the source duration", () => {
    expect(normalizeRenderRange(20, 3, 12)).toEqual({ start: 3, end: 12, duration: 9 });
    expect(normalizeRenderRange(20, -4, 30)).toEqual({ start: 0, end: 20, duration: 20 });
  });
});
