import { describe, expect, it } from "vitest";
import { fitImageCropToAspect, hasVideoTrim, imageCropSourceRect, moveImageCrop, normalizeImageCrop, normalizeVideoTrim, resizeImageCropFromCorner } from "./mediaEdits";

describe("non-destructive media edits", () => {
  it("creates fixed-ratio crops in normalized image space", () => {
    const square = fitImageCropToAspect("1:1", 1600, 900);
    expect(square).toEqual({ aspect: "1:1", x: 0.21875, y: 0, width: 0.5625, height: 1 });
    expect(imageCropSourceRect(1600, 900, square)).toEqual({ x: 350, y: 0, width: 900, height: 900 });
  });

  it("supports freely sized and positioned crop rectangles", () => {
    expect(imageCropSourceRect(1200, 800, { aspect: "free", x: 0.1, y: 0.2, width: 0.55, height: 0.4 })).toEqual({
      x: 120,
      y: 160,
      width: 660,
      height: 320
    });
  });

  it("moves crops without allowing them outside the image", () => {
    const crop = { aspect: "free" as const, x: 0.2, y: 0.25, width: 0.5, height: 0.4 };
    expect(moveImageCrop(crop, 0.8, -0.8)).toEqual({ ...crop, x: 0.5, y: 0 });
  });

  it("resizes free crops independently from every corner", () => {
    const crop = { aspect: "free" as const, x: 0.2, y: 0.2, width: 0.5, height: 0.5 };
    const resized = resizeImageCropFromCorner(crop, "top-left", 0.1, 0.05, 1000, 1000);
    expect(resized.aspect).toBe("free");
    expect(resized.x).toBeCloseTo(0.1);
    expect(resized.y).toBeCloseTo(0.05);
    expect(resized.width).toBeCloseTo(0.6);
    expect(resized.height).toBeCloseTo(0.65);
  });

  it("keeps fixed ratios while a corner is dragged", () => {
    const crop = fitImageCropToAspect("16:9", 1600, 900, { aspect: "free", x: 0.2, y: 0.2, width: 0.6, height: 0.6 });
    const resized = resizeImageCropFromCorner(crop, "bottom-right", 0.95, 0.95, 1600, 900);
    expect(resized.width / resized.height).toBeCloseTo(1, 6);
  });

  it("migrates legacy focal crops and leaves an uncropped image untouched", () => {
    expect(normalizeImageCrop({ aspect: "4:5", focusX: 0, focusY: 1 }, 1000, 1000)).toEqual({ aspect: "free", x: 0, y: 0, width: 0.8, height: 1 });
    expect(imageCropSourceRect(640, 480)).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });

  it("keeps trim ranges valid and at least a quarter-second long", () => {
    expect(normalizeVideoTrim({ start: -2, end: 20 }, 10)).toEqual({ start: 0, end: 10 });
    expect(normalizeVideoTrim({ start: 9.9, end: 9.95 }, 10)).toEqual({ start: 9.75, end: 10 });
    expect(hasVideoTrim({ start: 1, end: 9 }, 10)).toBe(true);
    expect(hasVideoTrim({ start: 0, end: 10 }, 10)).toBe(false);
  });
});
