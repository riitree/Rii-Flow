import { GESTURES, type GestureId, type GestureSequenceMap, type StudioAsset, type StudioLayer, type StudioScene } from "../types";
import { resolveLayer, sceneLayerId } from "./scenes";

export interface GestureCue {
  layer: StudioLayer;
  layerIds: string[];
  index: number;
  total: number;
  nextCursor: number;
  mode: "keep" | "replace";
}

export function assignedGestureLayerIds(
  gesture: GestureId,
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[]
) {
  const sceneMemberIds = new Set(scenes.flatMap((scene) => scene.memberIds));
  return [
    ...scenes.filter((scene) => scene.gesture === gesture).map((scene) => sceneLayerId(scene.id)),
    ...assets.filter((asset) => asset.gesture === gesture && !sceneMemberIds.has(asset.id)).map((asset) => asset.id)
  ];
}

export function gestureSequenceLayerIds(
  gesture: GestureId,
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[],
  sequences: GestureSequenceMap
) {
  const assigned = assignedGestureLayerIds(gesture, assets, scenes);
  const assignedSet = new Set(assigned);
  const explicit = (sequences[gesture]?.order ?? []).filter((id, index, order) => assignedSet.has(id) && order.indexOf(id) === index);
  const explicitSet = new Set(explicit);
  return [...explicit, ...assigned.filter((id) => !explicitSet.has(id))];
}

export function normalizeGestureSequences(
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[],
  sequences: GestureSequenceMap
) {
  const normalized: GestureSequenceMap = {};
  GESTURES.forEach(({ id }) => {
    const order = gestureSequenceLayerIds(id, assets, scenes, sequences);
    if (!order.length) return;
    normalized[id] = { order, mode: sequences[id]?.mode ?? "keep" };
  });
  return normalized;
}

export function gestureCueAtCursor(
  gesture: GestureId,
  cursor: number,
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[],
  sequences: GestureSequenceMap
): GestureCue | null {
  const layerIds = gestureSequenceLayerIds(gesture, assets, scenes, sequences);
  if (!layerIds.length) return null;
  const index = ((Math.floor(cursor) % layerIds.length) + layerIds.length) % layerIds.length;
  const layer = resolveLayer(layerIds[index], assets, scenes);
  if (!layer) return null;
  return {
    layer,
    layerIds,
    index,
    total: layerIds.length,
    nextCursor: (index + 1) % layerIds.length,
    mode: sequences[gesture]?.mode ?? "keep"
  };
}

export function reorderGestureCue(
  gesture: GestureId,
  layerId: string,
  direction: -1 | 1,
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[],
  sequences: GestureSequenceMap
) {
  const order = gestureSequenceLayerIds(gesture, assets, scenes, sequences);
  const index = order.indexOf(layerId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= order.length) return sequences;
  const nextOrder = [...order];
  [nextOrder[index], nextOrder[destination]] = [nextOrder[destination], nextOrder[index]];
  return {
    ...sequences,
    [gesture]: { order: nextOrder, mode: sequences[gesture]?.mode ?? "keep" }
  };
}
