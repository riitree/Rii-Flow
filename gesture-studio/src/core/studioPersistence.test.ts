import { describe, expect, it } from "vitest";
import { defaultTakeName, safeFileBase, takeFileName } from "./studioPersistence";

describe("studio persistence helpers", () => {
  it("creates filesystem-safe MP4 names without hiding the chosen title", () => {
    expect(takeFileName('Launch: Demo / Final*')).toBe("Launch Demo Final.mp4");
    expect(safeFileBase("   ")).toBe("Rii-Flow Take");
  });

  it("increments human-readable take names", () => {
    expect(defaultTakeName("Product Demo", 4)).toBe("Product Demo — Take 04");
  });
});
