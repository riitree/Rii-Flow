import { describe, expect, it } from "vitest";
import type { GestureSequenceMap, StudioAsset, StudioScene } from "../types";
import { gestureCueAtCursor, gestureSequenceLayerIds, normalizeGestureSequences, reorderGestureCue } from "./gestureSequences";
import { sceneLayerId } from "./scenes";

const asset = (id: string, gesture: StudioAsset["gesture"]): StudioAsset => ({
  id,
  name: `${id}.png`,
  kind: "image",
  gesture,
  placement: "corner",
  size: "small",
  dataView: "table"
});

const scene = (id: string, gesture: StudioScene["gesture"]): StudioScene => ({
  id,
  name: id,
  memberIds: ["member-a", "member-b"],
  gesture,
  placement: "center",
  size: "small",
  layout: "grid"
});

describe("gesture sequences", () => {
  it("turns duplicate gesture assignments into an ordered cue sequence", () => {
    const assets = [asset("first", "one"), asset("second", "one")];
    expect(gestureSequenceLayerIds("one", assets, [], {})).toEqual(["first", "second"]);
    expect(gestureCueAtCursor("one", 1, assets, [], {})?.layer.id).toBe("second");
    expect(gestureCueAtCursor("one", 2, assets, [], {})?.layer.id).toBe("first");
  });

  it("keeps scenes and standalone assets in one gesture sequence", () => {
    const assets = [asset("member-a", undefined), asset("member-b", undefined), asset("standalone", "two")];
    const scenes = [scene("story", "two")];
    expect(gestureSequenceLayerIds("two", assets, scenes, {})).toEqual([sceneLayerId("story"), "standalone"]);
  });

  it("persists reordered cues and sequence behavior", () => {
    const assets = [asset("first", "one"), asset("second", "one")];
    const reordered = reorderGestureCue("one", "second", -1, assets, [], {});
    const configured: GestureSequenceMap = { ...reordered, one: { ...reordered.one!, mode: "replace" } };
    expect(normalizeGestureSequences(assets, [], configured).one).toEqual({ order: ["second", "first"], mode: "replace" });
  });
});
