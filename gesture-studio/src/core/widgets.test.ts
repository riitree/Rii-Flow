import { describe, expect, it } from "vitest";
import { containWidgetMedia, orbitAssetAtPoint, orbitCardRects, orbitTargetAtPoint, pointNearOrbit, widgetAtPoint, widgetRect, type CanvasWidget } from "./widgets";
import type { StudioAsset, StudioScene } from "../types";

const widget: CanvasWidget = { id: "w1", kind: "sticker", x: .5, y: .5, scale: 1, title: "Star", items: [], revealed: 0, sticker: "star", visible: true };

describe("canvas widgets", () => {
  it("hit-tests the recorded widget bounds", () => {
    const rect = widgetRect(widget, 1000, 600);
    expect(widgetAtPoint([widget], { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, 1000, 600)?.id).toBe("w1");
    expect(widgetAtPoint([widget], { x: 2, y: 2 }, 1000, 600)).toBeNull();
    expect(widgetAtPoint([{ ...widget, visible: false }], { x: 500, y: 300 }, 1000, 600)).toBeNull();
  });

  it("gives a standalone media launcher a compact landscape hit target", () => {
    const media: CanvasWidget = { ...widget, kind: "media", actionAssetId: "hero" };
    const rect = widgetRect(media, 1000, 600);
    expect(rect).toEqual({ x: 435, y: 250, width: 130, height: 100 });
  });

  it("fans orbit cards into a crescent and hit-tests its visible assets", () => {
    const orbit: CanvasWidget = { ...widget, kind: "orbit", x: .12, open: true, assetIds: ["a", "b", "c"] };
    const assets = ["a", "b", "c"].map((id): StudioAsset => ({ id, name: id, kind: "image", placement: "center", size: "medium", dataView: "table" }));
    const cards = orbitCardRects(orbit, 1000, 600, assets.length);
    expect(cards).toHaveLength(3);
    expect(cards[1].x).toBeGreaterThan(cards[0].x);
    const middle = cards[1];
    const point = { x: middle.x + middle.width / 2, y: middle.y + middle.height / 2 };
    expect(orbitAssetAtPoint(orbit, assets, point, 1000, 600)?.id).toBe("b");
    expect(pointNearOrbit(orbit, point, 1000, 600, 10)).toBe(true);
  });

  it("contains wide and tall orbit thumbnails without stretching them", () => {
    const card = { x: 0, y: 0, width: 100, height: 100 };
    const wide = containWidgetMedia(card, 1600, 900);
    const tall = containWidgetMedia(card, 900, 1600);
    expect(wide.width / wide.height).toBeCloseTo(16 / 9);
    expect(tall.width / tall.height).toBeCloseTo(9 / 16);
    expect(wide.width).toBe(100);
    expect(tall.height).toBe(100);
  });

  it("lets the orbit file charm shrink without shrinking its cards below the readable minimum", () => {
    const small: CanvasWidget = { ...widget, kind: "orbit", x: .12, scale: .28, open: true, assetIds: ["a", "b"] };
    const previousMinimum: CanvasWidget = { ...small, scale: .55 };
    expect(widgetRect(small, 1000, 600).width).toBeLessThan(widgetRect(previousMinimum, 1000, 600).width);
    expect(orbitCardRects(small, 1000, 600, 2)[0].width).toBeCloseTo(orbitCardRects(previousMinimum, 1000, 600, 2)[0].width);
  });

  it("supports saved scenes as complete orbit targets", () => {
    const scene: StudioScene = { id: "scene-a", name: "Launch", memberIds: ["a", "b"], placement: "center", size: "full", layout: "grid" };
    const orbit: CanvasWidget = { ...widget, kind: "orbit", x: .12, open: true, assetIds: [], sceneIds: [scene.id] };
    const card = orbitCardRects(orbit, 1000, 600, 1)[0];
    const target = orbitTargetAtPoint(orbit, [], [scene], { x: card.x + card.width / 2, y: card.y + card.height / 2 }, 1000, 600);
    expect(target?.kind).toBe("scene");
    if (target?.kind === "scene") expect(target.scene.id).toBe(scene.id);
  });
});
