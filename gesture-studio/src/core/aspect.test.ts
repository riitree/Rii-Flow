import { describe, expect, it } from "vitest";
import { canvasDimensions, coverSourceCrop } from "./aspect";

describe("canvas aspect geometry", () => {
  it("maps a granted 1080p signal to horizontal and vertical recording canvases", () => {
    expect(canvasDimensions(1920, 1080, "landscape")).toEqual({ width: 1920, height: 1080 });
    expect(canvasDimensions(1920, 1080, "portrait")).toEqual({ width: 1080, height: 1920 });
  });

  it("maps a granted 4K signal to a 2160 by 3840 vertical canvas", () => {
    expect(canvasDimensions(3840, 2160, "portrait")).toEqual({ width: 2160, height: 3840 });
  });

  it("center-crops without distorting horizontal or vertical output", () => {
    expect(coverSourceCrop(1920, 1080, 1080, 1920)).toEqual({ x: 656.25, y: 0, width: 607.5, height: 1080 });
    expect(coverSourceCrop(1920, 1080, 1920, 1080)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
});
