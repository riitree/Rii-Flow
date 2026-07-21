import { describe, expect, it } from "vitest";
import type { StudioAsset, StudioScene } from "../types";
import { constrainedSceneMemberIds, findGestureLayer, gestureOwner, MAX_SCENE_ASSETS, MAX_SCENE_VIDEO_ASSETS, removeAssetFromScenes, resolveLayer, sceneLayerId, sceneMemberAtPalmCenter, sceneMemberLimitError } from "./scenes";

const asset = (id: string, gesture?: StudioAsset["gesture"]): StudioAsset => ({
  id,
  name: `${id}.png`,
  kind: "image",
  gesture,
  placement: "corner",
  size: "small",
  dataView: "table"
});

const scene = (memberIds: string[], gesture?: StudioScene["gesture"]): StudioScene => ({
  id: "scene-one",
  name: "Product scene",
  memberIds,
  gesture,
  placement: "center",
  size: "small",
  layout: "grid"
});

describe("multi-asset scenes", () => {
  it("resolves a scene layer with its ordered members", () => {
    const assets = [asset("a"), asset("b")];
    const layer = resolveLayer(sceneLayerId("scene-one"), assets, [scene(["b", "a"])]);
    expect(layer?.kind).toBe("scene");
    if (layer?.kind === "scene") expect(layer.assets.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("routes a unique gesture to the whole scene", () => {
    const layer = findGestureLayer("one", [asset("a")], [scene(["a", "b"], "one")]);
    expect(layer?.kind).toBe("scene");
  });

  it("reports conflicts across assets and scenes", () => {
    expect(gestureOwner("two", [asset("a", "two")], [scene(["a", "b"])])?.kind).toBe("asset");
    expect(gestureOwner("one", [asset("a")], [scene(["a", "b"], "one")])?.kind).toBe("scene");
  });

  it("removes invalid one-member scenes when an asset is deleted", () => {
    const result = removeAssetFromScenes("a", [scene(["a", "b"])]);
    expect(result).toEqual({ scenes: [], removedSceneIds: ["scene-one"] });
  });

  it("removes a deleted member's transform and draw-order entry", () => {
    const configured = {
      ...scene(["a", "b", "c"]),
      memberTransforms: { a: { x: 0.2, y: 0.3, scale: 0.8 }, b: { x: 0.5, y: 0.5, scale: 1 } },
      memberOrder: ["c", "a", "b"]
    };
    const result = removeAssetFromScenes("a", [configured]);
    expect(result.scenes[0].memberIds).toEqual(["b", "c"]);
    expect(result.scenes[0].memberTransforms).toEqual({ b: { x: 0.5, y: 0.5, scale: 1 } });
    expect(result.scenes[0].memberOrder).toEqual(["c", "b"]);
  });

  it("limits scenes to five total assets", () => {
    const assets = Array.from({ length: MAX_SCENE_ASSETS + 1 }, (_, index) => asset(`asset-${index}`));
    expect(sceneMemberLimitError(assets.map((item) => item.id), assets)).toBe("A scene can contain up to 5 assets.");
    expect(sceneMemberLimitError(assets.slice(0, MAX_SCENE_ASSETS).map((item) => item.id), assets)).toBeNull();
  });

  it("limits scenes to two video assets", () => {
    const assets = Array.from({ length: MAX_SCENE_VIDEO_ASSETS + 1 }, (_, index) => ({
      ...asset(`video-${index}`),
      kind: "video" as const
    }));
    expect(sceneMemberLimitError(assets.map((item) => item.id), assets)).toBe("A scene can contain up to 2 videos.");
  });

  it("safely constrains restored scenes without deleting their assets", () => {
    const assets = [
      ...Array.from({ length: 3 }, (_, index) => ({ ...asset(`video-${index}`), kind: "video" as const })),
      ...Array.from({ length: 4 }, (_, index) => asset(`image-${index}`))
    ];
    expect(constrainedSceneMemberIds(assets.map((item) => item.id), assets)).toEqual([
      "video-0",
      "video-1",
      "image-0",
      "image-1",
      "image-2"
    ]);
  });

  it("selects a scene member only when the palm centre is inside its real box", () => {
    const rects = new Map([
      ["left", { x: 100, y: 100, width: 200, height: 200 }],
      ["right", { x: 400, y: 100, width: 200, height: 200 }]
    ]);
    expect(sceneMemberAtPalmCenter(["left", "right"], rects, [{ x: 0.2, y: 0.28 }], 1000, 600)).toBe("left");
    expect(sceneMemberAtPalmCenter(["left", "right"], rects, [{ x: 0.305, y: 0.28 }], 1000, 600)).toBeNull();
  });

  it("chooses the topmost visible member when scene assets overlap", () => {
    const rects = new Map([
      ["back", { x: 100, y: 100, width: 300, height: 250 }],
      ["front", { x: 200, y: 150, width: 300, height: 250 }]
    ]);
    expect(sceneMemberAtPalmCenter(["back", "front"], rects, [{ x: 0.3, y: 0.3 }], 1000, 600)).toBe("front");
  });
});
