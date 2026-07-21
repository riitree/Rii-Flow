import type { CanvasAspectId } from "./aspect";
import type { CaptionStyle } from "./captions";
import type { QualityId } from "./quality";
import type { ScreenOverlaySettings, StudioAsset, StudioScene } from "../types";

export type StudioPresetId = "talking-head" | "screen-tutorial" | "commentary" | "product-demo" | "vertical-short";

export interface StudioPreset {
  id: StudioPresetId;
  name: string;
  detail: string;
  aspectId: CanvasAspectId;
  qualityId: QualityId;
  mirrorCamera: boolean;
  assetDefaults: Partial<StudioAsset>;
  sceneDefaults: Partial<StudioScene>;
  screenOverlay: Pick<ScreenOverlaySettings, "placement" | "size">;
  captionStyle: Partial<CaptionStyle>;
}

export const STUDIO_PRESETS: readonly StudioPreset[] = [
  {
    id: "talking-head", name: "Talking head", detail: "Clean camera with compact visual callouts",
    aspectId: "landscape", qualityId: "1080p30", mirrorCamera: true,
    assetDefaults: { placement: "corner", size: "small", cameraReflow: "overlay", stageBackground: "camera", entranceAnimation: "pop", motionEffect: "none" },
    sceneDefaults: { layout: "grid", placement: "center", size: "medium", revealSide: "none", stageBackground: "camera", entranceAnimation: "fade", motionEffect: "none" },
    screenOverlay: { placement: "right", size: "medium" },
    captionStyle: { preset: "clean", position: "bottom", font: "system", fontScale: 1, anchorX: 0.5, anchorY: 0.84 }
  },
  {
    id: "screen-tutorial", name: "Screen tutorial", detail: "Large shared screen with camera-friendly callouts",
    aspectId: "landscape", qualityId: "1080p30", mirrorCamera: true,
    assetDefaults: { placement: "lower", size: "small", cameraReflow: "overlay", stageBackground: "camera", entranceAnimation: "slide", motionEffect: "none" },
    sceneDefaults: { layout: "row", placement: "center", size: "medium", revealSide: "none", stageBackground: "camera", entranceAnimation: "fade", motionEffect: "none" },
    screenOverlay: { placement: "center", size: "full" },
    captionStyle: { preset: "clean", position: "bottom", font: "arial", fontScale: 0.9, anchorX: 0.5, anchorY: 0.9 }
  },
  {
    id: "commentary", name: "Commentary", detail: "Camera makes room for a strong side visual",
    aspectId: "landscape", qualityId: "1080p30", mirrorCamera: true,
    assetDefaults: { placement: "right", size: "medium", cameraReflow: "make-room", stageBackground: "camera", entranceAnimation: "slide", motionEffect: "none" },
    sceneDefaults: { layout: "spotlight", placement: "right", size: "medium", revealSide: "right", stageBackground: "camera", entranceAnimation: "slide", motionEffect: "none" },
    screenOverlay: { placement: "right", size: "medium" },
    captionStyle: { preset: "bold", position: "bottom", font: "system", fontScale: 1.05, anchorX: 0.5, anchorY: 0.86 }
  },
  {
    id: "product-demo", name: "Product demo", detail: "Centered media with focused collage moments",
    aspectId: "landscape", qualityId: "1080p30", mirrorCamera: true,
    assetDefaults: { placement: "center", size: "medium", cameraReflow: "overlay", stageBackground: "camera", entranceAnimation: "pop", motionEffect: "none" },
    sceneDefaults: { layout: "spotlight", placement: "center", size: "full", revealSide: "none", stageBackground: "camera", entranceAnimation: "pop", motionEffect: "none" },
    screenOverlay: { placement: "center", size: "medium" },
    captionStyle: { preset: "highlight", position: "bottom", font: "system", fontScale: 1, anchorX: 0.5, anchorY: 0.84 }
  },
  {
    id: "vertical-short", name: "Vertical short", detail: "Portrait framing with bold mobile captions",
    aspectId: "portrait", qualityId: "1080p30", mirrorCamera: true,
    assetDefaults: { placement: "center", size: "medium", cameraReflow: "overlay", stageBackground: "camera", entranceAnimation: "pop", motionEffect: "none" },
    sceneDefaults: { layout: "column", placement: "center", size: "medium", revealSide: "none", stageBackground: "camera", entranceAnimation: "pop", motionEffect: "none" },
    screenOverlay: { placement: "center", size: "medium" },
    captionStyle: { preset: "bold", position: "bottom", font: "impact", fontScale: 1.15, anchorX: 0.5, anchorY: 0.8 }
  }
];

export function applyPresetToAssets(assets: readonly StudioAsset[], preset: StudioPreset) {
  return assets.map((asset) => ({ ...asset, ...preset.assetDefaults, transform: undefined }));
}

export function applyPresetToScenes(scenes: readonly StudioScene[], preset: StudioPreset) {
  return scenes.map((scene) => ({
    ...scene,
    ...preset.sceneDefaults,
    transform: undefined,
    memberTransforms: undefined,
    memberOrder: undefined,
    memberFocusModes: Object.fromEntries(scene.memberIds.map((id) => [id, scene.memberFocusModes?.[id] ?? "medium"]))
  }));
}
