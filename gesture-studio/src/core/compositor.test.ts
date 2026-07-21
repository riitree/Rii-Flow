import { describe, expect, it } from "vitest";
import { applyAssetTransform, baseAssetRect, constrainAssetTransform, entranceAnimationFrame, motionAnimationFrame, presetMediaRect, reflowAssetPanelBackdropForLayer, reflowAssetPanelRect, reflowLayerPanelBackdropForLayer, sceneBaseRect, sceneDisplayRect, sceneFocusedMemberRect, sceneMemberCanvasTransform, sceneMemberContentRects, sceneMemberDisplayRects, sceneMemberDrawOrder, sceneMemberRects, sceneMemberRelativeTransform, sceneRevealAnimationFrame, sceneRevealPanelRect, screenOverlayBaseRect, screenOverlayDisplayRect, stageBackdropForLayers } from "./compositor";
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
  it("preserves user rotation while constraining position and scale", () => {
    expect(constrainAssetTransform(1280, 720, { x: 0, y: 0, width: 320, height: 180 }, { x: 0.5, y: 0.5, scale: 1, rotation: 0.75 }).rotation).toBe(0.75);
  });

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

  it("confines a make-room background to its left or right panel", () => {
    const asset: StudioAsset = {
      id: "side",
      name: "Side",
      kind: "image",
      placement: "right",
      size: "medium",
      dataView: "table",
      cameraReflow: "make-room",
      stageBackground: "custom",
      stageBackgroundColor: "#3564d8"
    };
    const layer = { id: asset.id, kind: "asset" as const, asset };
    expect(stageBackdropForLayers([layer])).toEqual({ mode: "camera" });
    expect(reflowAssetPanelBackdropForLayer(1920, 1080, layer)).toEqual({
      mode: "custom",
      color: "#3564d8",
      rect: { x: 1152, y: 0, width: 768, height: 1080 }
    });
  });

  it("uses only the newest live cue background while preserving earlier side assets", () => {
    const earlier: StudioAsset = {
      id: "earlier",
      name: "Earlier",
      kind: "image",
      placement: "left",
      size: "medium",
      dataView: "table",
      cameraReflow: "make-room",
      stageBackground: "white"
    };
    const newest: StudioAsset = {
      ...earlier,
      id: "newest",
      name: "Newest",
      placement: "right",
      stageBackground: "custom",
      stageBackgroundColor: "#6547d9"
    };
    const layers = [
      { id: earlier.id, kind: "asset" as const, asset: earlier },
      { id: newest.id, kind: "asset" as const, asset: newest }
    ];
    expect(stageBackdropForLayers(layers)).toEqual({ mode: "camera" });
    expect(reflowAssetPanelBackdropForLayer(1920, 1080, layers[1])).toEqual({
      mode: "custom",
      color: "#6547d9",
      rect: { x: 1152, y: 0, width: 768, height: 1080 }
    });
  });

  it("paints the newest background across the largest live side window", () => {
    const newest: StudioAsset = {
      id: "small-newest",
      name: "Small newest",
      kind: "image",
      placement: "right",
      size: "small",
      dataView: "table",
      cameraReflow: "make-room",
      stageBackground: "cream"
    };
    expect(reflowAssetPanelBackdropForLayer(
      1920,
      1080,
      { id: newest.id, kind: "asset", asset: newest },
      0.5
    )).toEqual({
      mode: "cream",
      color: "#f5f0e6",
      rect: { x: 960, y: 0, width: 960, height: 1080 }
    });
  });

  it("uses a scene's own stage background for the entire composition", () => {
    const member: StudioAsset = { id: "member", name: "Member", kind: "image", placement: "center", size: "small", dataView: "table", stageBackground: "black" };
    const customScene: StudioScene = { ...scene, stageBackground: "custom", stageBackgroundColor: "#6547d9" };
    expect(stageBackdropForLayers([{ id: customScene.id, kind: "scene", scene: customScene, assets: [member] }])).toEqual({ mode: "custom", color: "#6547d9" });
    expect(stageBackdropForLayers([{ id: scene.id, kind: "scene", scene, assets: [member] }])).toEqual({ mode: "camera" });
  });

  it("confines a Side Reveal scene and its background to a synchronized panel", () => {
    const revealScene: StudioScene = {
      ...scene,
      size: "medium",
      revealSide: "right",
      revealMotion: "smooth",
      stageBackground: "custom",
      stageBackgroundColor: "#3157d5"
    };
    const layer = { id: "scene:scene", kind: "scene" as const, scene: revealScene, assets: [] };
    expect(sceneRevealPanelRect(1920, 1080, revealScene)).toEqual({ x: 1152, y: 0, width: 768, height: 1080 });
    expect(sceneBaseRect(1920, 1080, revealScene)).toEqual({ x: 1152, y: 0, width: 768, height: 1080 });
    expect(sceneDisplayRect(1920, 1080, { ...revealScene, transform: { x: 0.4, y: 0.5, scale: 0.5 } })).toEqual({ x: 576, y: 270, width: 384, height: 540 });
    expect(stageBackdropForLayers([layer])).toEqual({ mode: "camera" });
    expect(reflowLayerPanelBackdropForLayer(1920, 1080, layer)).toEqual({
      mode: "custom",
      color: "#3157d5",
      rect: { x: 1152, y: 0, width: 768, height: 1080 }
    });
  });

  it("slides a Side Reveal scene as one cheap group transform", () => {
    expect(sceneRevealAnimationFrame("left", "smooth", 0, 640)).toEqual({ translateX: -640, progress: 0 });
    expect(sceneRevealAnimationFrame("right", "smooth", 55, 640)).toEqual({ translateX: 80, progress: 0.875 });
    expect(sceneRevealAnimationFrame("right", "soft", 55, 640).translateX).toBeGreaterThan(0);
    expect(sceneRevealAnimationFrame("left", "bounce", 80, 640).progress).toBeGreaterThan(0.8);
    expect(sceneRevealAnimationFrame("right", "bounce", 110, 640)).toEqual({ translateX: 0, progress: 1 });
  });

  it("spawns media in a small relative window by default", () => {
    const rect = presetMediaRect(1920, 1080, 640, 360, "center", "small");
    expect(rect.width / 1920).toBeCloseTo(0.28);
    expect(rect.height / 1080).toBeLessThan(0.32);
    expect(rect.x).toBeGreaterThan(600);
  });

  it("expands a focused scene member to its configured stage size", () => {
    const dataAsset: StudioAsset = { id: "data", name: "Data", kind: "json", rows: [], placement: "center", size: "small", dataView: "table" };
    const media = { images: new Map<string, HTMLImageElement>(), videos: new Map<string, HTMLVideoElement>() };
    const medium = sceneFocusedMemberRect(1920, 1080, { ...scene, memberFocusModes: { data: "medium" } }, dataAsset, media);
    expect(medium.width / 1920).toBeCloseTo(0.72);
    expect(medium.height / 1080).toBeCloseTo(0.72);
    expect(sceneFocusedMemberRect(1920, 1080, { ...scene, memberFocusModes: { data: "full" } }, dataAsset, media)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
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

  it("allows an asset to reach every true canvas edge", () => {
    const base = { x: 0, y: 0, width: 320, height: 180 };
    const right = applyAssetTransform(1280, 720, base, { x: 2, y: 0.5, scale: 1 });
    const left = applyAssetTransform(1280, 720, base, { x: -1, y: 0.5, scale: 1 });
    expect(left.x).toBe(0);
    expect(right.x + right.width).toBe(1280);
  });

  it("keeps a transformed make-room asset inside its side window", () => {
    const panel = { x: 896, y: 0, width: 384, height: 720 };
    const base = { x: 988, y: 260, width: 200, height: 200 };
    const leftEdge = applyAssetTransform(1280, 720, base, { x: 0.1, y: 0.5, scale: 1 }, panel);
    const rightEdge = applyAssetTransform(1280, 720, base, { x: 0.99, y: 0.5, scale: 1 }, panel);
    const enlarged = applyAssetTransform(1280, 720, base, { x: 0.9, y: 0.5, scale: 4 }, panel);
    expect(leftEdge.x).toBe(panel.x);
    expect(rightEdge.x + rightEdge.width).toBe(panel.x + panel.width);
    expect(enlarged.width).toBe(panel.width);
    expect(enlarged.x).toBe(panel.x);
  });

  it("lets a small cue use a larger shared window without crossing it", () => {
    const asset: StudioAsset = { id: "small", name: "Small", kind: "image", placement: "right", size: "small", dataView: "table", cameraReflow: "make-room", transform: { x: 0.52, y: 0.5, scale: 1 } };
    const sharedWindow = { x: 640, y: 0, width: 640, height: 720 };
    const rect = baseAssetRect(1280, 720, asset, 400, 400);
    const output = applyAssetTransform(1280, 720, rect, asset.transform, sharedWindow);
    expect(output.x).toBe(sharedWindow.x);
    expect(output.x + output.width).toBeLessThanOrEqual(sharedWindow.x + sharedWindow.width);
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
    expect(entranceAnimationFrame("pop", 100).scale).toBeGreaterThan(0.82);
    expect(entranceAnimationFrame("bounce", 80).scale).toBeGreaterThan(1);
    expect(entranceAnimationFrame("float", 100).translateY).toBeGreaterThan(0);
    expect(entranceAnimationFrame("slide-left", 0).translateX).toBeLessThan(0);
    expect(entranceAnimationFrame("slide-right", 0).translateX).toBeGreaterThan(0);
    expect(entranceAnimationFrame("zoom", 0).scale).toBeGreaterThan(1);
    expect(entranceAnimationFrame("drop", 0).translateY).toBeLessThan(0);
    expect(entranceAnimationFrame("float", Number.POSITIVE_INFINITY)).toEqual({ alpha: 1, scale: 1, translateX: 0, translateY: 0 });
    expect(entranceAnimationFrame("slide", 420)).toEqual({ alpha: 1, scale: 1, translateX: 0, translateY: 0 });
  });

  it("uses recording-safe transform-only continuing motions", () => {
    expect(motionAnimationFrame("none", 1200)).toEqual({ scale: 1, translateX: 0, translateY: 0, rotation: 0 });
    expect(Math.abs(motionAnimationFrame("float", 1000).translateY)).toBeGreaterThan(0);
    expect(motionAnimationFrame("pulse", 1000).scale).not.toBe(1);
    expect(Math.abs(motionAnimationFrame("sway", 1000).rotation)).toBeGreaterThan(0);
    expect(Math.abs(motionAnimationFrame("drift", 1000).translateX)).toBeGreaterThan(0);
  });

  it("preserves media aspect inside a make-room side region", () => {
    const asset = { id: "split", name: "Split", kind: "image", placement: "right", size: "full", dataView: "table", cameraReflow: "make-room" } as const;
    expect(reflowAssetPanelRect(1280, 720, asset)).toEqual({ x: 640, y: 0, width: 640, height: 720 });
    expect(baseAssetRect(1280, 720, asset, 1600, 900)).toEqual({ x: 640, y: 180, width: 640, height: 360 });
  });
});
