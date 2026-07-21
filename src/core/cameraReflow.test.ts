import { describe, expect, it } from "vitest";
import type { StudioAsset, StudioLayer, StudioScene } from "../types";
import { CameraReflowController, applyCameraReflow, CAMERA_REFLOW_DURATION_MS, cameraReflowPanelRatio, cameraReflowPanelRatioForFrame, cameraReflowPanelRatioForSide, cameraReflowTarget, visibleLayersForComposition } from "./cameraReflow";

const asset = (id: string, placement: "left" | "right", size: "small" | "medium" | "full" = "medium"): StudioLayer => ({
  id,
  kind: "asset",
  asset: { id, name: id, kind: "image", placement, size, dataView: "table", cameraReflow: "make-room" } as StudioAsset
});

const revealScene = (id: string, side: "left" | "right", size: "small" | "medium" | "full" = "medium"): StudioLayer => ({
  id: `scene:${id}`,
  kind: "scene",
  scene: { id, name: id, memberIds: ["a", "b"], placement: "center", size, layout: "grid", revealSide: side } as StudioScene,
  assets: []
});

describe("camera reflow", () => {
  it("uses predictable side regions without adding layout controls", () => {
    expect(cameraReflowPanelRatio("small")).toBe(0.3);
    expect(cameraReflowPanelRatio("medium")).toBe(0.4);
    expect(cameraReflowPanelRatio("full")).toBe(0.5);
    expect(cameraReflowPanelRatioForSide([
      asset("large", "left", "full"),
      asset("small", "left", "small"),
      asset("other-side", "right", "medium")
    ], "left")).toBe(0.5);
  });

  it("lets the newest make-room layer own the camera layout", () => {
    expect(cameraReflowTarget([asset("left", "left"), asset("right", "right", "full")])).toMatchObject({
      layerId: "right",
      assetSide: "right",
      panelRatio: 0.5
    });
  });

  it("lets a Side Reveal scene shift the camera with the same panel model", () => {
    expect(cameraReflowTarget([revealScene("story", "left", "medium")])).toMatchObject({
      layerId: "scene:story",
      assetSide: "left",
      panelRatio: 0.4
    });
    expect(cameraReflowPanelRatioForSide([
      revealScene("small", "right", "small"),
      revealScene("large", "right", "full")
    ], "right")).toBe(0.5);
  });

  it("keeps the side window sized for its largest still-live visual", () => {
    expect(cameraReflowTarget([
      asset("large-first", "right", "full"),
      asset("small-second", "right", "small")
    ])).toMatchObject({
      layerId: "small-second",
      assetSide: "right",
      panelRatio: 0.5
    });
    expect(cameraReflowTarget([
      asset("small-first", "left", "small"),
      asset("large-second", "left", "medium")
    ])).toMatchObject({
      layerId: "large-second",
      assetSide: "left",
      panelRatio: 0.4
    });
  });

  it("forgets a closed large cue before sizing the next small cue", () => {
    expect(cameraReflowTarget([asset("large", "right", "full")])?.panelRatio).toBe(0.5);
    expect(cameraReflowTarget([])).toBeNull();
    expect(cameraReflowTarget([asset("small", "right", "small")])?.panelRatio).toBe(0.3);
  });

  it("does not let an asset on the opposite side resize the active window", () => {
    expect(cameraReflowTarget([
      asset("large-left", "left", "full"),
      asset("small-right", "right", "small")
    ])).toMatchObject({
      layerId: "small-right",
      assetSide: "right",
      panelRatio: 0.3
    });
  });

  it("keeps camera reflow available with a coloured side background", () => {
    const coloured = asset("coloured", "left");
    if (coloured.kind !== "asset") throw new Error("Expected an asset layer");
    coloured.asset.stageBackground = "custom";
    coloured.asset.stageBackgroundColor = "#3456aa";
    expect(cameraReflowTarget([coloured])).toMatchObject({
      layerId: "coloured",
      assetSide: "left",
      panelRatio: 0.4
    });
  });

  it("keeps every earlier reflow cue visible while the newest owns the camera", () => {
    const overlay = { ...asset("overlay", "left"), asset: { ...(asset("overlay", "left") as Extract<StudioLayer, { kind: "asset" }>).asset, cameraReflow: "overlay" as const } } as StudioLayer;
    const layers = [asset("left", "left"), overlay, asset("right", "right")];
    expect(visibleLayersForComposition(layers).map((layer) => layer.id)).toEqual(["left", "overlay", "right"]);
    expect(cameraReflowTarget(layers)?.layerId).toBe("right");
  });

  it("smoothly shifts and restores the camera", () => {
    const controller = new CameraReflowController();
    const target = cameraReflowTarget([asset("right", "right", "full")]);
    expect(controller.update(target, 0)).toMatchObject({ x: 0, width: 1, transitioning: true });
    const midpoint = controller.update(target, CAMERA_REFLOW_DURATION_MS / 2);
    expect(midpoint.width).toBeCloseTo(0.5625);
    expect(controller.update(target, CAMERA_REFLOW_DURATION_MS)).toMatchObject({ x: 0, width: 0.5, transitioning: false });
    expect(controller.update(null, 300)).toMatchObject({ width: 0.5, transitioning: true });
    expect(controller.update(null, 300 + CAMERA_REFLOW_DURATION_MS)).toMatchObject({ x: 0, width: 1, transitioning: false });
  });

  it("keeps the panel edge attached to the camera while changing cue sizes", () => {
    const controller = new CameraReflowController();
    const large = cameraReflowTarget([asset("large", "right", "full")]);
    const small = cameraReflowTarget([asset("small", "right", "small")]);
    controller.update(large, 0);
    expect(cameraReflowPanelRatioForFrame(controller.update(large, CAMERA_REFLOW_DURATION_MS))).toBeCloseTo(0.5);
    controller.update(null, 260);
    const changing = controller.update(small, 300);
    expect(cameraReflowPanelRatioForFrame(changing)).toBeCloseTo(1 - changing.width);
    expect(cameraReflowPanelRatioForFrame(controller.update(small, 300 + CAMERA_REFLOW_DURATION_MS))).toBeCloseTo(0.3);
    expect(cameraReflowPanelRatioForFrame(controller.update(null, 600))).toBeUndefined();
  });

  it("applies reflow inside the existing camera border viewport", () => {
    expect(applyCameraReflow(
      { x: 100, y: 60, width: 1720, height: 960 },
      { x: 0.4, width: 0.6, target: null, transitioning: false }
    )).toEqual({ x: 788, y: 60, width: 1032, height: 960 });
  });
});
