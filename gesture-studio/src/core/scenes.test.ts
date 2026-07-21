import { describe, expect, it } from "vitest";
import type { StudioAsset, StudioScene } from "../types";
import { findGestureLayer, gestureOwner, removeAssetFromScenes, resolveLayer, sceneLayerId } from "./scenes";

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
});
