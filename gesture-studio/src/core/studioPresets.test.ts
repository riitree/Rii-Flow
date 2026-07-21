import { describe, expect, it } from "vitest";
import type { StudioAsset, StudioScene } from "../types";
import { applyPresetToAssets, applyPresetToScenes, STUDIO_PRESETS } from "./studioPresets";

describe("studio presets", () => {
  it("provides focused use-case starting points", () => {
    expect(STUDIO_PRESETS.map((preset) => preset.id)).toEqual(["talking-head", "screen-tutorial", "commentary", "product-demo", "vertical-short"]);
  });

  it("applies layout defaults without discarding asset-specific behavior", () => {
    const source: StudioAsset = { id: "asset", name: "Clip", kind: "video", placement: "left", size: "small", dataView: "table", includeAudio: true, gesture: "two", transform: { x: 0.2, y: 0.2, scale: 2 } };
    const [result] = applyPresetToAssets([source], STUDIO_PRESETS[2]);
    expect(result).toMatchObject({ placement: "right", cameraReflow: "make-room", includeAudio: true, gesture: "two" });
    expect(result.transform).toBeUndefined();
  });

  it("preserves per-member focus choices while resetting template geometry", () => {
    const source: StudioScene = { id: "scene", name: "Scene", memberIds: ["a", "b"], placement: "center", size: "small", layout: "grid", memberFocusModes: { a: "full", b: "off" }, memberTransforms: { a: { x: 0.2, y: 0.2, scale: 2 } } };
    const [result] = applyPresetToScenes([source], STUDIO_PRESETS[3]);
    expect(result.memberFocusModes).toEqual({ a: "full", b: "off" });
    expect(result.memberTransforms).toBeUndefined();
  });
});
