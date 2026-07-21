import { describe, expect, it } from "vitest";
import type { StudioAsset } from "../types";
import { deriveConcepts, reconcileConcepts } from "./concepts";

const asset = (id: string, name: string): StudioAsset => ({ id, name, kind: "image", placement: "center", size: "medium", dataView: "table" });

describe("concept organization", () => {
  it("groups related filenames into the way a presenter thinks", () => {
    const concepts = deriveConcepts([asset("a", "pricing.png"), asset("b", "pricing-chart.png"), asset("c", "dashboard.png")], []);
    expect(concepts).toHaveLength(2);
    expect(concepts.find((concept) => concept.displayName === "Pricing")?.assetIds).toEqual(["a", "b"]);
  });

  it("keeps edits and adds newly imported visuals without duplicating membership", () => {
    const initial = deriveConcepts([asset("a", "pricing.png")], []);
    initial[0] = { ...initial[0], displayName: "Plans", aliases: ["plans", "pricing"] };
    const next = reconcileConcepts(initial, [asset("a", "pricing.png"), asset("b", "dashboard.png")], []);
    expect(next[0].displayName).toBe("Plans");
    expect(next.flatMap((concept) => concept.assetIds).sort()).toEqual(["a", "b"]);
  });

  it("does not collapse generic camera-roll filenames into one first visual", () => {
    const concepts = deriveConcepts([
      asset("a", "Screenshot 2026-07-20 100001.png"),
      asset("b", "Screenshot 2026-07-20 100002.png"),
      asset("c", "Screenshot 2026-07-20 100003.png")
    ], []);
    expect(concepts).toHaveLength(3);
    expect(concepts.map((concept) => concept.assetIds)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("migrates an existing generic first-asset group without changing named Concepts", () => {
    const visuals = [asset("a", "Screenshot 100001.png"), asset("b", "Screenshot 100002.png")];
    const legacy = [{
      id: "concept-screenshot-a",
      displayName: "Screenshot",
      aliases: ["screenshot"],
      assetIds: ["a", "b"],
      primaryAssetId: "a",
      confirmationGesture: "pinch" as const,
      animation: "fade" as const,
      cooldownMs: 650,
      sceneIds: []
    }];
    const migrated = reconcileConcepts(legacy, visuals, []);
    expect(migrated).toHaveLength(2);
    expect(migrated.map((concept) => concept.assetIds)).toEqual([["a"], ["b"]]);
    expect(migrated.map((concept) => concept.displayName)).toEqual(["Visual 1", "Visual 2"]);
  });
});
