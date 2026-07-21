import { describe, expect, it } from "vitest";
import { assetsForMainDock, MAX_STYLE_ASSETS, containStyleRect, pointNearStyleDeck, retainedStyleTransform, styleAssetAtPoint, styleAssetsWithFocus, styleFocusBaseRect, styleTransformBounds, styleUsesUniformPreviews, videoStyleLayout } from "./videoStyles";
import type { StudioAsset } from "../types";

describe("visual video styles", () => {
  it("keeps a four-item right rail end-to-end inside its side window", () => {
    const layout = videoStyleLayout("right-rail", 1920, 1080, 4);
    expect(layout.constrainedFocus).toBe(true);
    expect(layout.camera.width).toBeCloseTo(1920 * 0.58);
    expect(layout.slots).toHaveLength(4);
    for (const slot of layout.slots) {
      expect(slot.x).toBeGreaterThanOrEqual(layout.panel!.x);
      expect(slot.x + slot.width).toBeLessThanOrEqual(layout.panel!.x + layout.panel!.width);
      expect(slot.width).toBeGreaterThan(layout.panel!.width * 0.9);
    }
    expect(layout.slots[1].y - (layout.slots[0].y + layout.slots[0].height)).toBeCloseTo(1080 * 0.012);
    expect(layout.focus.x).toBeGreaterThanOrEqual(layout.panel!.x);
    expect(layout.focus.x + layout.focus.width).toBeLessThanOrEqual(layout.panel!.x + layout.panel!.width);
    expect(layout.focus.x).toBe(layout.panel!.x);
    expect(layout.focus.width).toBe(layout.panel!.width);
  });

  it("shrinks both the side cards and their window when the rail becomes scrollable", () => {
    const shortRail = videoStyleLayout("right-rail", 1920, 1080, 4, { offset: 0, windowStart: 0, total: 4 });
    const longRail = videoStyleLayout("right-rail", 1920, 1080, 6, { offset: 0, windowStart: 0, total: 9 });
    expect(longRail.panel!.width).toBeLessThan(shortRail.panel!.width);
    expect(longRail.panel!.height).toBeLessThan(shortRail.panel!.height);
    expect(longRail.slots[0].width).toBeLessThan(shortRail.slots[0].width);
    expect(longRail.slots[0].height).toBeLessThan(shortRail.slots[0].height);
    expect(longRail.panel!.y).toBeGreaterThan(0);
  });

  it("uses medium center focus for camera-overlay styles", () => {
    for (const id of ["top-shelf", "center-shelf", "bottom-shelf", "spatial"] as const) {
      const layout = videoStyleLayout(id, 1280, 720, 4);
      expect(layout.constrainedFocus).toBe(false);
      expect(layout.focus.width).toBeCloseTo(1280 * 0.68);
      expect(layout.focus.x).toBeCloseTo(1280 * 0.16);
      expect(layout.keepSlotsWhileFocused).toBe(false);
    }
  });

  it("gives freeform assets a medium default and a visibly smaller small preset", () => {
    const layout = videoStyleLayout("spatial", 1280, 720, 3);
    const medium: StudioAsset = { id: "medium", name: "Medium", kind: "image", placement: "center", size: "medium", dataView: "table" };
    const small: StudioAsset = { ...medium, id: "small", size: "small" };
    const mediumRect = styleFocusBaseRect(layout, medium, 1600, 900);
    const smallRect = styleFocusBaseRect(layout, small, 1600, 900);
    expect(mediumRect.width).toBeCloseTo(layout.focus.width);
    expect(smallRect.width).toBeLessThan(mediumRect.width);
    expect(smallRect.x).toBeGreaterThan(mediumRect.x);
  });

  it("places the new horizontal media belts at center and bottom", () => {
    const center = videoStyleLayout("center-shelf", 1280, 720, 4);
    const bottom = videoStyleLayout("bottom-shelf", 1280, 720, 4);
    expect(center.slots[0].y).toBeCloseTo(720 * 0.425);
    expect(bottom.slots[0].y).toBeCloseTo(720 * 0.77);
    expect(center.slots[1].x).toBeGreaterThan(center.slots[0].x);
    expect(bottom.slots[1].x).toBeGreaterThan(bottom.slots[0].x);
    expect(center.deckViewport!.width).toBeLessThan(1280 * 0.6);
    expect(bottom.deckViewport!.width).toBeLessThan(1280 * 0.6);
  });

  it("lets settings move horizontal shelves vertically and side rails horizontally", () => {
    const high = videoStyleLayout("center-shelf", 1280, 720, 4, { offset: 0, windowStart: 0, total: 4, position: 0.2 });
    const low = videoStyleLayout("center-shelf", 1280, 720, 4, { offset: 0, windowStart: 0, total: 4, position: 0.7 });
    expect(low.slots[0].y).toBeGreaterThan(high.slots[0].y);
    const inner = videoStyleLayout("right-rail", 1280, 720, 4, { offset: 0, windowStart: 0, total: 4, position: 0 });
    const outer = videoStyleLayout("right-rail", 1280, 720, 4, { offset: 0, windowStart: 0, total: 4, position: 1 });
    expect(outer.slots[0].x).toBeGreaterThan(inner.slots[0].x);
  });

  it("keeps the top-row band over a full-canvas camera", () => {
    const layout = videoStyleLayout("top-shelf", 1280, 720, 3);
    expect(layout.camera).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    expect(layout.panel?.height).toBeCloseTo(720 * 0.26);
    expect(layout.slots[0].height).toBeCloseTo(720 * 0.145);
    expect(layout.slots[0].width).toBeCloseTo(layout.slots[0].height);
  });

  it("caps visible template media at four", () => {
    expect(videoStyleLayout("left-rail", 1280, 720, 20).slots).toHaveLength(MAX_STYLE_ASSETS);
  });

  it("moves every rail slot continuously by the fractional deck offset", () => {
    const before = videoStyleLayout("right-rail", 1280, 720, 6, { offset: 0, windowStart: 0, total: 8 });
    const after = videoStyleLayout("right-rail", 1280, 720, 6, { offset: 0.5, windowStart: 0, total: 8 });
    const step = before.slots[1].y - before.slots[0].y;
    expect(after.slots[0].y).toBeCloseTo(before.slots[0].y - step * 0.5);
    expect(after.slots[1].y - after.slots[0].y).toBeCloseTo(step);
  });

  it("moves the top dock horizontally but keeps Around you fixed", () => {
    const topBefore = videoStyleLayout("top-shelf", 1280, 720, 6, { offset: 1, windowStart: 0, total: 8 });
    const topAfter = videoStyleLayout("top-shelf", 1280, 720, 6, { offset: 1.25, windowStart: 0, total: 8 });
    expect(topAfter.slots[0].x).toBeLessThan(topBefore.slots[0].x);
    const spatialBefore = videoStyleLayout("spatial", 1280, 720, 6, { offset: 1, windowStart: 0, total: 8 });
    const spatialAfter = videoStyleLayout("spatial", 1280, 720, 6, { offset: 1.25, windowStart: 0, total: 8 });
    expect(spatialAfter.slots).toEqual(spatialBefore.slots);
  });

  it("only engages scrolling on or immediately behind the conveyor belt", () => {
    const layout = videoStyleLayout("right-rail", 1280, 720, 6, { offset: 0, windowStart: 0, total: 6 });
    expect(pointNearStyleDeck(layout, { x: 1100, y: 360 }, 24)).toBe(true);
    expect(pointNearStyleDeck(layout, { x: 500, y: 360 }, 24)).toBe(false);
    expect(pointNearStyleDeck(layout, { x: layout.deckViewport!.x - 12, y: 360 }, 24)).toBe(true);
  });

  it("keeps the conveyor parent tight around four cards", () => {
    const top = videoStyleLayout("top-shelf", 1280, 720, 6, { offset: 0, windowStart: 0, total: 6 });
    expect(top.deckViewport!.width).toBeLessThan(1280 * 0.6);
    const rail = videoStyleLayout("right-rail", 1280, 720, 6, { offset: 0, windowStart: 0, total: 6 });
    expect(rail.deckViewport!.height).toBeLessThanOrEqual(720);
    expect(rail.deckViewport!.height).toBeGreaterThan(rail.slots[0].height * 4);
  });

  it("always includes a confirmed asset even when it is beyond the four preview slots", () => {
    const assets = Array.from({ length: 8 }, (_, index): StudioAsset => ({
      id: `asset-${index + 1}`,
      name: `Asset ${index + 1}`,
      kind: "image",
      placement: "center",
      size: "medium",
      dataView: "table"
    }));
    const visible = styleAssetsWithFocus(assets, "asset-8");
    expect(visible).toHaveLength(MAX_STYLE_ASSETS);
    expect(visible.at(-1)?.id).toBe("asset-8");
  });

  it("keeps scene members available in the universal main dock", () => {
    const assets = ["a", "b", "c"].map((id): StudioAsset => ({ id, name: id, kind: "image", placement: "center", size: "medium", dataView: "table" }));
    expect(assetsForMainDock(assets).map((asset) => asset.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves source aspect ratio in freeform and side windows", () => {
    expect(styleUsesUniformPreviews("top-shelf")).toBe(true);
    expect(styleUsesUniformPreviews("center-shelf")).toBe(true);
    expect(styleUsesUniformPreviews("bottom-shelf")).toBe(true);
    expect(styleUsesUniformPreviews("split-decks")).toBe(true);
    expect(styleUsesUniformPreviews("right-rail")).toBe(true);
    expect(styleUsesUniformPreviews("left-rail")).toBe(true);
    expect(styleUsesUniformPreviews("spatial")).toBe(false);
  });

  it("contains focused media without changing its aspect ratio", () => {
    const output = containStyleRect({ x: 100, y: 50, width: 400, height: 400 }, 1600, 900);
    expect(output.width / output.height).toBeCloseTo(16 / 9);
    expect(output.x).toBe(100);
    expect(output.y).toBeGreaterThan(50);
  });

  it("makes full-size video truly cover the entire recording canvas", () => {
    const layout = videoStyleLayout("right-rail", 1280, 720, 3);
    const video: StudioAsset = { id: "clip", name: "Clip", kind: "video", placement: "center", size: "full", dataView: "table" };
    expect(styleFocusBaseRect(layout, video, 1920, 1080)).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    expect(styleTransformBounds(layout, video)).toBeUndefined();
  });

  it("retains a presenter's position and size when an asset is revealed again", () => {
    const authored = { x: 0.73, y: 0.31, scale: 1.85 };
    expect(retainedStyleTransform(authored, { x: 100, y: 80, width: 400, height: 240 }, 1280, 720)).toBe(authored);
  });

  it("maps a point directly to the visible template slot", () => {
    const assets = ["a", "b", "c"].map((id): StudioAsset => ({ id, name: id, kind: "image", placement: "center", size: "medium", dataView: "table" }));
    const layout = videoStyleLayout("right-rail", 1280, 720, assets.length);
    const first = layout.slots[0];
    expect(styleAssetAtPoint(layout, assets, { x: first.x + first.width / 2, y: first.y + first.height / 2 }, null)?.id).toBe("a");
    expect(styleAssetAtPoint(layout, assets, { x: first.x + first.width / 2, y: first.y + first.height / 2 }, "a")).toBeNull();
  });
});
