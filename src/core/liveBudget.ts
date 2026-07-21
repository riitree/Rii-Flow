import type { StudioLayer } from "../types";

export const MAX_LIVE_VISUALS = 8;
export const MAX_LIVE_MOVING_SOURCES = 2;

export interface LiveBudgetResult {
  layerIds: string[];
  hiddenAssetIds: Set<string>;
  evictedLayerIds: string[];
  visibleAssetCount: number;
  movingSourceCount: number;
}

/**
 * Protects the newest cues first. Older whole layers are evicted when the
 * visual budget is full; surplus scene videos are paused while static members
 * remain visible, so the collage does not disappear unexpectedly.
 */
export function enforceLiveBudget(
  layers: readonly StudioLayer[],
  options: {
    screenActive?: boolean;
    focusedSceneMembers?: Readonly<Record<string, string>>;
    alreadyHidden?: ReadonlySet<string>;
  } = {}
): LiveBudgetResult {
  const hiddenAssetIds = new Set<string>();
  const keptNewestFirst: string[] = [];
  const evictedLayerIds: string[] = [];
  let visibleAssetCount = 0;
  let movingSourceCount = options.screenActive ? 1 : 0;

  [...layers].reverse().forEach((layer) => {
    const focusedId = layer.kind === "scene" ? options.focusedSceneMembers?.[layer.scene.id] : undefined;
    const assets = (layer.kind === "asset" ? [layer.asset] : focusedId ? layer.assets.filter((asset) => asset.id === focusedId) : layer.assets)
      .filter((asset) => !options.alreadyHidden?.has(asset.id));
    const locallyHidden = new Set<string>();
    let localMovingSources = 0;
    assets.forEach((asset) => {
      if (asset.kind !== "video") return;
      if (movingSourceCount + localMovingSources < MAX_LIVE_MOVING_SOURCES) localMovingSources += 1;
      else locallyHidden.add(asset.id);
    });
    const drawable = assets.filter((asset) => !locallyHidden.has(asset.id));
    if (!drawable.length || visibleAssetCount + drawable.length > MAX_LIVE_VISUALS) {
      evictedLayerIds.push(layer.id);
      return;
    }
    locallyHidden.forEach((id) => hiddenAssetIds.add(id));
    movingSourceCount += localMovingSources;
    visibleAssetCount += drawable.length;
    keptNewestFirst.push(layer.id);
  });

  const kept = new Set(keptNewestFirst);
  return {
    layerIds: layers.map((layer) => layer.id).filter((id) => kept.has(id)),
    hiddenAssetIds,
    evictedLayerIds,
    visibleAssetCount,
    movingSourceCount
  };
}
