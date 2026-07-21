import { describe, expect, it } from "vitest";
import { compositionImageSize } from "./imageOptimization";

describe("composition image optimization", () => {
  it("keeps recording-sized images untouched", () => {
    expect(compositionImageSize(3840, 2160)).toEqual({ width: 3840, height: 2160, optimized: false });
  });

  it("reduces oversized images without changing their ratio", () => {
    expect(compositionImageSize(8000, 4000)).toEqual({ width: 4096, height: 2048, optimized: true });
  });

  it("supports tall images used in vertical recordings", () => {
    expect(compositionImageSize(3000, 9000)).toEqual({ width: 1365, height: 4096, optimized: true });
  });
});
