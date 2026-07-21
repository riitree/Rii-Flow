import { describe, expect, it } from "vitest";
import type { StudioAsset, StudioScene } from "../types";
import { adjacentDirectorCueIndex, buildDirectorQueue, directorCueIndex } from "./directorQueue";

const asset = (id: string): StudioAsset => ({ id, name: id, kind: "image", placement: "center", size: "small", dataView: "table" });

describe("live director queue", () => {
  it("preserves import order while replacing scene members with one cue", () => {
    const assets = [asset("before"), asset("a"), asset("between"), asset("b"), asset("after")];
    const scene: StudioScene = { id: "compare", name: "Compare", memberIds: ["a", "b"], placement: "center", size: "full", layout: "row" };
    expect(buildDirectorQueue(assets, [scene]).map((layer) => layer.id)).toEqual(["before", "scene:compare", "between", "after"]);
  });

  it("keeps the remembered cursor while the stage is hidden", () => {
    const queue = buildDirectorQueue([asset("a"), asset("b")], []);
    expect(directorCueIndex(queue, null, 1)).toBe(1);
  });

  it("stops cleanly at the beginning and end", () => {
    expect(adjacentDirectorCueIndex(3, 0, -1)).toBe(0);
    expect(adjacentDirectorCueIndex(3, 2, 1)).toBe(2);
    expect(adjacentDirectorCueIndex(0, 0, 1)).toBe(-1);
  });
});
