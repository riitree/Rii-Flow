import { describe, expect, it } from "vitest";
import { assetDeckCommandForGesture, assetDeckShouldRender } from "./assetDeck";

describe("asset deck commands", () => {
  it("uses the universal palm and fist vocabulary in command mode", () => {
    expect(assetDeckCommandForGesture("command", "palm")).toBe("show");
    expect(assetDeckCommandForGesture("command", "fist")).toBe("hide");
    expect(assetDeckCommandForGesture("command", "one")).toBeNull();
    expect(assetDeckCommandForGesture("always", "palm")).toBeNull();
  });

  it("keeps a focused visual visible even after the preview deck closes", () => {
    expect(assetDeckShouldRender(false, null)).toBe(false);
    expect(assetDeckShouldRender(false, "asset-a")).toBe(true);
  });
});
