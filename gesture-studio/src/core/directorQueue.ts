import type { StudioAsset, StudioLayer, StudioScene } from "../types";
import { sceneLayerId } from "./scenes";

/**
 * Creates one story queue in import order. A scene replaces its member cards at
 * the position of the first member, so the creator never has to rebuild order.
 */
export function buildDirectorQueue(assets: readonly StudioAsset[], scenes: readonly StudioScene[]): StudioLayer[] {
  const sceneByMember = new Map<string, StudioScene>();
  scenes.forEach((scene) => scene.memberIds.forEach((id) => sceneByMember.set(id, scene)));
  const emittedScenes = new Set<string>();
  const queue: StudioLayer[] = [];

  assets.forEach((asset) => {
    const scene = sceneByMember.get(asset.id);
    if (!scene) {
      queue.push({ id: asset.id, kind: "asset", asset });
      return;
    }
    if (emittedScenes.has(scene.id)) return;
    emittedScenes.add(scene.id);
    queue.push({
      id: sceneLayerId(scene.id),
      kind: "scene",
      scene,
      assets: scene.memberIds.map((id) => assets.find((candidate) => candidate.id === id)).filter((candidate): candidate is StudioAsset => Boolean(candidate))
    });
  });

  scenes.forEach((scene) => {
    if (emittedScenes.has(scene.id)) return;
    const members = scene.memberIds.map((id) => assets.find((candidate) => candidate.id === id)).filter((candidate): candidate is StudioAsset => Boolean(candidate));
    if (!members.length) return;
    queue.push({ id: sceneLayerId(scene.id), kind: "scene", scene, assets: members });
  });
  return queue;
}

export function directorCueIndex(queue: readonly StudioLayer[], activeLayerId: string | null, fallback = 0) {
  const activeIndex = activeLayerId ? queue.findIndex((layer) => layer.id === activeLayerId) : -1;
  return activeIndex >= 0 ? activeIndex : Math.min(Math.max(0, fallback), Math.max(0, queue.length - 1));
}

export function adjacentDirectorCueIndex(length: number, current: number, direction: -1 | 1) {
  if (length <= 0) return -1;
  return Math.min(length - 1, Math.max(0, current + direction));
}
