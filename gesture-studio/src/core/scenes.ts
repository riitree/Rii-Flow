import type { GestureId, StudioAsset, StudioLayer, StudioScene } from "../types";

export const sceneLayerId = (sceneId: string) => `scene:${sceneId}`;

export function resolveLayer(
  layerId: string,
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[]
): StudioLayer | null {
  if (layerId.startsWith("scene:")) {
    const scene = scenes.find((item) => item.id === layerId.slice(6));
    if (!scene) return null;
    const members = scene.memberIds
      .map((id) => assets.find((asset) => asset.id === id))
      .filter((asset): asset is StudioAsset => Boolean(asset));
    return { id: layerId, kind: "scene", scene, assets: members };
  }
  const asset = assets.find((item) => item.id === layerId);
  return asset ? { id: layerId, kind: "asset", asset } : null;
}

export function layerAssetIds(layer: StudioLayer): string[] {
  return layer.kind === "asset" ? [layer.asset.id] : layer.assets.map((asset) => asset.id);
}

export function layerName(layer: StudioLayer) {
  return layer.kind === "asset" ? layer.asset.name : layer.scene.name;
}

export function findGestureLayer(
  gesture: GestureId,
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[]
): StudioLayer | null {
  const scene = scenes.find((item) => item.gesture === gesture);
  if (scene) return resolveLayer(sceneLayerId(scene.id), assets, scenes);
  const asset = assets.find((item) => item.gesture === gesture);
  return asset ? resolveLayer(asset.id, assets, scenes) : null;
}

export interface GestureOwner {
  id: string;
  kind: "asset" | "scene";
  name: string;
}

/** One gesture can own exactly one activation target across assets and scenes. */
export function gestureOwner(
  gesture: GestureId,
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[],
  except?: { kind: "asset" | "scene"; id: string }
): GestureOwner | null {
  const scene = scenes.find((item) => item.gesture === gesture && !(except?.kind === "scene" && except.id === item.id));
  if (scene) return { id: scene.id, kind: "scene", name: scene.name };
  const asset = assets.find((item) => item.gesture === gesture && !(except?.kind === "asset" && except.id === item.id));
  return asset ? { id: asset.id, kind: "asset", name: asset.name } : null;
}

export function removeAssetFromScenes(assetId: string, scenes: readonly StudioScene[]) {
  const removedSceneIds: string[] = [];
  const next = scenes.flatMap((scene) => {
    if (!scene.memberIds.includes(assetId)) return [scene];
    const memberIds = scene.memberIds.filter((id) => id !== assetId);
    if (memberIds.length < 2) {
      removedSceneIds.push(scene.id);
      return [];
    }
    const memberTransforms = Object.fromEntries(Object.entries(scene.memberTransforms ?? {}).filter(([id]) => id !== assetId));
    const memberOrder = scene.memberOrder?.filter((id) => id !== assetId);
    return [{
      ...scene,
      memberIds,
      memberTransforms: Object.keys(memberTransforms).length ? memberTransforms : undefined,
      memberOrder: memberOrder?.length ? memberOrder : undefined
    }];
  });
  return { scenes: next, removedSceneIds };
}
