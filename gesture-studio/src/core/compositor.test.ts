import { describe, expect, it } from "vitest";
import { applyAssetTransform, constrainAssetTransform, entranceAnimationFrame, presetMediaRect, sceneBaseRect, sceneMemberCanvasTransform, sceneMemberContentRects, sceneMemberDisplayRects, sceneMemberDrawOrder, sceneMemberRects, sceneMemberRelativeTransform, screenOverlayBaseRect, screenOverlayDisplayRect, snapScaleToTemplate, snapTransformToCameraBorder, snappedAssetSize, stageBackdropForLayers } from "./compositor";
import { cameraFrameViewport } from "./cameraFrame";
import type { StudioAsset, StudioScene } from "../types";

const scene: StudioScene = {
  id: "scene",
  name: "Scene",
  memberIds: ["a", "b", "c", "d"],
  placement: "center",
  size: "small",
  layout: "grid"
};

describe("asset display geometry", () => {
  it("uses an asset's background for the full stage, not its media rectangle", () => {
    const cameraAsset: StudioAsset = { id: "camera", name: "Camera", kind: "image", placement: "center", size: "small", dataView: "table", stageBackground: "camera" };
    const blackAsset: StudioAsset = { ...cameraAsset, id: "black", name: "Black", stageBackground: "black" };
    expect(stageBackdropForLayers([])).toEqual({ mode: "camera" });
    expect(stageBackdropForLayers([{ id: cameraAsset.id, kind: "asset", asset: cameraAsset }])).toEqual({ mode: "camera" });
    expect(stageBackdropForLayers([
      { id: blackAsset.id, kind: "asset", asset: blackAsset },
      { id: cameraAsset.id, kind: "asset", asset: cameraAsset }
    ])).toEqual({ mode: "camera" });
    expect(stageBackdropForLayers([
      { id: cameraAsset.id, kind: "asset", asset: cameraAsset },
      { id: blackAsset.id, kind: "asset", asset: blackAsset }
    ])).toEqual({ mode: "black", color: "#050505" });
  });

  it("supports a safe custom stage colour", () => {
    const asset: StudioAsset = { id: "custom", name: "Custom", kind: "image", placement: "center", size: "small", dataView: "table", stageBackground: "custom", stageBackgroundColor: "#3564d8" };
    expect(stageBackdropForLayers([{ id: asset.id, kind: "asset", asset }])).toEqual({ mode: "custom", color: "#3564d8" });
    expect(stageBackdropForLayers([{ id: asset.id, kind: "asset", asset: { ...asset, stageBackgroundColor: "invalid" } }])).toEqual({ mode: "custom", color: "#111111" });
  });

  it("uses a scene's own stage background for the entire composition", () => {
    const member: StudioAsset = { id: "member", name: "Member", kind: "image", placement: "center", size: "small", dataView: "table", stageBackground: "black" };
    const customScene: StudioScene = { ...scene, stageBackground: "custom", stageBackgroundColor: "#6547d9" };
    expect(stageBackdropForLayers([{ id: customScene.id, kind: "scene", scene: customScene, assets: [member] }])).toEqual({ mode: "custom", color: "#6547d9" });
    expect(stageBackdropForLayers([{ id: scene.id, kind: "scene", scene, assets: [member] }])).toEqual({ mode: "camera" });
  });

  it("spawns media in a small relative window by default", () => {
    const rect = presetMediaRect(1920, 1080, 640, 360, "center", "small");
    expect(rect.width / 1920).toBeCloseTo(0.28);
    expect(rect.height / 1080).toBeLessThan(0.32);
    expect(rect.x).toBeGreaterThan(600);
  });

  it("keeps a shared screen as an aspect-true overlay on the camera canvas", () => {
    const settings = { placement: "right" as const, size: "medium" as const, visible: true };
    const base = screenOverlayBaseRect(1920, 1080, 2560, 1440, settings);
    expect(base.width / base.height).toBeCloseTo(16 / 9);
    expect(base.width).toBeLessThan(1920);
    expect(base.x).toBeGreaterThan(900);
    expect(screenOverlayDisplayRect(1920, 1080, 2560, 1440, { ...settings, transform: { x: 0.3, y: 0.4, scale: 0.75 } })).toEqual({
      x: 216,
      y: 229.5,
      width: 720,
      height: 405
    });
  });

  it("fits full-screen media without changing its aspect ratio", () => {
    expect(presetMediaRect(1280, 720, 3840, 2160, "corner", "full")).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 720
    });
  });

  it("anchors preset-size media to the chosen placement", () => {
    const corner = presetMediaRect(1280, 720, 320, 180, "corner", "small");
    const lower = presetMediaRect(1280, 720, 320, 180, "lower", "small");

    expect(corner.width / 1280).toBeCloseTo(0.28);
    expect(corner.height / 720).toBeLessThan(0.32);
    expect(corner.x).toBeGreaterThan(890);
    expect(corner.y).toBeGreaterThan(0);
    expect(lower.x).toBeGreaterThan(450);
    expect(lower.y).toBeGreaterThan(490);
  });

  it("applies an intentional user position and scale", () => {
    expect(applyAssetTransform(1920, 1080, { x: 640, y: 360, width: 640, height: 360 }, { x: 0.25, y: 0.75, scale: 0.5 })).toEqual({
      x: 320,
      y: 720,
      width: 320,
      height: 180
    });
  });

  it("keeps manipulated media on the canvas and limits zoom to the canvas", () => {
    const base = { x: 0, y: 0, width: 960, height: 540 };
    const constrained = constrainAssetTransform(1280, 720, base, { x: -1, y: 2, scale: 3 });
    expect(constrained.scale).toBeCloseTo(4 / 3);
    expect(constrained.x).toBeCloseTo(0.5);
    expect(constrained.y).toBeCloseTo(0.5);
  });

  it("snaps only to full screen and preserves every other custom size", () => {
    expect(snappedAssetSize(1280, 720, { x: 0, y: 0, width: 1100, height: 620 })).toBe("full");
    expect(snappedAssetSize(1280, 720, { x: 0, y: 0, width: 420, height: 230 })).toBeNull();
    expect(snappedAssetSize(1280, 720, { x: 0, y: 0, width: 700, height: 390 })).toBeNull();
  });

  it("magnetically restores scene resizing near the template scale", () => {
    expect(snapScaleToTemplate(0.93)).toBe(1);
    expect(snapScaleToTemplate(1.08)).toBe(1);
    expect(snapScaleToTemplate(0.9)).toBe(0.9);
    expect(snapScaleToTemplate(1.12)).toBe(1.12);
  });

  it("snaps overlays to camera corners and every edge while ignoring its border", () => {
    const canvas = { width: 1280, height: 720 };
    const base = { x: 0, y: 0, width: 320, height: 180 };
    const viewport = cameraFrameViewport(canvas.width, canvas.height, { enabled: true, mode: "black", sizePercent: 10, customColor: "#123456" });
    const nearCameraCorner = {
      x: (viewport.x + base.width / 2 + 18) / canvas.width,
      y: (viewport.y + base.height / 2 + 16) / canvas.height,
      scale: 1
    };
    const snapped = snapTransformToCameraBorder(canvas.width, canvas.height, base, nearCameraCorner, viewport);
    expect(snapped.target).toBe("top-left");
    expect(applyAssetTransform(canvas.width, canvas.height, base, snapped.transform)).toEqual({
      x: viewport.x,
      y: viewport.y,
      width: base.width,
      height: base.height
    });

    const canvasCorner = snapTransformToCameraBorder(canvas.width, canvas.height, base, {
      x: base.width / canvas.width / 2,
      y: base.height / canvas.height / 2,
      scale: 1
    }, viewport);
    expect(canvasCorner.target).toBeNull();

    const bottomRight = snapTransformToCameraBorder(canvas.width, canvas.height, base, {
      x: (viewport.x + viewport.width - base.width / 2 - 12) / canvas.width,
      y: (viewport.y + viewport.height - base.height / 2 + 10) / canvas.height,
      scale: 1
    }, viewport);
    const bottomRightRect = applyAssetTransform(canvas.width, canvas.height, base, bottomRight.transform);
    expect(bottomRight.target).toBe("bottom-right");
    expect(bottomRightRect.x + bottomRightRect.width).toBe(viewport.x + viewport.width);
    expect(bottomRightRect.y + bottomRightRect.height).toBe(viewport.y + viewport.height);

    const top = snapTransformToCameraBorder(canvas.width, canvas.height, base, {
      x: 0.5,
      y: (viewport.y + base.height / 2 + 14) / canvas.height,
      scale: 1
    }, viewport);
    const topRect = applyAssetTransform(canvas.width, canvas.height, base, top.transform);
    expect(top.target).toBe("top");
    expect(topRect.y).toBe(viewport.y);
    expect(topRect.x + topRect.width / 2).toBeCloseTo(canvas.width / 2);

    const outsideLightSnapZone = snapTransformToCameraBorder(canvas.width, canvas.height, base, {
      x: 0.5,
      y: (viewport.y + base.height / 2 + 26) / canvas.height,
      scale: 1
    }, viewport);
    expect(outsideLightSnapZone.target).toBeNull();

    const bottom = snapTransformToCameraBorder(canvas.width, canvas.height, base, {
      x: 0.43,
      y: (viewport.y + viewport.height - base.height / 2 - 10) / canvas.height,
      scale: 1
    }, viewport);
    const bottomRect = applyAssetTransform(canvas.width, canvas.height, base, bottom.transform);
    expect(bottom.target).toBe("bottom");
    expect(bottomRect.y + bottomRect.height).toBe(viewport.y + viewport.height);

    const left = snapTransformToCameraBorder(canvas.width, canvas.height, base, {
      x: (viewport.x + base.width / 2 + 11) / canvas.width,
      y: 0.48,
      scale: 1
    }, viewport);
    const leftRect = applyAssetTransform(canvas.width, canvas.height, base, left.transform);
    expect(left.target).toBe("left");
    expect(leftRect.x).toBe(viewport.x);

    const right = snapTransformToCameraBorder(canvas.width, canvas.height, base, {
      x: (viewport.x + viewport.width - base.width / 2 - 9) / canvas.width,
      y: 0.55,
      scale: 1
    }, viewport);
    const rightRect = applyAssetTransform(canvas.width, canvas.height, base, right.transform);
    expect(right.target).toBe("right");
    expect(rightRect.x + rightRect.width).toBe(viewport.x + viewport.width);
  });

  it("starts a multi-asset scene smaller than the stage", () => {
    const rect = sceneBaseRect(1920, 1080, scene);
    expect(rect.width / 1920).toBeLessThanOrEqual(0.44);
    expect(rect.height / 1080).toBeLessThanOrEqual(0.46);
  });

  it("lays out scene members inside one shared bounding box", () => {
    const rect = { x: 100, y: 50, width: 800, height: 500 };
    const members = sceneMemberRects(scene, rect);
    expect(members).toHaveLength(4);
    expect(Math.min(...members.map((item) => item.x))).toBeGreaterThanOrEqual(rect.x);
    expect(Math.max(...members.map((item) => item.x + item.width))).toBeLessThanOrEqual(rect.x + rect.width);
  });

  it("fits each scene member box to the visible media aspect ratio", () => {
    const group = { x: 100, y: 50, width: 800, height: 500 };
    const slots = sceneMemberRects(scene, group);
    const assets: StudioAsset[] = [
      { id: "a", name: "Wide", kind: "image", placement: "center", size: "small", dataView: "table" },
      { id: "b", name: "Portrait", kind: "image", placement: "center", size: "small", dataView: "table" }
    ];
    const media = {
      images: new Map<string, HTMLImageElement>([
        ["a", { naturalWidth: 1600, naturalHeight: 900 } as HTMLImageElement],
        ["b", { naturalWidth: 900, naturalHeight: 1600 } as HTMLImageElement]
      ]),
      videos: new Map<string, HTMLVideoElement>()
    };
    const fitted = sceneMemberContentRects(scene, group, assets, media);

    expect(fitted[0].width / fitted[0].height).toBeCloseTo(16 / 9);
    expect(fitted[0].height).toBeLessThan(slots[0].height);
    expect(fitted[1].width / fitted[1].height).toBeCloseTo(9 / 16);
    expect(fitted[1].width).toBeLessThan(slots[1].width);
    expect(fitted[0].x + fitted[0].width / 2).toBeCloseTo(slots[0].x + slots[0].width / 2);
    expect(fitted[1].y + fitted[1].height / 2).toBeCloseTo(slots[1].y + slots[1].height / 2);
  });

  it("supports a large spotlight with a secondary asset rail", () => {
    const spotlight = sceneMemberRects({ ...scene, layout: "spotlight" }, { x: 0, y: 0, width: 1000, height: 600 });
    expect(spotlight).toHaveLength(4);
    expect(spotlight[0].height).toBe(600);
    expect(spotlight[0].width).toBeGreaterThan(spotlight[1].width);
    expect(spotlight[1].x).toBeGreaterThan(spotlight[0].x + spotlight[0].width);
  });

  it("supports an overlapping cascade contained by the scene bounds", () => {
    const rect = { x: 100, y: 50, width: 800, height: 500 };
    const cascade = sceneMemberRects({ ...scene, layout: "cascade" }, rect);
    expect(cascade).toHaveLength(4);
    expect(cascade[1].x).toBeGreaterThan(cascade[0].x);
    expect(cascade[1].y).toBeGreaterThan(cascade[0].y);
    expect(cascade.at(-1)!.x + cascade.at(-1)!.width).toBeLessThanOrEqual(rect.x + rect.width);
    expect(cascade.at(-1)!.y + cascade.at(-1)!.height).toBeLessThanOrEqual(rect.y + rect.height);
  });

  it("keeps a palm-edited member relative to the whole scene", () => {
    const group = { x: 100, y: 50, width: 800, height: 500 };
    const slot = sceneMemberRects(scene, group)[0];
    const absolute = sceneMemberCanvasTransform(1280, 720, group, slot, { x: 0.7, y: 0.6, scale: 0.75 });
    const relative = sceneMemberRelativeTransform(1280, 720, group, absolute);
    expect(relative).toEqual({ x: 0.7, y: 0.6, scale: 0.75 });

    const movedGroup = { x: 220, y: 120, width: 600, height: 380 };
    const moved = sceneMemberDisplayRects({ ...scene, memberTransforms: { a: relative } }, movedGroup)[0];
    expect(moved.x + moved.width / 2).toBeCloseTo(movedGroup.x + movedGroup.width * 0.7);
    expect(moved.y + moved.height / 2).toBeCloseTo(movedGroup.y + movedGroup.height * 0.6);
  });

  it("draws the last palm-selected member on top without changing template slots", () => {
    expect(sceneMemberDrawOrder({ ...scene, memberOrder: ["b", "a"] })).toEqual(["b", "a", "c", "d"]);
  });

  it("uses inexpensive transform-and-opacity entrance animations", () => {
    expect(entranceAnimationFrame("fade", 0).alpha).toBe(0);
    expect(entranceAnimationFrame("pop", 200).scale).toBeGreaterThan(0.82);
    expect(entranceAnimationFrame("bounce", 220).scale).toBeGreaterThan(1);
    expect(Math.abs(entranceAnimationFrame("float", 900).translateY)).toBeGreaterThan(0);
    expect(entranceAnimationFrame("float", Number.POSITIVE_INFINITY)).toEqual({ alpha: 1, scale: 1, translateY: 0 });
    expect(entranceAnimationFrame("slide", 420)).toEqual({ alpha: 1, scale: 1, translateY: 0 });
  });
});
