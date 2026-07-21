export const GESTURES = [
  { id: "one", label: "One finger", source: "Pointing_Up" },
  { id: "two", label: "Two fingers", source: "Victory" },
  { id: "three", label: "Three fingers", source: "Landmarks" },
  { id: "four", label: "Four fingers", source: "Landmarks" },
  { id: "thumb", label: "Thumb up", source: "Thumb_Up" },
  { id: "love", label: "Love sign", source: "ILoveYou" },
  { id: "double-two", label: "Two peace signs", source: "Victory + Victory" },
  { id: "double-thumb", label: "Two thumbs up", source: "Thumb_Up + Thumb_Up" },
  { id: "thumb-two", label: "Thumb + peace", source: "Thumb_Up + Victory" }
] as const;

export type GestureId = (typeof GESTURES)[number]["id"];
export type RecognizedGesture = GestureId | "palm" | "fist" | null;
export type Placement = "left" | "right" | "corner" | "lower" | "center";
export type AssetSize = "small" | "medium" | "full";
export type AssetKind = "image" | "video" | "csv" | "json";
export type StageBackground = "camera" | "black" | "white" | "cream" | "custom";
export type DataView = "table" | "chart";
export type SceneLayout = "grid" | "row" | "column" | "spotlight" | "cascade";
export type EntranceAnimation = "none" | "fade" | "pop" | "slide" | "bounce" | "float";
export type CueSound = "none" | "soft" | "pop" | "chime" | "bottle" | "enter";
export type TriggerHand = "any" | "left" | "right";
export type ImageCropAspect = "free" | "1:1" | "16:9" | "9:16";
export type DataCell = string | number | boolean | null;
export type DataRow = Record<string, DataCell>;

export interface AssetTransform {
  x: number;
  y: number;
  scale: number;
}

export interface ImageCrop {
  aspect: ImageCropAspect;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoTrim {
  start: number;
  end: number;
}

export interface StudioAsset {
  id: string;
  name: string;
  kind: AssetKind;
  sourceUrl?: string;
  rows?: DataRow[];
  gesture?: GestureId;
  placement: Placement;
  size: AssetSize;
  dataView: DataView;
  stageBackground?: StageBackground;
  stageBackgroundColor?: string;
  includeAudio?: boolean;
  entranceAnimation?: EntranceAnimation;
  cueSound?: CueSound;
  cueVolume?: number;
  transform?: AssetTransform;
  imageCrop?: ImageCrop;
  mediaDuration?: number;
  videoTrim?: VideoTrim;
}

/** A scene template supplies starting slots. Whole-scene and member edits can
 * both use the mouse; member transforms stay relative to the group so palm
 * edits and later scene movement preserve the composition. */
export interface StudioScene {
  id: string;
  name: string;
  memberIds: string[];
  gesture?: GestureId;
  placement: Placement;
  size: AssetSize;
  layout: SceneLayout;
  stageBackground?: StageBackground;
  stageBackgroundColor?: string;
  entranceAnimation?: EntranceAnimation;
  cueSound?: CueSound;
  cueVolume?: number;
  transform?: AssetTransform;
  memberTransforms?: Record<string, AssetTransform>;
  memberOrder?: string[];
}

export type StudioLayer =
  | { id: string; kind: "asset"; asset: StudioAsset }
  | { id: string; kind: "scene"; scene: StudioScene; assets: StudioAsset[] };

export interface CameraOption {
  deviceId: string;
  label: string;
}

export interface MicrophoneOption {
  deviceId: string;
  label: string;
}

export interface GrantedVideoSettings {
  width: number;
  height: number;
  frameRate: number;
  deviceId: string;
}

export interface ScreenCaptureSettings {
  width: number;
  height: number;
  frameRate: number;
  label: string;
  displaySurface?: "browser" | "monitor" | "window";
  hasAudio: boolean;
}

export interface ScreenOverlaySettings {
  placement: Placement;
  size: AssetSize;
  transform?: AssetTransform;
  visible: boolean;
}
