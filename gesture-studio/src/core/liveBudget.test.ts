import { describe, expect, it } from "vitest";
import type { StudioAsset, StudioLayer, StudioScene } from "../types";
import { enforceLiveBudget, MAX_LIVE_MOVING_SOURCES, MAX_LIVE_VISUALS } from "./liveBudget";

const asset = (id: string, kind: StudioAsset["kind"] = "image"): StudioAsset => ({ id, name: id, kind, placement: "corner", size: "small", dataView: "table" });
const layer = (id: string, kind: StudioAsset["kind"] = "image"): StudioLayer => ({ id, kind: "asset", asset: asset(id, kind) });
const scene = (id: string, members: StudioAsset[]): StudioLayer => ({
  id: `scene:${id}`,
  kind: "scene",
  scene: { id, name: id, memberIds: members.map((item) => item.id), placement: "center", size: "medium", layout: "grid" } as StudioScene,
  assets: members
});

describe("live composition budget", () => {
  it("keeps the newest eight visuals", () => {
    const layers = Array.from({ length: MAX_LIVE_VISUALS + 2 }, (_, index) => layer(`asset-${index}`));
    const result = enforceLiveBudget(layers);
    expect(result.layerIds).toHaveLength(MAX_LIVE_VISUALS);
    expect(result.layerIds).not.toContain("asset-0");
    expect(result.layerIds).toContain(`asset-${MAX_LIVE_VISUALS + 1}`);
  });

  it("counts screen sharing and pauses surplus scene video members", () => {
    const result = enforceLiveBudget([scene("demo", [asset("a", "video"), asset("b", "video"), asset("still")])], { screenActive: true });
    expect(result.movingSourceCount).toBe(MAX_LIVE_MOVING_SOURCES);
    expect(result.hiddenAssetIds).toEqual(new Set(["b"]));
    expect(result.layerIds).toEqual(["scene:demo"]);
  });

  it("only budgets the focused scene member", () => {
    const result = enforceLiveBudget([scene("demo", [asset("a", "video"), asset("b", "video")])], { screenActive: true, focusedSceneMembers: { demo: "b" } });
    expect(result.hiddenAssetIds.size).toBe(0);
    expect(result.visibleAssetCount).toBe(1);
  });
});
