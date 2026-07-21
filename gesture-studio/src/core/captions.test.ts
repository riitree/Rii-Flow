import { describe, expect, it } from "vitest";
import { activeCaptionAt, CAPTION_FONTS, captionAnchorFromPoint, captionFontFamily, captionPresetAnchor, captionSegmentsFromText, DEFAULT_CAPTION_STYLE, drawCaption, groupCaptionWords, normalizeCaptionStyle } from "./captions";

describe("post-recording captions", () => {
  it("groups English word timestamps into short readable phrases", () => {
    const segments = groupCaptionWords([
      { text: "Hello", start: 0, end: 0.4 },
      { text: "creator", start: 0.4, end: 0.9 },
      { text: "friends.", start: 0.9, end: 1.3 },
      { text: "Welcome", start: 1.5, end: 1.9 },
      { text: "back", start: 1.9, end: 2.2 }
    ]);
    expect(segments.map((segment) => segment.text)).toEqual(["Hello creator friends.", "Welcome back"]);
    expect(activeCaptionAt(segments, 1)).toBe(segments[0]);
    expect(activeCaptionAt(segments, 1.4)).toBeNull();
  });

  it("creates evenly timed phrases when transcription has no word timestamps", () => {
    const segments = captionSegmentsFromText("This is a clean local caption fallback for creators.", 4.5);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.map((segment) => segment.text).join(" ")).toBe("This is a clean local caption fallback for creators.");
    expect(segments[0].start).toBe(0);
    expect(segments.at(-1)?.end).toBeCloseTo(4.5);
  });

  it("snaps freely placed captions to both centre guides", () => {
    expect(captionAnchorFromPoint(0.49, 0.512)).toEqual({ anchorX: 0.5, anchorY: 0.5, snapX: true, snapY: true });
    expect(captionAnchorFromPoint(0.72, 0.28)).toEqual({ anchorX: 0.72, anchorY: 0.28, snapX: false, snapY: false });
  });

  it("migrates saved caption styles and preserves preset anchors", () => {
    expect(normalizeCaptionStyle({ position: "top" }).anchorY).toBe(0.16);
    expect(captionPresetAnchor("center")).toEqual({ anchorX: 0.5, anchorY: 0.5 });
    expect(normalizeCaptionStyle({ position: "custom", anchorX: 2, anchorY: -1 })).toMatchObject({ anchorX: 0.96, anchorY: 0.06 });
    expect(normalizeCaptionStyle({ fontScale: 5 }).fontScale).toBe(2);
    expect(normalizeCaptionStyle({ font: "impact" }).font).toBe("impact");
    expect(CAPTION_FONTS).toHaveLength(5);
    expect(captionFontFamily("impact")).toContain("Impact");
  });

  it("draws the final recording caption at the same normalized preview anchor", () => {
    const positions: Array<{ x: number; y: number }> = [];
    const context = {
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      roundRect: () => undefined,
      fill: () => undefined,
      measureText: () => ({ width: 100 }),
      fillText: (_text: string, x: number, y: number) => positions.push({ x, y })
    } as unknown as CanvasRenderingContext2D;
    drawCaption(context, 1000, 600, { id: "one", text: "Creator caption", start: 0, end: 1 }, {
      ...DEFAULT_CAPTION_STYLE,
      position: "custom",
      anchorX: 0.25,
      anchorY: 0.3
    });
    expect(positions).toEqual([{ x: 250, y: 180 }]);
  });
});
