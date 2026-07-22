import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Archive,
  BarChart3,
  Camera,
  Captions,
  Check,
  ChevronDown,
  Circle,
  Crop,
  Download,
  Eye,
  EyeOff,
  FileJson2,
  FileSpreadsheet,
  FlipHorizontal2,
  FolderOpen,
  Gauge,
  Hand,
  HardDrive,
  Heart,
  HelpCircle,
  Image as ImageIcon,
  Layers3,
  LayoutGrid,
  ListVideo,
  LoaderCircle,
  Maximize2,
  Mic,
  Music2,
  Monitor,
  Moon,
  MousePointer2,
  Move,
  Pencil,
  Play,
  Plus,
  Radio,
  Repeat2,
  RotateCcw,
  Scissors,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Type,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import { ImageCropEditor } from "./components/ImageCropEditor";
import { TrimTimeline } from "./components/TrimTimeline";
import { applyAssetTransform, baseAssetRect, composeFrame, constrainAssetTransform, reflowAssetPanelRect, sceneBaseRect, sceneDisplayRect, sceneFocusedMemberRect, sceneMemberCanvasTransform, sceneMemberContentRects, sceneMemberDisplayRects, sceneMemberDrawOrder, sceneMemberRelativeTransform, stageBackdropForLayers, type Rect } from "./core/compositor";
import { CANVAS_ASPECTS, canvasDimensions, type CanvasAspectId } from "./core/aspect";
import {
  closeStudioAudioMixer,
  connectMicrophone,
  connectScreenAudio,
  connectVideoAudio,
  createStudioAudioMixer,
  mixedAudioStream,
  playCueSound,
  readMicrophoneLevel,
  removeVideoAudio,
  setMediaMonitoring,
  setVideoAudioEnabled,
  type StudioAudioMixer
} from "./core/audio";
import { startCaptionCapture, type CaptionAudio, type CaptionCaptureSession } from "./core/captionCapture";
import { transcribeEnglish, transcribeTriggerEnglish, warmEnglishTranscriber, type CaptionProgress } from "./core/captionClient";
import { editedFileName, editedRenderProfile, renderCaptionedTake } from "./core/captionRender";
import { activeCaptionAt, CAPTION_FONTS, captionAnchorFromPoint, captionFontFamily, captionPresetAnchor, DEFAULT_CAPTION_STYLE, drawCaption, normalizeCaptionStyle, retimeCaptionSegment, type CaptionSegment, type CaptionStyle } from "./core/captions";
import { activeWordAnimationAt, buildWordAnimationCues, retimeWordAnimationCue, type WordAnimationCue } from "./core/wordCues";
import { normalizeTriggerWord, suggestAssetTrigger, suggestSceneTrigger, triggerTargets, type VoiceTriggerTarget } from "./core/voiceTriggers";
import { normalizeConceptAliases, reconcileConcepts, type StudioConcept } from "./core/concepts";
import { IntentEngine, type IntentCandidate } from "./core/intentEngine";
import { StudioEventBus } from "./core/studioEvents";
import { SwipeTracker } from "./core/swipe";
import { MAX_OPERATOR_SHELF_ITEMS, operatorShelfRects, operatorShelfTargetAt, PalmCommandTracker, type OperatorShelfItem } from "./core/operatorControls";
import { cameraFrameColor, cameraFrameViewport, DEFAULT_CAMERA_FRAME, MAX_CAMERA_FRAME_PERCENT, MIN_CAMERA_FRAME_PERCENT, normalizeCameraFrame, type CameraFrameMode, type CameraFrameSettings } from "./core/cameraFrame";
import { ASSET_DECK_MODES, type AssetDeckMode } from "./core/assetDeck";
import { CameraReflowController, applyCameraReflow, cameraReflowPanelRatioForSide, cameraReflowTarget, visibleLayersForComposition, type CameraReflowFrame } from "./core/cameraReflow";
import { parseCsv, parseJson } from "./core/data";
import { GestureGate, GestureStabilizer, MIN_GESTURE_HOLD_MS, resolveCompositeGesture, resolveGesture, type Landmark } from "./core/gesture";
import { createGestureInferenceClient, type GestureFrameResult, type GestureInferenceClient, type InferenceCategory } from "./core/gestureInference";
import { gestureCueAtCursor, gestureSequenceLayerIds, normalizeGestureSequences, reorderGestureCue } from "./core/gestureSequences";
import { preferredCompositionDriver, replaceLatestFrame, videoFrameProcessor, type CompositionDriver } from "./core/framePipeline";
import { activateLayer, hideFocusedLayer, removeLayer, topmostStageHit, topmostStageHitForPoints, type StageHitCandidate } from "./core/layers";
import { enforceLiveBudget, MAX_LIVE_MOVING_SOURCES, MAX_LIVE_VISUALS } from "./core/liveBudget";
import { ManipulationTracker, manipulationFollowAlpha, mapControlPointForMirror, mapControlPointToStageViewport, mapPointForMovementReach, palmControlPoint, PalmSignalTracker, type ManipulationMode, type ManipulationUpdate, type PalmObservation } from "./core/manipulation";
import { fitImageCropToAspect, hasVideoTrim, normalizeImageCrop, normalizeVideoTrim } from "./core/mediaEdits";
import {
  createBrowserMediaProvider,
  createSyntheticMediaProvider,
  stopMediaStream,
  type CameraFeed,
  type MediaProvider,
  type MicrophoneFeed
} from "./core/mediaProvider";
import {
  bitrateForActual,
  formatBitrate,
  QUALITY_PRESETS,
  qualityPreset,
  recommendedQualityForDevice,
  type QualityId,
  type QualityPreset
} from "./core/quality";
import { compositionFrameBudget, compositionHealth, normalizedCompositionFps, shouldComposeFrame, type CompositionHealth } from "./core/performance";
import { PointFocusTracker } from "./core/pointFocus";
import { CircleMorphTracker, drawAssetMorphExit, type AssetMorphExit } from "./core/assetMorph";
import { drawStageSpotlight } from "./core/spotlight";
import { DeckScrollController } from "./core/deckScroll";
import { drawCanvasWidgets, drawLiveSticker, liveStickerRect, orbitPointRearmed, orbitTargetAtPoint, pointNearOrbit, widgetAtPoint, widgetRect, type CanvasWidget, type CanvasWidgetKind, type WidgetFrameStyle } from "./core/widgets";
import { compositionImageSize } from "./core/imageOptimization";
import { adjacentDirectorCueIndex, buildDirectorQueue, directorCueIndex } from "./core/directorQueue";
import { appendDirectorEvent, closeOpenDirectorEvents, nudgeDirectorEvent, removeDirectorEvent, type DirectorTrackEvent } from "./core/directorTrack";
import { composedStream, masterRecorderOptions, recordingMimeType } from "./core/recording";
import { constrainedSceneMemberIds, layerAssetIds, layerName, MAX_SCENE_ASSETS, MAX_SCENE_VIDEO_ASSETS, removeAssetFromScenes, resolveLayer, sceneLayerId, sceneMemberAtPalmCenter, sceneMemberLimitError } from "./core/scenes";
import { applyPresetToAssets, applyPresetToScenes, STUDIO_PRESETS, type StudioPresetId } from "./core/studioPresets";
import { normalizeVideoPlaybackMode, videoBoundaryAction } from "./core/videoPlayback";
import { assetsForMainDock, MAX_STYLE_ASSETS, VIDEO_STYLES, pointNearStyleDeck, retainedStyleTransform, styleAssetAtPoint, styleAssetsWithFocus, styleFocusBaseRect, styleTransformBounds, videoStyleLayout, type VideoStyleId } from "./core/videoStyles";
import { mergeTakeLibrary, takesForProject } from "./core/takeLibrary";
import {
  createBlankProject,
  deleteAssetBlob,
  deleteTake,
  getCurrentProjectId,
  listProjects,
  listTakes,
  loadCaptionAudio,
  loadCaptionDocument,
  loadAssetBlob,
  loadProject,
  loadRecordingsDirectory,
  requestPersistentStorage,
  saveAssetBlob,
  saveCaptionAudio,
  saveCaptionDocument,
  saveProject,
  saveRecordingsDirectory,
  saveTake,
  setCurrentProjectId,
  takeFileName,
  type ProjectSummary,
  type StoredTake,
  type StudioProjectSnapshot
} from "./core/studioPersistence";
import {
  GESTURES,
  type StageBackground,
  type AssetSize,
  type CameraOption,
  type CameraReflow,
  type CueSound,
  type EntranceAnimation,
  type GestureId,
  type GestureSequenceMap,
  type GestureSequenceMode,
  type GrantedVideoSettings,
  type ImageCropAspect,
  type MicrophoneOption,
  type MotionEffect,
  type Placement,
  type RecognizedGesture,
  type ScreenCaptureSettings,
  type ScreenOverlaySettings,
  type StudioAsset,
  type StudioLayer,
  type StudioScene,
  type VideoPlaybackMode,
  type SceneLayout,
  type SceneMemberFocusMode,
  type SceneRevealMotion,
  type SceneRevealSide
} from "./types";

const TUTORIAL_STEPS = [
  { target: "welcome", eyebrow: "Welcome", title: "Your live video desk", body: "Rii-Flow records the canvas exactly as you see it. Set up once, then present with your hands instead of editing afterward." },
  { target: "media", eyebrow: "Step 1", title: "Bring in what you want to show", body: "Choose your pictures and videos. They appear in a short list, ready for your live presentation." },
  { target: "layout", eyebrow: "Step 2", title: "Choose one look", body: "Clean, Side by side, or Freeform—that is all you need to decide. Rii-Flow handles the layout underneath." },
  { target: "devices", eyebrow: "Step 3", title: "Check camera and microphone", body: "Your essential device choices stay at the top. Extra visual and recording settings are hidden until you ask for them." },
  { target: "gestures", eyebrow: "Step 4", title: "Simple gestures do the work", body: "Point and hold opens an item. Thumbs-up opens the deck. Open palm flicks to scroll. One fist closes the current visual; two fists clear every visual and widget." },
  { target: "record", eyebrow: "Step 5", title: "Record the finished canvas", body: "Start the camera, press Record, and present naturally. Everything visible on the canvas is captured together." }
] as const;

type StudioPhase = "idle" | "permission" | "loading" | "switching" | "stopping" | "ready" | "error";
type MicrophonePhase = "idle" | "permission" | "switching" | "ready" | "off" | "error";
type ScreenPhase = "idle" | "permission" | "ready" | "error";
type CaptionEditorStatus = "idle" | "loading" | "transcribing" | "ready" | "rendering" | "done" | "error";
type ThemeMode = "dark" | "light";

interface RecordedClip extends StoredTake {
  url?: string;
  availability: "ready" | "permission" | "missing" | "session";
}

interface PointFocusState {
  x: number;
  y: number;
  progress: number;
  targetName?: string;
}

interface ArmedVoiceTarget extends VoiceTriggerTarget {
  heardText: string;
  source: "voice" | "shelf";
  armedAt: number;
  expiresAt: number;
}

interface SpotlightState {
  layerId: string;
  sceneMemberId?: string;
  name: string;
  progress: number;
}

type VisualTimelineEvent = DirectorTrackEvent;

interface PointerEditSession {
  pointerId: number;
  mode: "drag" | "scale";
  startClientX: number;
  startClientY: number;
  stageWidth: number;
  stageHeight: number;
  base: Rect;
  bounds?: Rect;
  initial: { x: number; y: number; scale: number };
  layerId: string;
  sceneMemberId?: string;
  sceneGroupRect?: Rect;
  moved: boolean;
}

interface WidgetPointerEditSession {
  pointerId: number;
  mode: "drag" | "scale";
  widgetId: string;
  startClientX: number;
  startClientY: number;
  stageWidth: number;
  stageHeight: number;
  initial: { x: number; y: number; scale: number };
  moved: boolean;
}

type DirectoryPermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
};

type DisplayMediaRequestOptions = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
};

type CaptureHandleMediaDevices = MediaDevices & {
  setCaptureHandleConfig?: (config: { exposeOrigin: boolean; handle: string; permittedOrigins: string[] }) => void;
};

type CaptureHandleTrack = MediaStreamTrack & {
  getCaptureHandle?: () => { handle?: string; origin?: string } | null;
};

const RII_FLOW_CAPTURE_HANDLE = "rii-flow-recording-canvas-v1";

async function directoryPermission(handle: FileSystemDirectoryHandle, request = false) {
  const permissionHandle = handle as DirectoryPermissionHandle;
  const descriptor = { mode: "readwrite" as const };
  const current = permissionHandle.queryPermission ? await permissionHandle.queryPermission(descriptor) : "prompt";
  if (current === "granted" || !request || !permissionHandle.requestPermission) return current;
  return permissionHandle.requestPermission(descriptor);
}

async function uniqueRecordingFileName(directory: FileSystemDirectoryHandle, preferred: string) {
  const extension = ".mp4";
  const base = preferred.toLowerCase().endsWith(extension) ? preferred.slice(0, -extension.length) : preferred;
  for (let suffix = 0; suffix < 500; suffix += 1) {
    const candidate = suffix ? `${base} (${suffix + 1})${extension}` : `${base}${extension}`;
    try {
      await directory.getFileHandle(candidate);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") return candidate;
      throw error;
    }
  }
  return `${base}-${Date.now()}${extension}`;
}

const PLACEMENTS: { id: Placement; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "corner", label: "Corner" },
  { id: "lower", label: "Lower third" },
  { id: "center", label: "Center" }
];

const ASSET_SIZES: { id: AssetSize; label: string }[] = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "full", label: "Full screen" }
];

const STAGE_BACKGROUNDS: { id: StageBackground; label: string }[] = [
  { id: "camera", label: "Keep live source" },
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
  { id: "cream", label: "Cream" },
  { id: "custom", label: "Custom colour" }
];

const ENTRANCE_ANIMATIONS: { id: EntranceAnimation; label: string }[] = [
  { id: "none", label: "No animation" },
  { id: "fade", label: "Fade" },
  { id: "pop", label: "Pop" },
  { id: "slide", label: "Slide up" },
  { id: "bounce", label: "Bounce" },
  { id: "float", label: "Float in" },
  { id: "slide-left", label: "Sweep from left" },
  { id: "slide-right", label: "Sweep from right" },
  { id: "zoom", label: "Zoom in" },
  { id: "drop", label: "Drop in" }
];

const MOTION_EFFECTS: { id: MotionEffect; label: string }[] = [
  { id: "none", label: "Stay still" },
  { id: "float", label: "Gentle float" },
  { id: "pulse", label: "Soft pulse" },
  { id: "sway", label: "Side sway" },
  { id: "drift", label: "Slow drift" }
];

const CUE_SOUNDS: { id: CueSound; label: string }[] = [
  { id: "none", label: "No sound" },
  { id: "whoosh", label: "Whoosh" },
  { id: "shutter", label: "Camera shutter" },
  { id: "film", label: "Film roll" },
  { id: "bottle", label: "Pop out" },
  { id: "chime", label: "Chime" },
];

type SpawnStyleId = "clean" | "quiet-glide" | "quiet-pop" | "glide" | "pop" | "bounce" | "sweep-left" | "sweep-right" | "zoom" | "drop";
const SPAWN_STYLES: readonly { id: SpawnStyleId; label: string; animation: EntranceAnimation; sound: CueSound }[] = [
  { id: "clean", label: "Clean · silent fade", animation: "fade", sound: "none" },
  { id: "quiet-glide", label: "Quiet glide", animation: "slide", sound: "none" },
  { id: "quiet-pop", label: "Quiet pop", animation: "pop", sound: "none" },
  { id: "glide", label: "Glide · whoosh", animation: "slide", sound: "whoosh" },
  { id: "pop", label: "Pop · pop sound", animation: "pop", sound: "bottle" },
  { id: "bounce", label: "Bounce · chime", animation: "bounce", sound: "chime" },
  { id: "sweep-left", label: "Sweep left · whoosh", animation: "slide-left", sound: "whoosh" },
  { id: "sweep-right", label: "Sweep right · whoosh", animation: "slide-right", sound: "whoosh" },
  { id: "zoom", label: "Zoom · shutter", animation: "zoom", sound: "shutter" },
  { id: "drop", label: "Drop · film roll", animation: "drop", sound: "film" }
];

function spawnStyleFor(animation?: EntranceAnimation, sound?: CueSound): SpawnStyleId | "custom" {
  return SPAWN_STYLES.find((style) => style.animation === (animation ?? "fade") && style.sound === (sound ?? "none"))?.id ?? "custom";
}

const ACTIVATION_GESTURES = GESTURES.filter((gesture) => gesture.id !== "one" && gesture.id !== "double-fist");
const STANDALONE_ASSET_GESTURES = GESTURES.filter((gesture) => ["two", "three", "four", "double-one"].includes(gesture.id));

function GesturePosture({ gesture }: { gesture: GestureId }) {
  if (gesture === "three" || gesture === "four") {
    const fingers = gesture === "three" ? [25, 36, 47] : [19, 29, 39, 49];
    return <span className="gesture-posture emoji counted-hand" aria-hidden="true">
      <svg viewBox="0 0 68 66">
        <path className="emoji-hand-palm" d="M17 35 C22 29 48 29 54 36 L55 46 C56 58 47 64 35 64 C23 64 14 57 15 47Z" />
        {fingers.map((x, index) => <g key={x}><path className="emoji-hand-finger" d={`M${x} 35 L${x} ${index === 0 || index === fingers.length - 1 ? 15 : 9}`} /><path className="emoji-hand-nail" d={`M${x - 2.5} ${index === 0 || index === fingers.length - 1 ? 16 : 10} Q${x} ${index === 0 || index === fingers.length - 1 ? 13 : 7} ${x + 2.5} ${index === 0 || index === fingers.length - 1 ? 16 : 10}`} /></g>)}
        <path className="emoji-hand-thumb" d="M18 39 C10 32 5 34 7 41 C9 47 14 51 20 52" />
        <path className="emoji-hand-fold" d="M22 47 Q35 42 49 47" />
      </svg>
      <i>{gesture === "three" ? "3" : "4"}</i>
    </span>;
  }
  const emoji = gesture === "double-one" ? "☝️☝️" : gesture === "two" ? "✌️" : "☝️";
  const count = gesture === "double-one" ? "1+1" : gesture === "two" ? "2" : "1";
  return <span className={`gesture-posture emoji ${gesture === "double-one" ? "double" : ""}`} aria-hidden="true"><b>{emoji}</b><i>{count}</i></span>;
}

const OUTPUT_RESOLUTIONS = [
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p" },
  { id: "4k", label: "4K" }
] as const;
const SCENE_MEMBER_FOCUS_MODES: { id: SceneMemberFocusMode; label: string }[] = [
  { id: "off", label: "No focus" },
  { id: "medium", label: "Focus medium" },
  { id: "full", label: "Focus full" }
];

const SCENE_TEMPLATES: { id: SceneLayout; label: string; detail: string }[] = [
  { id: "grid", label: "Story grid", detail: "Everything gets an equal box" },
  { id: "row", label: "Side by side", detail: "Pictures sit next to each other" },
  { id: "column", label: "Top to bottom", detail: "Pictures stack in one line" },
  { id: "spotlight", label: "Big + small", detail: "One big picture with helpers" },
  { id: "cascade", label: "Gallery", detail: "Pictures overlap like cards" }
];

const SCENE_REVEAL_MOTIONS: { id: SceneRevealMotion; label: string }[] = [
  { id: "smooth", label: "Smooth slide" },
  { id: "soft", label: "Soft slide" },
  { id: "bounce", label: "Bounce slide" }
];

function normalizeStageBackground(value: unknown): StageBackground {
  if (value === "black" || value === "white" || value === "cream" || value === "custom" || value === "camera") return value;
  return "camera";
}

function normalizeCueSound(value: unknown): CueSound {
  if (value === "soft") return "chime";
  if (value === "pop") return "bottle";
  if (value === "enter") return "shutter";
  if (value === "whoosh" || value === "shutter" || value === "film" || value === "bottle" || value === "chime" || value === "none") return value;
  return "none";
}

function normalizeCameraReflow(value: unknown): CameraReflow {
  return value === "make-room" ? "make-room" : "overlay";
}

function normalizeSceneRevealSide(value: unknown): SceneRevealSide {
  return value === "left" || value === "right" ? value : "none";
}

function normalizeSceneRevealMotion(value: unknown): SceneRevealMotion {
  return value === "soft" || value === "bounce" ? value : "smooth";
}

const DEFAULT_TIMING = { holdMs: MIN_GESTURE_HOLD_MS, cooldownMs: 550 };
const VOICE_ARM_TIMEOUT_MS = 12_000;
const DEFAULT_MANIPULATION = { armMs: 140, releaseGraceMs: 180, hitPadding: 0.05 };
const SCENE_MEMBER_SELECTION_GRACE_MS = 320;
const SCREEN_OVERLAY_ID = "__live-screen-overlay__";
const DEFAULT_SCREEN_OVERLAY: ScreenOverlaySettings = { placement: "right", size: "medium", visible: false, entranceAnimation: "fade", cueSound: "none", cueVolume: 0.55 };
const CAMERA_FRAME_OPTIONS: { id: CameraFrameMode; label: string; color?: string }[] = [
  { id: "off", label: "Off" },
  { id: "black", label: "Black", color: "#050505" },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "custom", label: "Custom" }
];

function manipulationLabel(mode: ManipulationMode, subject = "layer") {
  if (mode === "arming-drag") return "Hold palm to grab";
  if (mode === "dragging") return `Moving ${subject}`;
  if (mode === "arming-scale") return "Hold both palms";
  if (mode === "scaling") return `Resizing ${subject}`;
  return "";
}

function diagnosticPalmLandmarks(x: number, y: number): Landmark[] {
  const points: Landmark[] = Array.from({ length: 21 }, () => ({ x, y }));
  points[0] = { x, y: y + 0.12 };
  points[5] = { x: x - 0.08, y };
  points[9] = { x, y: y - 0.02 };
  points[13] = { x: x + 0.04, y };
  points[17] = { x: x + 0.08, y: y + 0.02 };
  points[4] = { x: x - 0.15, y: y - 0.02 };
  points[8] = { x: x - 0.05, y: y - 0.18 };
  return points;
}

function diagnosticPinchLandmarks(x: number, y: number): Landmark[] {
  const points = diagnosticPalmLandmarks(x, y);
  points[4] = { x: x - 0.008, y: y - 0.11 };
  points[8] = { x: x + 0.008, y: y - 0.11 };
  return points;
}

function gestureLabel(gesture: RecognizedGesture) {
  if (gesture === "fist") return "Fist";
  if (gesture === "palm") return "Open palm";
  if (gesture === "pinch") return "Pinch";
  if (gesture === "one") return "Point to focus";
  return GESTURES.find((item) => item.id === gesture)?.label ?? "None";
}

async function compositionImageFromBlob(blob: Blob, originalUrl: string, rememberUrl: (url: string) => void) {
  const loadImage = async (url: string) => {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    try {
      await image.decode();
    } catch {
      await new Promise<void>((resolve, reject) => {
        if (image.complete && image.naturalWidth > 0) resolve();
        else {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => reject(new Error("Image pixels could not be decoded.")), { once: true });
        }
      });
    }
    return image;
  };
  const fallback = () => loadImage(originalUrl);
  if (!("createImageBitmap" in window)) return fallback();
  try {
    const bitmap = await createImageBitmap(blob);
    const size = compositionImageSize(bitmap.width, bitmap.height);
    if (!size.optimized) {
      bitmap.close();
      return fallback();
    }
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      bitmap.close();
      return fallback();
    }
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const optimizedBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.96));
    if (!optimizedBlob) return fallback();
    const optimizedUrl = URL.createObjectURL(optimizedBlob);
    rememberUrl(optimizedUrl);
    return loadImage(optimizedUrl);
  } catch {
    return fallback();
  }
}

function shortName(name: string, length = 24) {
  return name.length > length ? `${name.slice(0, length - 1)}…` : name;
}

function directorImportDefaults(kind: StudioAsset["kind"], ordinal: number, aspect: CanvasAspectId): Partial<StudioAsset> {
  if (kind === "csv" || kind === "json") {
    return { placement: "center", size: "medium", cameraReflow: "overlay", entranceAnimation: "pop" };
  }
  if (aspect === "portrait") {
    return { placement: "center", size: "medium", cameraReflow: "overlay", entranceAnimation: "pop" };
  }
  return {
    placement: ordinal % 2 === 0 ? "right" : "left",
    size: "medium",
    cameraReflow: "make-room",
    entranceAnimation: "slide"
  };
}

function formatDuration(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(wholeSeconds / 60).toString().padStart(2, "0")}:${(wholeSeconds % 60).toString().padStart(2, "0")}`;
}

function formatEditTime(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${minutes}:${remainder.toFixed(2).padStart(5, "0")}`;
}

function videoMetadata(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && Number.isFinite(video.duration)) return Promise.resolve(video.duration);
  return new Promise<number>((resolve) => {
    const timeout = window.setTimeout(() => resolve(Number.isFinite(video.duration) ? video.duration : 0), 5000);
    const finish = () => {
      window.clearTimeout(timeout);
      resolve(Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.addEventListener("loadedmetadata", finish, { once: true });
    video.addEventListener("error", finish, { once: true });
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function diagnosticAsset(label = "LIVE OVERLAY", color = "#e8b35d") {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#172026";
    context.fillRect(54, 54, canvas.width - 108, canvas.height - 108);
    context.fillStyle = "#f4f7f8";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 68px system-ui";
    context.fillText(label, canvas.width / 2, canvas.height / 2);
  }
  return canvas.toDataURL("image/png");
}

function diagnosticDisplayStream() {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#111827";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#1f2937";
    for (let x = 0; x < canvas.width; x += 160) context.fillRect(x, 0, 1, canvas.height);
    for (let y = 0; y < canvas.height; y += 120) context.fillRect(0, y, canvas.width, 1);
    context.fillStyle = "#68122f";
    context.fillRect(120, 130, 680, 500);
    context.fillStyle = "#f8fafc";
    context.font = "700 72px system-ui";
    context.fillText("SHARED SCREEN", 170, 245);
    context.font = "500 38px system-ui";
    context.fillText("Local preview · canvas composed", 170, 320);
  }
  return canvas.captureStream(60);
}

function screenOverlayAsset(capture: ScreenCaptureSettings, settings: ScreenOverlaySettings): StudioAsset {
  return {
    id: SCREEN_OVERLAY_ID,
    name: capture.label,
    kind: "image",
    placement: settings.placement,
    size: settings.size,
    transform: settings.transform,
    dataView: "table",
    stageBackground: "camera",
    entranceAnimation: settings.entranceAnimation ?? "fade",
    cueSound: settings.cueSound ?? "none",
    cueVolume: settings.cueVolume ?? 0.55
  };
}

function mergedAssetIds(...sets: ReadonlySet<string>[]) {
  return new Set(sets.flatMap((set) => [...set]));
}

function buildStageHitCandidates(
  stageWidth: number,
  stageHeight: number,
  liveLayerIds: readonly string[],
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[],
  images: Map<string, HTMLImageElement>,
  videos: Map<string, HTMLVideoElement>,
  sceneSolo: Readonly<Record<string, string>>,
  includeSceneGroups = true,
  hiddenAssetIds: ReadonlySet<string> = new Set()
) {
  const candidates: StageHitCandidate[] = [];
  const hitLayers = visibleLayersForComposition(liveLayerIds
    .map((layerId) => resolveLayer(layerId, assets, scenes))
    .filter((layer): layer is StudioLayer => Boolean(layer)));
  hitLayers.forEach((layer) => {
    const layerId = layer.id;
    if (layer.kind === "asset") {
      if (hiddenAssetIds.has(layer.asset.id)) return;
      const source = layer.asset.kind === "image" ? images.get(layer.asset.id) : videos.get(layer.asset.id);
      const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : undefined;
      const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : undefined;
      const base = baseAssetRect(stageWidth, stageHeight, layer.asset, sourceWidth, sourceHeight);
      const panelRatio = layer.asset.placement === "left" || layer.asset.placement === "right"
        ? cameraReflowPanelRatioForSide(hitLayers, layer.asset.placement)
        : null;
      const bounds = reflowAssetPanelRect(stageWidth, stageHeight, layer.asset, panelRatio ?? undefined) ?? undefined;
      candidates.push({
        layerId,
        rect: applyAssetTransform(stageWidth, stageHeight, base, layer.asset.transform, bounds)
      });
      return;
    }

    const groupRect = sceneDisplayRect(stageWidth, stageHeight, layer.scene);
    if (includeSceneGroups) candidates.push({ layerId, rect: groupRect });
    const memberBases = sceneMemberContentRects(layer.scene, groupRect, layer.assets, { images, videos });
    const memberRects = sceneMemberDisplayRects(layer.scene, groupRect, memberBases);
    const rectById = new Map(layer.scene.memberIds.map((id, index) => [id, memberRects[index]]));
    const soloId = sceneSolo[layer.scene.id];
    if (soloId) {
      const asset = layer.assets.find((item) => item.id === soloId);
      if (asset && !hiddenAssetIds.has(soloId)) candidates.push({
        layerId,
        sceneMemberId: soloId,
        rect: sceneFocusedMemberRect(stageWidth, stageHeight, layer.scene, asset, { images, videos })
      });
      return;
    }
    const memberOrder = sceneMemberDrawOrder(layer.scene).filter((id) => !hiddenAssetIds.has(id));
    memberOrder.forEach((sceneMemberId) => {
      const rect = rectById.get(sceneMemberId);
      if (rect) candidates.push({ layerId, sceneMemberId, rect });
    });
  });
  return candidates;
}

function buildVideoStyleSlotCandidates(
  stageWidth: number,
  stageHeight: number,
  styleId: VideoStyleId,
  assets: readonly StudioAsset[],
  focusedAssetId: string | null,
  deck?: { offset: number; windowStart: number; total: number }
): StageHitCandidate[] {
  const visible = assets;
  const layout = videoStyleLayout(styleId, stageWidth, stageHeight, visible.length, deck);
  const focusedVisibleAsset = Boolean(focusedAssetId && visible.some((asset) => asset.id === focusedAssetId));
  if (focusedVisibleAsset && !layout.keepSlotsWhileFocused) return [];
  return layout.slots.flatMap((rect, index) => visible[index] ? [{ layerId: visible[index].id, rect }] : []);
}

function videoStyleWindow(assets: readonly StudioAsset[], scenes: readonly StudioScene[], screenAsset?: StudioAsset | null, focusedAssetId: string | null = null, deckOffset = 0) {
  void scenes;
  const candidates = assetsForMainDock(assets, screenAsset);
  const capacity = MAX_STYLE_ASSETS;
  const maximumOffset = Math.max(0, candidates.length - capacity);
  const offset = Math.max(0, Math.min(maximumOffset, deckOffset));
  const windowStart = Math.max(0, Math.min(Math.max(0, candidates.length - (capacity + 2)), Math.floor(deckOffset) - 1));
  const window = candidates.slice(windowStart, windowStart + capacity + 2);
  const focused = focusedAssetId ? candidates.find((asset) => asset.id === focusedAssetId) : undefined;
  const visible = focused && !window.some((asset) => asset.id === focused.id) ? [...window, focused] : window;
  return { assets: visible, windowStart, total: candidates.length, offset };
}

function videoStyleAssets(assets: readonly StudioAsset[], scenes: readonly StudioScene[], screenAsset?: StudioAsset | null, focusedAssetId: string | null = null, deckOffset = 0) {
  return videoStyleWindow(assets, scenes, screenAsset, focusedAssetId, deckOffset).assets;
}

function defaultDeckPlacement(style: VideoStyleId) {
  return style === "top-shelf" ? 0.055 : style === "center-shelf" ? 0.425 : style === "bottom-shelf" ? 0.77 : 0.5;
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const diagnostics = import.meta.env.DEV && params.has("diagnostics");
  const diagnosticScenario = diagnostics ? params.get("scenario") : null;
  const provider = useMemo<MediaProvider>(
    () => diagnostics ? createSyntheticMediaProvider(
      diagnosticScenario === "streaming-speech"
        ? { speechFixtureUrl: `${import.meta.env.BASE_URL}diagnostics/pull-up-dashboard.mp3`, speechFixtureDelayMs: 6_000 }
        : diagnosticScenario === "streaming-multi"
          ? { speechFixtureUrl: `${import.meta.env.BASE_URL}diagnostics/compare-dashboard-product.mp3`, speechFixtureDelayMs: 6_000 }
          : diagnosticScenario === "streaming-sequence"
            ? { speechFixtures: [
              { url: `${import.meta.env.BASE_URL}diagnostics/pull-up-dashboard.mp3`, delayMs: 6_000 },
              { url: `${import.meta.env.BASE_URL}diagnostics/pull-up-product.mp3`, delayMs: 11_000 },
              { url: `${import.meta.env.BASE_URL}diagnostics/pull-up-proof.mp3`, delayMs: 16_000 }
            ] }
            : diagnosticScenario === "import-flow"
              ? { speechFixtures: [
                { url: `${import.meta.env.BASE_URL}diagnostics/pull-up-dashboard.mp3`, delayMs: 6_000 },
                { url: `${import.meta.env.BASE_URL}diagnostics/pull-up-product.mp3`, delayMs: 11_000 },
                { url: `${import.meta.env.BASE_URL}diagnostics/pull-up-proof.mp3`, delayMs: 16_000 }
              ] }
        : undefined
    ) : createBrowserMediaProvider(),
    [diagnosticScenario, diagnostics]
  );

  const [phase, setPhase] = useState<StudioPhase>("idle");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => localStorage.getItem("rii-flow-theme") === "light" ? "light" : "dark");
  const [phaseMessage, setPhaseMessage] = useState("Camera starts automatically when you enter");
  const [studioReady, setStudioReady] = useState(false);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [microphones, setMicrophones] = useState<MicrophoneOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState(() => diagnostics ? "diagnostic-camera-a" : localStorage.getItem("gesture-studio-camera") ?? "");
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState(() => diagnostics ? "diagnostic-microphone-a" : localStorage.getItem("gesture-studio-microphone") ?? "");
  const [activeCameraLabel, setActiveCameraLabel] = useState("No active camera");
  const [activeMicrophoneLabel, setActiveMicrophoneLabel] = useState("No active microphone");
  const [microphonePhase, setMicrophonePhase] = useState<MicrophonePhase>("idle");
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [monitorMediaAudio, setMonitorMediaAudio] = useState(() => diagnostics ? false : localStorage.getItem("gesture-studio-monitor-media") === "true");
  const [screenPhase, setScreenPhase] = useState<ScreenPhase>("idle");
  const [screenSettings, setScreenSettings] = useState<ScreenCaptureSettings | null>(null);
  const [screenOverlay, setScreenOverlay] = useState<ScreenOverlaySettings>({ ...DEFAULT_SCREEN_OVERLAY });
  const [qualityId, setQualityId] = useState<QualityId>(() => diagnostics
    ? "720p30"
    : recommendedQualityForDevice(navigator.hardwareConcurrency, (navigator as Navigator & { deviceMemory?: number }).deviceMemory));
  const [aspectId, setAspectId] = useState<CanvasAspectId>("landscape");
  const [mirrorCamera, setMirrorCamera] = useState(() => {
    if (diagnostics) return false;
    const saved = localStorage.getItem("gesture-studio-mirror");
    return saved === null ? true : saved === "true";
  });
  const [cameraFrame, setCameraFrame] = useState<CameraFrameSettings>({ ...DEFAULT_CAMERA_FRAME });
  const [cameraFramePanelOpen, setCameraFramePanelOpen] = useState(false);
  const [outputSize, setOutputSize] = useState(() => {
    const preset = qualityPreset(qualityId);
    return canvasDimensions(preset.width, preset.height, aspectId);
  });
  const [granted, setGranted] = useState<GrantedVideoSettings | null>(null);
  const [compositionStats, setCompositionStats] = useState<CompositionHealth>({ fps: 0, averageMs: 0, budgetPercent: 0, overBudgetFrames: 0 });
  const [compositionDriver, setCompositionDriver] = useState<CompositionDriver>(() => preferredCompositionDriver());
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("Untitled project");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectHydrated, setProjectHydrated] = useState(diagnostics);
  const [projectSaveState, setProjectSaveState] = useState<"loading" | "saved" | "saving" | "error">(diagnostics ? "saved" : "loading");
  const [welcomeOpen, setWelcomeOpen] = useState(!diagnostics);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [simpleExtrasOpen, setSimpleExtrasOpen] = useState(false);
  const [guidedWorkflowStep, setGuidedWorkflowStep] = useState(1);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [scenes, setScenes] = useState<StudioScene[]>([]);
  const [concepts, setConcepts] = useState<StudioConcept[]>([]);
  const [intentQueue, setIntentQueue] = useState<IntentCandidate[]>([]);
  const [intentPulse, setIntentPulse] = useState(0);
  const [confirmFeedback, setConfirmFeedback] = useState("");
  const [videoStyleId, setVideoStyleId] = useState<VideoStyleId>(() => {
    const stored = localStorage.getItem("rii-flow-video-style") as VideoStyleId | null;
    return stored === "bottom-shelf" ? "center-shelf" : VIDEO_STYLES.some((style) => style.id === stored) ? stored! : "right-rail";
  });
  const [assetDeckMode, setAssetDeckMode] = useState<AssetDeckMode>(() => diagnostics ? "always" : "command");
  const [assetDeckVisible, setAssetDeckVisible] = useState(() => diagnostics);
  const [assetDeckOffset, setAssetDeckOffset] = useState(0);
  const [deckPlacement, setDeckPlacement] = useState(() => defaultDeckPlacement(videoStyleId));
  const [panelBackground, setPanelBackground] = useState(() => localStorage.getItem("rii-flow-panel-background") ?? "#15131a");
  const [timelineEvents, setTimelineEvents] = useState<VisualTimelineEvent[]>([]);
  const [selectedDirectorEventId, setSelectedDirectorEventId] = useState<string | null>(null);
  const [studioPresetId, setStudioPresetId] = useState<StudioPresetId>(() => {
    const stored = localStorage.getItem("rii-flow-studio-preset");
    return STUDIO_PRESETS.some((preset) => preset.id === stored) ? stored as StudioPresetId : "talking-head";
  });
  const [gestureSequences, setGestureSequences] = useState<GestureSequenceMap>({});
  const [activeGestureCue, setActiveGestureCue] = useState<{ gesture: GestureId; index: number; total: number; name: string } | null>(null);
  const [sceneBuilderOpen, setSceneBuilderOpen] = useState(false);
  const [widgets, setWidgets] = useState<CanvasWidget[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [widgetPanelOpen, setWidgetPanelOpen] = useState(false);
  const [sidebarPage, setSidebarPage] = useState<"setup" | "widgets" | "downloads">("setup");
  const [widgetPanelMode, setWidgetPanelMode] = useState<"stickers" | "settings">("stickers");
  const [sceneDraftName, setSceneDraftName] = useState("New collage");
  const [sceneDraftLayout, setSceneDraftLayout] = useState<SceneLayout>("grid");
  const [sceneDraftMembers, setSceneDraftMembers] = useState<string[]>([]);
  const [sceneSolo, setSceneSolo] = useState<Record<string, string>>({});
  const [pointFocus, setPointFocus] = useState<PointFocusState | null>(null);
  const [liveBudgetNotice, setLiveBudgetNotice] = useState<string | null>(null);
  const [liveLayerIds, setLiveLayerIds] = useState<string[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [directorCursor, setDirectorCursor] = useState(0);
  const [directorFocusedAssetId, setDirectorFocusedAssetId] = useState<string | null>(null);
  const [detected, setDetected] = useState<{ gesture: RecognizedGesture; confidence: number; source: string }>({ gesture: null, confidence: 0, source: "none" });
  const [holdProgress, setHoldProgress] = useState(0);
  const [armed, setArmed] = useState(true);
  const [timing, setTiming] = useState(DEFAULT_TIMING);
  const [palmHoldMs, setPalmHoldMs] = useState(DEFAULT_MANIPULATION.armMs);
  const [manipulation, setManipulation] = useState<{ mode: ManipulationMode; progress: number }>({ mode: "idle", progress: 0 });
  const [sceneMemberTargetId, setSceneMemberTargetId] = useState<string | null>(null);
  const [selectedSceneMemberId, setSelectedSceneMemberId] = useState<string | null>(null);
  const [activatedAt, setActivatedAt] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingBytes, setRecordingBytes] = useState(0);
  const [recordingAudioTracks, setRecordingAudioTracks] = useState(0);
  const [recordingMime, setRecordingMime] = useState("");
  const [recordingSignature, setRecordingSignature] = useState("");
  const [recordings, setRecordings] = useState<RecordedClip[]>([]);
  const [previewTakeId, setPreviewTakeId] = useState<string | null>(null);
  const [pendingDeleteTakeId, setPendingDeleteTakeId] = useState<string | null>(null);
  const [deletingTakeId, setDeletingTakeId] = useState<string | null>(null);
  const [editingTakeId, setEditingTakeId] = useState<string | null>(null);
  const [editingTakeName, setEditingTakeName] = useState("");
  const [assetEditorId, setAssetEditorId] = useState<string | null>(null);
  const [assetEditorPlayhead, setAssetEditorPlayhead] = useState(0);
  const [finishTakeId, setFinishTakeId] = useState<string | null>(null);
  const [takeTrim, setTakeTrim] = useState({ start: 0, end: 0 });
  const [finishTakeMediaDuration, setFinishTakeMediaDuration] = useState(0);
  const [captionEnabled, setCaptionEnabled] = useState(false);
  const [captionSegments, setCaptionSegments] = useState<CaptionSegment[]>([]);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>({ ...DEFAULT_CAPTION_STYLE });
  const [captionStatus, setCaptionStatus] = useState<CaptionEditorStatus>("idle");
  const [captionProgress, setCaptionProgress] = useState<CaptionProgress | null>(null);
  const [captionRenderProgress, setCaptionRenderProgress] = useState(0);
  const [captionResultTakeId, setCaptionResultTakeId] = useState<string | null>(null);
  const [captionDrag, setCaptionDrag] = useState({ dragging: false, snapX: false, snapY: false });
  const [captionPreviewTime, setCaptionPreviewTime] = useState(0);
  const [captionPreviewPlaying, setCaptionPreviewPlaying] = useState(false);
  const [wordAnimationCues, setWordAnimationCues] = useState<WordAnimationCue[]>([]);
  const [morphGestureProgress, setMorphGestureProgress] = useState(0);
  const [morphExitAssetId, setMorphExitAssetId] = useState<string | null>(null);
  // Browser Rii-Flow is deliberately gesture-first. Native keyword control is
  // preserved in the separate desktop project, not loaded into this build.
  const voiceCuesEnabled = false;
  const [armedVoiceTarget, setArmedVoiceTarget] = useState<ArmedVoiceTarget | null>(null);
  const [operatorShelfOpen, setOperatorShelfOpen] = useState(false);
  const [operatorShelfTargetId, setOperatorShelfTargetId] = useState<string | null>(null);
  const [operatorShelfProgress, setOperatorShelfProgress] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightState | null>(null);
  const [recordingsDirectory, setRecordingsDirectory] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderPermission, setFolderPermission] = useState<PermissionState | "unsupported">("prompt");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recognizerGeneration, setRecognizerGeneration] = useState(0);
  const [inferenceMode, setInferenceMode] = useState<"worker" | "main-thread" | "loading">("loading");
  const [inferenceLatency, setInferenceLatency] = useState(0);
  const [cameraSwitches, setCameraSwitches] = useState(0);
  const [oldTrackStopped, setOldTrackStopped] = useState(true);

  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const inferenceCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioMixerRef = useRef<StudioAudioMixer | null>(null);
  const recognizerRef = useRef<GestureInferenceClient | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingWritableRef = useRef<FileSystemWritableFileStream | null>(null);
  const recordingFileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const recordingWriteRef = useRef<Promise<void>>(Promise.resolve());
  const recordingFileNameRef = useRef("");
  const recordingUrlsRef = useRef<string[]>([]);
  const takeLibraryRef = useRef<RecordedClip[]>([]);
  const recordingStartedAtRef = useRef(0);
  const projectIdRef = useRef(projectId);
  const recordingsDirectoryRef = useRef(recordingsDirectory);
  const folderPermissionRef = useRef(folderPermission);
  const autosaveTimerRef = useRef<number | null>(null);
  const outputAnimationRef = useRef<number | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const videosRef = useRef(new Map<string, HTMLVideoElement>());
  const completedVideoIdsRef = useRef<Set<string>>(new Set());
  const completedVideoVersionRef = useRef(0);
  const budgetHiddenAssetIdsRef = useRef<Set<string>>(new Set());
  const budgetHiddenVersionRef = useRef(0);
  const assetsRef = useRef(assets);
  const scenesRef = useRef(scenes);
  const videoStyleRef = useRef<VideoStyleId>(videoStyleId);
  const assetDeckModeRef = useRef<AssetDeckMode>(assetDeckMode);
  const assetDeckVisibleRef = useRef(assetDeckVisible);
  const assetDeckOffsetRef = useRef(0);
  const deckScrollControllerRef = useRef(new DeckScrollController());
  const deckPlacementRef = useRef(deckPlacement);
  const panelBackgroundRef = useRef(panelBackground);
  const deckScrollEngagedRef = useRef(false);
  const suppressDeckFocusUntilRef = useRef(0);
  const deckFlickCandidateRef = useRef<{ axisStart: number; lastAxis: number; startedAt: number } | null>(null);
  const timelineEventsRef = useRef<VisualTimelineEvent[]>([]);
  const gestureSequencesRef = useRef<GestureSequenceMap>(gestureSequences);
  const gestureSequenceCursorRef = useRef<Partial<Record<GestureId, number>>>({});
  const liveLayerIdsRef = useRef(liveLayerIds);
  const activeLayerIdRef = useRef(activeLayerId);
  const directorQueueRef = useRef<StudioLayer[]>([]);
  const directorCursorRef = useRef(0);
  const directorFocusedAssetIdRef = useRef<string | null>(null);
  const palmRestoreRef = useRef({ since: 0, latched: false });
  const layerActivationTimesRef = useRef<Record<string, number>>({});
  const studioReadyRef = useRef(studioReady);
  const recordingRef = useRef(isRecording);
  const selectedCameraRef = useRef(selectedCameraId);
  const selectedMicrophoneRef = useRef(selectedMicrophoneId);
  const grantedRef = useRef(granted);
  const screenSettingsRef = useRef(screenSettings);
  const screenOverlayRef = useRef(screenOverlay);
  const qualityRef = useRef(qualityId);
  const compositionStatsRef = useRef(compositionStats);
  const aspectRef = useRef(aspectId);
  const mirrorCameraRef = useRef(mirrorCamera);
  const cameraFrameRef = useRef(cameraFrame);
  const cameraReflowControllerRef = useRef(new CameraReflowController());
  const cameraReflowFrameRef = useRef<CameraReflowFrame>({ x: 0, width: 1, target: null, transitioning: false });
  const monitorMediaAudioRef = useRef(monitorMediaAudio);
  const phaseRef = useRef(phase);
  const gateRef = useRef(new GestureGate(DEFAULT_TIMING));
  const assetDeckGateRef = useRef(new GestureGate({ holdMs: 120, cooldownMs: 350 }));
  const stabilizerRef = useRef(new GestureStabilizer());
  const manipulationTrackerRef = useRef(new ManipulationTracker(DEFAULT_MANIPULATION));
  const palmSignalTrackerRef = useRef(new PalmSignalTracker());
  const pointFocusTrackerRef = useRef(new PointFocusTracker(420));
  const widgetPointTrackerRef = useRef(new PointFocusTracker(280));
  const orbitScrollRef = useRef<{ widgetId: string; lastY: number } | null>(null);
  const orbitPointRearmRef = useRef<{ widgetId: string; x: number; y: number } | null>(null);
  const circleMorphTrackerRef = useRef(new CircleMorphTracker());
  const manipulationGuardUntilRef = useRef(0);
  const sceneMemberTargetIdRef = useRef<string | null>(null);
  const sceneMemberMissSinceRef = useRef<number | null>(null);
  const switchCameraRef = useRef<(deviceId: string, preset: QualityPreset, initial?: boolean) => Promise<void>>(async () => undefined);
  const switchMicrophoneRef = useRef<(deviceId: string, initial?: boolean, force?: boolean) => Promise<void>>(async () => undefined);
  const stopRecordingRef = useRef<() => void>(() => undefined);
  const activateStudioLayerRef = useRef<(layer: StudioLayer) => void>(() => undefined);
  const revealVoiceTargetRef = useRef<(target: VoiceTriggerTarget, source: "voice" | "shelf") => void>(() => undefined);
  const chooseShelfTargetRef = useRef<(target: VoiceTriggerTarget) => void>(() => undefined);
  const focusVideoStyleAssetRef = useRef<(asset: StudioAsset) => void>(() => undefined);
  const startMorphExitRef = useRef<(assetId: string) => void>(() => undefined);
  const studioSessionRef = useRef(0);
  const studioStartingRef = useRef(false);
  const pendingFallbackRef = useRef<string | null>(null);
  const diagnosticSequenceStartRef = useRef(0);
  const pointerEditRef = useRef<PointerEditSession | null>(null);
  const widgetPointerEditRef = useRef<WidgetPointerEditSession | null>(null);
  const suppressStageClickUntilRef = useRef(0);
  const sceneSoloRef = useRef<Record<string, string>>({});
  const captionCaptureRef = useRef<CaptionCaptureSession | null>(null);
  const captionAudioCacheRef = useRef(new Map<string, CaptionAudio>());
  const captionPreviewRef = useRef<HTMLDivElement>(null);
  const captionPreviewVideoRef = useRef<HTMLVideoElement>(null);
  const assetEditorVideoRef = useRef<HTMLVideoElement>(null);
  const captionPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const captionDragPointerRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const confirmFeedbackTimerRef = useRef<number | null>(null);
  const assetMorphExitRef = useRef<AssetMorphExit | null>(null);
  const activeGeometryRef = useRef<{ rect: Rect } | null>(null);
  const morphFocusLockUntilRef = useRef(0);
  const diagnosticCaptionOpenedRef = useRef<string | null>(null);
  const conceptsRef = useRef<StudioConcept[]>([]);
  const intentQueueRef = useRef<IntentCandidate[]>([]);
  const intentEngineRef = useRef(new IntentEngine());
  const studioEventsRef = useRef(new StudioEventBus());
  const swipeTrackerRef = useRef(new SwipeTracker());
  const confirmIntentRef = useRef<() => void>(() => undefined);
  const conceptCooldownsRef = useRef(new Map<string, number>());
  const conceptCursorsRef = useRef(new Map<string, number>());
  const armedVoiceTargetRef = useRef<ArmedVoiceTarget | null>(null);
  const voiceArmTimerRef = useRef<number | null>(null);
  const operatorShelfOpenRef = useRef(false);
  const operatorShelfItemsRef = useRef<OperatorShelfItem[]>([]);
  const operatorShelfPointTrackerRef = useRef(new PointFocusTracker(170));
  const widgetsRef = useRef<CanvasWidget[]>([]);
  const widgetAudioRef = useRef(new Map<string, HTMLAudioElement>());
  const widgetAudioInputRef = useRef<HTMLInputElement | null>(null);
  const activateWidgetRef = useRef<(widget: CanvasWidget) => void>(() => undefined);
  const palmCommandTrackerRef = useRef(new PalmCommandTracker());
  const thumbDeckTrackerRef = useRef(new PalmCommandTracker());
  const shelfPointCarryoverRef = useRef(false);
  const spotlightRef = useRef<SpotlightState | null>(null);
  const spotlightRectRef = useRef<Rect | null>(null);

  const currentVideoStyleAssets = useCallback(() => {
    const screenAsset = screenSettingsRef.current
      ? screenOverlayAsset(screenSettingsRef.current, screenOverlayRef.current)
      : null;
    return videoStyleAssets(assetsRef.current, scenesRef.current, screenAsset, activeLayerIdRef.current, assetDeckOffsetRef.current);
  }, []);

  const currentVideoStyleWindow = useCallback(() => {
    const screenAsset = screenSettingsRef.current
      ? screenOverlayAsset(screenSettingsRef.current, screenOverlayRef.current)
      : null;
    return videoStyleWindow(assetsRef.current, scenesRef.current, screenAsset, activeLayerIdRef.current, assetDeckOffsetRef.current);
  }, []);

  const liveScreenAsset = useMemo(() => screenSettings ? screenOverlayAsset(screenSettings, screenOverlay) : null, [screenOverlay, screenSettings]);
  const styleWindow = useMemo(() => videoStyleWindow(assets, scenes, liveScreenAsset, null, assetDeckOffset), [assetDeckOffset, assets, liveScreenAsset, scenes]);
  const styleAssets = styleWindow.assets;
  const dockAssets = useMemo(() => {
    const items = assets.filter((asset) => asset.kind !== "text");
    return liveScreenAsset ? [...items, liveScreenAsset] : items;
  }, [assets, liveScreenAsset]);
  const currentStyleLayout = useMemo(
    () => videoStyleLayout(videoStyleId, outputSize.width, outputSize.height, styleAssets.length, { offset: styleWindow.offset, windowStart: styleWindow.windowStart, total: styleWindow.total, position: deckPlacement }),
    [deckPlacement, outputSize.height, outputSize.width, styleAssets.length, styleWindow.offset, styleWindow.total, styleWindow.windowStart, videoStyleId]
  );
  const activeLayer = useMemo(() => activeLayerId === SCREEN_OVERLAY_ID && liveScreenAsset
    ? { id: SCREEN_OVERLAY_ID, kind: "asset" as const, asset: liveScreenAsset }
    : activeLayerId ? resolveLayer(activeLayerId, assets, scenes) : null, [activeLayerId, assets, liveScreenAsset, scenes]);
  const activeAsset = activeLayer?.kind === "asset" ? activeLayer.asset : null;
  const assetDeckOnStage = assetDeckVisible || Boolean(activeAsset && styleAssets.some((asset) => asset.id === activeAsset.id));
  const activeScene = activeLayer?.kind === "scene" ? activeLayer.scene : null;
  const activeSceneSoloId = activeScene ? sceneSolo[activeScene.id] : undefined;
  const focusedSceneMemberId = sceneMemberTargetId ?? selectedSceneMemberId ?? activeSceneSoloId;
  const activeGeometry = useMemo(() => {
    if (!activeLayer) return null;
    if (activeLayer.kind === "scene") {
      const base = sceneBaseRect(outputSize.width, outputSize.height, activeLayer.scene);
      return { base, bounds: undefined, rect: sceneDisplayRect(outputSize.width, outputSize.height, activeLayer.scene), transform: activeLayer.scene.transform };
    }
    const source = activeLayer.asset.id === SCREEN_OVERLAY_ID
      ? undefined
      : activeLayer.asset.kind === "image" ? imagesRef.current.get(activeLayer.asset.id) : activeLayer.asset.kind === "video" ? videosRef.current.get(activeLayer.asset.id) : undefined;
    const sourceWidth = activeLayer.asset.id === SCREEN_OVERLAY_ID ? screenSettings?.width : source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : undefined;
    const sourceHeight = activeLayer.asset.id === SCREEN_OVERLAY_ID ? screenSettings?.height : source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : undefined;
    if (styleAssets.some((asset) => asset.id === activeLayer.asset.id)) {
      const base = styleFocusBaseRect(currentStyleLayout, activeLayer.asset, sourceWidth, sourceHeight);
      const bounds = styleTransformBounds(currentStyleLayout, activeLayer.asset);
      return { base, bounds, rect: applyAssetTransform(outputSize.width, outputSize.height, base, activeLayer.asset.transform, bounds), transform: activeLayer.asset.transform };
    }
    const base = baseAssetRect(outputSize.width, outputSize.height, activeLayer.asset, sourceWidth, sourceHeight);
    const activeLiveLayers = visibleLayersForComposition(liveLayerIds
      .map((id) => resolveLayer(id, assets, scenes))
      .filter((layer): layer is StudioLayer => Boolean(layer)));
    const panelRatio = activeLayer.asset.placement === "left" || activeLayer.asset.placement === "right"
      ? cameraReflowPanelRatioForSide(activeLiveLayers, activeLayer.asset.placement)
      : null;
    const bounds = reflowAssetPanelRect(outputSize.width, outputSize.height, activeLayer.asset, panelRatio ?? undefined) ?? undefined;
    return { base, bounds, rect: applyAssetTransform(outputSize.width, outputSize.height, base, activeLayer.asset.transform, bounds), transform: activeLayer.asset.transform };
  }, [activeLayer, assets, currentStyleLayout, liveLayerIds, outputSize.height, outputSize.width, scenes, screenSettings?.height, screenSettings?.width, styleAssets]);
  useEffect(() => {
    activeGeometryRef.current = activeGeometry ? { rect: activeGeometry.rect } : null;
  }, [activeGeometry]);
  const activeSceneMemberGeometry = useMemo(() => {
    if (!activeScene || !activeGeometry || !focusedSceneMemberId) return null;
    const index = activeScene.memberIds.indexOf(focusedSceneMemberId);
    if (index < 0) return null;
    const bases = sceneMemberContentRects(activeScene, activeGeometry.rect, assets, { images: imagesRef.current, videos: videosRef.current });
    const asset = assets.find((item) => item.id === focusedSceneMemberId);
    const rect = activeSceneSoloId === focusedSceneMemberId && asset
      ? sceneFocusedMemberRect(outputSize.width, outputSize.height, activeScene, asset, { images: imagesRef.current, videos: videosRef.current })
      : sceneMemberDisplayRects(activeScene, activeGeometry.rect, bases)[index];
    return rect && asset ? { rect, asset } : null;
  }, [activeGeometry, activeScene, activeSceneSoloId, assets, focusedSceneMemberId, outputSize.height, outputSize.width]);
  const activeSceneMemberEditorGeometry = useMemo(() => {
    if (!activeScene || !activeGeometry || !selectedSceneMemberId) return null;
    const index = activeScene.memberIds.indexOf(selectedSceneMemberId);
    if (index < 0) return null;
    const bases = sceneMemberContentRects(activeScene, activeGeometry.rect, assets, { images: imagesRef.current, videos: videosRef.current });
    const base = bases[index];
    const rect = sceneMemberDisplayRects(activeScene, activeGeometry.rect, bases)[index];
    const asset = assets.find((item) => item.id === selectedSceneMemberId);
    if (!base || !rect || !asset) return null;
    return {
      base,
      rect,
      asset,
      transform: sceneMemberCanvasTransform(outputSize.width, outputSize.height, activeGeometry.rect, base, activeScene.memberTransforms?.[selectedSceneMemberId]),
      groupRect: activeGeometry.rect
    };
  }, [activeGeometry, activeScene, assets, outputSize.height, outputSize.width, selectedSceneMemberId]);
  const liveLayers = useMemo(() => liveLayerIds
    .map((id) => resolveLayer(id, assets, scenes))
    .filter((layer): layer is StudioLayer => Boolean(layer)), [assets, liveLayerIds, scenes]);
  const activeFrameRate = Math.max(1, Math.min(qualityPreset(qualityId).fps, granted?.frameRate || qualityPreset(qualityId).fps));
  const actualBitrate = bitrateForActual(outputSize.width, outputSize.height, activeFrameRate);
  const sceneDraftVideoCount = useMemo(() => {
    const selected = new Set(sceneDraftMembers);
    return assets.filter((asset) => selected.has(asset.id) && asset.kind === "video").length;
  }, [assets, sceneDraftMembers]);
  const effectiveGestureSequences = useMemo(
    () => normalizeGestureSequences(assets, scenes, gestureSequences),
    [assets, gestureSequences, scenes]
  );
  const standaloneAssets = assets.filter((asset) => asset.kind !== "text");
  const hiddenStyleAssetCount = Math.max(0, standaloneAssets.length - (MAX_STYLE_ASSETS - (liveScreenAsset ? 1 : 0)));
  const directorQueue = useMemo(() => buildDirectorQueue(assets, scenes), [assets, scenes]);
  const directorCurrentIndex = directorCueIndex(directorQueue, activeLayerId, directorCursor);
  const directorCurrentCue = directorQueue[directorCurrentIndex] ?? null;
  const directorNextCue = directorQueue[Math.min(directorQueue.length - 1, directorCurrentIndex + 1)] ?? null;
  const directorCueLive = Boolean(directorCurrentCue && directorCurrentCue.id === activeLayerId);
  const voiceTriggerTargets = useMemo<VoiceTriggerTarget[]>(() => triggerTargets(assets, scenes), [assets, scenes]);
  const operatorShelfItems = useMemo<OperatorShelfItem[]>(() => voiceTriggerTargets
    .slice(0, MAX_OPERATOR_SHELF_ITEMS)
    .map(({ id, kind, name, triggerWord }) => ({ id, kind, name, triggerWord })), [voiceTriggerTargets]);
  const operatorShelfLayout = useMemo(
    () => operatorShelfRects(operatorShelfItems, aspectId === "portrait"),
    [aspectId, operatorShelfItems]
  );
  const finishTake = finishTakeId ? recordings.find((take) => take.id === finishTakeId) ?? null : null;
  const assetEditor = assetEditorId ? assets.find((asset) => asset.id === assetEditorId) ?? null : null;
  const assetEditorDuration = assetEditor?.kind === "video" ? Math.max(0, assetEditor.mediaDuration ?? 0) : 0;
  const assetEditorTrim = assetEditor?.kind === "video" ? normalizeVideoTrim(assetEditor.videoTrim, assetEditorDuration) : { start: 0, end: 0 };
  const captionResultTake = captionResultTakeId ? recordings.find((take) => take.id === captionResultTakeId) ?? null : null;
  const captionBusy = captionStatus === "loading" || captionStatus === "transcribing" || captionStatus === "rendering";
  const captionPreviewRendered = captionStatus === "done" && Boolean(captionResultTake?.url);
  const captionPreviewSource = captionPreviewRendered ? captionResultTake?.url : finishTake?.url;
  const captionPreviewSegment = captionSegments.length
    ? activeCaptionAt(captionSegments, captionPreviewTime) ?? (!captionPreviewPlaying ? captionSegments[0] : null)
    : null;
  const previewWordAnimation = activeWordAnimationAt(wordAnimationCues, captionPreviewTime);
  const finishDuration = Math.max(0, finishTakeMediaDuration || finishTake?.durationSeconds || 0);
  const normalizedTakeTrim = normalizeVideoTrim(takeTrim, finishDuration);
  const takeIsTrimmed = hasVideoTrim(normalizedTakeTrim, finishDuration);
  const captionsReady = captionEnabled && captionSegments.length > 0;
  const wordAnimationsReady = wordAnimationCues.length > 0;
  const hasFinalEdits = takeIsTrimmed || captionsReady || wordAnimationsReady;

  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => {
    if (!projectHydrated) return;
    const used = new Set<string>();
    assets.forEach((asset) => {
      const cue = normalizeTriggerWord(asset.triggerWord ?? "");
      if (cue) used.add(cue);
    });
    let assetsChanged = false;
    const nextAssets = assets.map((asset) => {
      if (normalizeTriggerWord(asset.triggerWord ?? "")) return asset;
      const triggerWord = suggestAssetTrigger(asset, used);
      used.add(triggerWord);
      assetsChanged = true;
      return { ...asset, triggerWord };
    });
    scenes.forEach((scene) => {
      const cue = normalizeTriggerWord(scene.triggerWord ?? "");
      if (cue) used.add(cue);
    });
    let scenesChanged = false;
    const nextScenes = scenes.map((scene) => {
      if (normalizeTriggerWord(scene.triggerWord ?? "")) return scene;
      const triggerWord = suggestSceneTrigger(scene, nextAssets, used);
      used.add(triggerWord);
      scenesChanged = true;
      return { ...scene, triggerWord };
    });
    if (assetsChanged) {
      assetsRef.current = nextAssets;
      setAssets(nextAssets);
    }
    if (scenesChanged) {
      scenesRef.current = nextScenes;
      setScenes(nextScenes);
    }
  }, [assets, projectHydrated, scenes]);
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem("rii-flow-theme", themeMode);
  }, [themeMode]);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => { conceptsRef.current = concepts; }, [concepts]);
  useEffect(() => { intentQueueRef.current = intentQueue; }, [intentQueue]);
  useEffect(() => {
    setConcepts((current) => reconcileConcepts(current, assets, scenes));
  }, [assets, scenes]);
  useEffect(() => {
    videoStyleRef.current = videoStyleId;
    localStorage.setItem("rii-flow-video-style", videoStyleId);
  }, [videoStyleId]);
  useEffect(() => {
    panelBackgroundRef.current = panelBackground;
    localStorage.setItem("rii-flow-panel-background", panelBackground);
  }, [panelBackground]);
  useEffect(() => {
    assetDeckModeRef.current = assetDeckMode;
    if (!diagnostics) localStorage.setItem("rii-flow-asset-deck-mode", assetDeckMode);
    if (assetDeckMode === "always") {
      assetDeckVisibleRef.current = true;
      setAssetDeckVisible(true);
    }
    assetDeckGateRef.current.reset();
  }, [assetDeckMode, diagnostics]);
  useEffect(() => { assetDeckVisibleRef.current = assetDeckVisible; }, [assetDeckVisible]);
  useEffect(() => { deckPlacementRef.current = deckPlacement; }, [deckPlacement]);
  useEffect(() => { widgetsRef.current = widgets; }, [widgets]);
  useEffect(() => {
    try {
      (navigator.mediaDevices as CaptureHandleMediaDevices | undefined)?.setCaptureHandleConfig?.({
        exposeOrigin: true,
        handle: RII_FLOW_CAPTURE_HANDLE,
        permittedOrigins: ["*"]
      });
    } catch {
      // Capture Handle is progressive enhancement; label/surface guards remain active.
    }
  }, []);
  useEffect(() => { operatorShelfItemsRef.current = operatorShelfItems; }, [operatorShelfItems]);
  useEffect(() => { operatorShelfOpenRef.current = operatorShelfOpen; }, [operatorShelfOpen]);
  useEffect(() => { armedVoiceTargetRef.current = armedVoiceTarget; }, [armedVoiceTarget]);
  useEffect(() => { spotlightRef.current = spotlight; }, [spotlight]);
  useEffect(() => { timelineEventsRef.current = timelineEvents; }, [timelineEvents]);
  useEffect(() => { gestureSequencesRef.current = effectiveGestureSequences; }, [effectiveGestureSequences]);
  useEffect(() => { sceneSoloRef.current = sceneSolo; }, [sceneSolo]);
  useEffect(() => { liveLayerIdsRef.current = liveLayerIds; }, [liveLayerIds]);
  useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
  useEffect(() => {
    directorQueueRef.current = directorQueue;
    const nextCursor = directorCueIndex(directorQueue, activeLayerIdRef.current, directorCursorRef.current);
    directorCursorRef.current = nextCursor;
    setDirectorCursor((current) => current === nextCursor ? current : nextCursor);
  }, [directorQueue]);
  useEffect(() => { directorFocusedAssetIdRef.current = directorFocusedAssetId; }, [directorFocusedAssetId]);
  useEffect(() => { sceneMemberTargetIdRef.current = sceneMemberTargetId; }, [sceneMemberTargetId]);
  useEffect(() => {
    if (sceneMemberTargetId && (!activeScene || !activeScene.memberIds.includes(sceneMemberTargetId))) {
      sceneMemberTargetIdRef.current = null;
      sceneMemberMissSinceRef.current = null;
      setSceneMemberTargetId(null);
    }
  }, [activeScene, sceneMemberTargetId]);
  useEffect(() => {
    if (selectedSceneMemberId && (!activeScene || !activeScene.memberIds.includes(selectedSceneMemberId))) setSelectedSceneMemberId(null);
  }, [activeScene, selectedSceneMemberId]);
  useEffect(() => { studioReadyRef.current = studioReady; }, [studioReady]);
  useEffect(() => { recordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { recordingsDirectoryRef.current = recordingsDirectory; }, [recordingsDirectory]);
  useEffect(() => { folderPermissionRef.current = folderPermission; }, [folderPermission]);
  useEffect(() => { selectedCameraRef.current = selectedCameraId; }, [selectedCameraId]);
  useEffect(() => { selectedMicrophoneRef.current = selectedMicrophoneId; }, [selectedMicrophoneId]);
  useEffect(() => { grantedRef.current = granted; }, [granted]);
  useEffect(() => { screenSettingsRef.current = screenSettings; }, [screenSettings]);
  useEffect(() => { screenOverlayRef.current = screenOverlay; }, [screenOverlay]);
  useEffect(() => {
    if (!studioReadyRef.current || !liveLayerIdsRef.current.length) return;
    const nextStack = enforceBudgetForStack(liveLayerIdsRef.current);
    liveLayerIdsRef.current = nextStack;
    setLiveLayerIds(nextStack);
    if (activeLayerIdRef.current && !nextStack.includes(activeLayerIdRef.current)) {
      activeLayerIdRef.current = nextStack.at(-1) ?? null;
      setActiveLayerId(activeLayerIdRef.current);
    }
  }, [screenOverlay.visible, screenSettings]);
  useEffect(() => { qualityRef.current = qualityId; }, [qualityId]);
  useEffect(() => { compositionStatsRef.current = compositionStats; }, [compositionStats]);
  useEffect(() => { aspectRef.current = aspectId; }, [aspectId]);
  useEffect(() => { mirrorCameraRef.current = mirrorCamera; }, [mirrorCamera]);
  useEffect(() => { cameraFrameRef.current = cameraFrame; }, [cameraFrame]);
  useEffect(() => { monitorMediaAudioRef.current = monitorMediaAudio; }, [monitorMediaAudio]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (!finishTake || !captionSegments.length || diagnostics || captionBusy) return;
    const timer = window.setTimeout(() => {
      void saveCaptionDocument({ takeId: finishTake.id, segments: captionSegments, style: normalizeCaptionStyle(captionStyle), wordCues: wordAnimationCues, updatedAt: Date.now() });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [captionBusy, captionSegments, captionStyle, diagnostics, finishTake, wordAnimationCues]);
  useEffect(() => {
    const merged = new Map(takeLibraryRef.current.map((take) => [take.id, take]));
    recordings.forEach((take) => merged.set(take.id, take));
    takeLibraryRef.current = [...merged.values()].sort((a, b) => b.createdAt - a.createdAt);
  }, [recordings]);
  useEffect(() => { gateRef.current.configure(timing); }, [timing]);
  useEffect(() => {
    manipulationTrackerRef.current.configure({ ...DEFAULT_MANIPULATION, armMs: palmHoldMs });
  }, [palmHoldMs]);
  useEffect(() => {
    const canvas = captionPreviewCanvasRef.current;
    if (!canvas || !finishTake) return;
    const scale = Math.min(1, 1280 / Math.max(finishTake.width, finishTake.height));
    const width = Math.max(1, Math.round(finishTake.width * scale));
    const height = Math.max(1, Math.round(finishTake.height * scale));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (captionEnabled && !captionPreviewRendered) drawCaption(context, width, height, captionPreviewSegment, captionStyle);
  }, [captionEnabled, captionPreviewRendered, captionPreviewSegment, captionStyle, finishTake]);

  const restoreTransientSceneLayout = useCallback((sceneId: string) => {
    // Solo focus is runtime-only, but the scene's group transform and every
    // member transform are authored workspace state and must survive respawn.
    const nextSolo = { ...sceneSoloRef.current };
    delete nextSolo[sceneId];
    sceneSoloRef.current = nextSolo;
    setSceneSolo(nextSolo);
  }, []);

  const restoreTransientLayer = useCallback((layerId: string) => {
    const layer = resolveLayer(layerId, assetsRef.current, scenesRef.current);
    if (!layer) return;
    // Individual asset transforms are authored workspace state. Hiding and
    // revealing an asset must never roll its position or scale back.
    if (layer.kind === "scene") restoreTransientSceneLayout(layer.scene.id);
  }, [restoreTransientSceneLayout]);

  const commitAssetUpdates = useCallback((assetId: string, updates: Partial<StudioAsset>) => {
    if (assetId === SCREEN_OVERLAY_ID) {
      const current = screenOverlayRef.current;
      const next: ScreenOverlaySettings = {
        ...current,
        ...(updates.placement ? { placement: updates.placement } : {}),
        ...(updates.size ? { size: updates.size } : {}),
        ...("transform" in updates ? { transform: updates.transform } : {}),
        ...(updates.entranceAnimation ? { entranceAnimation: updates.entranceAnimation } : {}),
        ...(updates.cueSound ? { cueSound: updates.cueSound } : {}),
        ...(typeof updates.cueVolume === "number" ? { cueVolume: updates.cueVolume } : {})
      };
      screenOverlayRef.current = next;
      setScreenOverlay(next);
      return;
    }
    const next = assetsRef.current.map((asset) => asset.id === assetId ? { ...asset, ...updates } : asset);
    assetsRef.current = next;
    setAssets(next);
  }, []);

  const commitSceneUpdates = useCallback((sceneId: string, updates: Partial<StudioScene>) => {
    const next = scenesRef.current.map((scene) => scene.id === sceneId ? { ...scene, ...updates } : scene);
    scenesRef.current = next;
    setScenes(next);
  }, []);

  const beginPointerEdit = (event: ReactPointerEvent<HTMLElement>, mode: "drag" | "scale") => {
    const editGeometry = activeSceneMemberEditorGeometry ?? activeGeometry;
    if (!activeLayer || !editGeometry || isRecording || isFinalizing) return;
    const stage = event.currentTarget.closest(".stage-wrap") as HTMLElement | null;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const initial = editGeometry.transform ?? {
      x: (editGeometry.rect.x + editGeometry.rect.width / 2) / outputSize.width,
      y: (editGeometry.rect.y + editGeometry.rect.height / 2) / outputSize.height,
      scale: 1
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerEditRef.current = {
      pointerId: event.pointerId,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      stageWidth: bounds.width,
      stageHeight: bounds.height,
      base: editGeometry.base,
      bounds: activeLayer.kind === "asset" ? activeGeometry?.bounds : undefined,
      initial,
      layerId: activeLayer.id,
      sceneMemberId: activeLayer.kind === "scene" && activeSceneMemberEditorGeometry ? selectedSceneMemberId ?? undefined : undefined,
      sceneGroupRect: activeLayer.kind === "scene" && activeSceneMemberEditorGeometry ? activeSceneMemberEditorGeometry.groupRect : undefined,
      moved: false
    };
    setManipulation({ mode: mode === "drag" ? "dragging" : "scaling", progress: 1 });
    event.preventDefault();
  };

  const movePointerEdit = (event: ReactPointerEvent<HTMLElement>) => {
    const session = pointerEditRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - session.startClientX, event.clientY - session.startClientY) > 3) session.moved = true;
    const dx = (event.clientX - session.startClientX) / Math.max(1, session.stageWidth);
    const dy = (event.clientY - session.startClientY) / Math.max(1, session.stageHeight);
    const candidate = session.mode === "drag"
      ? { ...session.initial, x: session.initial.x + dx, y: session.initial.y + dy }
      : { ...session.initial, scale: session.initial.scale + (dx + dy) * 1.25 };
    const transform = constrainAssetTransform(outputSize.width, outputSize.height, session.base, candidate, session.bounds);
    const layer = session.layerId === SCREEN_OVERLAY_ID && screenSettingsRef.current
      ? { id: SCREEN_OVERLAY_ID, kind: "asset" as const, asset: screenOverlayAsset(screenSettingsRef.current, screenOverlayRef.current) }
      : resolveLayer(session.layerId, assetsRef.current, scenesRef.current);
    if (layer?.kind === "asset") {
      commitAssetUpdates(layer.asset.id, { transform });
    }
    if (layer?.kind === "scene") {
      if (session.sceneMemberId && session.sceneGroupRect) {
        const order = sceneMemberDrawOrder(layer.scene).filter((id) => id !== session.sceneMemberId);
        order.push(session.sceneMemberId);
        commitSceneUpdates(layer.scene.id, {
          memberTransforms: {
            ...layer.scene.memberTransforms,
            [session.sceneMemberId]: sceneMemberRelativeTransform(outputSize.width, outputSize.height, session.sceneGroupRect, transform)
          },
          memberOrder: order
        });
      } else commitSceneUpdates(layer.scene.id, { transform });
    }
    event.preventDefault();
  };

  const endPointerEdit = (event: ReactPointerEvent<HTMLElement>) => {
    const session = pointerEditRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    pointerEditRef.current = null;
    if (session.moved) suppressStageClickUntilRef.current = performance.now() + 160;
    setManipulation({ mode: "idle", progress: 0 });
  };

  const layerAtStagePoint = (event: ReactMouseEvent<HTMLElement>) => {
    const canvas = outputCanvasRef.current;
    const bounds = canvas?.getBoundingClientRect();
    if (!canvas || !bounds?.width || !bounds.height) return null;
    const point = {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height
    };
    const currentStyleWindow = currentVideoStyleWindow();
    const currentStyleAssets = currentStyleWindow.assets;
    const focusedStyleAssetId = activeLayerIdRef.current && currentStyleAssets.some((asset) => asset.id === activeLayerIdRef.current)
      ? activeLayerIdRef.current
      : null;
    const styleHit = assetDeckVisibleRef.current || focusedStyleAssetId
      ? topmostStageHit(buildVideoStyleSlotCandidates(
          canvas.width,
          canvas.height,
          videoStyleRef.current,
          currentStyleAssets,
          focusedStyleAssetId,
          { offset: currentStyleWindow.offset, windowStart: currentStyleWindow.windowStart, total: currentStyleWindow.total }
        ), point)
      : null;
    if (styleHit) return styleHit;
    return topmostStageHit(buildStageHitCandidates(
      canvas.width,
      canvas.height,
      liveLayerIdsRef.current,
      assetsRef.current,
      scenesRef.current,
      imagesRef.current,
      videosRef.current,
      sceneSoloRef.current,
      true,
      mergedAssetIds(completedVideoIdsRef.current, budgetHiddenAssetIdsRef.current)
    ), point);
  };

  const focusStageLayer = useCallback((hit: StageHitCandidate, source: "mouse" | "palm" | "point" = "mouse") => {
    if (hit.layerId === SCREEN_OVERLAY_ID) {
      activeLayerIdRef.current = SCREEN_OVERLAY_ID;
      setActiveLayerId(SCREEN_OVERLAY_ID);
    } else {
      const nextStack = activateLayer(liveLayerIdsRef.current, hit.layerId);
      liveLayerIdsRef.current = nextStack;
      activeLayerIdRef.current = hit.layerId;
      setLiveLayerIds(nextStack);
      setActiveLayerId(hit.layerId);
    }
    setSelectedSceneMemberId(source === "mouse" ? hit.sceneMemberId ?? null : null);
    sceneMemberTargetIdRef.current = source === "palm" ? hit.sceneMemberId ?? null : null;
    sceneMemberMissSinceRef.current = null;
    setSceneMemberTargetId(sceneMemberTargetIdRef.current);
    manipulationTrackerRef.current.reset();
    if (source === "mouse") palmSignalTrackerRef.current.reset();
    setManipulation({ mode: "idle", progress: 0 });
  }, []);

  const handleStageClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (isFinalizing || performance.now() < suppressStageClickUntilRef.current) return;
    const canvas = outputCanvasRef.current;
    const canvasBounds = canvas?.getBoundingClientRect();
    if (canvas && canvasBounds?.width && canvasBounds.height) {
      const widget = widgetAtPoint(widgetsRef.current, {
        x: (event.clientX - canvasBounds.left) / canvasBounds.width * canvas.width,
        y: (event.clientY - canvasBounds.top) / canvasBounds.height * canvas.height
      }, canvas.width, canvas.height);
      if (widget && widget.kind !== "live") {
        setSelectedWidgetId(widget.id);
        activeLayerIdRef.current = null;
        setActiveLayerId(null);
        setSelectedSceneMemberId(null);
        return;
      }
    }
    setSelectedWidgetId(null);
    const hit = layerAtStagePoint(event);
    const styleAsset = hit ? currentVideoStyleAssets().find((asset) => asset.id === hit.layerId) : undefined;
    if (styleAsset) focusVideoStyleAssetRef.current(styleAsset);
    else if (hit) focusStageLayer(hit);
    else setSelectedSceneMemberId(null);
  };

  const handleStageDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    const hit = layerAtStagePoint(event);
    if (!hit?.sceneMemberId) return;
    const layer = resolveLayer(hit.layerId, assetsRef.current, scenesRef.current);
    if (layer?.kind !== "scene") return;
    focusStageLayer(hit);
    toggleSceneSolo(layer.scene, sceneSoloRef.current[layer.scene.id] ?? hit.sceneMemberId);
  };

  const ensureAudioMixer = useCallback(async () => {
    if (audioMixerRef.current) return audioMixerRef.current;
    const mixer = await createStudioAudioMixer();
    audioMixerRef.current = mixer;
    if (mixer) {
      setMediaMonitoring(mixer, monitorMediaAudioRef.current);
      connectScreenAudio(mixer, screenStreamRef.current);
      videosRef.current.forEach((video, id) => {
        const asset = assetsRef.current.find((item) => item.id === id);
        video.muted = false;
        connectVideoAudio(mixer, id, video, Boolean(asset?.includeAudio));
      });
      widgetAudioRef.current.forEach((audio, id) => connectVideoAudio(mixer, `widget:${id}`, audio, true, true));
    }
    return mixer;
  }, []);

  const clearRuntimeAssets = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    videosRef.current.forEach((video, id) => {
      video.pause();
      removeVideoAudio(audioMixerRef.current, id);
    });
    imagesRef.current.clear();
    videosRef.current.clear();
    completedVideoIdsRef.current = new Set();
    completedVideoVersionRef.current += 1;
    budgetHiddenAssetIdsRef.current = new Set();
    budgetHiddenVersionRef.current += 1;
    pointFocusTrackerRef.current.reset();
    setPointFocus(null);
    setLiveBudgetNotice(null);
    liveLayerIdsRef.current = [];
    activeLayerIdRef.current = null;
    layerActivationTimesRef.current = {};
    cameraReflowControllerRef.current.reset();
    cameraReflowFrameRef.current = { x: 0, width: 1, target: null, transitioning: false };
    gestureSequenceCursorRef.current = {};
    directorQueueRef.current = [];
    directorCursorRef.current = 0;
    directorFocusedAssetIdRef.current = null;
    palmRestoreRef.current = { since: 0, latched: false };
    setActiveGestureCue(null);
    setDirectorCursor(0);
    setDirectorFocusedAssetId(null);
    setLiveLayerIds([]);
    setActiveLayerId(null);
    intentEngineRef.current.reset();
    intentQueueRef.current = [];
    setIntentQueue([]);
  }, []);

  const materializeProjectAssets = useCallback(async (snapshot: StudioProjectSnapshot) => {
    clearRuntimeAssets();
    const restored: StudioAsset[] = [];
    for (const stored of snapshot.assets) {
      const legacyBackground = (stored as StudioAsset & { background?: unknown }).background;
      const asset: StudioAsset = {
        ...stored,
        gesture: (stored.gesture as string | undefined) === "palm" || stored.gesture === "one" ? undefined : stored.gesture,
        entranceAnimation: stored.entranceAnimation ?? "fade",
        motionEffect: stored.motionEffect ?? (stored.entranceAnimation === "float" ? "float" : "none"),
        cameraReflow: normalizeCameraReflow(stored.cameraReflow),
        videoPlayback: stored.kind === "video" ? "once" : undefined,
        cueSound: normalizeCueSound(stored.cueSound),
        cueVolume: stored.cueVolume ?? 0.65,
        stageBackground: normalizeStageBackground(stored.stageBackground ?? legacyBackground),
        stageBackgroundColor: stored.stageBackgroundColor ?? "#111111",
        sourceUrl: undefined
      };
      delete (asset as StudioAsset & { background?: unknown }).background;
      if (asset.kind === "image" || asset.kind === "video") {
        const blob = await loadAssetBlob(snapshot.id, asset.id);
        if (blob) {
          const sourceUrl = URL.createObjectURL(blob);
          objectUrlsRef.current.push(sourceUrl);
          asset.sourceUrl = sourceUrl;
          if (asset.kind === "image") {
            const image = await compositionImageFromBlob(blob, sourceUrl, (url) => objectUrlsRef.current.push(url));
            asset.sourceUrl = image.src;
            imagesRef.current.set(asset.id, image);
          } else {
            const video = document.createElement("video");
            video.src = sourceUrl;
            video.muted = true;
            video.loop = false;
            video.playsInline = true;
            video.preload = "auto";
            const duration = await videoMetadata(video);
            if (duration > 0) {
              asset.mediaDuration = duration;
              if (asset.videoTrim) asset.videoTrim = normalizeVideoTrim(asset.videoTrim, duration);
            }
            videosRef.current.set(asset.id, video);
            if (audioMixerRef.current) {
              video.muted = false;
              connectVideoAudio(audioMixerRef.current, asset.id, video, Boolean(asset.includeAudio));
            }
          }
        }
      }
      restored.push(asset);
    }
    return restored;
  }, [clearRuntimeAssets]);

  const hydrateProject = useCallback(async (snapshot: StudioProjectSnapshot) => {
    setProjectHydrated(false);
    let restoredAssets = await materializeProjectAssets(snapshot);
    const availableIds = new Set(restoredAssets.map((asset) => asset.id));
    let limitedRestoredScenes = 0;
    const restoredScenes = (snapshot.scenes ?? []).map((scene) => {
      const availableMembers = scene.memberIds.filter((id) => availableIds.has(id));
      const memberIds = constrainedSceneMemberIds(availableMembers, restoredAssets);
      if (memberIds.length !== availableMembers.length) limitedRestoredScenes += 1;
      return {
        ...scene,
        gesture: scene.gesture === "one" ? undefined : scene.gesture,
        memberIds,
        placement: scene.placement ?? "center" as const,
        size: scene.size ?? "full" as const,
        revealSide: normalizeSceneRevealSide(scene.revealSide),
        revealMotion: normalizeSceneRevealMotion(scene.revealMotion),
        stageBackground: normalizeStageBackground(scene.stageBackground),
        stageBackgroundColor: scene.stageBackgroundColor ?? "#111111",
        entranceAnimation: scene.entranceAnimation ?? "fade" as const,
        motionEffect: scene.motionEffect ?? (scene.entranceAnimation === "float" ? "float" as const : "none" as const),
        cueSound: normalizeCueSound(scene.cueSound),
        cueVolume: scene.cueVolume ?? 0.65,
        memberFocusModes: Object.fromEntries(memberIds.map((id): [string, SceneMemberFocusMode] => {
          const mode = scene.memberFocusModes?.[id];
          return [id, mode === "off" || mode === "full" ? mode : "medium"];
        }))
      };
    }).filter((scene) => scene.memberIds.length >= 2);
    const sceneMemberIds = new Set(restoredScenes.flatMap((scene) => scene.memberIds));
    restoredAssets = restoredAssets.map((asset) => sceneMemberIds.has(asset.id) ? { ...asset, gesture: undefined } : asset);
    const restoredConcepts = reconcileConcepts(snapshot.concepts ?? [], restoredAssets, restoredScenes);
    const restoredWidgets = (snapshot.widgets ?? []).filter((widget) => widget.kind !== "live").map((widget): CanvasWidget => ({
      ...widget,
      visible: widget.visible !== false,
      volume: widget.kind === "vinyl" ? Math.min(1, Math.max(0, widget.volume ?? .8)) : widget.volume,
      assetIds: widget.kind === "orbit" ? (widget.assetIds ?? []).filter((id) => restoredAssets.some((asset) => asset.id === id)) : widget.assetIds,
      sceneIds: widget.kind === "orbit" ? (widget.sceneIds ?? []).filter((id) => restoredScenes.some((scene) => scene.id === id)) : widget.sceneIds,
      actionAssetId: widget.actionAssetId && restoredAssets.some((asset) => asset.id === widget.actionAssetId) ? widget.actionAssetId : undefined,
      active: false,
      open: false,
      orbitOffset: 0
    }));
    assetsRef.current = restoredAssets;
    scenesRef.current = restoredScenes;
    widgetsRef.current = restoredWidgets;
    conceptsRef.current = restoredConcepts;
    const restoredGestureSequences = normalizeGestureSequences(restoredAssets, restoredScenes, snapshot.gestureSequences ?? {});
    gestureSequencesRef.current = restoredGestureSequences;
    gestureSequenceCursorRef.current = {};
    projectIdRef.current = snapshot.id;
    selectedCameraRef.current = snapshot.selectedCameraId || selectedCameraRef.current;
    selectedMicrophoneRef.current = snapshot.selectedMicrophoneId || "none";
    qualityRef.current = diagnostics
      ? "720p30"
      : recommendedQualityForDevice(navigator.hardwareConcurrency, (navigator as Navigator & { deviceMemory?: number }).deviceMemory);
    // Rii-Flow records in one predictable, standard video format.
    aspectRef.current = snapshot.aspectId || "landscape";
    const savedMirrorPreference = diagnostics ? null : localStorage.getItem("gesture-studio-mirror");
    mirrorCameraRef.current = diagnostics ? false : savedMirrorPreference === null ? true : savedMirrorPreference === "true";
    const restoredCameraFrame = normalizeCameraFrame(snapshot.cameraFrame);
    cameraFrameRef.current = restoredCameraFrame;
    monitorMediaAudioRef.current = Boolean(snapshot.monitorMediaAudio);
    setProjectId(snapshot.id);
    setProjectName(snapshot.name);
    setAssets(restoredAssets);
    setScenes(restoredScenes);
    setWidgets(restoredWidgets);
    setConcepts(restoredConcepts);
    setGestureSequences(restoredGestureSequences);
    setActiveGestureCue(null);
    setSelectedCameraId(selectedCameraRef.current);
    setSelectedMicrophoneId(selectedMicrophoneRef.current);
    setQualityId(qualityRef.current);
    setAspectId(aspectRef.current);
    setMirrorCamera(mirrorCameraRef.current);
    setCameraFrame(restoredCameraFrame);
    setMonitorMediaAudio(monitorMediaAudioRef.current);
    const savedTiming = snapshot.timing || DEFAULT_TIMING;
    const restoredHoldMs = savedTiming.holdMs === 550 || savedTiming.holdMs === 350 || savedTiming.holdMs === 180 || savedTiming.holdMs === 150 ? DEFAULT_TIMING.holdMs : savedTiming.holdMs;
    setTiming({
      holdMs: Number.isFinite(restoredHoldMs) ? Math.max(MIN_GESTURE_HOLD_MS, restoredHoldMs) : DEFAULT_TIMING.holdMs,
      cooldownMs: savedTiming.cooldownMs === 900 || savedTiming.cooldownMs === 700 ? DEFAULT_TIMING.cooldownMs : savedTiming.cooldownMs
    });
    const savedPalmHold = snapshot.palmHoldMs;
    setPalmHoldMs(!Number.isFinite(savedPalmHold) || savedPalmHold === 220
      ? DEFAULT_MANIPULATION.armMs
      : Math.min(400, Math.max(80, savedPalmHold)));
    const source = qualityPreset(qualityRef.current);
    const dimensions = canvasDimensions(source.width, source.height, aspectRef.current);
    if (outputCanvasRef.current) {
      outputCanvasRef.current.width = dimensions.width;
      outputCanvasRef.current.height = dimensions.height;
    }
    setOutputSize(dimensions);
    setProjectHydrated(true);
    setProjectSaveState("saved");
    if (limitedRestoredScenes) {
      setErrorMessage(`${limitedRestoredScenes} older scene${limitedRestoredScenes === 1 ? " was" : "s were"} limited to five assets and two videos for smooth recording.`);
    }
    await setCurrentProjectId(snapshot.id);
  }, [materializeProjectAssets]);

  const refreshStoredTakes = useCallback(async (directory?: FileSystemDirectoryHandle | null, permission?: PermissionState | "unsupported", targetProjectId?: string) => {
    if (diagnostics) return;
    const metadata = await listTakes();
    const resolvedDirectory = directory === undefined ? recordingsDirectoryRef.current : directory;
    const resolvedPermission = permission ?? folderPermissionRef.current;
    const hydrated = await Promise.all(metadata.map(async (take): Promise<RecordedClip> => {
      const normalizedTake = { ...take, rating: take.rating === "favorite" ? "favorite" as const : "neutral" as const };
      if (!take.folderBacked) return { ...normalizedTake, availability: "missing" };
      if (!resolvedDirectory || resolvedPermission !== "granted") return { ...normalizedTake, availability: "permission" };
      try {
        const handle = await resolvedDirectory.getFileHandle(take.fileName);
        const url = URL.createObjectURL(await handle.getFile());
        recordingUrlsRef.current.push(url);
        return { ...normalizedTake, url, availability: "ready" };
      } catch {
        return { ...normalizedTake, availability: "missing" };
      }
    }));
    const library = mergeTakeLibrary(hydrated, takeLibraryRef.current);
    takeLibraryRef.current = library;
    setRecordings(takesForProject(library, targetProjectId ?? projectIdRef.current));
  }, [diagnostics]);

  useEffect(() => {
    if (diagnostics) return;
    let cancelled = false;
    void (async () => {
      try {
        await requestPersistentStorage().catch(() => false);

        let index = await listProjects();
        let currentId = await getCurrentProjectId();
        let snapshot = currentId ? await loadProject(currentId) : undefined;
        if (!snapshot) {
          snapshot = createBlankProject("My studio");
          snapshot.selectedCameraId = selectedCameraRef.current;
          snapshot.selectedMicrophoneId = selectedMicrophoneRef.current || "none";
          snapshot.qualityId = qualityRef.current;
          snapshot.aspectId = aspectRef.current;
          snapshot.mirrorCamera = mirrorCameraRef.current;
          await saveProject(snapshot);
          await setCurrentProjectId(snapshot.id);
          index = await listProjects();
        }
        if (cancelled) return;
        setProjects(index);
        await hydrateProject(snapshot);

        const directory = await loadRecordingsDirectory();
        let permission: PermissionState | "unsupported" = (window as DirectoryPickerWindow).showDirectoryPicker ? "prompt" : "unsupported";
        if (directory) permission = await directoryPermission(directory, false);
        if (cancelled) return;
        recordingsDirectoryRef.current = directory ?? null;
        folderPermissionRef.current = permission;
        setRecordingsDirectory(directory ?? null);
        setFolderPermission(permission);
        await refreshStoredTakes(directory, permission, snapshot.id);
      } catch (error) {
        if (!cancelled) {
          setProjectHydrated(true);
          setProjectSaveState("error");
          setErrorMessage(error instanceof Error ? `Local session could not load: ${error.message}` : "Local session could not load.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [diagnostics, hydrateProject, refreshStoredTakes]);

  useEffect(() => {
    if (diagnostics || !projectHydrated || !projectId) return;
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    setProjectSaveState("saving");
    const snapshot: StudioProjectSnapshot = {
      id: projectId,
      name: projectName.trim() || "Untitled project",
      createdAt: projects.find((project) => project.id === projectId)?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      assets,
      scenes,
      widgets,
      concepts,
      gestureSequences: effectiveGestureSequences,
      selectedCameraId,
      selectedMicrophoneId,
      qualityId,
      aspectId,
      mirrorCamera,
      cameraFrame,
      monitorMediaAudio,
      timing,
      palmHoldMs,
      movementReach: "comfort",
      triggerHand: "any",
      takeCounter: 1
    };
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveProject(snapshot)
        .then(async () => {
          setProjectSaveState("saved");
          setProjects(await listProjects());
        })
        .catch((error) => {
          setProjectSaveState("error");
          setErrorMessage(error instanceof Error ? `Project could not save: ${error.message}` : "Project could not save.");
        });
    }, 450);
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [aspectId, assets, cameraFrame, concepts, diagnostics, effectiveGestureSequences, mirrorCamera, monitorMediaAudio, palmHoldMs, projectHydrated, projectId, projectName, qualityId, scenes, selectedCameraId, selectedMicrophoneId, timing, widgets]);

  const refreshCameras = useCallback(async () => {
    const list = await provider.enumerateCameras();
    setCameras(list);
    if (list.length && !list.some((camera) => camera.deviceId === selectedCameraRef.current)) {
      const remembered = diagnostics ? null : localStorage.getItem("gesture-studio-camera");
      const fallback = list.find((camera) => camera.deviceId === remembered) ?? list[0];
      selectedCameraRef.current = fallback.deviceId;
      setSelectedCameraId(fallback.deviceId);
    }
    return list;
  }, [diagnostics, provider]);

  const refreshMicrophones = useCallback(async () => {
    const list = await provider.enumerateMicrophones();
    setMicrophones(list);
    const selected = selectedMicrophoneRef.current;
    if (selected === "none") return list;
    if (list.length && !list.some((microphone) => microphone.deviceId === selected)) {
      const remembered = diagnostics ? null : localStorage.getItem("gesture-studio-microphone");
      const fallback = list.find((microphone) => microphone.deviceId === remembered) ?? list[0];
      selectedMicrophoneRef.current = fallback.deviceId;
      setSelectedMicrophoneId(fallback.deviceId);
    }
    return list;
  }, [diagnostics, provider]);

  const syncStageOutputSize = useCallback((cameraSettings = grantedRef.current) => {
    const source = cameraSettings ?? qualityPreset(qualityRef.current);
    const dimensions = canvasDimensions(source.width, source.height, aspectRef.current);
    const canvas = outputCanvasRef.current;
    if (canvas) {
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
    }
    setOutputSize(dimensions);
    return dimensions;
  }, []);

  const installFeed = useCallback(async (feed: CameraFeed, deviceId: string, previous: MediaStream | null) => {
    const video = cameraVideoRef.current;
    const canvas = outputCanvasRef.current;
    if (!video || !canvas) throw new Error("The output stage is unavailable.");
    video.srcObject = feed.stream;
    await video.play();
    cameraStreamRef.current = feed.stream;
    grantedRef.current = feed.settings;
    setGranted(feed.settings);
    syncStageOutputSize(feed.settings);
    setActiveCameraLabel(feed.label);
    selectedCameraRef.current = deviceId || feed.settings.deviceId;
    setSelectedCameraId(selectedCameraRef.current);
    if (!diagnostics) localStorage.setItem("gesture-studio-camera", selectedCameraRef.current);

    const track = feed.stream.getVideoTracks()[0];
    track?.addEventListener("ended", () => {
      if (cameraStreamRef.current !== feed.stream) return;
      void (async () => {
        setErrorMessage("The active camera disconnected. Rii-Flow is selecting another source.");
        const list = await refreshCameras();
        const fallback = list.find((camera) => camera.deviceId !== feed.settings.deviceId) ?? list[0];
        if (!fallback) {
          setPhase("error");
          setPhaseMessage("No camera is currently available");
          return;
        }
        if (recordingRef.current) {
          pendingFallbackRef.current = fallback.deviceId;
          stopRecordingRef.current();
        } else {
          await switchCameraRef.current(fallback.deviceId, qualityPreset(qualityRef.current));
        }
      })();
    });

    if (previous && previous !== feed.stream) {
      const previousTracks = previous.getTracks();
      stopMediaStream(previous);
      setOldTrackStopped(previousTracks.every((item) => item.readyState === "ended"));
      setCameraSwitches((count) => count + 1);
    }
  }, [diagnostics, refreshCameras, syncStageOutputSize]);

  const switchCamera = useCallback(async (deviceId: string, preset: QualityPreset, initial = false) => {
    if (recordingRef.current) return;
    const previous = cameraStreamRef.current;
    setErrorMessage(null);
    setPhase(initial ? "permission" : "switching");
    setPhaseMessage(initial ? "Waiting for camera permission" : "Switching camera source");
    try {
      const feed = await provider.openCamera(deviceId, preset);
      await installFeed(feed, deviceId, previous);
      await refreshCameras();
      if (studioReadyRef.current) {
        setPhase("ready");
        setPhaseMessage("Camera and gestures ready — point at a visual or use its gesture");
      }
    } catch (error) {
      if (!previous) {
        setPhase("error");
        setPhaseMessage("Camera could not start");
      } else {
        setPhase("ready");
        setPhaseMessage("Previous camera is still active");
      }
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow access and try again."
        : error instanceof Error ? error.message : "The camera could not be opened.";
      setErrorMessage(message);
      throw error;
    }
  }, [installFeed, provider, refreshCameras]);

  useEffect(() => { switchCameraRef.current = switchCamera; }, [switchCamera]);

  const installMicrophone = useCallback(async (feed: MicrophoneFeed, deviceId: string, previous: MediaStream | null) => {
    const mixer = await ensureAudioMixer();
    connectMicrophone(mixer, feed.stream);
    audioStreamRef.current = feed.stream;
    selectedMicrophoneRef.current = deviceId;
    setSelectedMicrophoneId(deviceId);
    setActiveMicrophoneLabel(feed.label);
    setMicrophonePhase("ready");
    if (!diagnostics) localStorage.setItem("gesture-studio-microphone", deviceId);

    const track = feed.stream.getAudioTracks()[0];
    track?.addEventListener("ended", () => {
      if (audioStreamRef.current !== feed.stream) return;
      void (async () => {
        setMicrophonePhase("switching");
        const list = await refreshMicrophones();
        const fallback = list.find((microphone) => microphone.deviceId !== deviceId);
        if (fallback) await switchMicrophoneRef.current(fallback.deviceId, false, true);
        else {
          connectMicrophone(audioMixerRef.current, null);
          audioStreamRef.current = null;
          setActiveMicrophoneLabel("No active microphone");
          setMicrophonePhase("error");
          setErrorMessage("The active microphone disconnected and no fallback is available.");
        }
      })();
    });

    if (previous && previous !== feed.stream) stopMediaStream(previous);
  }, [diagnostics, ensureAudioMixer, refreshMicrophones]);

  const switchMicrophone = useCallback(async (deviceId: string, initial = false, force = false) => {
    if (recordingRef.current && !force) return;
    const previous = audioStreamRef.current;
    if (deviceId === "none") {
      connectMicrophone(audioMixerRef.current, null);
      audioStreamRef.current = null;
      stopMediaStream(previous);
      selectedMicrophoneRef.current = "none";
      setSelectedMicrophoneId("none");
      setActiveMicrophoneLabel("Microphone off");
      setMicrophonePhase("off");
      setMicrophoneLevel(0);
      if (!diagnostics) localStorage.setItem("gesture-studio-microphone", "none");
      return;
    }
    setMicrophonePhase(initial ? "permission" : "switching");
    try {
      const feed = await provider.openMicrophone(deviceId);
      await installMicrophone(feed, deviceId, previous);
      await refreshMicrophones();
    } catch (error) {
      setMicrophonePhase(previous ? "ready" : "error");
      setActiveMicrophoneLabel(previous ? previous.getAudioTracks()[0]?.label || "Active microphone" : "Microphone unavailable");
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone permission was denied. Choose Microphone off or allow access and try again."
        : error instanceof Error ? error.message : "The microphone could not be opened.";
      setErrorMessage(message);
      throw error;
    }
  }, [diagnostics, installMicrophone, provider, refreshMicrophones]);

  useEffect(() => { switchMicrophoneRef.current = switchMicrophone; }, [switchMicrophone]);

  const endScreenShare = useCallback((stream = screenStreamRef.current, notify = true) => {
    if (!stream || (screenStreamRef.current && screenStreamRef.current !== stream)) return;
    screenStreamRef.current = null;
    screenSettingsRef.current = null;
    connectScreenAudio(audioMixerRef.current, null);
    stopMediaStream(stream);
    const video = screenVideoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    setScreenSettings(null);
    setScreenPhase("idle");
    screenOverlayRef.current = { ...screenOverlayRef.current, visible: false };
    setScreenOverlay(screenOverlayRef.current);
    if (activeLayerIdRef.current === SCREEN_OVERLAY_ID) {
      const fallback = liveLayerIdsRef.current.at(-1) ?? null;
      activeLayerIdRef.current = fallback;
      setActiveLayerId(fallback);
    }
    if (notify && studioReadyRef.current) setPhaseMessage("Screen sharing stopped — camera remains live");
  }, []);

  const selectScreenOverlay = useCallback(() => {
    if (!screenSettingsRef.current) return;
    if (screenSettingsRef.current.recursionGuard) {
      setPhaseMessage("Rii-Flow is already the recording canvas — self-share preview hidden to prevent an infinite mirror");
      return;
    }
    if (!screenOverlayRef.current.visible) {
      screenOverlayRef.current = { ...screenOverlayRef.current, visible: true };
      setScreenOverlay(screenOverlayRef.current);
    }
    const now = performance.now();
    layerActivationTimesRef.current = { ...layerActivationTimesRef.current, [SCREEN_OVERLAY_ID]: now };
    playCueSound(audioMixerRef.current, screenOverlayRef.current.cueSound, screenOverlayRef.current.cueVolume);
    activeLayerIdRef.current = SCREEN_OVERLAY_ID;
    setActiveLayerId(SCREEN_OVERLAY_ID);
    setSelectedSceneMemberId(null);
    sceneMemberTargetIdRef.current = null;
    sceneMemberMissSinceRef.current = null;
    setSceneMemberTargetId(null);
    manipulationTrackerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    circleMorphTrackerRef.current.reset();
    assetMorphExitRef.current = null;
    morphFocusLockUntilRef.current = 0;
    manipulationGuardUntilRef.current = now + 420;
    setManipulation({ mode: "idle", progress: 0 });
    setMorphGestureProgress(0);
    setMorphExitAssetId(null);
  }, []);

  const startScreenShare = async () => {
    if (!studioReadyRef.current || recordingRef.current || screenPhase === "permission") return;
    const previous = screenStreamRef.current;
    let candidate: MediaStream | null = null;
    setErrorMessage(null);
    setScreenPhase("permission");
    try {
      const preset = qualityPreset(qualityRef.current);
      const options: DisplayMediaRequestOptions = {
        video: {
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: preset.fps, max: preset.fps }
        },
        audio: true,
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        systemAudio: "include"
      };
      candidate = (diagnostics
        ? diagnosticDisplayStream()
        : await navigator.mediaDevices?.getDisplayMedia?.(options)) ?? null;
      const nextStream = candidate;
      if (!nextStream) throw new Error("Screen capture is not available in this browser.");
      const track = nextStream.getVideoTracks()[0];
      if (!track) {
        stopMediaStream(nextStream);
        throw new Error("The selected screen source did not provide video.");
      }
      const video = screenVideoRef.current;
      if (!video) {
        stopMediaStream(nextStream);
        throw new Error("The screen preview is unavailable.");
      }
      video.srcObject = nextStream;
      video.muted = true;
      await video.play();
      const settings = track.getSettings();
      const displaySurface = settings.displaySurface === "browser" || settings.displaySurface === "monitor" || settings.displaySurface === "window"
        ? settings.displaySurface
        : undefined;
      const captureLabel = track.label.toLowerCase();
      const pageTitle = document.title.trim().toLowerCase();
      const captureHandle = (track as CaptureHandleTrack).getCaptureHandle?.();
      const identifiedSelfCapture = captureHandle?.handle === RII_FLOW_CAPTURE_HANDLE;
      const selfTabLabel = captureLabel.includes("rii-flow") || captureLabel.includes("rii flow") || captureLabel.includes("127.0.0.1") || captureLabel.includes("localhost") || captureLabel.includes("this tab") || captureLabel.includes("current tab");
      const capturesThisTab = displaySurface === "browser" && (identifiedSelfCapture || selfTabLabel || Boolean(pageTitle && captureLabel.includes(pageTitle)) || captureLabel.length === 0);
      const recursionGuard = identifiedSelfCapture || capturesThisTab;
      const capture: ScreenCaptureSettings = {
        width: settings.width || video.videoWidth || preset.width,
        height: settings.height || video.videoHeight || preset.height,
        frameRate: settings.frameRate || preset.fps,
        label: diagnostics
          ? "Shared screen preview"
          : displaySurface === "browser"
          ? "Shared browser tab"
          : displaySurface === "window"
          ? "Shared app window"
          : displaySurface === "monitor"
          ? "Shared display"
          : "Shared screen",
        displaySurface,
        hasAudio: nextStream.getAudioTracks().length > 0,
        recursionGuard
      };
      const mixer = await ensureAudioMixer();
      connectScreenAudio(mixer, recursionGuard ? null : nextStream);
      screenStreamRef.current = nextStream;
      screenSettingsRef.current = capture;
      setScreenSettings(capture);
      screenOverlayRef.current = { ...screenOverlayRef.current, visible: false };
      setScreenOverlay(screenOverlayRef.current);
      assetDeckVisibleRef.current = true;
      setAssetDeckVisible(true);
      if (activeLayerIdRef.current === SCREEN_OVERLAY_ID) {
        activeLayerIdRef.current = null;
        setActiveLayerId(null);
      }
      setScreenPhase("ready");
      setPhaseMessage(recursionGuard
        ? "Rii-Flow selected — self-share is blocked from the canvas to prevent an infinite mirror"
        : capture.hasAudio ? "Screen added to the media deck with shared audio" : "Screen added to the media deck — microphone audio remains active");

      track.addEventListener("ended", () => {
        if (screenStreamRef.current === nextStream) endScreenShare(nextStream, true);
      }, { once: true });
      nextStream.getAudioTracks().forEach((audioTrack) => audioTrack.addEventListener("ended", () => {
        if (screenStreamRef.current !== nextStream) return;
        connectScreenAudio(audioMixerRef.current, null);
        screenSettingsRef.current = { ...capture, hasAudio: false };
        setScreenSettings((current) => current ? { ...current, hasAudio: false } : current);
      }, { once: true }));
      if (previous && previous !== nextStream) stopMediaStream(previous);
      candidate = null;
    } catch (error) {
      if (candidate && candidate !== previous) stopMediaStream(candidate);
      const video = screenVideoRef.current;
      if (video && video.srcObject === candidate) {
        video.srcObject = previous;
        if (previous) void video.play().catch(() => undefined);
      }
      connectScreenAudio(audioMixerRef.current, previous);
      const cancelled = error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError");
      setScreenPhase(previous ? "ready" : cancelled ? "idle" : "error");
      if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "The screen source could not start.");
    }
  };

  useEffect(() => {
    void refreshCameras();
    return provider.watchDevices(() => {
      void (async () => {
        const list = await refreshCameras();
        const activeDevice = cameraStreamRef.current?.getVideoTracks()[0]?.getSettings().deviceId || granted?.deviceId;
        if (studioReadyRef.current && activeDevice && !list.some((camera) => camera.deviceId === activeDevice)) {
          const fallback = list[0];
          if (!fallback) return;
          if (recordingRef.current) {
            pendingFallbackRef.current = fallback.deviceId;
            stopRecordingRef.current();
          } else {
            await switchCameraRef.current(fallback.deviceId, qualityPreset(qualityRef.current));
          }
        }
      })();
    });
  }, [granted?.deviceId, provider, refreshCameras]);

  useEffect(() => {
    void refreshMicrophones();
    return provider.watchDevices(() => {
      void (async () => {
        const list = await refreshMicrophones();
        const activeDevice = audioStreamRef.current?.getAudioTracks()[0]?.getSettings().deviceId || selectedMicrophoneRef.current;
        if (studioReadyRef.current && activeDevice !== "none" && !list.some((microphone) => microphone.deviceId === activeDevice)) {
          const fallback = list[0];
          if (fallback) await switchMicrophoneRef.current(fallback.deviceId, false, true);
        }
      })();
    });
  }, [provider, refreshMicrophones]);

  useEffect(() => {
    if (!diagnostics || !["setup", "import-flow", "intent-pinch", "intent-sequence", "streaming-speech", "streaming-multi", "streaming-sequence", "voice-command", "voice-palm-hold", "shelf-confirm", "director", "director-back", "style-focus", "morph", "gesture", "palm", "double", "manipulation", "stack", "stack-manipulation", "sequence", "scene", "scene-reveal", "scene-video-audio", "scene-limit", "scene-manipulation", "scene-selection", "scene-focus", "workspace"].includes(diagnosticScenario ?? "")) return;
    if (diagnosticScenario === "import-flow") {
      let cancelled = false;
      void (async () => {
        const fixtures = [
          ["diagnostic-import-dashboard", "Dashboard.svg", `${import.meta.env.BASE_URL}diagnostics/Dashboard.svg`],
          ["diagnostic-import-product", "Product.svg", `${import.meta.env.BASE_URL}diagnostics/Product.svg`],
          ["diagnostic-import-proof", "Proof.svg", `${import.meta.env.BASE_URL}diagnostics/Proof.svg`]
        ] as const;
        const samples = await Promise.all(fixtures.map(async ([id, name, url], index): Promise<StudioAsset> => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Diagnostic import failed (${response.status}).`);
          const blob = await response.blob();
          const sourceUrl = URL.createObjectURL(blob);
          objectUrlsRef.current.push(sourceUrl);
          const image = await compositionImageFromBlob(blob, sourceUrl, (nextUrl) => objectUrlsRef.current.push(nextUrl));
          imagesRef.current.set(id, image);
          return {
            id,
            name,
            kind: "image",
            sourceUrl: image.src,
            placement: index % 2 === 0 ? "right" : "left",
            size: "medium",
            dataView: "table",
            stageBackground: "camera",
            stageBackgroundColor: "#111111",
            entranceAnimation: "slide",
            motionEffect: "none",
            cameraReflow: "make-room",
            cueSound: "none",
            cueVolume: 0.65
          };
        }));
        if (cancelled) return;
        assetsRef.current = samples;
        scenesRef.current = [];
        setAssets(samples);
        setScenes([]);
      })().catch((error) => setErrorMessage(error instanceof Error ? error.message : "Diagnostic import failed."));
      return () => { cancelled = true; };
    }
    if (diagnosticScenario === "scene-limit") {
      const samples: StudioAsset[] = Array.from({ length: 7 }, (_, index) => ({
        id: `scene-limit-${index}`,
        name: `${index < 3 ? "Video" : "Image"} ${index + 1}.${index < 3 ? "mp4" : "png"}`,
        kind: index < 3 ? "video" as const : "image" as const,
        sourceUrl: index < 3 ? undefined : diagnosticAsset(`IMAGE ${index - 2}`, ["#e8b35d", "#c8d9b0", "#9fcbd0", "#b8a7d9"][index - 3] ?? "#e8b35d"),
        placement: "corner" as const,
        size: "small" as const,
        dataView: "table" as const
      }));
      samples.filter((sample) => sample.kind === "image").forEach((sample) => {
        const image = new Image();
        image.src = sample.sourceUrl ?? "";
        imagesRef.current.set(sample.id, image);
      });
      assetsRef.current = samples;
      scenesRef.current = [];
      setAssets(samples);
      setScenes([]);
      return;
    }
    if (diagnosticScenario === "setup" || diagnosticScenario === "intent-pinch" || diagnosticScenario === "intent-sequence" || diagnosticScenario === "streaming-speech" || diagnosticScenario === "streaming-multi" || diagnosticScenario === "streaming-sequence" || diagnosticScenario === "voice-command" || diagnosticScenario === "voice-palm-hold" || diagnosticScenario === "shelf-confirm" || diagnosticScenario === "director" || diagnosticScenario === "director-back" || diagnosticScenario === "style-focus" || diagnosticScenario === "morph") {
      const voiceDiagnostic = diagnosticScenario === "intent-pinch" || diagnosticScenario === "intent-sequence" || diagnosticScenario === "streaming-speech" || diagnosticScenario === "streaming-multi" || diagnosticScenario === "streaming-sequence" || diagnosticScenario === "voice-command" || diagnosticScenario === "voice-palm-hold" || diagnosticScenario === "shelf-confirm";
      const samples: StudioAsset[] = [
        { id: "director-a", name: diagnosticScenario === "setup" ? "Q3 dashboard.png" : voiceDiagnostic ? "The dashboard.png" : "The problem.png", triggerWord: diagnosticScenario === "setup" || voiceDiagnostic ? "dashboard" : "problem", kind: "image", sourceUrl: diagnosticAsset(diagnosticScenario === "setup" || voiceDiagnostic ? "DASHBOARD" : "THE PROBLEM", "#d9a76c"), placement: "right", size: "medium", dataView: "table", cameraReflow: "make-room", entranceAnimation: "slide" },
        { id: "director-b", name: "The product.png", triggerWord: "product", kind: "image", sourceUrl: diagnosticAsset("THE PRODUCT", "#7e97e8"), placement: "left", size: "medium", dataView: "table", cameraReflow: "make-room", entranceAnimation: "slide" },
        { id: "director-c", name: "The proof.png", triggerWord: "proof", kind: "image", sourceUrl: diagnosticAsset("THE PROOF", "#73c49a"), placement: "center", size: "medium", dataView: "table", cameraReflow: "overlay", entranceAnimation: "pop" }
      ];
      samples.forEach((sample) => {
        const image = new Image();
        image.src = sample.sourceUrl ?? "";
        imagesRef.current.set(sample.id, image);
      });
      assetsRef.current = samples;
      scenesRef.current = [];
      setAssets(samples);
      setScenes([]);
      if (diagnosticScenario === "style-focus" || diagnosticScenario === "morph") {
        videoStyleRef.current = "right-rail";
        setVideoStyleId("right-rail");
        mirrorCameraRef.current = false;
        setMirrorCamera(false);
      }
      return;
    }
    if (diagnosticScenario === "scene" || diagnosticScenario === "scene-reveal" || diagnosticScenario === "scene-video-audio" || diagnosticScenario === "scene-manipulation" || diagnosticScenario === "scene-selection" || diagnosticScenario === "scene-focus" || diagnosticScenario === "workspace") {
      const samples: StudioAsset[] = [
        { id: "scene-member-a", name: diagnosticScenario === "scene-video-audio" ? "Intro.mp4" : "Portrait.png", kind: diagnosticScenario === "scene-video-audio" ? "video" : "image", sourceUrl: diagnosticScenario === "scene-video-audio" ? undefined : diagnosticAsset("PORTRAIT", "#e8b35d"), includeAudio: false, placement: "corner", size: "small", dataView: "table" },
        { id: "scene-member-b", name: "Product.png", kind: "image", sourceUrl: diagnosticAsset("PRODUCT", "#c8d9b0"), placement: "corner", size: "small", dataView: "table" },
        { id: "scene-member-c", name: "Detail.png", kind: "image", sourceUrl: diagnosticAsset("DETAIL", "#9fcbd0"), placement: "corner", size: "small", dataView: "table" }
      ];
      samples.filter((sample) => sample.kind === "image").forEach((sample) => {
        const image = new Image();
        image.src = sample.sourceUrl ?? "";
        imagesRef.current.set(sample.id, image);
      });
      const sampleScene: StudioScene = {
        id: "diagnostic-scene",
        name: "Product story",
        memberIds: samples.map((sample) => sample.id),
        gesture: diagnosticScenario === "scene-focus" ? "two" : "one",
        placement: "center",
        size: "small",
        layout: "grid",
        revealSide: diagnosticScenario === "scene-reveal" ? "left" : "none",
        revealMotion: "smooth",
        stageBackground: diagnosticScenario === "scene-reveal" ? "cream" : "camera",
        memberFocusModes: Object.fromEntries(samples.map((sample, index) => [sample.id, index === 1 ? "full" as const : "medium" as const]))
      };
      assetsRef.current = samples;
      scenesRef.current = [sampleScene];
      setAssets(samples);
      setScenes([sampleScene]);
      return;
    }
    if (diagnosticScenario === "stack" || diagnosticScenario === "stack-manipulation" || diagnosticScenario === "sequence") {
      const samples: StudioAsset[] = [
        {
          id: "diagnostic-layer-one",
          name: "First overlay.png",
          kind: "image",
          sourceUrl: diagnosticAsset("FIRST LAYER", "#e8b35d"),
          gesture: "one",
          placement: "left",
          size: "small",
          dataView: "table"
        },
        {
          id: "diagnostic-layer-two",
          name: "Second overlay.png",
          kind: "image",
          sourceUrl: diagnosticAsset("SECOND LAYER", "#c8d9b0"),
          gesture: diagnosticScenario === "sequence" ? "one" : "two",
          placement: "right",
          size: "small",
          dataView: "table"
        }
      ];
      samples.forEach((sample) => {
        const image = new Image();
        image.src = sample.sourceUrl ?? "";
        imagesRef.current.set(sample.id, image);
      });
      assetsRef.current = samples;
      setAssets(samples);
      return;
    }
    const id = "diagnostic-asset";
    const sourceUrl = diagnosticAsset();
    const image = new Image();
    image.src = sourceUrl;
    imagesRef.current.set(id, image);
    const sample: StudioAsset = {
      id,
      name: "Live overlay.png",
      kind: "image",
      sourceUrl,
      gesture: diagnosticScenario === "palm" ? undefined : diagnosticScenario === "double" ? "double-two" : "one",
      placement: "corner",
      size: "small",
      dataView: "table"
    };
    assetsRef.current = [sample];
    setAssets([sample]);
  }, [diagnosticScenario, diagnostics, projectHydrated]);

  useEffect(() => {
    if (!diagnostics || diagnosticScenario !== "takes") return;
    const now = Date.now();
    setRecordings(Array.from({ length: 12 }, (_, index): RecordedClip => ({
      id: `diagnostic-take-${index + 1}`,
      projectId: "diagnostic-project",
      projectName: "Creator session",
      fileName: `Creator-session-take-${String(index + 1).padStart(2, "0")}.mp4`,
      bytes: 42_000_000 + index * 1_500_000,
      durationSeconds: 48 + index * 7,
      createdAt: now - index * 180_000,
      width: 1920,
      height: 1080,
      frameRate: 60,
      bitrate: 24_000_000,
      mimeType: "video/mp4",
      folderBacked: index === 0,
      rating: index === 1 ? "favorite" : "neutral",
      availability: index === 0 ? "missing" : "session"
    })));
  }, [diagnosticScenario, diagnostics]);

  useEffect(() => {
    if (!diagnostics || diagnosticScenario !== "project-switch") return;
    const now = Date.now();
    const diagnosticProjects: ProjectSummary[] = [
      { id: "project-alpha", name: "Alpha desk", createdAt: now - 3000, updatedAt: now - 1000 },
      { id: "project-beta", name: "Beta desk", createdAt: now - 2000, updatedAt: now - 500 },
      { id: "project-fresh", name: "Fresh desk", createdAt: now - 1000, updatedAt: now }
    ];
    const diagnosticTakes: RecordedClip[] = [
      { id: "alpha-2", projectId: "project-alpha", projectName: "Alpha desk", fileName: "Alpha-02.mp4", bytes: 24_000_000, durationSeconds: 18, createdAt: now - 100, width: 1920, height: 1080, frameRate: 30, bitrate: 20_000_000, mimeType: "video/mp4", folderBacked: false, rating: "neutral", availability: "session" },
      { id: "alpha-1", projectId: "project-alpha", projectName: "Alpha desk", fileName: "Alpha-01.mp4", bytes: 18_000_000, durationSeconds: 12, createdAt: now - 200, width: 1920, height: 1080, frameRate: 30, bitrate: 20_000_000, mimeType: "video/mp4", folderBacked: false, rating: "neutral", availability: "session" },
      { id: "beta-1", projectId: "project-beta", projectName: "Beta desk", fileName: "Beta-01.mp4", bytes: 16_000_000, durationSeconds: 10, createdAt: now - 150, width: 1280, height: 720, frameRate: 30, bitrate: 12_000_000, mimeType: "video/mp4", folderBacked: false, rating: "neutral", availability: "session" }
    ];
    takeLibraryRef.current = diagnosticTakes;
    projectIdRef.current = diagnosticProjects[0].id;
    setProjects(diagnosticProjects);
    setProjectId(diagnosticProjects[0].id);
    setProjectName(diagnosticProjects[0].name);
    setRecordings(takesForProject(diagnosticTakes, diagnosticProjects[0].id));
  }, [diagnosticScenario, diagnostics]);

  const clearArmedVoiceTarget = useCallback((message?: string) => {
    if (voiceArmTimerRef.current !== null) window.clearTimeout(voiceArmTimerRef.current);
    voiceArmTimerRef.current = null;
    armedVoiceTargetRef.current = null;
    setArmedVoiceTarget(null);
    if (message) setPhaseMessage(message);
  }, []);

  const armVoiceTarget = useCallback((target: VoiceTriggerTarget, heardText: string, source: "voice" | "shelf" = "voice") => {
    const now = performance.now();
    const armedTarget: ArmedVoiceTarget = { ...target, heardText, source, armedAt: now, expiresAt: now + VOICE_ARM_TIMEOUT_MS };
    if (voiceArmTimerRef.current !== null) window.clearTimeout(voiceArmTimerRef.current);
    // Voice is the primary selector. If the fallback shelf happens to be open,
    // dismiss it immediately so the next palm can only confirm this cue.
    operatorShelfOpenRef.current = false;
    setOperatorShelfOpen(false);
    setOperatorShelfTargetId(null);
    setOperatorShelfProgress(0);
    operatorShelfPointTrackerRef.current.reset();
    armedVoiceTargetRef.current = armedTarget;
    setArmedVoiceTarget(armedTarget);
    setPhaseMessage(`${target.name} ready — raise your palm to reveal`);
    voiceArmTimerRef.current = window.setTimeout(() => {
      if (armedVoiceTargetRef.current?.id !== target.id) return;
      armedVoiceTargetRef.current = null;
      setArmedVoiceTarget(null);
      setPhaseMessage("Listening — say a visual's cue word");
    }, VOICE_ARM_TIMEOUT_MS);
  }, []);


  const initializeRecognizer = async () => {
    if (recognizerRef.current) return recognizerRef.current;
    const client = await createGestureInferenceClient();
    recognizerRef.current = client;
    setInferenceMode(client.mode);
    setRecognizerGeneration((value) => value + 1);
    return client;
  };

  const releaseStudio = () => {
    studioReadyRef.current = false;
    setStudioReady(false);
    stopMediaStream(cameraStreamRef.current);
    stopMediaStream(screenStreamRef.current);
    stopMediaStream(audioStreamRef.current);
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
    screenSettingsRef.current = null;
    audioStreamRef.current = null;
    const video = cameraVideoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    const screenVideo = screenVideoRef.current;
    if (screenVideo) {
      screenVideo.pause();
      screenVideo.srcObject = null;
    }
    connectScreenAudio(audioMixerRef.current, null);
    void closeStudioAudioMixer(audioMixerRef.current);
    audioMixerRef.current = null;
    if (confirmFeedbackTimerRef.current !== null) window.clearTimeout(confirmFeedbackTimerRef.current);
    confirmFeedbackTimerRef.current = null;
    setConfirmFeedback("");
    clearArmedVoiceTarget();
    palmCommandTrackerRef.current.reset();
    shelfPointCarryoverRef.current = false;
    operatorShelfPointTrackerRef.current.reset();
    operatorShelfOpenRef.current = false;
    setOperatorShelfOpen(false);
    setOperatorShelfTargetId(null);
    setOperatorShelfProgress(0);
    spotlightRef.current = null;
    spotlightRectRef.current = null;
    setSpotlight(null);
    liveLayerIdsRef.current = [];
    activeLayerIdRef.current = null;
    layerActivationTimesRef.current = {};
    cameraReflowControllerRef.current.reset();
    cameraReflowFrameRef.current = { x: 0, width: 1, target: null, transitioning: false };
    gestureSequenceCursorRef.current = {};
    setLiveLayerIds([]);
    setActiveLayerId(null);
    setActiveGestureCue(null);
    videosRef.current.forEach((overlay) => overlay.pause());
    gateRef.current.reset();
    stabilizerRef.current.reset();
    manipulationTrackerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    circleMorphTrackerRef.current.reset();
    assetMorphExitRef.current = null;
    morphFocusLockUntilRef.current = 0;
    sceneMemberTargetIdRef.current = null;
    sceneMemberMissSinceRef.current = null;
    setSceneMemberTargetId(null);
    setSelectedSceneMemberId(null);
    setManipulation({ mode: "idle", progress: 0 });
    setMorphGestureProgress(0);
    setMorphExitAssetId(null);
    setDetected({ gesture: null, confidence: 0, source: "none" });
    setHoldProgress(0);
    setArmed(true);
    setGranted(null);
    grantedRef.current = null;
    screenOverlayRef.current = { ...screenOverlayRef.current, visible: false };
    setScreenOverlay(screenOverlayRef.current);
    setScreenSettings(null);
    setScreenPhase("idle");
    setCompositionStats({ fps: 0, averageMs: 0, budgetPercent: 0, overBudgetFrames: 0 });
    setMicrophoneLevel(0);
    setActiveCameraLabel("No active camera");
    setActiveMicrophoneLabel(selectedMicrophoneRef.current === "none" ? "Microphone off" : "No active microphone");
    setMicrophonePhase(selectedMicrophoneRef.current === "none" ? "off" : "idle");
    setErrorMessage(null);
  };

  const finishStudioStop = () => {
    releaseStudio();
    setPhase("idle");
    setPhaseMessage("Camera starts automatically when you enter");
  };

  const stopStudio = () => {
    if (recordingRef.current || isFinalizing) return;
    const waitingForStartup = studioStartingRef.current;
    studioSessionRef.current += 1;
    releaseStudio();
    if (waitingForStartup) {
      setPhase("stopping");
      setPhaseMessage("Stopping camera and gesture recognition");
      return;
    }
    setPhase("idle");
    setPhaseMessage("Camera starts automatically when you enter");
  };

  const startStudio = async () => {
    if (studioStartingRef.current || ["permission", "loading", "switching", "stopping"].includes(phase) || studioReadyRef.current) return;
    const studioSession = ++studioSessionRef.current;
    studioStartingRef.current = true;
    setErrorMessage(null);
    gateRef.current.reset();
    stabilizerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    gestureSequenceCursorRef.current = {};
    setActiveGestureCue(null);
    setPhase("permission");
    setPhaseMessage("Waiting for camera permission");
    const preset = qualityPreset(qualityRef.current);
    const cameraId = selectedCameraRef.current || cameras[0]?.deviceId || "";
    const microphoneId = selectedMicrophoneRef.current || microphones[0]?.deviceId || "none";
    const recognizerPromise = initializeRecognizer();
    const cameraPromise = switchCamera(cameraId, preset, true);
    const microphonePromise = ensureAudioMixer()
      .then(() => switchMicrophone(microphoneId, true))
      .catch((error) => {
        setMicrophonePhase("error");
        setActiveMicrophoneLabel("Microphone unavailable");
        setErrorMessage(error instanceof Error ? `Audio could not start: ${error.message}` : "Audio could not start.");
      });
    try {
      await cameraPromise;
      await microphonePromise;
      if (studioSession !== studioSessionRef.current) {
        studioStartingRef.current = false;
        finishStudioStop();
        return;
      }
      setPhase("loading");
      setPhaseMessage("Loading the local MediaPipe gesture model");
      await recognizerPromise;
      if (studioSession !== studioSessionRef.current) {
        studioStartingRef.current = false;
        finishStudioStop();
        return;
      }
      studioStartingRef.current = false;
      studioReadyRef.current = true;
      setStudioReady(true);
      setPhase("ready");
      setPhaseMessage("Camera and gestures ready — point at a visual or use its gesture");
      diagnosticSequenceStartRef.current = performance.now();
    } catch {
      if (studioSession !== studioSessionRef.current) {
        studioStartingRef.current = false;
        finishStudioStop();
        return;
      }
      studioStartingRef.current = false;
      stopMediaStream(cameraStreamRef.current);
      cameraStreamRef.current = null;
      setStudioReady(false);
      studioReadyRef.current = false;
    }
  };

  useEffect(() => {
    if (diagnostics || welcomeOpen || studioReadyRef.current || studioStartingRef.current || phase !== "idle") return;
    void startStudio();
  }, [welcomeOpen]);

  /* Desktop-only keyword recognition is intentionally excluded from the web
     product. The preserved implementation lives in rii-flow-desktop.
  useEffect(() => {
    let cancelled = false;
    const diagnosticTimers: number[] = [];
    const previous = liveVoiceCaptureRef.current;
    liveVoiceCaptureRef.current = null;
    if (previous) void previous.stop();
    browserSpeechCaptureRef.current?.stop();
    browserSpeechCaptureRef.current = null;
    voskSpeechCaptureRef.current?.stop();
    voskSpeechCaptureRef.current = null;
    voiceInferenceBusyRef.current = false;
    pendingVoiceWindowRef.current = null;

    if (!voiceCuesEnabled || !studioReady || finishTakeId || selectedMicrophoneId === "none" || !voiceTriggerTargets.length) {
      setVoiceTriggerStatus("off");
      setVoiceModelProgress(0);
      setSpeechContextMode("off");
      return () => { cancelled = true; };
    }

    const publishTranscript = (phrase: string) => {
      const transcript = phrase.trim();
      if (!transcript || cancelled) return;
      setLastVoicePhrase(transcript);
      studioEventsRef.current.emit("speech:context", { transcript, at: performance.now() });
    };

    let localStarting = false;
    const startLocal = async () => {
      if (cancelled || localStarting || liveVoiceCaptureRef.current) return;
      localStarting = true;
      const mixer = audioMixerRef.current;
      if (!mixer?.microphoneSource) {
        setVoiceTriggerStatus("off");
        setSpeechContextMode("off");
        return;
      }
      try {
        setSpeechContextMode("local");
        setVoiceTriggerStatus("loading");
        setVoiceModelProgress(0);
        await warmEnglishTranscriber((progress) => {
          if (!cancelled) setVoiceModelProgress(Math.round(progress.percent));
        });
        if (cancelled) return;
        setVoiceModelProgress(100);
        setVoiceTriggerStatus("listening");
        const transcribeWindow = (audio: CaptionAudio) => {
          if (cancelled) return;
          if (voiceInferenceBusyRef.current) {
            // Never discard what the presenter said while the worker is busy.
            // One latest window is enough because windows overlap by design.
            pendingVoiceWindowRef.current = audio;
            return;
          }
          voiceInferenceBusyRef.current = true;
          setVoiceTriggerStatus("hearing");
          void transcribeTriggerEnglish(audio)
            .then(publishTranscript)
            .catch((error) => {
              if (cancelled) return;
              console.warn("Local speech window failed", error);
              setVoiceTriggerStatus("error");
            })
            .finally(() => {
              voiceInferenceBusyRef.current = false;
              if (cancelled) return;
              setVoiceTriggerStatus("listening");
              const pending = pendingVoiceWindowRef.current;
              pendingVoiceWindowRef.current = null;
              if (pending) transcribeWindow(pending);
            });
        };
        liveVoiceCaptureRef.current = await startLiveVoiceCapture(mixer, transcribeWindow);
        if (!liveVoiceCaptureRef.current && !cancelled) setVoiceTriggerStatus("off");
      } catch (error) {
        if (cancelled) return;
        console.warn("Local speech model could not start", error);
        setVoiceTriggerStatus("error");
        setPhaseMessage("Speech recognition is unavailable. Check the microphone and restart Studio.");
      } finally {
        localStarting = false;
      }
    };

    let voskStarting = false;
    const startStreamingLocal = async () => {
      if (cancelled || voskStarting || voskSpeechCaptureRef.current) return;
      voskStarting = true;
      try {
        setSpeechContextMode("streaming-local");
        setVoiceTriggerStatus("loading");
        setVoiceModelProgress(0);
        const capture = await startVoskSpeechContext(audioMixerRef.current, voiceRecognitionHints, (transcript) => {
          if (cancelled) return;
          setVoiceTriggerStatus("hearing");
          publishTranscript(transcript);
          window.setTimeout(() => { if (!cancelled) setVoiceTriggerStatus("listening"); }, 140);
        });
        if (cancelled) {
          capture?.stop();
          return;
        }
        if (!capture) throw new Error("The selected microphone is not connected to the local recognizer.");
        voskSpeechCaptureRef.current = capture;
        setVoiceModelProgress(100);
        setVoiceTriggerStatus("listening");
      } catch (error) {
        if (cancelled) return;
        console.warn("Offline streaming speech could not start; using Whisper fallback.", error);
        await startLocal();
      } finally {
        voskStarting = false;
      }
    };

    const start = async () => {
      if (diagnostics && (diagnosticScenario === "intent-pinch" || diagnosticScenario === "intent-sequence" || diagnosticScenario === "voice-command" || diagnosticScenario === "voice-palm-hold")) {
        setSpeechContextMode("local");
        setVoiceModelProgress(100);
        setVoiceTriggerStatus("listening");
        const target = voiceTriggerTargets[0];
        diagnosticTimers.push(window.setTimeout(() => {
          if (!cancelled && target) publishTranscript(`here is the ${target.triggerWord}`);
        }, 620));
        if (diagnosticScenario === "intent-sequence") {
          const nextTarget = voiceTriggerTargets[1];
          diagnosticTimers.push(window.setTimeout(() => {
            if (!cancelled && nextTarget) publishTranscript(`now the ${nextTarget.triggerWord}`);
          }, 2_600));
        }
        return;
      }
      if (diagnostics && diagnosticScenario === "shelf-confirm") {
        setSpeechContextMode("local");
        setVoiceModelProgress(100);
        setVoiceTriggerStatus("listening");
        return;
      }
      // Rii's production cue path is intentionally deterministic: the selected
      // microphone feeds the local constrained grammar directly. Browser
      // SpeechRecognition varied by browser, account and network, and could
      // report "listening" without ever consuming the selected track.
      await startStreamingLocal();
    };
    void start();
    return () => {
      cancelled = true;
      diagnosticTimers.forEach((timer) => window.clearTimeout(timer));
      const active = liveVoiceCaptureRef.current;
      liveVoiceCaptureRef.current = null;
      if (active) void active.stop();
      browserSpeechCaptureRef.current?.stop();
      browserSpeechCaptureRef.current = null;
      voskSpeechCaptureRef.current?.stop();
      voskSpeechCaptureRef.current = null;
      voiceInferenceBusyRef.current = false;
      pendingVoiceWindowRef.current = null;
    };
  }, [diagnosticScenario, diagnostics, finishTakeId, selectedMicrophoneId, studioReady, voiceCuesEnabled, voiceRecognitionHintSignature, voiceTriggerSignature]);
  */

  useEffect(() => {
    if (!studioReady) return;
    const video = cameraVideoRef.current;
    const canvas = outputCanvasRef.current;
    if (!video || !canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    let stopped = false;
    let composedFrames = 0;
    let totalComposeMs = 0;
    let overBudgetFrames = 0;
    let lastComposedAt = Number.NEGATIVE_INFINITY;
    let statsStarted = performance.now();
    let cachedLayerIds: string[] | null = null;
    let cachedAssets: StudioAsset[] | null = null;
    let cachedScenes: StudioScene[] | null = null;
    let cachedSceneSolo: Record<string, string> | null = null;
    let cachedCompletedVideoVersion = -1;
    let cachedBudgetHiddenVersion = -1;
    let cachedHiddenAssetIds = new Set<string>();
    let cachedStack: StudioLayer[] = [];
    let cachedPlayingVideos: Array<{ asset: StudioAsset; overlay: HTMLVideoElement }> = [];
    const targetFps = normalizedCompositionFps(activeFrameRate);
    const frameBudget = compositionFrameBudget(targetFps);
    const Processor = videoFrameProcessor();
    const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0] ?? null;
    let cameraReader: ReadableStreamDefaultReader<VideoFrame> | null = null;
    let cameraReaderTrack: MediaStreamTrack | null = null;
    let screenReader: ReadableStreamDefaultReader<VideoFrame> | null = null;
    let screenReaderTrack: MediaStreamTrack | null = null;
    let latestScreenFrame: VideoFrame | null = null;
    let displayFallbackStarted = false;

    const refreshLayerCache = () => {
      if (cachedLayerIds === liveLayerIdsRef.current && cachedAssets === assetsRef.current && cachedScenes === scenesRef.current && cachedSceneSolo === sceneSoloRef.current && cachedCompletedVideoVersion === completedVideoVersionRef.current && cachedBudgetHiddenVersion === budgetHiddenVersionRef.current) return;
      cachedLayerIds = liveLayerIdsRef.current;
      cachedAssets = assetsRef.current;
      cachedScenes = scenesRef.current;
      cachedSceneSolo = sceneSoloRef.current;
      cachedCompletedVideoVersion = completedVideoVersionRef.current;
      cachedBudgetHiddenVersion = budgetHiddenVersionRef.current;
      cachedHiddenAssetIds = mergedAssetIds(completedVideoIdsRef.current, budgetHiddenAssetIdsRef.current);
      cachedStack = liveLayerIdsRef.current
        .map((id) => resolveLayer(id, assetsRef.current, scenesRef.current))
        .filter((layer): layer is StudioLayer => Boolean(layer));
      const assetById = new Map(assetsRef.current.map((asset) => [asset.id, asset]));
      const compositionStack = visibleLayersForComposition(cachedStack);
      const playingVideoIds = new Set(compositionStack.flatMap((layer) => {
        if (layer.kind === "asset") return layer.asset.kind === "video" && !cachedHiddenAssetIds.has(layer.asset.id) ? [layer.asset.id] : [];
        const soloId = sceneSoloRef.current[layer.scene.id];
        return layer.assets.filter((asset) => asset.kind === "video" && !cachedHiddenAssetIds.has(asset.id) && (!soloId || asset.id === soloId)).map((asset) => asset.id);
      }));
      const allLiveVideoIds = new Set([
        ...cachedStack.flatMap((layer) => layerAssetIds(layer).filter((id) => assetById.get(id)?.kind === "video")),
        ...currentVideoStyleAssets().filter((asset) => asset.kind === "video" && asset.id !== SCREEN_OVERLAY_ID).map((asset) => asset.id)
      ]);
      allLiveVideoIds.forEach((id) => {
        const overlay = videosRef.current.get(id);
        const asset = assetById.get(id);
        if (!overlay || !asset) return;
        const visible = playingVideoIds.has(id);
        if (!visible) overlay.pause();
        else if (overlay.paused) void overlay.play().catch(() => undefined);
        setVideoAudioEnabled(audioMixerRef.current, id, Boolean(visible && asset.includeAudio));
      });
      cachedPlayingVideos = [...playingVideoIds].flatMap((id) => {
        const asset = assetById.get(id);
        const overlay = videosRef.current.get(id);
        return asset && overlay ? [{ asset, overlay }] : [];
      });
    };

    const completeVideoAsset = (asset: StudioAsset, overlay: HTMLVideoElement) => {
      if (completedVideoIdsRef.current.has(asset.id)) return;
      completedVideoIdsRef.current = new Set(completedVideoIdsRef.current).add(asset.id);
      completedVideoVersionRef.current += 1;
      overlay.pause();
      setVideoAudioEnabled(audioMixerRef.current, asset.id, false);

      const ownerScene = scenesRef.current.find((scene) => scene.memberIds.includes(asset.id));
      if (ownerScene) {
        if (sceneSoloRef.current[ownerScene.id] === asset.id) {
          const nextSolo = { ...sceneSoloRef.current };
          delete nextSolo[ownerScene.id];
          sceneSoloRef.current = nextSolo;
          setSceneSolo(nextSolo);
        }
        if (sceneMemberTargetIdRef.current === asset.id) {
          sceneMemberTargetIdRef.current = null;
          sceneMemberMissSinceRef.current = null;
          setSceneMemberTargetId(null);
          setSelectedSceneMemberId(null);
        }
        return;
      }

      const nextStack = removeLayer(liveLayerIdsRef.current, asset.id);
      liveLayerIdsRef.current = nextStack;
      cachedStack = cachedStack.filter((layer) => layer.id !== asset.id);
      const nextActivationTimes = { ...layerActivationTimesRef.current };
      delete nextActivationTimes[asset.id];
      layerActivationTimesRef.current = nextActivationTimes;
      const nextFocus = activeLayerIdRef.current === asset.id ? nextStack.at(-1) ?? null : activeLayerIdRef.current;
      activeLayerIdRef.current = nextFocus;
      setLiveLayerIds(nextStack);
      setActiveLayerId(nextFocus);
    };

    const draw = (now: number, cameraSource: HTMLVideoElement | VideoFrame, screenSource: HTMLVideoElement | VideoFrame | null, sourceDriven = false) => {
      if (stopped) return;
      if (sourceDriven || shouldComposeFrame(now, lastComposedAt, targetFps)) {
        lastComposedAt = now;
        refreshLayerCache();
        cachedPlayingVideos.forEach(({ asset, overlay }) => {
          if (!Number.isFinite(overlay.duration) || overlay.duration <= 0) return;
          const trim = normalizeVideoTrim(asset.videoTrim, overlay.duration);
          const boundaryAction = videoBoundaryAction("once", overlay.currentTime, trim, overlay.ended);
          if (boundaryAction === "complete") {
            completeVideoAsset(asset, overlay);
          } else if (boundaryAction === "restart") {
            overlay.currentTime = trim.start;
            void overlay.play().catch(() => undefined);
          }
        });
        const composeStarted = performance.now();
        const cameraReflow = cameraReflowControllerRef.current.update(cameraReflowTarget(cachedStack), now);
        cameraReflowFrameRef.current = cameraReflow;
        const focusedLayer = activeLayerIdRef.current && activeLayerIdRef.current !== SCREEN_OVERLAY_ID
          ? resolveLayer(activeLayerIdRef.current, assetsRef.current, scenesRef.current)
          : null;
        let compositionStyleWindow = currentVideoStyleWindow();
        const smoothDeckFrame = deckScrollControllerRef.current.frame(now, Math.max(0, compositionStyleWindow.total - MAX_STYLE_ASSETS));
        if (Math.abs(smoothDeckFrame.offset - assetDeckOffsetRef.current) > 0.0005) {
          assetDeckOffsetRef.current = smoothDeckFrame.offset;
          compositionStyleWindow = currentVideoStyleWindow();
        }
        const compositionStyleAssets = compositionStyleWindow.assets;
        const activeMediaWidget = widgetsRef.current.find((widget) => widget.kind === "media" && widget.visible && widget.active && widget.actionAssetId === activeLayerIdRef.current);
        const videoStyleComposition = focusedLayer?.kind === "scene" ? undefined : {
          id: videoStyleRef.current,
          assets: compositionStyleAssets,
          focusedAssetId: activeLayerIdRef.current && compositionStyleAssets.some((asset) => asset.id === activeLayerIdRef.current)
            ? activeLayerIdRef.current
            : null,
          deckVisible: assetDeckVisibleRef.current,
          deckScrollOffset: compositionStyleWindow.offset,
          deckWindowStart: compositionStyleWindow.windowStart,
          deckTotal: compositionStyleWindow.total,
          deckPlacement: deckPlacementRef.current,
          panelBackground: panelBackgroundRef.current,
          screenAssetId: screenSettingsRef.current ? SCREEN_OVERLAY_ID : undefined,
          pipAssetId: activeMediaWidget?.actionAssetId
        };
        const drawDeskObjects = () => {
          drawCanvasWidgets(context, canvas.width, canvas.height, widgetsRef.current, now, assetsRef.current, imagesRef.current, videosRef.current, scenesRef.current);
          if (screenSettingsRef.current) drawLiveSticker(context, canvas.width, canvas.height, activeLayerIdRef.current === SCREEN_OVERLAY_ID);
        };
        const deskBehindActiveVisual = Boolean(activeLayerIdRef.current);
        composeFrame(
          context,
          canvas,
          cameraSource,
          cachedStack,
          { images: imagesRef.current, videos: videosRef.current },
          layerActivationTimesRef.current,
          now,
          cameraReflow,
          mirrorCameraRef.current,
          cameraFrameRef.current,
          sceneSoloRef.current,
          screenSettingsRef.current?.recursionGuard ? null : screenSource,
          screenOverlayRef.current,
          cachedHiddenAssetIds,
          videoStyleComposition,
          deskBehindActiveVisual ? drawDeskObjects : undefined
        );
        const spotlightState = spotlightRef.current;
        const spotlightRect = spotlightRectRef.current;
        if (spotlightState && spotlightRect) drawStageSpotlight(context, canvas, spotlightRect, spotlightState.progress);
        if (!deskBehindActiveVisual) drawDeskObjects();
        const morphExit = assetMorphExitRef.current;
        if (morphExit && drawAssetMorphExit(context, morphExit, now)) {
          assetMorphExitRef.current = null;
          setMorphExitAssetId(null);
        }
        const composeMs = performance.now() - composeStarted;
        composedFrames += 1;
        totalComposeMs += composeMs;
        if (composeMs > frameBudget) overBudgetFrames += 1;
      }
      if (now - statsStarted >= 1000) {
        const elapsed = now - statsStarted;
        const nextHealth = compositionHealth(composedFrames, totalComposeMs, elapsed, targetFps, overBudgetFrames);
        if (!document.hidden && !recordingRef.current) {
          setCompositionStats((current) => current.fps === nextHealth.fps
            && current.averageMs === nextHealth.averageMs
            && current.budgetPercent === nextHealth.budgetPercent
            && current.overBudgetFrames === nextHealth.overBudgetFrames
            ? current
            : nextHealth);
        }
        composedFrames = 0;
        totalComposeMs = 0;
        overBudgetFrames = 0;
        statsStarted = now;
      }
    };

    const startDisplayFallback = () => {
      if (stopped || displayFallbackStarted) return;
      displayFallbackStarted = true;
      setCompositionDriver("display");
      const animate = (now: number) => {
        if (stopped) return;
        draw(now, video, screenVideoRef.current);
        outputAnimationRef.current = requestAnimationFrame(animate);
      };
      outputAnimationRef.current = requestAnimationFrame(animate);
    };

    if (Processor && cameraTrack) {
      setCompositionDriver("media-track");
      const sharedTrack = screenStreamRef.current?.getVideoTracks()[0] ?? null;
      if (sharedTrack) {
        screenReaderTrack = sharedTrack.clone();
        screenReader = new Processor({ track: screenReaderTrack, maxBufferSize: 1 }).readable.getReader();
        void (async () => {
          try {
            while (!stopped && screenReader) {
              const result = await screenReader.read();
              if (result.done) break;
              if (stopped) result.value.close();
              else latestScreenFrame = replaceLatestFrame(latestScreenFrame, result.value);
            }
          } catch (error) {
            if (!stopped) {
              latestScreenFrame?.close();
              latestScreenFrame = null;
              console.warn("Shared-screen frame processing stopped", error);
            }
          }
        })();
      }

      cameraReaderTrack = cameraTrack.clone();
      cameraReader = new Processor({ track: cameraReaderTrack, maxBufferSize: 1 }).readable.getReader();
      void (async () => {
        try {
          while (!stopped && cameraReader) {
            const result = await cameraReader.read();
            if (result.done) break;
            try {
              draw(performance.now(), result.value, latestScreenFrame ?? screenVideoRef.current, true);
            } finally {
              result.value.close();
            }
          }
          if (!stopped) startDisplayFallback();
        } catch (error) {
          if (!stopped) {
            console.error("Camera frame processing stopped", error);
            startDisplayFallback();
          }
        }
      })();
    } else {
      startDisplayFallback();
    }

    return () => {
      stopped = true;
      if (outputAnimationRef.current !== null) cancelAnimationFrame(outputAnimationRef.current);
      outputAnimationRef.current = null;
      void cameraReader?.cancel().catch(() => undefined);
      void screenReader?.cancel().catch(() => undefined);
      cameraReaderTrack?.stop();
      screenReaderTrack?.stop();
      latestScreenFrame?.close();
    };
  }, [activeFrameRate, granted, screenSettings, studioReady]);

  const chooseRecordingsFolder = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      setFolderPermission("unsupported");
      setErrorMessage("Direct folder recording is unavailable in this browser. Current-session MP4 downloads still work.");
      return;
    }
    try {
      const directory = await picker({ mode: "readwrite" });
      const permission = await directoryPermission(directory, true);
      if (permission !== "granted") throw new Error("Folder access was not granted.");
      await saveRecordingsDirectory(directory);
      recordingsDirectoryRef.current = directory;
      folderPermissionRef.current = permission;
      setRecordingsDirectory(directory);
      setFolderPermission(permission);
      await refreshStoredTakes(directory, permission);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
        setFolderPermission("unsupported");
        setErrorMessage("The browser blocked the system folder picker. Open Rii-Flow directly in Chrome or Edge to choose a recording location; Takes downloads still work here.");
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "The recordings folder could not be opened.");
    }
  };

  const reconnectRecordingsFolder = async () => {
    const directory = recordingsDirectoryRef.current;
    if (!directory) {
      await chooseRecordingsFolder();
      return;
    }
    const permission = await directoryPermission(directory, true);
    folderPermissionRef.current = permission;
    setFolderPermission(permission);
    if (permission === "granted") await refreshStoredTakes(directory, permission);
  };

  const changeRecordingsFolder = async () => {
    if ((window as DirectoryPickerWindow).showDirectoryPicker) {
      await chooseRecordingsFolder();
      return;
    }
    if (recordingsDirectoryRef.current) {
      await reconnectRecordingsFolder();
      return;
    }
    setFolderPermission("unsupported");
    setErrorMessage("This browser cannot choose a recording folder. Open Rii-Flow in Chrome or Edge to select one; recordings can still be downloaded from Takes here.");
  };

  const resolveTakeUrl = async (take: RecordedClip) => {
    if (take.url) return take.url;
    if (!take.folderBacked || !recordingsDirectoryRef.current) return null;
    let permission = folderPermissionRef.current;
    if (permission !== "granted") {
      permission = await directoryPermission(recordingsDirectoryRef.current, true);
      folderPermissionRef.current = permission;
      setFolderPermission(permission);
    }
    if (permission !== "granted") return null;
    try {
      const handle = await recordingsDirectoryRef.current.getFileHandle(take.fileName);
      const url = URL.createObjectURL(await handle.getFile());
      recordingUrlsRef.current.push(url);
      setRecordings((current) => current.map((item) => item.id === take.id ? { ...item, url, availability: "ready" } : item));
      return url;
    } catch {
      setRecordings((current) => current.map((item) => item.id === take.id ? { ...item, availability: "missing" } : item));
      return null;
    }
  };

  const openTakePreview = async (take: RecordedClip) => {
    const url = await resolveTakeUrl(take);
    if (!url) {
      setErrorMessage(take.folderBacked ? "Reconnect the recordings folder to preview this take." : "This session-only take is no longer available.");
      return;
    }
    setPreviewTakeId(take.id);
  };

  const openFinishTake = async (take: RecordedClip) => {
    const url = await resolveTakeUrl(take);
    if (!url) {
      setErrorMessage("Reconnect this take before finishing or downloading it.");
      return;
    }
    setFinishTakeId(take.id);
    setFinishTakeMediaDuration(take.durationSeconds);
    setTakeTrim({ start: 0, end: take.durationSeconds });
    setCaptionEnabled(false);
    setCaptionStatus("idle");
    setCaptionProgress(null);
    setCaptionRenderProgress(0);
    setCaptionResultTakeId(null);
    setCaptionSegments([]);
    setWordAnimationCues([]);
    setCaptionStyle({ ...DEFAULT_CAPTION_STYLE });
    setCaptionDrag({ dragging: false, snapX: false, snapY: false });
    setCaptionPreviewTime(0);
    setCaptionPreviewPlaying(false);
    captionDragPointerRef.current = null;
    if (diagnostics && diagnosticScenario === "caption-layout") {
      setCaptionEnabled(true);
      const sampleSegments = [{ id: "caption-layout-sample", text: "Place this caption exactly where you want it", start: 0, end: 5 }];
      setCaptionSegments(sampleSegments);
      setWordAnimationCues(buildWordAnimationCues(sampleSegments, [], 5));
      setCaptionStatus("ready");
      return;
    }
    if (!diagnostics) {
      const saved = await loadCaptionDocument(take.id).catch(() => undefined);
      if (saved) {
        setCaptionSegments(saved.segments);
        setCaptionStyle(normalizeCaptionStyle(saved.style));
        setWordAnimationCues(saved.wordCues ?? []);
        setCaptionStatus("ready");
      }
    }
  };

  useEffect(() => {
    if (!diagnostics || diagnosticScenario !== "caption-layout" || finishTakeId || isRecording || isFinalizing) return;
    const latest = recordings.find((take) => Boolean(take.url));
    if (!latest || diagnosticCaptionOpenedRef.current === latest.id) return;
    diagnosticCaptionOpenedRef.current = latest.id;
    void openFinishTake(latest);
  }, [diagnosticScenario, diagnostics, finishTakeId, isFinalizing, isRecording, recordings]);

  const generateEnglishCaptions = async () => {
    if (!finishTake) return;
    try {
      setCaptionStatus("loading");
      setCaptionProgress({ phase: "loading", percent: 0 });
      let audio = captionAudioCacheRef.current.get(finishTake.id) ?? null;
      if (!audio && !diagnostics) audio = await loadCaptionAudio(finishTake.id);
      if (!audio?.samples.length) throw new Error("This take has no mic-only caption source. Record a new take with the microphone enabled.");
      captionAudioCacheRef.current.set(finishTake.id, audio);
      const segments = diagnostics
        ? [
            { id: "diagnostic-caption-1", text: "Today we launch something incredible", start: 0, end: 2.4 },
            { id: "diagnostic-caption-2", text: "Here are three reasons it feels faster", start: 2.5, end: 5.4 }
          ]
        : await transcribeEnglish(audio, (progress) => {
            setCaptionProgress(progress);
            setCaptionStatus(progress.phase === "loading" ? "loading" : "transcribing");
          });
      if (!segments.length) throw new Error("No clear English speech was found in the selected microphone feed.");
      const wordCues = buildWordAnimationCues(segments, [], finishTake.durationSeconds);
      setCaptionSegments(segments);
      setWordAnimationCues(wordCues);
      setCaptionStatus("ready");
      setCaptionProgress(null);
      if (!diagnostics) await saveCaptionDocument({ takeId: finishTake.id, segments, style: captionStyle, wordCues, updatedAt: Date.now() });
    } catch (error) {
      setCaptionStatus("error");
      setCaptionProgress(null);
      setErrorMessage(error instanceof Error ? error.message : "English captions could not be created.");
    }
  };

  const markCaptionDraftChanged = () => {
    setCaptionStatus((current) => current === "done" ? "ready" : current);
    setCaptionResultTakeId(null);
  };

  const updateTakeTrimRange = (start: number, end: number, handle: "start" | "end") => {
    const next = normalizeVideoTrim({ start, end }, finishDuration);
    setTakeTrim(next);
    markCaptionDraftChanged();
    const video = captionPreviewVideoRef.current;
    if (video) {
      video.pause();
      const edgeTime = handle === "start" ? next.start : next.end;
      video.currentTime = Math.min(edgeTime, Math.max(0, finishDuration - 0.001));
      setCaptionPreviewTime(edgeTime);
    }
  };

  const seekFinishTimeline = (time: number) => {
    const video = captionPreviewVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = Math.min(time, Math.max(0, finishDuration - 0.001));
    }
    setCaptionPreviewTime(time);
  };

  const resetTakeTrim = () => {
    setTakeTrim({ start: 0, end: finishDuration });
    markCaptionDraftChanged();
  };

  const previewTakeTrim = async () => {
    const video = captionPreviewVideoRef.current;
    if (!video) return;
    video.currentTime = normalizedTakeTrim.start;
    setCaptionPreviewTime(normalizedTakeTrim.start);
    await video.play().catch(() => undefined);
  };

  const syncFinishPreviewTime = (video: HTMLVideoElement) => {
    if (!captionPreviewRendered && takeIsTrimmed && video.currentTime >= normalizedTakeTrim.end) {
      video.pause();
      video.currentTime = normalizedTakeTrim.end;
    }
    setCaptionPreviewTime(video.currentTime);
  };

  const syncFinishPreviewMetadata = (video: HTMLVideoElement) => {
    if (!captionPreviewRendered && Number.isFinite(video.duration) && video.duration > 0) {
      const priorDuration = finishDuration;
      setFinishTakeMediaDuration(video.duration);
      if (!takeIsTrimmed || Math.abs(normalizedTakeTrim.end - priorDuration) < 0.1) setTakeTrim({ start: normalizedTakeTrim.start, end: video.duration });
    }
    setCaptionPreviewTime(video.currentTime);
  };

  const updateCaptionStyle = (updates: Partial<CaptionStyle>) => {
    setCaptionStyle((current) => normalizeCaptionStyle({ ...current, ...updates }));
    markCaptionDraftChanged();
  };

  const updateCaptionSegment = (id: string, text: string) => {
    setCaptionSegments((current) => current.map((segment) => segment.id === id ? { ...segment, text } : segment));
    markCaptionDraftChanged();
  };

  const updateCaptionTiming = (id: string, field: "start" | "end", value: number) => {
    if (!Number.isFinite(value)) return;
    setCaptionSegments((current) => current.map((segment) => segment.id === id
      ? retimeCaptionSegment(segment, field === "start" ? value : segment.start, field === "end" ? value : segment.end, finishDuration)
      : segment).sort((a, b) => a.start - b.start));
    markCaptionDraftChanged();
  };

  const updateWordAnimationTiming = (id: string, field: "start" | "end", value: number) => {
    if (!Number.isFinite(value)) return;
    setWordAnimationCues((current) => current.map((cue) => cue.id === id
      ? retimeWordAnimationCue(cue, field === "start" ? value : cue.start, field === "end" ? value : cue.end, finishDuration)
      : cue).sort((a, b) => a.start - b.start));
    markCaptionDraftChanged();
  };

  const removeWordAnimation = (id: string) => {
    setWordAnimationCues((current) => current.filter((cue) => cue.id !== id));
    markCaptionDraftChanged();
  };

  const restoreWordAnimations = () => {
    if (!finishTake || !captionSegments.length) return;
    setWordAnimationCues(buildWordAnimationCues(captionSegments, [], finishTake.durationSeconds));
    markCaptionDraftChanged();
  };

  const seekWordAnimation = (cue: WordAnimationCue) => {
    const video = captionPreviewVideoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, cue.start + 0.04);
    setCaptionPreviewTime(video.currentTime);
    setCaptionPreviewPlaying(false);
  };

  const setCaptionPositionPreset = (position: CaptionStyle["position"]) => {
    updateCaptionStyle(position === "custom" ? { position } : { position, ...captionPresetAnchor(position) });
  };

  const setCaptionCoordinate = (axis: "anchorX" | "anchorY", percent: number) => {
    updateCaptionStyle({ position: "custom", [axis]: percent / 100 });
  };

  const previewCaptionSegment = (segment: CaptionSegment) => {
    const video = captionPreviewVideoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, segment.start + 0.01);
    setCaptionPreviewTime(video.currentTime);
    setCaptionPreviewPlaying(false);
  };

  const beginCaptionDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (captionBusy) return;
    const bounds = captionPreviewRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    const style = normalizeCaptionStyle(captionStyle);
    captionDragPointerRef.current = {
      pointerId: event.pointerId,
      offsetX: (event.clientX - bounds.left) / bounds.width - style.anchorX,
      offsetY: (event.clientY - bounds.top) / bounds.height - style.anchorY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setCaptionDrag({ dragging: true, snapX: style.anchorX === 0.5, snapY: style.anchorY === 0.5 });
    event.preventDefault();
  };

  const moveCaptionDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = captionDragPointerRef.current;
    const bounds = captionPreviewRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !bounds?.width || !bounds.height) return;
    const anchor = captionAnchorFromPoint(
      (event.clientX - bounds.left) / bounds.width - drag.offsetX,
      (event.clientY - bounds.top) / bounds.height - drag.offsetY
    );
    updateCaptionStyle({ position: "custom", anchorX: anchor.anchorX, anchorY: anchor.anchorY });
    setCaptionDrag({ dragging: true, snapX: anchor.snapX, snapY: anchor.snapY });
    event.preventDefault();
  };

  const endCaptionDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (captionDragPointerRef.current?.pointerId !== event.pointerId) return;
    captionDragPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setCaptionDrag({ dragging: false, snapX: false, snapY: false });
  };

  const renderEditedVersion = async () => {
    if (!finishTake?.url || !hasFinalEdits || captionBusy || recordingRef.current) return;
    try {
      setCaptionStatus("rendering");
      setCaptionRenderProgress(0);
      if (!diagnostics && (captionsReady || wordAnimationsReady)) await saveCaptionDocument({ takeId: finishTake.id, segments: captionSegments, style: captionStyle, wordCues: wordAnimationCues, updatedAt: Date.now() });
      const blob = await renderCaptionedTake({
        sourceUrl: finishTake.url,
        width: finishTake.width,
        height: finishTake.height,
        frameRate: finishTake.frameRate,
        bitrate: finishTake.bitrate,
        segments: captionsReady ? captionSegments : [],
        style: captionsReady ? captionStyle : undefined,
        wordCues: wordAnimationsReady ? wordAnimationCues : [],
        startTime: normalizedTakeTrim.start,
        endTime: normalizedTakeTrim.end,
        onProgress: setCaptionRenderProgress
      });
      let fileName = editedFileName(finishTake.fileName, { captions: captionsReady, trimmed: takeIsTrimmed, wordCues: wordAnimationsReady });
      let folderBacked = false;
      const directory = recordingsDirectoryRef.current;
      if (directory && await directoryPermission(directory, true) === "granted") {
        fileName = await uniqueRecordingFileName(directory, fileName);
        const handle = await directory.getFileHandle(fileName, { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        folderBacked = true;
      }
      const url = URL.createObjectURL(blob);
      recordingUrlsRef.current.push(url);
      const finishedAt = Date.now();
      const captioned: RecordedClip = {
        ...finishTake,
        id: `${finishedAt}-${blob.size}-edited`,
        fileName,
        url,
        bytes: blob.size,
        ...editedRenderProfile(finishTake.width, finishTake.height, finishTake.frameRate, finishTake.bitrate),
        durationSeconds: Math.max(1, normalizedTakeTrim.end - normalizedTakeTrim.start),
        createdAt: finishedAt,
        folderBacked,
        captionAudioAvailable: false,
        availability: folderBacked ? "ready" : "session"
      };
      setRecordings((current) => [captioned, ...current]);
      if (folderBacked) await saveTake(captioned);
      setCaptionResultTakeId(captioned.id);
      setCaptionStatus("done");
      setCaptionRenderProgress(1);
    } catch (error) {
      setCaptionStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "The edited MP4 could not be rendered.");
    }
  };

  const rateTake = async (take: RecordedClip, rating: "favorite") => {
    const next = { ...take, rating: take.rating === rating ? "neutral" as const : rating };
    setRecordings((current) => current.map((item) => item.id === take.id ? next : item));
    if (next.folderBacked) await saveTake(next);
  };

  const commitTakeRename = async (take: RecordedClip) => {
    const requestedName = editingTakeName.trim().replace(/\.mp4$/i, "");
    if (!requestedName) return;
    const desired = takeFileName(requestedName);
    if (desired === take.fileName) {
      setEditingTakeId(null);
      return;
    }
    try {
      let fileName = desired;
      let url = take.url;
      if (take.folderBacked) {
        const directory = recordingsDirectoryRef.current;
        if (!directory || await directoryPermission(directory, true) !== "granted") throw new Error("Reconnect the recordings folder before renaming this recording.");
        fileName = await uniqueRecordingFileName(directory, desired);
        const source = await (await directory.getFileHandle(take.fileName)).getFile();
        const target = await directory.getFileHandle(fileName, { create: true });
        const writable = await target.createWritable();
        await writable.write(source);
        await writable.close();
        await directory.removeEntry(take.fileName);
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(await target.getFile());
        recordingUrlsRef.current.push(url);
      }
      const next: RecordedClip = { ...take, fileName, url };
      if (next.folderBacked) await saveTake(next);
      setRecordings((current) => current.map((item) => item.id === take.id ? next : item));
      setEditingTakeId(null);
      setEditingTakeName("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The recording could not be renamed.");
    }
  };

  const removeTake = async (take: RecordedClip, deleteDestinationFile: boolean) => {
    setDeletingTakeId(take.id);
    try {
      if (take.folderBacked && deleteDestinationFile) {
        const directory = recordingsDirectoryRef.current;
        if (!directory || await directoryPermission(directory, true) !== "granted") {
          throw new Error("Reconnect the recordings folder before deleting the MP4 from disk.");
        }
        try {
          await directory.removeEntry(take.fileName);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
        }
      }
      if (take.url) URL.revokeObjectURL(take.url);
      await deleteTake(take.id);
      takeLibraryRef.current = takeLibraryRef.current.filter((item) => item.id !== take.id);
      setRecordings((current) => current.filter((item) => item.id !== take.id));
      if (previewTakeId === take.id) setPreviewTakeId(null);
      setPendingDeleteTakeId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The take could not be deleted.");
    } finally {
      setDeletingTakeId(null);
    }
  };

  function enforceBudgetForStack(requestedLayerIds: readonly string[]) {
    const layers = requestedLayerIds
      .map((id) => resolveLayer(id, assetsRef.current, scenesRef.current))
      .filter((layer): layer is StudioLayer => Boolean(layer));
    const budget = enforceLiveBudget(layers, {
      screenActive: Boolean(screenSettingsRef.current),
      focusedSceneMembers: sceneSoloRef.current,
      alreadyHidden: completedVideoIdsRef.current
    });
    budgetHiddenAssetIdsRef.current = budget.hiddenAssetIds;
    budgetHiddenVersionRef.current += 1;

    const visibleAssetIds = new Set(budget.layerIds.flatMap((id) => {
      const layer = resolveLayer(id, assetsRef.current, scenesRef.current);
      return layer ? layerAssetIds(layer).filter((assetId) => !budget.hiddenAssetIds.has(assetId)) : [];
    }));
    layers.forEach((layer) => layerAssetIds(layer).forEach((assetId) => {
      if (visibleAssetIds.has(assetId)) return;
      videosRef.current.get(assetId)?.pause();
      setVideoAudioEnabled(audioMixerRef.current, assetId, false);
    }));

    const hiddenVideos = [...budget.hiddenAssetIds].filter((id) => assetsRef.current.find((asset) => asset.id === id)?.kind === "video").length;
    if (budget.evictedLayerIds.length || hiddenVideos) {
      const parts = [
        budget.evictedLayerIds.length ? `${budget.evictedLayerIds.length} older layer${budget.evictedLayerIds.length === 1 ? "" : "s"} paused` : "",
        hiddenVideos ? `${hiddenVideos} extra video${hiddenVideos === 1 ? "" : "s"} paused` : ""
      ].filter(Boolean);
      setLiveBudgetNotice(`Performance guard · ${parts.join(" · ")}`);
    } else setLiveBudgetNotice(null);
    return budget.layerIds;
  }

  const closeVisualTimelineEvent = useCallback((at = Date.now()) => {
    if (!recordingRef.current || !recordingStartedAtRef.current) return;
    const elapsed = Math.max(0, at - recordingStartedAtRef.current);
    setTimelineEvents((current) => {
      const next = closeOpenDirectorEvents(current, elapsed);
      timelineEventsRef.current = next;
      return next;
    });
  }, []);

  const appendVisualTimelineEvent = useCallback((layer: StudioLayer, at = Date.now()) => {
    if (!recordingRef.current || !recordingStartedAtRef.current) return;
    const elapsed = Math.max(0, at - recordingStartedAtRef.current);
    setTimelineEvents((current) => {
      const next = appendDirectorEvent(current, {
        assetId: layer.id,
        label: layerName(layer),
        startMs: elapsed,
        endMs: null,
        kind: layer.kind === "scene" ? "scene" : "visual",
        source: "gesture",
        action: "show"
      });
      timelineEventsRef.current = next;
      return next;
    });
  }, []);

  const hideLayer = useCallback(() => {
    if (activeLayerIdRef.current === SCREEN_OVERLAY_ID && screenSettingsRef.current) {
      screenOverlayRef.current = { ...screenOverlayRef.current, visible: false };
      setScreenOverlay(screenOverlayRef.current);
      const fallback = liveLayerIdsRef.current.at(-1) ?? null;
      activeLayerIdRef.current = fallback;
      setActiveLayerId(fallback);
      manipulationTrackerRef.current.reset();
      palmSignalTrackerRef.current.reset();
      setManipulation({ mode: "idle", progress: 0 });
      return;
    }
    const result = hideFocusedLayer(liveLayerIdsRef.current);
    if (!result.hiddenId) return;
    const nextStack = enforceBudgetForStack(result.stack);
    const nextActivationTimes = { ...layerActivationTimesRef.current };
    delete nextActivationTimes[result.hiddenId];
    layerActivationTimesRef.current = nextActivationTimes;
    const hidden = resolveLayer(result.hiddenId, assetsRef.current, scenesRef.current);
    const remainingAssetIds = new Set(nextStack.flatMap((id) => {
      const layer = resolveLayer(id, assetsRef.current, scenesRef.current);
      return layer ? layerAssetIds(layer) : [];
    }));
    hidden && layerAssetIds(hidden).forEach((id) => {
      if (!remainingAssetIds.has(id)) {
        videosRef.current.get(id)?.pause();
        setVideoAudioEnabled(audioMixerRef.current, id, false);
      }
    });
    restoreTransientLayer(result.hiddenId);
    if (hidden?.kind === "scene") {
      const nextSolo = { ...sceneSoloRef.current };
      delete nextSolo[hidden.scene.id];
      sceneSoloRef.current = nextSolo;
      setSceneSolo(nextSolo);
    }
    manipulationTrackerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    sceneMemberTargetIdRef.current = null;
    sceneMemberMissSinceRef.current = null;
    setSceneMemberTargetId(null);
    setSelectedSceneMemberId(null);
    manipulationGuardUntilRef.current = performance.now() + 450;
    setManipulation({ mode: "idle", progress: 0 });
    const nextFocus = nextStack.at(-1) ?? null;
    liveLayerIdsRef.current = nextStack;
    activeLayerIdRef.current = nextFocus;
    setLiveLayerIds(nextStack);
    setActiveLayerId(nextFocus);
    directorFocusedAssetIdRef.current = null;
    setDirectorFocusedAssetId(null);
    palmRestoreRef.current = { since: 0, latched: false };
    closeVisualTimelineEvent();
  }, [closeVisualTimelineEvent, restoreTransientLayer]);

  const hideEverything = useCallback(() => {
    videosRef.current.forEach((video, id) => {
      video.pause();
      setVideoAudioEnabled(audioMixerRef.current, id, false);
    });
    widgetAudioRef.current.forEach((audio) => audio.pause());

    liveLayerIdsRef.current = [];
    activeLayerIdRef.current = null;
    setLiveLayerIds([]);
    setActiveLayerId(null);
    setDirectorFocusedAssetId(null);
    directorFocusedAssetIdRef.current = null;

    screenOverlayRef.current = { ...screenOverlayRef.current, visible: false };
    setScreenOverlay(screenOverlayRef.current);
    assetDeckVisibleRef.current = false;
    setAssetDeckVisible(false);
    operatorShelfOpenRef.current = false;
    setOperatorShelfOpen(false);
    setOperatorShelfTargetId(null);
    setOperatorShelfProgress(0);

    widgetsRef.current = widgetsRef.current.map((widget) => ({
      ...widget,
      visible: false,
      open: false,
      playing: false,
      active: false
    }));
    setWidgets(widgetsRef.current);

    setPointFocus(null);
    pointFocusTrackerRef.current.reset();
    widgetPointTrackerRef.current.reset();
    manipulationTrackerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    setManipulation({ mode: "idle", progress: 0 });
    setPhaseMessage("Canvas cleared — camera remains live");
    closeVisualTimelineEvent();
  }, [closeVisualTimelineEvent]);

  const startMorphExit = useCallback((assetId: string) => {
    const canvas = outputCanvasRef.current;
    const layer = activeLayerIdRef.current ? resolveLayer(activeLayerIdRef.current, assetsRef.current, scenesRef.current) : null;
    if (!canvas || !layer || layer.kind !== "asset" || layer.asset.id !== assetId || !activeGeometry?.rect || assetMorphExitRef.current) return;
    const sourceRect = activeGeometry.rect;
    const x = Math.max(0, Math.min(canvas.width - 1, sourceRect.x));
    const y = Math.max(0, Math.min(canvas.height - 1, sourceRect.y));
    const width = Math.max(1, Math.min(canvas.width - x, sourceRect.width));
    const height = Math.max(1, Math.min(canvas.height - y, sourceRect.height));
    const previewScale = Math.min(1, 1_200 / width, 900 / height);
    const snapshot = document.createElement("canvas");
    snapshot.width = Math.max(1, Math.round(width * previewScale));
    snapshot.height = Math.max(1, Math.round(height * previewScale));
    const snapshotContext = snapshot.getContext("2d", { alpha: false });
    if (!snapshotContext) return;
    snapshotContext.drawImage(canvas, x, y, width, height, 0, 0, snapshot.width, snapshot.height);
    const now = performance.now();
    assetMorphExitRef.current = {
      id: crypto.randomUUID(),
      assetId,
      name: layer.asset.name,
      startedAt: now,
      durationMs: 820,
      rect: { x, y, width, height },
      snapshot
    };
    // The same finishing arc must not immediately focus the next deck item.
    morphFocusLockUntilRef.current = now + 1_200;
    setMorphExitAssetId(assetId);
    setMorphGestureProgress(0);
    circleMorphTrackerRef.current.reset();
    setPhaseMessage(`${shortName(layer.asset.name, 28)} morphed away`);
    hideLayer();
  }, [activeGeometry, hideLayer]);

  useEffect(() => { startMorphExitRef.current = startMorphExit; }, [startMorphExit]);

  const activateStudioLayer = useCallback((layer: StudioLayer) => {
    const previousLayerIds = [...liveLayerIdsRef.current];
    previousLayerIds.forEach((layerId) => {
      const previous = resolveLayer(layerId, assetsRef.current, scenesRef.current);
      previous && layerAssetIds(previous).forEach((assetId) => {
        videosRef.current.get(assetId)?.pause();
        setVideoAudioEnabled(audioMixerRef.current, assetId, false);
      });
      restoreTransientLayer(layerId);
    });
    sceneSoloRef.current = {};
    setSceneSolo({});
    setSelectedSceneMemberId(null);
    directorFocusedAssetIdRef.current = null;
    setDirectorFocusedAssetId(null);
    const assetIds = layerAssetIds(layer);
    const nextCompleted = new Set(completedVideoIdsRef.current);
    let restoredCompletedVideo = false;
    assetIds.forEach((id) => {
      if (nextCompleted.delete(id)) restoredCompletedVideo = true;
    });
    if (restoredCompletedVideo) {
      completedVideoIdsRef.current = nextCompleted;
      completedVideoVersionRef.current += 1;
    }
    assetIds.forEach((id) => {
      const overlayVideo = videosRef.current.get(id);
      if (!overlayVideo) return;
      const asset = assetsRef.current.find((item) => item.id === id);
      const trim = normalizeVideoTrim(asset?.videoTrim, asset?.mediaDuration ?? overlayVideo.duration);
      overlayVideo.currentTime = trim.start;
      // Gesture callbacks are not browser user-activation events. Starting an
      // unmuted media element from one is commonly rejected, which used to leave
      // an empty focused frame. Start the visual track muted, then enable its
      // mixer route once playback has actually begun. During recording this also
      // preserves the asset audio in the composed take.
      overlayVideo.muted = true;
      setVideoAudioEnabled(audioMixerRef.current, id, false);
      void overlayVideo.play().then(() => {
        const includeAudio = Boolean(asset?.includeAudio);
        if (!includeAudio) return;
        overlayVideo.muted = false;
        setVideoAudioEnabled(audioMixerRef.current, id, true);
      }).catch(() => undefined);
    });
    const now = performance.now();
    const cueSound = layer.kind === "asset" ? layer.asset.cueSound : layer.scene.cueSound;
    const cueVolume = layer.kind === "asset" ? layer.asset.cueVolume : layer.scene.cueVolume;
    playCueSound(audioMixerRef.current, cueSound, cueVolume);
    manipulationTrackerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    manipulationGuardUntilRef.current = now + 300;
    setManipulation({ mode: "idle", progress: 0 });
    const nextStack = enforceBudgetForStack([layer.id]);
    liveLayerIdsRef.current = nextStack;
    activeLayerIdRef.current = layer.id;
    layerActivationTimesRef.current = { ...layerActivationTimesRef.current, [layer.id]: now };
    setLiveLayerIds(nextStack);
    setActiveLayerId(layer.id);
    setActivatedAt(now);
    palmRestoreRef.current = { since: 0, latched: false };
    appendVisualTimelineEvent(layer);
  }, [appendVisualTimelineEvent, restoreTransientLayer]);

  useEffect(() => { activateStudioLayerRef.current = activateStudioLayer; }, [activateStudioLayer]);

  const confirmCurrentIntent = useCallback(() => {
    const publishConfirmFeedback = (message: string) => {
      setConfirmFeedback(message);
      if (confirmFeedbackTimerRef.current !== null) window.clearTimeout(confirmFeedbackTimerRef.current);
      confirmFeedbackTimerRef.current = window.setTimeout(() => {
        setConfirmFeedback("");
        confirmFeedbackTimerRef.current = null;
      }, 1_650);
    };
    const candidate = intentQueueRef.current[0];
    if (!candidate?.confirmable) {
      const message = candidate ? "Pinch seen — keep speaking" : "Pinch seen — say the concept first";
      setPhaseMessage(message);
      publishConfirmFeedback(message);
      return;
    }
    const concept = conceptsRef.current.find((item) => item.id === candidate.conceptId);
    if (!concept) return;
    const now = performance.now();
    const lastConfirmed = conceptCooldownsRef.current.get(concept.id) ?? Number.NEGATIVE_INFINITY;
    if (now - lastConfirmed < concept.cooldownMs) {
      publishConfirmFeedback(`${concept.displayName} is already ready`);
      return;
    }

    let layerId: string | null = concept.sceneIds[0] ? sceneLayerId(concept.sceneIds[0]) : null;
    if (!layerId && concept.assetIds.length) {
      const cursor = conceptCursorsRef.current.get(concept.id) ?? 0;
      layerId = concept.assetIds[cursor % concept.assetIds.length];
      conceptCursorsRef.current.set(concept.id, cursor + 1);
    }
    if (!layerId) {
      publishConfirmFeedback(`${concept.displayName} has no visual yet`);
      return;
    }

    if (layerId.startsWith("scene:")) {
      const sceneId = layerId.slice("scene:".length);
      const nextScenes = scenesRef.current.map((scene) => scene.id === sceneId ? { ...scene, entranceAnimation: concept.animation } : scene);
      scenesRef.current = nextScenes;
      setScenes(nextScenes);
    } else {
      const nextAssets = assetsRef.current.map((asset) => asset.id === layerId ? { ...asset, entranceAnimation: concept.animation } : asset);
      assetsRef.current = nextAssets;
      setAssets(nextAssets);
    }
    const layer = resolveLayer(layerId, assetsRef.current, scenesRef.current);
    if (!layer) return;
    conceptCooldownsRef.current.set(concept.id, now);
    activateStudioLayerRef.current(layer);
    setPhaseMessage(`${concept.displayName} on stage`);
    publishConfirmFeedback(`${concept.displayName} shown`);
    studioEventsRef.current.emit("overlay:spawned", { conceptId: concept.id, layerId, at: now });
  }, []);

  useEffect(() => { confirmIntentRef.current = confirmCurrentIntent; }, [confirmCurrentIntent]);
  useEffect(() => studioEventsRef.current.on("gesture:confirm", () => confirmIntentRef.current()), []);

  const revealVoiceTarget = useCallback((target: VoiceTriggerTarget, source: "voice" | "shelf") => {
    const layer = resolveLayer(target.kind === "scene" ? sceneLayerId(target.id) : target.id, assetsRef.current, scenesRef.current);
    if (!layer) return;
    activateStudioLayerRef.current(layer);
    clearArmedVoiceTarget();
    operatorShelfOpenRef.current = false;
    setOperatorShelfOpen(false);
    setOperatorShelfTargetId(null);
    setOperatorShelfProgress(0);
    operatorShelfPointTrackerRef.current.reset();
    // Keep the command tracker latched until the creator lowers their hand.
    // Resetting it here made one long palm reveal the visual and then reopen
    // the shelf roughly a second later.
    setPhaseMessage(source === "voice" ? `${layerName(layer)} revealed` : `${layerName(layer)} selected from shelf`);
  }, [clearArmedVoiceTarget]);

  useEffect(() => { revealVoiceTargetRef.current = revealVoiceTarget; }, [revealVoiceTarget]);

  const chooseShelfTarget = useCallback((target: VoiceTriggerTarget) => {
    shelfPointCarryoverRef.current = true;
    operatorShelfOpenRef.current = false;
    setOperatorShelfOpen(false);
    setOperatorShelfTargetId(null);
    setOperatorShelfProgress(0);
    operatorShelfPointTrackerRef.current.reset();
    pointFocusTrackerRef.current.reset();
    spotlightRef.current = null;
    spotlightRectRef.current = null;
    setSpotlight(null);
    setPointFocus(null);
    // Shelf selection happens with a point, so the next fresh palm should be
    // accepted immediately as the reveal confirmation.
    palmCommandTrackerRef.current.reset();
    armVoiceTarget(target, target.triggerWord, "shelf");
    setPhaseMessage(`${target.name} selected — raise your palm to reveal`);
  }, [armVoiceTarget]);

  useEffect(() => { chooseShelfTargetRef.current = chooseShelfTarget; }, [chooseShelfTarget]);

  const focusVideoStyleAsset = useCallback((asset: StudioAsset) => {
    if (asset.id === SCREEN_OVERLAY_ID) {
      liveLayerIdsRef.current.forEach((layerId) => {
        const previous = resolveLayer(layerId, assetsRef.current, scenesRef.current);
        previous && layerAssetIds(previous).forEach((assetId) => {
          videosRef.current.get(assetId)?.pause();
          setVideoAudioEnabled(audioMixerRef.current, assetId, false);
        });
        restoreTransientLayer(layerId);
      });
      liveLayerIdsRef.current = [];
      setLiveLayerIds([]);
      selectScreenOverlay();
      return;
    }
    if (screenOverlayRef.current.visible) {
      screenOverlayRef.current = { ...screenOverlayRef.current, visible: false };
      setScreenOverlay(screenOverlayRef.current);
    }
    const styleWindow = currentVideoStyleWindow();
    const styleLayout = videoStyleLayout(videoStyleRef.current, outputSize.width, outputSize.height, styleWindow.assets.length, {
      offset: styleWindow.offset,
      windowStart: styleWindow.windowStart,
      total: styleWindow.total,
      position: deckPlacementRef.current
    });
    const source = asset.kind === "image" ? imagesRef.current.get(asset.id) : asset.kind === "video" ? videosRef.current.get(asset.id) : undefined;
    const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : undefined;
    const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : undefined;
    const base = styleFocusBaseRect(styleLayout, asset, sourceWidth, sourceHeight);
    const transform = retainedStyleTransform(asset.transform, base, outputSize.width, outputSize.height);
    const positionedAsset = asset.transform ? asset : { ...asset, transform };
    if (!asset.transform) commitAssetUpdates(asset.id, { transform });
    activateStudioLayer({ id: asset.id, kind: "asset", asset: positionedAsset });
  }, [activateStudioLayer, commitAssetUpdates, currentVideoStyleWindow, outputSize.height, outputSize.width, restoreTransientLayer, selectScreenOverlay]);

  useEffect(() => { focusVideoStyleAssetRef.current = focusVideoStyleAsset; }, [focusVideoStyleAsset]);

  const activateGestureCue = useCallback((gesture: GestureId) => {
    const cursor = gestureSequenceCursorRef.current[gesture] ?? 0;
    const cue = gestureCueAtCursor(
      gesture,
      cursor,
      assetsRef.current,
      scenesRef.current,
      gestureSequencesRef.current
    );
    if (!cue) return false;

    gestureSequenceCursorRef.current = {
      ...gestureSequenceCursorRef.current,
      [gesture]: cue.nextCursor
    };

    if (cue.mode === "replace" && cue.total > 1) {
      const sequenceIds = new Set(cue.layerIds.filter((id) => id !== cue.layer.id));
      const removedIds = liveLayerIdsRef.current.filter((id) => sequenceIds.has(id));
      if (removedIds.length) {
        const nextStack = liveLayerIdsRef.current.filter((id) => !sequenceIds.has(id));
        const remainingAssetIds = new Set([
          ...nextStack.flatMap((id) => {
            const layer = resolveLayer(id, assetsRef.current, scenesRef.current);
            return layer ? layerAssetIds(layer) : [];
          }),
          ...layerAssetIds(cue.layer)
        ]);
        removedIds.forEach((id) => {
          const layer = resolveLayer(id, assetsRef.current, scenesRef.current);
          if (!layer) return;
          layerAssetIds(layer).forEach((assetId) => {
            if (remainingAssetIds.has(assetId)) return;
            videosRef.current.get(assetId)?.pause();
            setVideoAudioEnabled(audioMixerRef.current, assetId, false);
          });
        });
        const nextActivationTimes = { ...layerActivationTimesRef.current };
        removedIds.forEach((id) => { delete nextActivationTimes[id]; });
        layerActivationTimesRef.current = nextActivationTimes;
        liveLayerIdsRef.current = nextStack;
        setLiveLayerIds(nextStack);
      }
    }

    setActiveGestureCue({
      gesture,
      index: cue.index,
      total: cue.total,
      name: layerName(cue.layer)
    });
    activateStudioLayer(cue.layer);
    return true;
  }, [activateStudioLayer]);

  const showDirectorCueAt = useCallback((requestedIndex: number) => {
    const queue = directorQueueRef.current;
    if (!queue.length) return false;
    const index = Math.min(queue.length - 1, Math.max(0, requestedIndex));
    const cue = queue[index];
    directorCursorRef.current = index;
    setDirectorCursor(index);
    setActiveGestureCue(null);
    activateStudioLayer(cue);
    return true;
  }, [activateStudioLayer]);

  const navigateDirector = useCallback((direction: -1 | 1) => {
    const queue = directorQueueRef.current;
    if (!queue.length) return false;
    const current = directorCueIndex(queue, activeLayerIdRef.current, directorCursorRef.current);
    const currentIsLive = queue.some((cue) => cue.id === activeLayerIdRef.current);
    const target = currentIsLive
      ? adjacentDirectorCueIndex(queue.length, current, direction)
      : current;
    return showDirectorCueAt(target);
  }, [showDirectorCueAt]);

  const restoreDirectorCue = useCallback(() => {
    if (activeLayerIdRef.current || !directorQueueRef.current.length) return false;
    return showDirectorCueAt(directorCursorRef.current);
  }, [showDirectorCueAt]);

  const activateLayerFromLibrary = async (layer: StudioLayer) => {
    const index = directorQueueRef.current.findIndex((cue) => cue.id === layer.id);
    if (index >= 0) showDirectorCueAt(index);
    else activateStudioLayer(layer);
  };

  useEffect(() => {
    if (!studioReady) return;
    const recognizer = recognizerRef.current;
    const video = cameraVideoRef.current;
    const outputCanvas = outputCanvasRef.current;
    const inferenceCanvas = inferenceCanvasRef.current;
    const context = inferenceCanvas?.getContext("2d", { alpha: false });
    if (!recognizer || !video || !outputCanvas || !inferenceCanvas || !context) return;
    let busy = false;
    let stopped = false;
    let lastInferenceAt = Number.NEGATIVE_INFINITY;
    let lastLatencyPublishedAt = Number.NEGATIVE_INFINITY;
    let lastDetectedPublishedAt = Number.NEGATIVE_INFINITY;
    let publishedDetected: { gesture: RecognizedGesture; confidence: number; source: string } = { gesture: null, confidence: 0, source: "none" };
    let frameCallbackId: number | null = null;
    let animationId: number | null = null;
    let displayScheduleStarted = false;
    let processorReader: ReadableStreamDefaultReader<VideoFrame> | null = null;
    let processorTrack: MediaStreamTrack | null = null;
    const Processor = videoFrameProcessor();
    const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0] ?? null;
    const category = (categoryName: string): InferenceCategory => ({ categoryName, score: 0.99, index: 0, displayName: "" });

    const applyDiagnostics = (result: GestureFrameResult, now: number) => {
      let categories = result.gestures.map((gestures) => gestures[0]);
      let landmarkSets = result.landmarks ?? [];
      let handednesses = result.handednesses ?? [];
      const elapsed = performance.now() - diagnosticSequenceStartRef.current;
      if (diagnosticScenario === "intent-pinch" || diagnosticScenario === "intent-sequence" || diagnosticScenario === "streaming-speech" || diagnosticScenario === "streaming-sequence" || diagnosticScenario === "import-flow") {
        const firstPinch = diagnosticScenario === "streaming-sequence" || diagnosticScenario === "import-flow"
          ? elapsed >= 8_000 && elapsed < 8_900
          : diagnosticScenario === "streaming-speech"
          ? elapsed >= 10_000 && elapsed < 11_400
          : elapsed >= 1_800 && elapsed < 2_400;
        const secondPinch = diagnosticScenario === "intent-sequence"
          ? elapsed >= 3_600 && elapsed < 4_200
          : (diagnosticScenario === "streaming-sequence" || diagnosticScenario === "import-flow") && elapsed >= 13_000 && elapsed < 13_900;
        const thirdPinch = (diagnosticScenario === "streaming-sequence" || diagnosticScenario === "import-flow") && elapsed >= 18_000 && elapsed < 18_900;
        if (firstPinch || secondPinch || thirdPinch) {
          const confirmsVoiceCue = diagnosticScenario === "streaming-speech";
          categories = confirmsVoiceCue ? [category("Open_Palm")] : [];
          landmarkSets = [confirmsVoiceCue ? diagnosticPalmLandmarks(0.5, 0.55) : diagnosticPinchLandmarks(0.82, 0.22)];
          handednesses = [[{ ...category("Left"), score: 1 }]];
        } else if (diagnosticScenario === "import-flow" && elapsed >= 21_000 && elapsed < 25_000) {
          categories = [category("Closed_Fist")];
          landmarkSets = [];
          handednesses = [[{ ...category("Left"), score: 1 }]];
        } else {
          categories = [];
          landmarkSets = [];
          handednesses = [];
        }
      } else if (diagnosticScenario === "shelf-confirm") {
        if ((elapsed >= 600 && elapsed < 1_600) || (elapsed >= 4_300 && elapsed < 5_300)) {
          categories = [category("Open_Palm")];
          landmarkSets = [diagnosticPalmLandmarks(0.5, 0.55)];
        } else if (elapsed >= 2_100 && elapsed < 3_800) {
          const shelfRect = operatorShelfRects(operatorShelfItemsRef.current, aspectRef.current === "portrait")[1]
            ?? operatorShelfRects(operatorShelfItemsRef.current, aspectRef.current === "portrait")[0];
          const tipX = shelfRect ? shelfRect.x + shelfRect.width / 2 : 0.4;
          const tipY = shelfRect ? shelfRect.y + shelfRect.height / 2 : 0.7;
          categories = [category("Pointing_Up")];
          landmarkSets = [diagnosticPalmLandmarks(tipX + 0.05, tipY + 0.18)];
        } else {
          categories = [];
          landmarkSets = [];
        }
        handednesses = categories.length ? [[{ ...category("Left"), score: 1 }]] : [];
      } else if (diagnosticScenario === "voice-palm-hold") {
        if (elapsed >= 1_050 && elapsed < 3_500) {
          categories = [category("Open_Palm")];
          landmarkSets = [diagnosticPalmLandmarks(0.5, 0.55)];
        } else {
          categories = [];
          landmarkSets = [];
        }
        handednesses = categories.length ? [[{ ...category("Left"), score: 1 }]] : [];
      } else if (diagnosticScenario === "voice-command") {
        if ((elapsed >= 1_050 && elapsed < 1_650) || (elapsed >= 3_250 && elapsed < 3_850) || (elapsed >= 5_350 && elapsed < 5_950)) {
          categories = [category("Open_Palm")];
          landmarkSets = [diagnosticPalmLandmarks(0.5, 0.55)];
        } else if (elapsed >= 2_200 && elapsed < 2_900) {
          categories = [category("Closed_Fist")];
          landmarkSets = [];
        } else if (elapsed >= 4_150 && elapsed < 5_050) {
          const firstShelfRect = operatorShelfRects(operatorShelfItemsRef.current, aspectRef.current === "portrait")[1]
            ?? operatorShelfRects(operatorShelfItemsRef.current, aspectRef.current === "portrait")[0];
          const tipX = firstShelfRect ? firstShelfRect.x + firstShelfRect.width / 2 : 0.4;
          const tipY = firstShelfRect ? firstShelfRect.y + firstShelfRect.height / 2 : 0.7;
          categories = [category("Pointing_Up")];
          landmarkSets = [diagnosticPalmLandmarks(tipX + 0.05, tipY + 0.18)];
        } else if (elapsed >= 6_350 && elapsed < 7_500) {
          // The second shelf choice uses a left-side placement. Keep pointing
          // at it long enough to verify the recorded spotlight treatment.
          categories = [category("Pointing_Up")];
          landmarkSets = [diagnosticPalmLandmarks(0.89, 0.68)];
        } else {
          categories = [];
          landmarkSets = [];
        }
        handednesses = categories.length ? [[{ ...category("Left"), score: 1 }]] : [];
      } else if (diagnosticScenario === "morph") {
        if (elapsed >= 600 && elapsed < 1_700) {
          categories = [category("Pointing_Up")];
          landmarkSets = [diagnosticPalmLandmarks(0.89, 0.507)];
        } else if (elapsed >= 2_350 && elapsed < 3_750) {
          // Slightly over one orbit keeps the deterministic 10 fps diagnostic
          // from ending one sample before the fingertip closes the circle.
          const angle = (elapsed - 2_350) / 1_400 * Math.PI * 2.22;
          const tipX = 0.84 + Math.cos(angle) * 0.07;
          const tipY = 0.5 + Math.sin(angle) * 0.07;
          categories = [category("Pointing_Up")];
          landmarkSets = [diagnosticPalmLandmarks(tipX + 0.05, tipY + 0.18)];
        } else {
          categories = [];
          landmarkSets = [];
        }
        handednesses = categories.length ? [[{ ...category("Left"), score: 1 }]] : [];
      } else if (diagnosticScenario === "style-focus") {
        if (elapsed >= 600 && elapsed < 2500) {
          categories = [category("Pointing_Up")];
          // The literal fingertip lands in the first right-rail card, away
          // from the narrow gap between cards.
          landmarkSets = [diagnosticPalmLandmarks(0.84, 0.507)];
        } else if (elapsed >= 2700 && elapsed < 3700) {
          // A palm far from the selected asset must not move or teleport it.
          categories = [category("Open_Palm")];
          landmarkSets = [diagnosticPalmLandmarks(0.2, 0.72)];
        } else if (elapsed >= 3900 && elapsed < 5500) {
          const spread = (elapsed - 3900) / 1600;
          categories = [category("Open_Palm"), category("Open_Palm")];
          landmarkSets = [diagnosticPalmLandmarks(0.6 + spread * .12, 0.5), diagnosticPalmLandmarks(0.98 - spread * .12, 0.5)];
        } else if (elapsed >= 5800 && elapsed < 7000) {
          categories = [category("Closed_Fist")];
          landmarkSets = [];
        } else {
          categories = [];
          landmarkSets = [];
        }
        handednesses = categories.length ? [[{ ...category("Left"), score: 1 }]] : [];
      } else if (diagnosticScenario === "director" || diagnosticScenario === "director-back") {
        if (elapsed < 1200 || (elapsed >= 1900 && elapsed < 3100)) categories = [category("Thumb_Up")];
        else if (diagnosticScenario === "director-back" && elapsed >= 3800 && elapsed < 5400) categories = [category("Thumb_Down")];
        else if (elapsed >= 3800 && elapsed < 6000) categories = [category("Closed_Fist")];
        else if (elapsed >= 7000 && elapsed < 8600) categories = [category("Open_Palm")];
        else if (elapsed >= 9600 && elapsed < 11200) categories = [category("Thumb_Down")];
        else categories = [];
        landmarkSets = elapsed >= 7000 && elapsed < 8600 ? [diagnosticPalmLandmarks(0.03, 0.06)] : [];
        handednesses = categories.length ? [[{ ...category("Left"), score: 1 }]] : [];
      } else if (diagnosticScenario === "gesture" || diagnosticScenario === "palm" || diagnosticScenario === "scene" || diagnosticScenario === "scene-reveal") {
        if (elapsed < 3000) categories = [category(diagnosticScenario === "palm" ? "Open_Palm" : "Thumb_Up")];
        else if (elapsed >= 4500 && elapsed < 5500) categories = [category("Closed_Fist")];
        else categories = [];
        landmarkSets = diagnosticScenario === "palm" && elapsed < 3000 ? [diagnosticPalmLandmarks(0.15, 0.75)] : [];
        handednesses = categories.length ? [[{ ...category("Left"), score: 1 }]] : [];
      } else if (diagnosticScenario === "double") {
        if (elapsed < 3000) categories = [category("Victory"), category("Victory")];
        else if (elapsed >= 4500 && elapsed < 5500) categories = [category("Closed_Fist")];
        else categories = [];
        landmarkSets = [];
        handednesses = categories.map((_, index) => [{ ...category(index === 0 ? "Left" : "Right"), score: 1 }]);
      } else if (diagnosticScenario === "stack") {
        if (elapsed < 1200) categories = [category("Pointing_Up")];
        else if (elapsed >= 1800 && elapsed < 3200) categories = [category("Victory")];
        else if (elapsed >= 5200 && elapsed < 6000) categories = [category("Closed_Fist")];
        else categories = [];
        landmarkSets = [];
      } else if (diagnosticScenario === "sequence") {
        if (elapsed < 900 || (elapsed >= 1800 && elapsed < 2700) || (elapsed >= 3600 && elapsed < 4500)) categories = [category("Pointing_Up")];
        else if (elapsed >= 5200 && elapsed < 6000) categories = [category("Closed_Fist")];
        else categories = [];
        landmarkSets = [];
      } else if (diagnosticScenario === "stack-manipulation") {
        if (elapsed >= 900 && elapsed < 2300) {
          categories = [category("Open_Palm")];
          landmarkSets = [diagnosticPalmLandmarks(0.152, 0.476)];
          handednesses = [[{ ...category("Left"), score: 1 }]];
        } else {
          categories = [];
          landmarkSets = [];
          handednesses = [];
        }
      } else if (diagnosticScenario === "screen-manipulation") {
        if (elapsed >= 450 && elapsed < 1200) {
          categories = [category("Open_Palm")];
          landmarkSets = [diagnosticPalmLandmarks(0.75, 0.5)];
        } else if (elapsed >= 1200 && elapsed < 2800) {
          const progress = (elapsed - 1200) / 1600;
          categories = [category("Open_Palm")];
          landmarkSets = [diagnosticPalmLandmarks(0.75 - progress * 0.2, 0.5 + progress * 0.12)];
        } else if (elapsed >= 4000 && elapsed < 5000) {
          categories = [category("Closed_Fist")];
          landmarkSets = [];
        } else {
          categories = [];
          landmarkSets = [];
        }
        handednesses = categories.length ? [[{ ...category("Left"), score: 1 }]] : [];
      } else if (diagnosticScenario === "scene-focus") {
        if (elapsed < 1100) {
          categories = [category("Thumb_Up")];
          landmarkSets = [];
        } else if (elapsed >= 1800 && elapsed < 3200) {
          categories = [category("Pointing_Up")];
          landmarkSets = [diagnosticPalmLandmarks(0.42, 0.56)];
        } else {
          categories = [];
          landmarkSets = [];
        }
        handednesses = categories.length ? [[{ ...category("Left"), score: 1 }]] : [];
      } else if (diagnosticScenario === "scene-selection") {
        if (elapsed >= 2500 && elapsed < 2680) {
          landmarkSets = [diagnosticPalmLandmarks(0.41, 0.354)];
        } else if (elapsed >= 2820 && elapsed < 3600) {
          landmarkSets = [diagnosticPalmLandmarks(0.574, 0.354)];
        } else {
          landmarkSets = [];
        }
        if (landmarkSets.length) categories = landmarkSets.map(() => category("Open_Palm"));
        else categories = [];
        handednesses = landmarkSets.map(() => [{ ...category("Left"), score: 1 }]);
      } else if (diagnosticScenario === "manipulation" || diagnosticScenario === "scene-manipulation") {
        const cameraX = (displayX: number) => mirrorCameraRef.current ? 1 - displayX : displayX;
        const activationWindow = diagnosticScenario === "scene-manipulation" ? 2500 : 1200;
        categories = elapsed < activationWindow ? [category("Thumb_Up")] : [];
        landmarkSets = [];
        if (diagnosticScenario === "scene-manipulation" && elapsed >= 3500 && elapsed < 4200) {
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.5), 0.5)];
        } else if (diagnosticScenario === "scene-manipulation" && elapsed >= 4200 && elapsed < 5600) {
          const progress = (elapsed - 4200) / 1400;
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.5 + progress * 0.16), 0.5 + progress * 0.1)];
        } else if (diagnosticScenario === "scene-manipulation" && elapsed >= 7000 && elapsed < 8000) {
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.6), 0.6), diagnosticPalmLandmarks(cameraX(0.72), 0.6)];
        } else if (diagnosticScenario === "scene-manipulation" && elapsed >= 8000 && elapsed < 10000) {
          const progress = (elapsed - 8000) / 2000;
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.6 - progress * 0.15), 0.6), diagnosticPalmLandmarks(cameraX(0.72 + progress * 0.16), 0.6)];
        } else if (diagnosticScenario === "scene-manipulation" && elapsed >= 12000 && elapsed < 13000) {
          categories = [category("Closed_Fist")];
        } else if (elapsed >= 2500 && elapsed < 3200) {
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.84), 0.18)];
        } else if (elapsed >= 3200 && elapsed < 4000) {
          const progress = (elapsed - 3200) / 800;
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.84 + progress * 0.1), 0.18)];
        } else if (elapsed >= 4000 && elapsed < 5800) {
          const progress = (elapsed - 4000) / 1800;
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.94 - progress * 0.27), 0.18 + progress * 0.2)];
        } else if (elapsed >= 6500 && elapsed < 7500) {
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.59), 0.38), diagnosticPalmLandmarks(cameraX(0.75), 0.38)];
        } else if (elapsed >= 7500 && elapsed < 9500) {
          const progress = (elapsed - 7500) / 2000;
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.59 - progress * 0.18), 0.38), diagnosticPalmLandmarks(cameraX(0.75 + progress * 0.18), 0.38)];
        } else if (elapsed >= 11000 && elapsed < 12000) {
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.25), 0.5), diagnosticPalmLandmarks(cameraX(0.75), 0.5)];
        } else if (elapsed >= 12000 && elapsed < 14000) {
          const progress = (elapsed - 12000) / 2000;
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.25 + progress * 0.18), 0.5), diagnosticPalmLandmarks(cameraX(0.75 - progress * 0.18), 0.5)];
        }
        if (landmarkSets.length) categories = landmarkSets.map(() => category("Open_Palm"));
        handednesses = landmarkSets.map((_, index) => [{ ...category(index === 0 ? "Left" : "Right"), score: 1 }]);
      }
      return { categories, landmarkSets, handednesses };
    };

    const processResult = (result: GestureFrameResult, now: number) => {
      if (now - lastLatencyPublishedAt >= 750) {
        lastLatencyPublishedAt = now;
        setInferenceLatency((current) => Math.abs(current - result.inferenceMs) < 1 ? current : Math.round(result.inferenceMs));
      }
      const { categories, landmarkSets, handednesses } = applyDiagnostics(result, now);
      const handCount = Math.max(categories.length, landmarkSets.length, 1);
      const handResults = Array.from({ length: handCount }, (_, index) => {
        const item = categories[index];
        return resolveGesture(item?.categoryName, item?.score ?? 0, landmarkSets[index] ?? []);
      });
      const triggerResults = handResults;
      const compositeResult = resolveCompositeGesture(handResults);
      const rawResolution = compositeResult?.gesture === "double-fist" ? compositeResult
        : handResults.find((item) => item.gesture === "fist")
        ?? compositeResult
        ?? triggerResults.filter((item) => item.gesture !== null && item.gesture !== "palm").sort((a, b) => (b.confidence * b.quality) - (a.confidence * a.quality))[0]
        ?? { gesture: null, source: "none" as const, confidence: 0, quality: 1 };
      const stable = stabilizerRef.current.update(rawResolution, now);
      // Resolve an open palm after spatial hit-testing: over a visual it grabs,
      // while in empty space it summons the media deck.
      const deckEvent = assetDeckGateRef.current.suppress();
      const palmObservations: PalmObservation[] = [];
      handResults.forEach((hand, index) => {
        if (hand.gesture !== "palm" || hand.confidence * hand.quality < 0.46) return;
        const point = palmControlPoint(landmarkSets[index] ?? []);
        if (!point) return;
        const handedness = handednesses[index]?.[0]?.categoryName || `hand-${index}`;
        palmObservations.push({ id: handedness, point: mapControlPointForMirror(point, mirrorCameraRef.current) });
      });
      const palmPoints = palmSignalTrackerRef.current.update(palmObservations, now);
      const deckCapacity = MAX_STYLE_ASSETS;
      const deckAssetCount = assetsRef.current.filter((asset) => asset.kind !== "text").length + (screenSettingsRef.current ? 1 : 0);
      const maximumDeckOffset = Math.max(0, deckAssetCount - deckCapacity);
      const scrollHandIndex = handResults.findIndex((hand) => hand.gesture === "palm");
      const scrollPalmPoint = scrollHandIndex >= 0 ? palmControlPoint(landmarkSets[scrollHandIndex] ?? []) : null;
      const mappedScrollPalm = scrollPalmPoint ? mapControlPointForMirror(scrollPalmPoint, mirrorCameraRef.current) : null;
      const scrollPalmCanvasPoint = mappedScrollPalm ? { x: mappedScrollPalm.x * outputCanvas.width, y: mappedScrollPalm.y * outputCanvas.height } : null;
      const openOrbit = widgetsRef.current.find((widget) => widget.kind === "orbit" && widget.visible && widget.open);
      let orbitScrollActive = false;
      if (scrollHandIndex >= 0 && openOrbit) {
        const orbitLandmarks = landmarkSets[scrollHandIndex] ?? [];
        const orbitTips = [orbitLandmarks[8], orbitLandmarks[12], orbitLandmarks[16], orbitLandmarks[20]].filter((tip): tip is Landmark => Boolean(tip));
        if (orbitTips.length >= 2) {
          const rawOrbitPoint = { x: orbitTips.reduce((sum, tip) => sum + tip.x, 0) / orbitTips.length, y: orbitTips.reduce((sum, tip) => sum + tip.y, 0) / orbitTips.length };
          const mappedOrbitPoint = mapControlPointForMirror(rawOrbitPoint, mirrorCameraRef.current);
          const orbitCanvasPoint = { x: mappedOrbitPoint.x * outputCanvas.width, y: mappedOrbitPoint.y * outputCanvas.height };
          const nearOrbit = pointNearOrbit(openOrbit, orbitCanvasPoint, outputCanvas.width, outputCanvas.height, Math.min(outputCanvas.width, outputCanvas.height) * .045);
          if (nearOrbit) {
            orbitScrollActive = true;
            suppressDeckFocusUntilRef.current = now + 650;
            const previous = orbitScrollRef.current;
            if (previous?.widgetId === openOrbit.id) {
              const maximum = Math.max(0, (openOrbit.assetIds?.length ?? 0) - 5);
              const nextOffset = Math.min(maximum, Math.max(0, (openOrbit.orbitOffset ?? 0) + (mappedOrbitPoint.y - previous.lastY) * 8));
              if (Math.abs(nextOffset - (openOrbit.orbitOffset ?? 0)) > .006) {
                widgetsRef.current = widgetsRef.current.map((widget) => widget.id === openOrbit.id ? { ...widget, orbitOffset: nextOffset } : widget);
                setWidgets(widgetsRef.current);
              }
            }
            orbitScrollRef.current = { widgetId: openOrbit.id, lastY: mappedOrbitPoint.y };
          }
        }
      }
      if (!orbitScrollActive) orbitScrollRef.current = null;
      const activeScrollRect = activeGeometryRef.current?.rect;
      const palmCenterOverActive = Boolean(scrollPalmCanvasPoint && activeScrollRect && scrollPalmCanvasPoint.x >= activeScrollRect.x && scrollPalmCanvasPoint.x <= activeScrollRect.x + activeScrollRect.width && scrollPalmCanvasPoint.y >= activeScrollRect.y && scrollPalmCanvasPoint.y <= activeScrollRect.y + activeScrollRect.height);
      if (!orbitScrollActive && scrollHandIndex >= 0 && !palmCenterOverActive && videoStyleRef.current !== "spatial" && videoStyleRef.current !== "split-decks" && assetDeckVisibleRef.current && deckAssetCount > deckCapacity) {
        const scrollLandmarks = scrollHandIndex >= 0 ? landmarkSets[scrollHandIndex] ?? [] : [];
        const tips = [scrollLandmarks[8], scrollLandmarks[12], scrollLandmarks[16], scrollLandmarks[20]].filter((tip): tip is Landmark => Boolean(tip));
        const rawScrollPoint = tips.length >= 2
          ? { x: tips.reduce((sum, tip) => sum + tip.x, 0) / tips.length, y: tips.reduce((sum, tip) => sum + tip.y, 0) / tips.length }
          : null;
        if (rawScrollPoint) {
          const mapped = mapControlPointForMirror(rawScrollPoint, mirrorCameraRef.current);
          const beltWindow = currentVideoStyleWindow();
          const beltLayout = videoStyleLayout(videoStyleRef.current, outputCanvas.width, outputCanvas.height, beltWindow.assets.length, { offset: beltWindow.offset, windowStart: beltWindow.windowStart, total: beltWindow.total, position: deckPlacementRef.current });
          const beltPoint = { x: mapped.x * outputCanvas.width, y: mapped.y * outputCanvas.height };
          const engagementPadding = Math.min(outputCanvas.width, outputCanvas.height) * (deckScrollEngagedRef.current ? 0.08 : 0.0425);
          const nearBelt = pointNearStyleDeck(beltLayout, beltPoint, engagementPadding);
          if (nearBelt) {
            suppressDeckFocusUntilRef.current = now + 650;
            const horizontalDeck = videoStyleRef.current === "top-shelf" || videoStyleRef.current === "center-shelf" || videoStyleRef.current === "bottom-shelf";
            const axisPoint = horizontalDeck ? mapped.x : mapped.y;
            const flickCandidate = deckFlickCandidateRef.current;
            if (!flickCandidate || !deckScrollEngagedRef.current) {
              deckFlickCandidateRef.current = { axisStart: axisPoint, lastAxis: axisPoint, startedAt: now };
              deckScrollEngagedRef.current = true;
            } else {
              const filteredAxisPoint = flickCandidate.lastAxis + (axisPoint - flickCandidate.lastAxis) * 0.92;
              const flickTravel = Math.abs(filteredAxisPoint - flickCandidate.axisStart);
              const flickFastEnough = flickTravel >= 0.012 && now - flickCandidate.startedAt <= 520;
              if (deckScrollEngagedRef.current || flickFastEnough) {
                if (!deckScrollEngagedRef.current) {
                  deckScrollEngagedRef.current = true;
                  deckScrollControllerRef.current.drag(flickCandidate.lastAxis, Math.max(0, now - 16), maximumDeckOffset);
                }
                const scroll = deckScrollControllerRef.current.drag(filteredAxisPoint, now, maximumDeckOffset);
                assetDeckOffsetRef.current = scroll.offset;
                setAssetDeckOffset((current) => Math.abs(current - scroll.offset) < 0.006 ? current : scroll.offset);
                pointFocusTrackerRef.current.reset();
                setPointFocus(null);
              }
              deckFlickCandidateRef.current = { ...flickCandidate, lastAxis: filteredAxisPoint };
            }
          } else {
            deckScrollEngagedRef.current = false;
            deckFlickCandidateRef.current = null;
            const scroll = deckScrollControllerRef.current.release(now, maximumDeckOffset);
            assetDeckOffsetRef.current = scroll.offset;
            if (scroll.moving) setAssetDeckOffset((current) => Math.abs(current - scroll.offset) < 0.006 ? current : scroll.offset);
          }
        } else {
          deckScrollEngagedRef.current = false;
          deckFlickCandidateRef.current = null;
          const scroll = deckScrollControllerRef.current.release(now, maximumDeckOffset);
          assetDeckOffsetRef.current = scroll.offset;
          if (scroll.moving) setAssetDeckOffset((current) => Math.abs(current - scroll.offset) < 0.006 ? current : scroll.offset);
        }
      } else {
        deckScrollEngagedRef.current = false;
        deckFlickCandidateRef.current = null;
        const scroll = deckScrollControllerRef.current.release(now, maximumDeckOffset);
        assetDeckOffsetRef.current = scroll.offset;
        if (scroll.moving) setAssetDeckOffset((current) => Math.abs(current - scroll.offset) < 0.006 ? current : scroll.offset);
      }
      const swipeDirection = swipeTrackerRef.current.update(palmPoints.length === 1 && !palmCenterOverActive ? palmPoints[0] : null, now);
      const swipeNavigationTriggered = swipeDirection
        ? navigateDirector(swipeDirection === "left" ? 1 : -1)
        : false;
      if (swipeNavigationTriggered) {
        palmCommandTrackerRef.current.reset();
        manipulationGuardUntilRef.current = now + 520;
        setPhaseMessage(swipeDirection === "left" ? "Next scene" : "Previous scene");
      }
      const movementPoints = palmPoints.map((point) => mapPointForMovementReach(point, "comfort", aspectRef.current));
      const visibleCamera = applyCameraReflow(
        cameraFrameViewport(outputCanvas.width, outputCanvas.height, cameraFrameRef.current),
        cameraReflowFrameRef.current
      );
      const directPalmPoints = palmPoints.map((point) => mapControlPointToStageViewport(
        point,
        visibleCamera,
        outputCanvas.width,
        outputCanvas.height,
        video.videoWidth || grantedRef.current?.width || visibleCamera.width,
        video.videoHeight || grantedRef.current?.height || visibleCamera.height
      ));
      const pointerHandIndex = handResults
        .map((hand, index) => ({ hand, index }))
        .filter(({ hand }) => hand.gesture === "one")
        .sort((a, b) => b.hand.confidence * b.hand.quality - a.hand.confidence * a.hand.quality)[0]?.index;
      if (pointerHandIndex !== undefined && !deckScrollEngagedRef.current && now >= suppressDeckFocusUntilRef.current) {
        const fingertip = pointerHandIndex === undefined ? undefined : landmarkSets[pointerHandIndex]?.[8];
        if (fingertip) {
          const cameraPoint = mapControlPointForMirror({ x: fingertip.x, y: fingertip.y }, mirrorCameraRef.current);
          // Keep the cursor on the visibly recorded fingertip when a camera
          // border/matte makes the live feed smaller than the full canvas.
          const stagePoint = mapControlPointToStageViewport(
            cameraPoint,
            visibleCamera,
            outputCanvas.width,
            outputCanvas.height,
            video.videoWidth || grantedRef.current?.width || visibleCamera.width,
            video.videoHeight || grantedRef.current?.height || visibleCamera.height
          );
          if (operatorShelfOpenRef.current) {
            const shelfRects = operatorShelfRects(operatorShelfItemsRef.current, aspectRef.current === "portrait");
            const shelfTargetId = operatorShelfTargetAt(shelfRects, stagePoint);
            const shelfTarget = operatorShelfItemsRef.current.find((item) => item.id === shelfTargetId) ?? null;
            const shelfUpdate = operatorShelfPointTrackerRef.current.update(shelfTargetId, now);
            setOperatorShelfTargetId(shelfTargetId);
            setOperatorShelfProgress(shelfUpdate.progress);
            setPointFocus({ x: stagePoint.x, y: stagePoint.y, progress: shelfUpdate.progress, targetName: shelfTarget?.name });
            spotlightRef.current = null;
            spotlightRectRef.current = null;
            setSpotlight(null);
            circleMorphTrackerRef.current.update(null, null, now);
            setMorphGestureProgress((current) => current ? 0 : current);
            if (shelfUpdate.activate && shelfTarget) chooseShelfTargetRef.current(shelfTarget);
          } else if (shelfPointCarryoverRef.current) {
            // The point that chose a shelf card cannot leak into stage focus.
            // The creator must lower/change the pointing pose before a later
            // point can spotlight or enlarge anything on stage.
            pointFocusTrackerRef.current.update(null, now);
            operatorShelfPointTrackerRef.current.update(null, now);
            spotlightRef.current = null;
            spotlightRectRef.current = null;
            setSpotlight((current) => current ? null : current);
            circleMorphTrackerRef.current.update(null, null, now);
            setMorphGestureProgress((current) => current ? 0 : current);
            setPointFocus({ x: stagePoint.x, y: stagePoint.y, progress: 0, targetName: armedVoiceTargetRef.current?.name });
          } else {
            const point = { x: stagePoint.x * outputCanvas.width, y: stagePoint.y * outputCanvas.height };
            const pointStyleWindow = currentVideoStyleWindow();
            const pointStyleAssets = pointStyleWindow.assets;
            const pointStyleLayout = videoStyleLayout(videoStyleRef.current, outputCanvas.width, outputCanvas.height, pointStyleAssets.length, { offset: pointStyleWindow.offset, windowStart: pointStyleWindow.windowStart, total: pointStyleWindow.total });
            const activeId = activeLayerIdRef.current;
            const focusedStyleAssetId = activeId && pointStyleAssets.some((asset) => asset.id === activeId) ? activeId : null;
            const liveRect = liveStickerRect(outputCanvas.width, outputCanvas.height);
            const liveStickerTarget = screenSettingsRef.current
              && point.x >= liveRect.x && point.x <= liveRect.x + liveRect.width
              && point.y >= liveRect.y && point.y <= liveRect.y + liveRect.height
              ? screenOverlayAsset(screenSettingsRef.current, screenOverlayRef.current)
              : null;
            const orbitRearm = orbitPointRearmRef.current;
            const orbitRearmBlocked = Boolean(orbitRearm && !orbitPointRearmed(orbitRearm, point, outputCanvas.width, outputCanvas.height));
            if (orbitRearm && !orbitRearmBlocked) {
              orbitPointRearmRef.current = null;
              pointFocusTrackerRef.current.reset();
              widgetPointTrackerRef.current.reset();
            }
            const openOrbitWidget = widgetsRef.current.find((widget) => widget.kind === "orbit" && widget.visible && widget.open);
            const orbitTarget = liveStickerTarget || orbitRearmBlocked ? null : openOrbitWidget ? orbitTargetAtPoint(openOrbitWidget, assetsRef.current, scenesRef.current, point, outputCanvas.width, outputCanvas.height) : null;
            const orbitTargetAsset = orbitTarget?.kind === "asset" ? orbitTarget.asset : null;
            const orbitTargetScene = orbitTarget?.kind === "scene" ? orbitTarget.scene : null;
            // Desk objects own their pixels. A classic-deck card behind the
            // charm must never steal the point intended to open the orbit.
            const pointedWidget = liveStickerTarget || orbitTarget ? null : widgetAtPoint(widgetsRef.current, point, outputCanvas.width, outputCanvas.height);
            const targetWidget = pointedWidget?.kind === "orbit" && orbitRearmBlocked ? null : pointedWidget;
            const candidateTargetAsset = liveStickerTarget ?? orbitTargetAsset ?? (!targetWidget && assetDeckVisibleRef.current
              ? styleAssetAtPoint(pointStyleLayout, pointStyleAssets, point, focusedStyleAssetId)
              : null);
            const targetAsset = now < morphFocusLockUntilRef.current ? null : candidateTargetAsset;
            const focusRect = pointStyleLayout.focus;
            const fingerBehindFocusedAsset = focusedStyleAssetId && (videoStyleRef.current === "left-rail" || videoStyleRef.current === "right-rail")
              && point.x >= focusRect.x && point.x <= focusRect.x + focusRect.width && point.y >= focusRect.y && point.y <= focusRect.y + focusRect.height
              ? pointStyleAssets.find((asset) => asset.id === focusedStyleAssetId)
              : null;
            const targetName = targetWidget?.title ?? orbitTargetScene?.name ?? targetAsset?.name ?? (fingerBehindFocusedAsset ? `Behind ${fingerBehindFocusedAsset.name}` : undefined);
            const widgetFocusUpdate = widgetPointTrackerRef.current.update(targetWidget?.id ?? null, now);
            const assetFocusUpdate = pointFocusTrackerRef.current.update(targetWidget ? null : orbitTargetScene ? sceneLayerId(orbitTargetScene.id) : targetAsset?.id ?? null, now);
            const focusUpdate = targetWidget ? widgetFocusUpdate : assetFocusUpdate;
            const nextPointFocus = { x: stagePoint.x, y: stagePoint.y, progress: focusUpdate.progress, targetName };
            setPointFocus((current) => current
              && Math.abs(current.x - nextPointFocus.x) < 0.008
              && Math.abs(current.y - nextPointFocus.y) < 0.008
              && Math.abs(current.progress - nextPointFocus.progress) < 0.08
              && current.targetName === nextPointFocus.targetName
              ? current
              : nextPointFocus);
            spotlightRef.current = null;
            spotlightRectRef.current = null;
            setSpotlight((current) => current ? null : current);
            if (focusUpdate.activate) {
              if (targetWidget) {
                if (targetWidget.kind === "orbit") orbitPointRearmRef.current = { widgetId: targetWidget.id, x: point.x, y: point.y };
                activateWidgetRef.current(targetWidget);
              }
              else if (targetAsset) {
                if (orbitTargetAsset && openOrbitWidget) {
                  orbitPointRearmRef.current = { widgetId: openOrbitWidget.id, x: point.x, y: point.y };
                  updateCanvasWidget(openOrbitWidget.id, { open: false });
                }
                focusVideoStyleAssetRef.current(targetAsset);
              } else if (orbitTargetScene) {
                if (openOrbitWidget) {
                  orbitPointRearmRef.current = { widgetId: openOrbitWidget.id, x: point.x, y: point.y };
                  updateCanvasWidget(openOrbitWidget.id, { open: false });
                }
                const layer = resolveLayer(sceneLayerId(orbitTargetScene.id), assetsRef.current, scenesRef.current);
                if (layer) activateStudioLayerRef.current(layer);
              }
            }

            // Pointing is selection-only. It must never move, resize, morph or
            // otherwise alter an asset that is already on the stage.
            circleMorphTrackerRef.current.update(null, null, now);
            setMorphGestureProgress((current) => current ? 0 : current);
          }
        } else {
          shelfPointCarryoverRef.current = false;
          pointFocusTrackerRef.current.update(null, now);
          operatorShelfPointTrackerRef.current.update(null, now);
          setOperatorShelfTargetId(null);
          setOperatorShelfProgress(0);
          spotlightRef.current = null;
          spotlightRectRef.current = null;
          setSpotlight((current) => current ? null : current);
          circleMorphTrackerRef.current.update(null, null, now);
          setMorphGestureProgress((current) => current ? 0 : current);
          setPointFocus(null);
        }
      } else {
        shelfPointCarryoverRef.current = false;
        pointFocusTrackerRef.current.update(null, now);
        operatorShelfPointTrackerRef.current.update(null, now);
        setOperatorShelfTargetId(null);
        setOperatorShelfProgress(0);
        spotlightRef.current = null;
        spotlightRectRef.current = null;
        setSpotlight((current) => current ? null : current);
        circleMorphTrackerRef.current.update(null, null, now);
        setMorphGestureProgress((current) => current ? 0 : current);
        setPointFocus((current) => current ? null : current);
      }
      const displayedGesture = stable.gesture ?? (palmPoints.length ? "palm" : null);
      const nextDetected = { gesture: displayedGesture, confidence: stable.gesture ? stable.confidence : rawResolution.confidence, source: palmPoints.length ? "palm-control" : rawResolution.source };
      const detectedPublishInterval = recordingRef.current ? 320 : 180;
      const detectedIntentChanged = nextDetected.gesture !== publishedDetected.gesture || nextDetected.source !== publishedDetected.source;
      if (detectedIntentChanged || now - lastDetectedPublishedAt >= detectedPublishInterval) {
        lastDetectedPublishedAt = now;
        publishedDetected = nextDetected;
        setDetected((current) => current.gesture === nextDetected.gesture
          && current.source === nextDetected.source
          && Math.abs(current.confidence - nextDetected.confidence) < 0.035
          ? current
          : nextDetected);
      }

      palmRestoreRef.current = { since: 0, latched: false };
      if (palmPoints.length) {
        pointFocusTrackerRef.current.reset();
        widgetPointTrackerRef.current.reset();
        setPointFocus((current) => current ? null : current);
      }

      let event;
      if (stable.gesture === "fist") {
        clearArmedVoiceTarget();
        operatorShelfOpenRef.current = false;
        setOperatorShelfOpen(false);
        setOperatorShelfTargetId(null);
        setOperatorShelfProgress(0);
        operatorShelfPointTrackerRef.current.reset();
        palmCommandTrackerRef.current.reset();
        shelfPointCarryoverRef.current = false;
        spotlightRef.current = null;
        spotlightRectRef.current = null;
        setSpotlight(null);
        manipulationTrackerRef.current.reset();
        palmSignalTrackerRef.current.reset();
        sceneMemberTargetIdRef.current = null;
        sceneMemberMissSinceRef.current = null;
        setSceneMemberTargetId(null);
        setManipulation({ mode: "idle", progress: 0 });
        event = gateRef.current.update("fist", now);
      } else {
        const trackerModeBeforeSelection = manipulationTrackerRef.current.currentMode();
        const palmTargetLocked = trackerModeBeforeSelection === "dragging"
          || trackerModeBeforeSelection === "scaling"
          || trackerModeBeforeSelection === "arming-scale";
        // A palm manipulates the asset that pointing already focused. It never
        // changes selection, which avoids fighting the user's intended target.
        void palmTargetLocked;

        const pendingVoiceTarget = armedVoiceTargetRef.current?.source === "shelf" ? armedVoiceTargetRef.current : null;
        const active = activeLayerIdRef.current === SCREEN_OVERLAY_ID && screenSettingsRef.current && screenOverlayRef.current.visible
          ? { id: SCREEN_OVERLAY_ID, kind: "asset" as const, asset: screenOverlayAsset(screenSettingsRef.current, screenOverlayRef.current) }
          : activeLayerIdRef.current ? resolveLayer(activeLayerIdRef.current, assetsRef.current, scenesRef.current) : null;
        let manipulationUpdate: ManipulationUpdate = { mode: "idle", progress: 0, suppressActivation: false };
        // One palm grabs and moves the focused visual; two palms resize it.
        // The manipulation tracker anchors at acquisition, so movement starts
        // from the asset's current transform instead of teleporting to the hand.
        const allowPalmAssetManipulation = palmPoints.length >= 1;
        if (!allowPalmAssetManipulation) manipulationTrackerRef.current.reset();

        // Confirmation always outranks manipulation. Previously a live asset
        // could capture the palm before the armed voice cue saw it.
        // Palm remains available for deck/orbit scrolling when it is not over
        // the focused visual.
        if (allowPalmAssetManipulation && !pendingVoiceTarget && active && palmPoints.length >= 1 && now >= manipulationGuardUntilRef.current) {
          let base: Rect | null = null;
          let rect: Rect | null = null;
          let currentTransform: StudioAsset["transform"];
          let transformBounds: Rect | undefined;
          let sceneMemberContext: { memberId: string; groupRect: Rect } | null = null;
          let sourceWidth: number | undefined;
          let sourceHeight: number | undefined;
          if (active.kind === "asset") {
            const source = active.asset.id === SCREEN_OVERLAY_ID
              ? undefined
              : active.asset.kind === "image" ? imagesRef.current.get(active.asset.id) : active.asset.kind === "video" ? videosRef.current.get(active.asset.id) : undefined;
            sourceWidth = active.asset.id === SCREEN_OVERLAY_ID ? screenSettingsRef.current?.width : source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : undefined;
            sourceHeight = active.asset.id === SCREEN_OVERLAY_ID ? screenSettingsRef.current?.height : source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : undefined;
            const currentStyleWindow = currentVideoStyleWindow();
            const currentStyleAssets = currentStyleWindow.assets;
            if (currentStyleAssets.some((asset) => asset.id === active.asset.id)) {
              const styleLayout = videoStyleLayout(videoStyleRef.current, outputCanvas.width, outputCanvas.height, currentStyleAssets.length, { offset: currentStyleWindow.offset, windowStart: currentStyleWindow.windowStart, total: currentStyleWindow.total });
              base = styleFocusBaseRect(styleLayout, active.asset, sourceWidth, sourceHeight);
              transformBounds = styleTransformBounds(styleLayout, active.asset);
            } else {
              base = baseAssetRect(outputCanvas.width, outputCanvas.height, active.asset, sourceWidth, sourceHeight);
              const currentLayers = visibleLayersForComposition(liveLayerIdsRef.current
                .map((id) => resolveLayer(id, assetsRef.current, scenesRef.current))
                .filter((layer): layer is StudioLayer => Boolean(layer)));
              const panelRatio = active.asset.placement === "left" || active.asset.placement === "right"
                ? cameraReflowPanelRatioForSide(currentLayers, active.asset.placement)
                : null;
              transformBounds = reflowAssetPanelRect(outputCanvas.width, outputCanvas.height, active.asset, panelRatio ?? undefined) ?? undefined;
            }
            rect = applyAssetTransform(outputCanvas.width, outputCanvas.height, base, active.asset.transform, transformBounds);
            currentTransform = active.asset.transform ?? {
              x: (rect.x + rect.width / 2) / outputCanvas.width,
              y: (rect.y + rect.height / 2) / outputCanvas.height,
              scale: 1
            };
          } else {
            const groupRect = sceneDisplayRect(outputCanvas.width, outputCanvas.height, active.scene);
            const memberBases = sceneMemberContentRects(active.scene, groupRect, active.assets, { images: imagesRef.current, videos: videosRef.current });
            const displayRects = sceneMemberDisplayRects(active.scene, groupRect, memberBases);
            const rectById = new Map(active.scene.memberIds.map((id, index) => [id, displayRects[index]]));
            const soloId = sceneSoloRef.current[active.scene.id];
            const eligibleOrder = (soloId ? [soloId] : sceneMemberDrawOrder(active.scene)).filter((id) => !completedVideoIdsRef.current.has(id));
            let targetId = sceneMemberTargetIdRef.current;
            if (targetId && (!active.scene.memberIds.includes(targetId) || completedVideoIdsRef.current.has(targetId) || (soloId && targetId !== soloId))) {
              manipulationTrackerRef.current.reset();
              targetId = null;
              sceneMemberTargetIdRef.current = null;
              sceneMemberMissSinceRef.current = null;
              setSceneMemberTargetId(null);
            }
            const trackerMode = manipulationTrackerRef.current.currentMode();
            const memberLocked = trackerMode === "dragging" || trackerMode === "scaling" || trackerMode === "arming-scale";
            const directTargetId = sceneMemberAtPalmCenter(
              eligibleOrder,
              rectById,
              directPalmPoints,
              outputCanvas.width,
              outputCanvas.height
            );
            if (directTargetId) sceneMemberMissSinceRef.current = null;
            if (!memberLocked) {
              if (directTargetId && directTargetId !== targetId) {
                manipulationTrackerRef.current.reset();
                targetId = directTargetId;
                sceneMemberTargetIdRef.current = directTargetId;
                setSceneMemberTargetId(directTargetId);
              } else if (!directTargetId && targetId) {
                if (sceneMemberMissSinceRef.current === null) sceneMemberMissSinceRef.current = now;
                if (now - sceneMemberMissSinceRef.current >= SCENE_MEMBER_SELECTION_GRACE_MS) {
                  manipulationTrackerRef.current.reset();
                  targetId = null;
                  sceneMemberTargetIdRef.current = null;
                  sceneMemberMissSinceRef.current = null;
                  setSceneMemberTargetId(null);
                }
              } else if (!targetId) {
                sceneMemberMissSinceRef.current = null;
              }
            }
            if (targetId) {
              const index = active.scene.memberIds.indexOf(targetId);
              const slot = memberBases[index];
              const targetRect = displayRects[index];
              if (slot && targetRect) {
                base = slot;
                rect = targetRect;
                currentTransform = sceneMemberCanvasTransform(
                  outputCanvas.width,
                  outputCanvas.height,
                  groupRect,
                  slot,
                  active.scene.memberTransforms?.[targetId]
                );
                sceneMemberContext = { memberId: targetId, groupRect };
              }
            } else {
              manipulationTrackerRef.current.reset();
            }
          }

          if (base && rect && currentTransform) {
            manipulationUpdate = manipulationTrackerRef.current.update(
              palmPoints,
              now,
              { x: rect.x / outputCanvas.width, y: rect.y / outputCanvas.height, width: rect.width / outputCanvas.width, height: rect.height / outputCanvas.height },
              currentTransform,
              movementPoints,
              directPalmPoints
            );
          }

          if (base && currentTransform && manipulationUpdate.transform) {
            const intendedTransform = manipulationUpdate.mode === "dragging"
              ? { ...manipulationUpdate.transform, rotation: currentTransform.rotation }
              : {
                  ...manipulationUpdate.transform,
                  x: currentTransform.x,
                  y: currentTransform.y,
                  rotation: currentTransform.rotation
                };
            const target = constrainAssetTransform(outputCanvas.width, outputCanvas.height, base, intendedTransform, transformBounds);
            const smoothing = manipulationFollowAlpha(currentTransform, target, manipulationUpdate.mode === "scaling");
            const smoothed = {
              x: currentTransform.x + (target.x - currentTransform.x) * smoothing,
              y: currentTransform.y + (target.y - currentTransform.y) * smoothing,
              scale: currentTransform.scale + (target.scale - currentTransform.scale) * smoothing,
              rotation: currentTransform.rotation
            };
            if (active.kind === "asset") commitAssetUpdates(active.asset.id, { transform: smoothed });
            else if (sceneMemberContext) {
              const relative = sceneMemberRelativeTransform(outputCanvas.width, outputCanvas.height, sceneMemberContext.groupRect, smoothed);
              const order = sceneMemberDrawOrder(active.scene).filter((id) => id !== sceneMemberContext!.memberId);
              order.push(sceneMemberContext.memberId);
              commitSceneUpdates(active.scene.id, {
                memberTransforms: { ...active.scene.memberTransforms, [sceneMemberContext.memberId]: relative },
                memberOrder: order
              });
            }
          }
          if (manipulationUpdate.ended) {
            sceneMemberTargetIdRef.current = null;
            sceneMemberMissSinceRef.current = null;
            setSceneMemberTargetId(null);
            manipulationGuardUntilRef.current = now + 650;
            gateRef.current.disarm(now);
            stabilizerRef.current.reset();
          }
        } else if (!active || pendingVoiceTarget) {
          manipulationTrackerRef.current.reset();
          sceneMemberTargetIdRef.current = null;
          sceneMemberMissSinceRef.current = null;
          setSceneMemberTargetId(null);
        }

        setManipulation((current) => current.mode === manipulationUpdate.mode && Math.abs(current.progress - manipulationUpdate.progress) < 0.06
          ? current
          : { mode: manipulationUpdate.mode, progress: manipulationUpdate.progress });

        const palmAvailableForCommand = palmPoints.length > 0
          && !swipeNavigationTriggered
          && manipulationUpdate.mode === "idle"
          && !manipulationUpdate.suppressActivation
          && now >= manipulationGuardUntilRef.current;
        const palmCommand = palmCommandTrackerRef.current.update(
          palmAvailableForCommand,
          now,
          260
        );
        if (palmAvailableForCommand) setOperatorShelfProgress(palmCommand.progress);
        else if (!operatorShelfOpenRef.current) setOperatorShelfProgress(0);
        const thumbDeckCommand = thumbDeckTrackerRef.current.update(
          stable.gesture === "thumb" && palmPoints.length === 0 && now >= manipulationGuardUntilRef.current,
          now,
          260
        );
        if (palmCommand.trigger && pendingVoiceTarget) {
          revealVoiceTargetRef.current(pendingVoiceTarget, "voice");
          gateRef.current.disarm(now);
        } else if (thumbDeckCommand.trigger && assetDeckModeRef.current === "command" && !assetDeckVisibleRef.current) {
          assetDeckVisibleRef.current = true;
          setAssetDeckVisible(true);
          setPhaseMessage("Media deck open — point at a visual");
        }

        const suppressActivation = stable.gesture === "thumb" || palmPoints.length > 0 || Boolean(deckEvent.trigger) || swipeNavigationTriggered || manipulationUpdate.suppressActivation || palmCommand.trigger || thumbDeckCommand.trigger || now < manipulationGuardUntilRef.current;
        event = suppressActivation
          ? gateRef.current.suppress()
          : gateRef.current.update(stable.gesture, now, stable.gesture !== "palm");
      }
      setHoldProgress((current) => {
        const boundaryChanged = (event.progress === 0 && current !== 0) || (event.progress === 1 && current !== 1);
        return !boundaryChanged && Math.abs(current - event.progress) < 0.07 ? current : event.progress;
      });
      setArmed(event.armed);
      if (event.hide) {
        if (activeLayerIdRef.current) hideLayer();
        else if (assetDeckModeRef.current === "command" && assetDeckVisibleRef.current) {
          assetDeckVisibleRef.current = false;
          setAssetDeckVisible(false);
          setPointFocus(null);
          pointFocusTrackerRef.current.update(null, now);
          setPhaseMessage("Media deck hidden — camera is full stage");
        }
      }
      else if (event.trigger === "double-fist") hideEverything();
      else if (event.trigger) activateGestureCue(event.trigger as GestureId);
    };

    const infer = async (now: number, source: HTMLVideoElement | VideoFrame = video) => {
      const sourceReady = "readyState" in source ? source.readyState >= 2 : source.displayWidth > 0 && source.displayHeight > 0;
      // Encoding is the priority during a take. Eight gesture samples per
      // second remains responsive while returning CPU/GPU time to H.264.
      const inferenceInterval = recordingRef.current ? 125 : 90;
      if (stopped || busy || now - lastInferenceAt < inferenceInterval || !sourceReady) return;
      busy = true;
      lastInferenceAt = now;
      try {
        context.drawImage(source, 0, 0, 640, 360);
        processResult(await recognizer.recognize(inferenceCanvas, now), now);
      } catch (error) {
        if (!stopped) console.error("Gesture inference frame failed", error);
      } finally {
        busy = false;
      }
    };

    const scheduleDisplayFrames = () => {
      if (stopped) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        frameCallbackId = video.requestVideoFrameCallback((now) => {
          scheduleDisplayFrames();
          void infer(now);
        });
      } else {
        animationId = requestAnimationFrame((now) => {
          scheduleDisplayFrames();
          void infer(now);
        });
      }
    };
    const startDisplaySchedule = () => {
      if (stopped || displayScheduleStarted) return;
      displayScheduleStarted = true;
      scheduleDisplayFrames();
    };

    if (Processor && cameraTrack) {
      processorTrack = cameraTrack.clone();
      processorReader = new Processor({ track: processorTrack, maxBufferSize: 1 }).readable.getReader();
      void (async () => {
        try {
          while (!stopped && processorReader) {
            const result = await processorReader.read();
            if (result.done) break;
            try {
              await infer(performance.now(), result.value);
            } finally {
              result.value.close();
            }
          }
          if (!stopped) startDisplaySchedule();
        } catch (error) {
          if (!stopped) {
            console.error("Gesture camera frame processing stopped", error);
            startDisplaySchedule();
          }
        }
      })();
    } else {
      startDisplaySchedule();
    }

    return () => {
      stopped = true;
      if (frameCallbackId !== null && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(frameCallbackId);
      if (animationId !== null) cancelAnimationFrame(animationId);
      void processorReader?.cancel().catch(() => undefined);
      processorTrack?.stop();
    };
  }, [activateStudioLayer, clearArmedVoiceTarget, commitAssetUpdates, commitSceneUpdates, diagnosticScenario, focusStageLayer, granted, hideEverything, hideLayer, navigateDirector, studioReady]);

  useEffect(() => {
    if (!isRecording) return;
    const started = Date.now();
    setRecordingSeconds(0);
    const timer = window.setInterval(() => setRecordingSeconds((current) => {
      const next = Math.floor((Date.now() - started) / 1000);
      return current === next ? current : next;
    }), 500);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (!studioReady) return;
    const timer = window.setInterval(() => {
      const next = readMicrophoneLevel(audioMixerRef.current);
      setMicrophoneLevel((current) => Math.abs(current - next) < 0.018 ? current : next);
    }, 300);
    return () => {
      window.clearInterval(timer);
      setMicrophoneLevel(0);
    };
  }, [studioReady]);

  const startRecording = async () => {
    const canvas = outputCanvasRef.current;
    if (!canvas || !granted || !studioReadyRef.current || recordingRef.current || isFinalizing) return;
    if (compositionDriver === "display") {
      setErrorMessage("This browser cannot keep composing while Rii-Flow is hidden. Keep this window visible during recording.");
    }
    gestureSequenceCursorRef.current = {};
    setActiveGestureCue(null);
    try {
      if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder is not available in this browser.");
      const mixer = audioMixerRef.current;
      if (mixer?.context.state === "suspended") {
        try {
          await Promise.race([
            mixer.context.resume(),
            new Promise<void>((resolve) => window.setTimeout(resolve, 350))
          ]);
        } catch {
          setErrorMessage("The audio mixer could not resume. Recording will use the microphone directly.");
        }
      }
      // A video may have started muted before Record because browsers do not
      // treat camera gestures as user activation. The Record click is a real
      // activation, so restore every currently visible video's recording route.
      const recordingVideoIds = new Set(liveLayerIdsRef.current.flatMap((layerId) => {
        const layer = resolveLayer(layerId, assetsRef.current, scenesRef.current);
        return layer ? layerAssetIds(layer) : [];
      }));
      recordingVideoIds.forEach((id) => {
        const video = videosRef.current.get(id);
        const asset = assetsRef.current.find((item) => item.id === id);
        if (!video || asset?.kind !== "video") return;
        video.muted = false;
        connectVideoAudio(mixer, id, video, Boolean(asset.includeAudio));
        setVideoAudioEnabled(mixer, id, Boolean(asset.includeAudio));
        if (video.paused) void video.play().catch(() => undefined);
      });
      setRecordingBytes(0);
      timelineEventsRef.current = [];
      setTimelineEvents([]);
      setSelectedDirectorEventId(null);
      setRecordingMime("");
      setRecordingSignature("");
      setIsFinalizing(false);
      captionCaptureRef.current = await startCaptionCapture(mixer).catch((error) => {
        setErrorMessage(error instanceof Error ? `Mic-only caption capture is unavailable: ${error.message}` : "Mic-only caption capture is unavailable for this take.");
        return null;
      });
      recordingChunksRef.current = [];
      recordingWriteRef.current = Promise.resolve();
      recordingWritableRef.current = null;
      recordingFileHandleRef.current = null;
      const temporaryStamp = new Date().toISOString().replace(/[:.]/g, "-");
      let fileName = takeFileName(`Recording ${temporaryStamp}`);
      const directory = recordingsDirectoryRef.current;
      if (directory) {
        const permission = await directoryPermission(directory, true);
        folderPermissionRef.current = permission;
        setFolderPermission(permission);
        if (permission === "granted") {
          fileName = await uniqueRecordingFileName(directory, fileName);
          const fileHandle = await directory.getFileHandle(fileName, { create: true });
          recordingFileHandleRef.current = fileHandle;
          recordingWritableRef.current = await fileHandle.createWritable();
        }
      }
      recordingFileNameRef.current = fileName;
      const audio = mixer?.context.state === "running" ? mixedAudioStream(mixer, audioStreamRef.current) : audioStreamRef.current;
      const stream = composedStream(canvas, Math.max(1, Math.round(activeFrameRate)), audio);
      recordingStreamRef.current = stream;
      setRecordingAudioTracks(stream.getAudioTracks().length);
      const mimeType = recordingMimeType();
      if (!mimeType) throw new Error("This browser cannot create MP4 recordings. Use a current version of Chrome or Edge with H.264 recording support.");
      const bitrate = bitrateForActual(canvas.width, canvas.height, activeFrameRate);
      const recorder = new MediaRecorder(stream, masterRecorderOptions(mimeType, bitrate));
      setRecordingMime(recorder.mimeType || mimeType);
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        const writable = recordingWritableRef.current;
        if (writable) {
          recordingWriteRef.current = recordingWriteRef.current
            .then(() => writable.write(event.data))
            .catch((error) => {
              setErrorMessage(error instanceof Error ? `Recording storage failed: ${error.message}` : "Recording storage failed.");
              stopRecordingRef.current();
            });
        } else {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setErrorMessage("Recording stopped because the browser encoder reported an error.");
        recordingRef.current = false;
        setIsRecording(false);
      };
      recorder.onstop = async () => {
        recordingRef.current = false;
        setIsRecording(false);
        setIsFinalizing(true);
        recordingStreamRef.current?.getVideoTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        try {
          let captionAudio = await captionCaptureRef.current?.stop() ?? null;
          captionCaptureRef.current = null;
          if (diagnostics && (!captionAudio || captionAudio.samples.length < 16000)) {
            const samples = new Int16Array(16000 * 2);
            for (let index = 0; index < samples.length; index += 1) samples[index] = Math.round(Math.sin(index / 18) * 1200);
            captionAudio = { sampleRate: 16000, samples };
          }
          await recordingWriteRef.current;
          let blob: Blob;
          const folderBacked = Boolean(recordingWritableRef.current && recordingFileHandleRef.current);
          if (recordingWritableRef.current && recordingFileHandleRef.current) {
            await recordingWritableRef.current.close();
            blob = await recordingFileHandleRef.current.getFile();
          } else {
            blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || mimeType });
          }
          recordingWritableRef.current = null;
          recordingFileHandleRef.current = null;
          const signature = new Uint8Array(await blob.slice(4, 8).arrayBuffer());
          setRecordingSignature(String.fromCharCode(...signature));
          setRecordingBytes(blob.size);
          if (!blob.size) throw new Error("The browser did not return recording data. Try another quality setting.");
          const url = URL.createObjectURL(blob);
          const finishedAt = Date.now();
          recordingUrlsRef.current.push(url);
          const take: RecordedClip = {
            id: `${finishedAt}-${blob.size}`,
            projectId: projectIdRef.current,
            projectName: projectName.trim() || "Untitled project",
            url,
            fileName: recordingFileNameRef.current,
            bytes: blob.size,
            durationSeconds: Math.max(1, Math.round((finishedAt - recordingStartedAtRef.current) / 1000)),
            createdAt: finishedAt,
            width: canvas.width,
            height: canvas.height,
            frameRate: activeFrameRate,
            bitrate,
            mimeType: recorder.mimeType || mimeType,
            folderBacked,
            rating: "neutral",
            captionAudioAvailable: Boolean(captionAudio?.samples.length),
            directorTrack: closeOpenDirectorEvents(timelineEventsRef.current, finishedAt - recordingStartedAtRef.current),
            availability: folderBacked ? "ready" : "session"
          };
          if (captionAudio?.samples.length) {
            captionAudioCacheRef.current.set(take.id, captionAudio);
            if (!diagnostics) await saveCaptionAudio(take.id, captionAudio.samples);
          }
          setRecordings((current) => [take, ...current]);
          if (folderBacked) await saveTake(take);
          setEditingTakeId(take.id);
          setEditingTakeName("");
        } catch (error) {
          try { await recordingWritableRef.current?.abort(); } catch { /* Best effort cleanup for a failed recording. */ }
          recordingWritableRef.current = null;
          recordingFileHandleRef.current = null;
          setErrorMessage(error instanceof Error ? error.message : "The recording could not be finalized.");
        } finally {
          setIsFinalizing(false);
        }
        const fallback = pendingFallbackRef.current;
        pendingFallbackRef.current = null;
        if (fallback) void switchCameraRef.current(fallback, qualityPreset(qualityRef.current));
      };
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      recorder.start(1_000);
      recordingRef.current = true;
      setIsRecording(true);
    } catch (error) {
      void captionCaptureRef.current?.stop();
      captionCaptureRef.current = null;
      setErrorMessage(error instanceof Error ? error.message : "Recording could not start.");
    }
  };

  const stopRecording = useCallback(() => {
    closeVisualTimelineEvent();
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.requestData();
      window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 150);
    }
  }, [closeVisualTimelineEvent]);

  useEffect(() => { stopRecordingRef.current = stopRecording; }, [stopRecording]);

  const handleCameraChange = async (deviceId: string) => {
    if (recordingRef.current) return;
    selectedCameraRef.current = deviceId;
    setSelectedCameraId(deviceId);
    if (!diagnostics) localStorage.setItem("gesture-studio-camera", deviceId);
    if (studioReadyRef.current) await switchCamera(deviceId, qualityPreset(qualityRef.current));
  };

  const handleMicrophoneChange = async (deviceId: string) => {
    if (recordingRef.current) return;
    if (studioReadyRef.current) {
      try {
        await switchMicrophone(deviceId);
      } catch {
        // switchMicrophone keeps the previous source active and reports the error.
      }
    } else {
      selectedMicrophoneRef.current = deviceId;
      setSelectedMicrophoneId(deviceId);
      if (!diagnostics) localStorage.setItem("gesture-studio-microphone", deviceId);
      setMicrophonePhase(deviceId === "none" ? "off" : "idle");
      setActiveMicrophoneLabel(deviceId === "none" ? "Microphone off" : "No active microphone");
    }
  };

  const toggleMediaMonitoring = () => {
    const next = !monitorMediaAudioRef.current;
    monitorMediaAudioRef.current = next;
    setMonitorMediaAudio(next);
    setMediaMonitoring(audioMixerRef.current, next);
    if (!diagnostics) localStorage.setItem("gesture-studio-monitor-media", String(next));
  };

  const handleQualityChange = async (id: QualityId) => {
    if (recordingRef.current) return;
    qualityRef.current = id;
    setQualityId(id);
    if (!diagnostics) localStorage.setItem("gesture-studio-quality", id);
    const preset = qualityPreset(id);
    if (studioReadyRef.current) await switchCamera(selectedCameraRef.current, preset);
    else syncStageOutputSize();
  };

  const handleAspectChange = (id: CanvasAspectId) => {
    if (recordingRef.current) return;
    aspectRef.current = id;
    setAspectId(id);
    syncStageOutputSize();
  };

  const handleResolutionChange = async (resolution: "720p" | "1080p" | "4k") => {
    const fps = qualityPreset(qualityRef.current).fps;
    const next: QualityId = resolution === "4k" ? "4k30" : `${resolution}${fps}` as QualityId;
    await handleQualityChange(next);
  };

  const handleFrameRateChange = async (fps: 30 | 60) => {
    const current = qualityPreset(qualityRef.current);
    const resolution = current.width >= 3_000 ? "4k" : current.width >= 1_700 ? "1080p" : "720p";
    const next: QualityId = resolution === "4k" ? "4k30" : `${resolution}${fps}` as QualityId;
    await handleQualityChange(next);
  };

  const toggleMirrorCamera = () => {
    if (recordingRef.current) return;
    const next = !mirrorCameraRef.current;
    mirrorCameraRef.current = next;
    setMirrorCamera(next);
    if (!diagnostics) localStorage.setItem("gesture-studio-mirror", String(next));
  };

  const applyStudioPreset = async () => {
    if (recordingRef.current || phaseRef.current === "switching") return;
    const preset = STUDIO_PRESETS.find((item) => item.id === studioPresetId) ?? STUDIO_PRESETS[0];
    handleAspectChange(preset.aspectId);
    if (qualityRef.current !== preset.qualityId) await handleQualityChange(preset.qualityId);
    mirrorCameraRef.current = preset.mirrorCamera;
    setMirrorCamera(preset.mirrorCamera);
    if (!diagnostics) localStorage.setItem("gesture-studio-mirror", String(preset.mirrorCamera));
    const nextAssets = applyPresetToAssets(assetsRef.current, preset);
    const nextScenes = applyPresetToScenes(scenesRef.current, preset);
    assetsRef.current = nextAssets;
    scenesRef.current = nextScenes;
    setAssets(nextAssets);
    setScenes(nextScenes);
    const nextScreenOverlay = { ...screenOverlayRef.current, ...preset.screenOverlay, transform: undefined };
    screenOverlayRef.current = nextScreenOverlay;
    setScreenOverlay(nextScreenOverlay);
    setCaptionStyle((current) => normalizeCaptionStyle({ ...current, ...preset.captionStyle }));
    setErrorMessage(null);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const imported: StudioAsset[] = [];
    setErrorMessage(null);
    for (const file of files) {
      try {
        const id = crypto.randomUUID();
        if (file.type.startsWith("image/")) {
          const sourceUrl = URL.createObjectURL(file);
          objectUrlsRef.current.push(sourceUrl);
          const image = await compositionImageFromBlob(file, sourceUrl, (url) => objectUrlsRef.current.push(url));
          imagesRef.current.set(id, image);
          imported.push({ id, name: file.name, kind: "image", sourceUrl: image.src, placement: "corner", size: "small", dataView: "table", stageBackground: "camera", stageBackgroundColor: "#111111", entranceAnimation: "fade", motionEffect: "none", cameraReflow: "overlay", cueSound: "none", cueVolume: 0.65, ...directorImportDefaults("image", assetsRef.current.length + imported.length, aspectRef.current) });
          if (!diagnostics && projectIdRef.current) await saveAssetBlob(projectIdRef.current, id, file);
        } else if (file.type.startsWith("video/")) {
          const sourceUrl = URL.createObjectURL(file);
          objectUrlsRef.current.push(sourceUrl);
          const overlayVideo = document.createElement("video");
          overlayVideo.src = sourceUrl;
          overlayVideo.muted = true;
          overlayVideo.loop = false;
          overlayVideo.playsInline = true;
          overlayVideo.preload = "auto";
          const duration = await videoMetadata(overlayVideo);
          videosRef.current.set(id, overlayVideo);
          if (audioMixerRef.current) {
            overlayVideo.muted = false;
            connectVideoAudio(audioMixerRef.current, id, overlayVideo, true);
          }
          imported.push({ id, name: file.name, kind: "video", sourceUrl, placement: "corner", size: "small", dataView: "table", includeAudio: true, videoPlayback: "once", mediaDuration: duration || undefined, stageBackground: "camera", stageBackgroundColor: "#111111", entranceAnimation: "fade", motionEffect: "none", cameraReflow: "overlay", cueSound: "none", cueVolume: 0.65, ...directorImportDefaults("video", assetsRef.current.length + imported.length, aspectRef.current) });
          if (!diagnostics && projectIdRef.current) await saveAssetBlob(projectIdRef.current, id, file);
        } else if (file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv") {
          imported.push({ id, name: file.name, kind: "csv", rows: parseCsv(await file.text()), placement: "lower", size: "small", dataView: "table", stageBackground: "camera", stageBackgroundColor: "#111111", entranceAnimation: "fade", motionEffect: "none", cameraReflow: "overlay", cueSound: "none", cueVolume: 0.65, ...directorImportDefaults("csv", assetsRef.current.length + imported.length, aspectRef.current) });
        } else if (file.name.toLowerCase().endsWith(".json") || file.type === "application/json") {
          imported.push({ id, name: file.name, kind: "json", rows: parseJson(await file.text()), placement: "lower", size: "small", dataView: "table", stageBackground: "camera", stageBackgroundColor: "#111111", entranceAnimation: "fade", motionEffect: "none", cameraReflow: "overlay", cueSound: "none", cueVolume: 0.65, ...directorImportDefaults("json", assetsRef.current.length + imported.length, aspectRef.current) });
        } else {
          throw new Error(`${file.name} is not a supported file.`);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : `Could not import ${file.name}.`);
      }
    }
    if (imported.length) {
      setAssets((current) => [...current, ...imported]);
    }
    event.target.value = "";
  };

  const updateAsset = (assetId: string, updates: Partial<StudioAsset>) => {
    setAssets((current) => {
      const next = current.map((asset) => asset.id === assetId ? { ...asset, ...updates } : asset);
      assetsRef.current = next;
      return next;
    });
  };

  /* Keyword assignment is desktop-only.
  const commitVoiceTrigger = (target: { id: string; kind: "asset" | "scene"; name: string }, value: string) => {
    const normalized = normalizeTriggerWord(value);
    const currentTargets = triggerTargets(assetsRef.current, scenesRef.current);
    const fallback = target.kind === "asset"
      ? suggestAssetTrigger(assetsRef.current.find((asset) => asset.id === target.id) ?? { name: target.name, kind: "image" }, new Set(currentTargets.filter((item) => item.id !== target.id).map((item) => item.triggerWord)))
      : suggestSceneTrigger(scenesRef.current.find((scene) => scene.id === target.id) ?? { name: target.name, memberIds: [] }, assetsRef.current, new Set(currentTargets.filter((item) => item.id !== target.id).map((item) => item.triggerWord)));
    const next = normalized || fallback;
    if (triggerCollision(next, target.id, currentTargets)) {
      setErrorMessage(`“${next}” already controls another visual. Choose a different word.`);
      return false;
    }
    setErrorMessage(null);
    if (target.kind === "asset") updateAsset(target.id, { triggerWord: next });
    else commitSceneUpdates(target.id, { triggerWord: next });
    return true;
  };
  */

  const chooseAssetDeckMode = (mode: AssetDeckMode) => {
    if (isRecording || isFinalizing) return;
    assetDeckModeRef.current = mode;
    setAssetDeckMode(mode);
    const visible = mode === "always";
    assetDeckVisibleRef.current = visible;
    setAssetDeckVisible(visible);
    assetDeckGateRef.current.reset();
    if (!visible && activeLayerIdRef.current && currentVideoStyleAssets().some((asset) => asset.id === activeLayerIdRef.current)) hideLayer();
  };

  const applySpawnStyle = (asset: StudioAsset, styleId: SpawnStyleId) => {
    const style = SPAWN_STYLES.find((item) => item.id === styleId);
    if (!style) return;
    const updates: Partial<StudioAsset> = { entranceAnimation: style.animation, cueSound: style.sound, cueVolume: 0.55 };
    if (asset.id === SCREEN_OVERLAY_ID) commitAssetUpdates(asset.id, updates);
    else updateAsset(asset.id, updates);
  };

  const openAssetEditor = (asset: StudioAsset) => {
    setAssetEditorId(asset.id);
    setAssetEditorPlayhead(asset.kind === "video" ? normalizeVideoTrim(asset.videoTrim, asset.mediaDuration ?? 0).start : 0);
  };

  const closeAssetEditor = () => {
    assetEditorVideoRef.current?.pause();
    setAssetEditorId(null);
    setAssetEditorPlayhead(0);
  };

  const updateAssetVideoTrim = (asset: StudioAsset, start: number, end: number, handle: "start" | "end") => {
    const editorDuration = assetEditorVideoRef.current?.duration;
    const duration = Number.isFinite(editorDuration) && editorDuration! > 0 ? editorDuration! : asset.mediaDuration ?? 0;
    if (!duration) return;
    const normalized = normalizeVideoTrim({ start, end }, duration);
    const videoTrim = hasVideoTrim(normalized, duration) ? normalized : undefined;
    updateAsset(asset.id, { mediaDuration: duration, videoTrim });
    const liveVideo = videosRef.current.get(asset.id);
    if (liveVideo && (liveVideo.currentTime < normalized.start || liveVideo.currentTime > normalized.end)) liveVideo.currentTime = normalized.start;
    const previewVideo = assetEditorVideoRef.current;
    if (previewVideo) {
      previewVideo.pause();
      const edgeTime = handle === "start" ? normalized.start : normalized.end;
      previewVideo.currentTime = Math.min(edgeTime, Math.max(0, duration - 0.001));
      setAssetEditorPlayhead(edgeTime);
    }
  };

  const seekAssetTimeline = (time: number) => {
    const video = assetEditorVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = Math.min(time, Math.max(0, assetEditorDuration - 0.001));
    }
    setAssetEditorPlayhead(time);
  };

  const previewAssetTrim = async (asset: StudioAsset) => {
    const video = assetEditorVideoRef.current;
    if (!video) return;
    const trim = normalizeVideoTrim(asset.videoTrim, video.duration);
    video.currentTime = trim.start;
    setAssetEditorPlayhead(trim.start);
    await video.play().catch(() => undefined);
  };

  const syncAssetEditorMetadata = (asset: StudioAsset, video: HTMLVideoElement) => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const trim = normalizeVideoTrim(asset.videoTrim, video.duration);
    updateAsset(asset.id, { mediaDuration: video.duration, videoTrim: hasVideoTrim(trim, video.duration) ? trim : undefined });
    setAssetEditorPlayhead(trim.start);
  };

  const syncAssetEditorPlayhead = (asset: StudioAsset, video: HTMLVideoElement) => {
    const trim = normalizeVideoTrim(asset.videoTrim, video.duration);
    if (!video.paused && video.currentTime >= trim.end) {
      video.pause();
      video.currentTime = trim.end;
    }
    setAssetEditorPlayhead(video.currentTime);
  };

  const updateImageCrop = (asset: StudioAsset, aspect: "original" | ImageCropAspect) => {
    const image = imagesRef.current.get(asset.id);
    const sourceWidth = image?.naturalWidth || 1;
    const sourceHeight = image?.naturalHeight || 1;
    updateAsset(asset.id, {
      imageCrop: aspect === "original"
        ? undefined
        : fitImageCropToAspect(aspect, sourceWidth, sourceHeight, asset.imageCrop)
    });
  };

  const toggleVideoAudio = (asset: StudioAsset) => {
    if (asset.kind !== "video") return;
    const enabled = !asset.includeAudio;
    updateAsset(asset.id, { includeAudio: enabled });
    const video = videosRef.current.get(asset.id);
    if (video && audioMixerRef.current) {
      video.muted = false;
      connectVideoAudio(audioMixerRef.current, asset.id, video, enabled);
      setVideoAudioEnabled(audioMixerRef.current, asset.id, enabled);
    }
  };

  const setVideoPlayback = (asset: StudioAsset, mode: VideoPlaybackMode) => {
    if (asset.kind !== "video") return;
    updateAsset(asset.id, { videoPlayback: mode });
    if (!completedVideoIdsRef.current.has(asset.id)) return;

    const nextCompleted = new Set(completedVideoIdsRef.current);
    nextCompleted.delete(asset.id);
    completedVideoIdsRef.current = nextCompleted;
    completedVideoVersionRef.current += 1;

    const ownerScene = scenesRef.current.find((scene) => scene.memberIds.includes(asset.id));
    const ownerLayerId = ownerScene ? sceneLayerId(ownerScene.id) : asset.id;
    if (!liveLayerIdsRef.current.includes(ownerLayerId)) return;
    const video = videosRef.current.get(asset.id);
    if (!video) return;
    const trim = normalizeVideoTrim(asset.videoTrim, asset.mediaDuration ?? video.duration);
    video.currentTime = trim.start;
    void video.play().catch(() => undefined);
    const visible = (!ownerScene || !sceneSoloRef.current[ownerScene.id] || sceneSoloRef.current[ownerScene.id] === asset.id)
      && !budgetHiddenAssetIdsRef.current.has(asset.id);
    setVideoAudioEnabled(audioMixerRef.current, asset.id, Boolean(visible && asset.includeAudio));
  };

  const toggleVideoPlayback = (asset: StudioAsset) => {
    setVideoPlayback(asset, normalizeVideoPlaybackMode(asset.videoPlayback) === "loop" ? "once" : "loop");
  };

  const toggleSceneDraftMember = (assetId: string) => {
    if (sceneDraftMembers.includes(assetId)) {
      setSceneDraftMembers(sceneDraftMembers.filter((id) => id !== assetId));
      setErrorMessage(null);
      return;
    }
    const candidate = [...sceneDraftMembers, assetId];
    const limitError = sceneMemberLimitError(candidate, assetsRef.current);
    if (limitError) {
      setErrorMessage(limitError);
      return;
    }
    setSceneDraftMembers(candidate);
    setErrorMessage(null);
  };

  const createScene = () => {
    const members = sceneDraftMembers.filter((id) => assetsRef.current.some((asset) => asset.id === id) && !scenesRef.current.some((scene) => scene.memberIds.includes(id)));
    if (members.length < 2) {
      setErrorMessage("Choose at least two unused assets for a collage scene.");
      return;
    }
    const limitError = sceneMemberLimitError(members, assetsRef.current);
    if (limitError) {
      setErrorMessage(limitError);
      return;
    }
    const creationPreset = STUDIO_PRESETS.find((item) => item.id === studioPresetId) ?? STUDIO_PRESETS[0];
    const scene: StudioScene = {
      id: crypto.randomUUID(),
      name: sceneDraftName.trim() || `Scene ${scenesRef.current.length + 1}`,
      memberIds: members,
      placement: "center",
      size: "full",
      ...creationPreset.sceneDefaults,
      layout: sceneDraftLayout,
      memberFocusModes: Object.fromEntries(members.map((id) => [id, "medium" as const]))
    };
    const memberSet = new Set(members);
    const nextAssets = assetsRef.current.map((asset) => memberSet.has(asset.id) ? { ...asset, gesture: undefined } : asset);
    const nextScenes = [...scenesRef.current, scene];
    assetsRef.current = nextAssets;
    scenesRef.current = nextScenes;
    setAssets(nextAssets);
    setScenes(nextScenes);
    setSceneDraftMembers([]);
    setSceneDraftName("New collage");
    setSceneBuilderOpen(false);
    setErrorMessage(null);
  };

  const removeScene = (scene: StudioScene) => {
    const layerId = sceneLayerId(scene.id);
    const nextScenes = scenesRef.current.filter((item) => item.id !== scene.id);
    let nextStack = removeLayer(liveLayerIdsRef.current, layerId);
    const nextSolo = { ...sceneSoloRef.current };
    delete nextSolo[scene.id];
    const nextCompleted = new Set(completedVideoIdsRef.current);
    let clearedCompletedVideo = false;
    scene.memberIds.forEach((id) => {
      if (nextCompleted.delete(id)) clearedCompletedVideo = true;
    });
    if (clearedCompletedVideo) {
      completedVideoIdsRef.current = nextCompleted;
      completedVideoVersionRef.current += 1;
    }
    scenesRef.current = nextScenes;
    sceneSoloRef.current = nextSolo;
    nextStack = enforceBudgetForStack(nextStack);
    const nextFocus = activeLayerIdRef.current === layerId || !nextStack.includes(activeLayerIdRef.current ?? "") ? nextStack.at(-1) ?? null : activeLayerIdRef.current;
    liveLayerIdsRef.current = nextStack;
    activeLayerIdRef.current = nextFocus;
    const nextActivationTimes = { ...layerActivationTimesRef.current };
    delete nextActivationTimes[layerId];
    layerActivationTimesRef.current = nextActivationTimes;
    setScenes(nextScenes);
    widgetsRef.current = widgetsRef.current.map((widget) => widget.kind === "orbit" ? { ...widget, sceneIds: (widget.sceneIds ?? []).filter((id) => id !== scene.id) } : widget);
    setWidgets(widgetsRef.current);
    setLiveLayerIds(nextStack);
    setActiveLayerId(nextFocus);
    setSceneSolo(nextSolo);
  };

  const assignSceneGesture = (sceneId: string, gesture: GestureId | undefined) => {
    if (gesture === "one") {
      setErrorMessage("One finger is reserved for pointing at scene assets.");
      return;
    }
    const scene = scenesRef.current.find((item) => item.id === sceneId);
    const previousGesture = scene?.gesture;
    setErrorMessage(null);
    commitSceneUpdates(sceneId, { gesture });
    gestureSequenceCursorRef.current = {
      ...gestureSequenceCursorRef.current,
      ...(previousGesture ? { [previousGesture]: 0 } : {}),
      ...(gesture ? { [gesture]: 0 } : {})
    };
    setActiveGestureCue(null);
  };

  function toggleSceneSolo(scene: StudioScene, assetId: string) {
    if (!liveLayerIdsRef.current.includes(sceneLayerId(scene.id))) return;
    if ((scene.memberFocusModes?.[assetId] ?? "medium") === "off") return;
    const current = sceneSoloRef.current[scene.id];
    const next = { ...sceneSoloRef.current };
    if (current === assetId) delete next[scene.id];
    else next[scene.id] = assetId;
    sceneSoloRef.current = next;
    setSceneSolo(next);
    const budgetedStack = enforceBudgetForStack(liveLayerIdsRef.current);
    liveLayerIdsRef.current = budgetedStack;
    setLiveLayerIds(budgetedStack);
    scene.memberIds.forEach((id) => {
      const asset = assetsRef.current.find((item) => item.id === id);
      const video = videosRef.current.get(id);
      const visible = (!next[scene.id] || next[scene.id] === id)
        && !completedVideoIdsRef.current.has(id)
        && !budgetHiddenAssetIdsRef.current.has(id);
      if (video) {
        if (visible) void video.play().catch(() => undefined);
        else video.pause();
      }
      setVideoAudioEnabled(audioMixerRef.current, id, Boolean(visible && asset?.includeAudio));
    });
  }

  const setSceneMemberFocusMode = (scene: StudioScene, assetId: string, mode: SceneMemberFocusMode) => {
    const memberFocusModes = { ...scene.memberFocusModes, [assetId]: mode };
    commitSceneUpdates(scene.id, { memberFocusModes });
    if (mode === "off" && sceneSoloRef.current[scene.id] === assetId) {
      const next = { ...sceneSoloRef.current };
      delete next[scene.id];
      sceneSoloRef.current = next;
      setSceneSolo(next);
      const budgetedStack = enforceBudgetForStack(liveLayerIdsRef.current);
      liveLayerIdsRef.current = budgetedStack;
      setLiveLayerIds(budgetedStack);
      if (activeLayerIdRef.current && !budgetedStack.includes(activeLayerIdRef.current)) {
        activeLayerIdRef.current = budgetedStack.at(-1) ?? null;
        setActiveLayerId(activeLayerIdRef.current);
      }
    }
  };

  const assignGesture = (assetId: string, gesture: GestureId | undefined) => {
    if (gesture === "one") {
      setErrorMessage("One finger is reserved for pointing at scene assets.");
      return;
    }
    const scene = scenesRef.current.find((item) => item.memberIds.includes(assetId));
    if (scene) {
      setErrorMessage(`${scene.name} owns the gesture for this asset.`);
      return;
    }
    const previousGesture = assetsRef.current.find((item) => item.id === assetId)?.gesture;
    setErrorMessage(null);
    updateAsset(assetId, { gesture });
    gestureSequenceCursorRef.current = {
      ...gestureSequenceCursorRef.current,
      ...(previousGesture ? { [previousGesture]: 0 } : {}),
      ...(gesture ? { [gesture]: 0 } : {})
    };
    setActiveGestureCue(null);
  };

  const setGestureSequenceMode = (gesture: GestureId, mode: GestureSequenceMode) => {
    const order = gestureSequenceLayerIds(gesture, assetsRef.current, scenesRef.current, gestureSequencesRef.current);
    const next = { ...gestureSequencesRef.current, [gesture]: { order, mode } };
    gestureSequencesRef.current = next;
    setGestureSequences(next);
  };

  const moveGestureSequenceCue = (gesture: GestureId, layerId: string, direction: -1 | 1) => {
    const next = reorderGestureCue(gesture, layerId, direction, assetsRef.current, scenesRef.current, gestureSequencesRef.current);
    gestureSequencesRef.current = next;
    gestureSequenceCursorRef.current = { ...gestureSequenceCursorRef.current, [gesture]: 0 };
    setGestureSequences(next);
    setActiveGestureCue(null);
  };

  const removeAsset = (asset: StudioAsset) => {
    if (asset.sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(asset.sourceUrl);
    imagesRef.current.delete(asset.id);
    videosRef.current.get(asset.id)?.pause();
    removeVideoAudio(audioMixerRef.current, asset.id);
    videosRef.current.delete(asset.id);
    if (completedVideoIdsRef.current.has(asset.id)) {
      const nextCompleted = new Set(completedVideoIdsRef.current);
      nextCompleted.delete(asset.id);
      completedVideoIdsRef.current = nextCompleted;
      completedVideoVersionRef.current += 1;
    }
    const remainingAssets = assetsRef.current.filter((item) => item.id !== asset.id);
    const sceneResult = removeAssetFromScenes(asset.id, scenesRef.current);
    let nextStack = removeLayer(liveLayerIdsRef.current, asset.id);
    sceneResult.removedSceneIds.forEach((id) => { nextStack = removeLayer(nextStack, sceneLayerId(id)); });
    const activeWasRemoved = activeLayerIdRef.current === asset.id
      || sceneResult.removedSceneIds.some((id) => activeLayerIdRef.current === sceneLayerId(id));
    assetsRef.current = remainingAssets;
    scenesRef.current = sceneResult.scenes;
    widgetsRef.current = widgetsRef.current.map((widget) => widget.actionAssetId === asset.id ? { ...widget, actionAssetId: undefined, active: false } : widget);
    nextStack = enforceBudgetForStack(nextStack);
    const nextFocus = activeWasRemoved || !nextStack.includes(activeLayerIdRef.current ?? "") ? nextStack[nextStack.length - 1] ?? null : activeLayerIdRef.current;
    liveLayerIdsRef.current = nextStack;
    activeLayerIdRef.current = nextFocus;
    const nextActivationTimes = { ...layerActivationTimesRef.current };
    delete nextActivationTimes[asset.id];
    sceneResult.removedSceneIds.forEach((id) => { delete nextActivationTimes[sceneLayerId(id)]; });
    layerActivationTimesRef.current = nextActivationTimes;
    setAssets(remainingAssets);
    setScenes(sceneResult.scenes);
    setWidgets(widgetsRef.current);
    setLiveLayerIds(nextStack);
    setActiveLayerId(nextFocus);
    if (!diagnostics && projectIdRef.current) void deleteAssetBlob(projectIdRef.current, asset.id);
    if (nextFocus !== activeLayerId) {
      manipulationTrackerRef.current.reset();
      palmSignalTrackerRef.current.reset();
      setManipulation({ mode: "idle", progress: 0 });
    }
  };

  const clearWorkspace = () => {
    if (isRecording || isFinalizing || (!assetsRef.current.length && !scenesRef.current.length && !widgetsRef.current.length)) return;
    if (!window.confirm("Clear every visual, scene, and sticker from this workspace? This cannot be undone.")) return;
    [...assetsRef.current].forEach(removeAsset);
    scenesRef.current = [];
    liveLayerIdsRef.current = [];
    activeLayerIdRef.current = null;
    gestureSequencesRef.current = {};
    assetDeckOffsetRef.current = 0;
    deckScrollControllerRef.current.reset();
    deckScrollEngagedRef.current = false;
    setScenes([]);
    setLiveLayerIds([]);
    setActiveLayerId(null);
    setGestureSequences({});
    setAssetDeckOffset(0);
    widgetAudioRef.current.forEach((audio, id) => { audio.pause(); removeVideoAudio(audioMixerRef.current, `widget:${id}`); URL.revokeObjectURL(audio.src); });
    widgetAudioRef.current.clear();
    widgetsRef.current = [];
    setWidgets([]);
    setSelectedWidgetId(null);
    setPointFocus(null);
    setSpotlight(null);
    setPhaseMessage("Workspace cleared — add media when you’re ready");
  };

  useEffect(() => {
    const protectActiveTake = (event: BeforeUnloadEvent) => {
      if (!recordingRef.current && !isFinalizing && !captionBusy) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectActiveTake);
    return () => window.removeEventListener("beforeunload", protectActiveTake);
  }, [captionBusy, isFinalizing]);

  useEffect(() => () => {
    if (outputAnimationRef.current !== null) cancelAnimationFrame(outputAnimationRef.current);
    stopMediaStream(cameraStreamRef.current);
    stopMediaStream(audioStreamRef.current);
    stopMediaStream(recordingStreamRef.current);
    void closeStudioAudioMixer(audioMixerRef.current);
    recognizerRef.current?.close();
    recordingUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
  }, []);

  const stageStateTitle = phase === "permission" ? "Allow camera access" : phase === "loading" ? "Starting gestures" : phase === "stopping" ? "Camera is stopping" : phase === "error" ? "Camera unavailable" : "Starting camera";
  const manipulationSubject = activeSceneMemberGeometry?.asset.name
    ? shortName(activeSceneMemberGeometry.asset.name, 18)
    : activeLayer?.kind;
  const pointerEditorGeometry = activeSceneMemberEditorGeometry ?? activeGeometry;
  const pointerEditorName = activeSceneMemberEditorGeometry?.asset.name ?? (activeLayer ? layerName(activeLayer) : "Asset");
  const manipulationHeadline = manipulationLabel(manipulation.mode, manipulationSubject);
  const previewTake = previewTakeId ? recordings.find((take) => take.id === previewTakeId) ?? null : null;
  const pendingDeleteTake = pendingDeleteTakeId ? recordings.find((take) => take.id === pendingDeleteTakeId) ?? null : null;
  const selectedStudioPreset = STUDIO_PRESETS.find((preset) => preset.id === studioPresetId) ?? STUDIO_PRESETS[0];
  const gestureSequenceCatalog = Object.fromEntries(GESTURES.map(({ id }) => [
    id,
    gestureSequenceLayerIds(id, assets, scenes, effectiveGestureSequences)
  ])) as Record<GestureId, string[]>;
  const gestureOptionLabel = (gesture: GestureId, layerId: string, currentGesture?: GestureId) => {
    const label = GESTURES.find((item) => item.id === gesture)?.label ?? gesture;
    const sequence = gestureSequenceCatalog[gesture];
    if (currentGesture === gesture && sequence.length > 1) return `${label} · cue ${sequence.indexOf(layerId) + 1}/${sequence.length}`;
    if (currentGesture !== gesture && sequence.length) return `${label} · add cue ${sequence.length + 1}`;
    return label;
  };
  const gestureCueGroups = ACTIVATION_GESTURES.map((gesture) => {
    const order = gestureSequenceCatalog[gesture.id];
    return {
      gesture,
      order,
      layers: order.map((id) => resolveLayer(id, assets, scenes)).filter((layer): layer is StudioLayer => Boolean(layer)),
      mode: effectiveGestureSequences[gesture.id]?.mode ?? "keep" as GestureSequenceMode
    };
  }).filter((group) => group.layers.length > 1);
  const focusCueSettings = (layerId: string) => {
    const card = document.getElementById(`library-layer-${layerId}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.focus({ preventScroll: true });
  };
  const screenCaptureSupported = diagnostics || Boolean(navigator.mediaDevices?.getDisplayMedia);
  const screenSurfaceName = screenSettings?.displaySurface === "browser"
    ? "Browser tab"
    : screenSettings?.displaySurface === "window"
    ? "Window"
    : screenSettings?.displaySurface === "monitor"
    ? "Display"
    : "Shared screen";
  const selectVideoStyle = (next: VideoStyleId) => {
    if (isRecording || isFinalizing) return;
    const defaultPlacement = defaultDeckPlacement(next);
    // Selecting a template always restores that template's true default,
    // including when the same template was already active with a stale slider.
    deckPlacementRef.current = defaultPlacement;
    setDeckPlacement(defaultPlacement);
    if (next === videoStyleId) return;
    if (activeLayerIdRef.current) hideLayer();
    if (next === "spatial" || next === "split-decks") {
      deckScrollControllerRef.current.reset();
      deckScrollEngagedRef.current = false;
      deckFlickCandidateRef.current = null;
      assetDeckOffsetRef.current = 0;
      setAssetDeckOffset(0);
    }
    setVideoStyleId(next);
  };
  const createCanvasWidget = (kind: CanvasWidgetKind, position = { x: .5, y: .5 }, sceneId?: string) => {
    const existing = widgetsRef.current.find((widget) => widget.kind === kind && (kind !== "orbit"
      || (sceneId ? widget.sceneIds?.includes(sceneId) : !(widget.sceneIds?.length))));
    if (existing) {
      updateCanvasWidget(existing.id, {
        visible: true,
        ...(kind === "orbit" && !(existing.assetIds?.length) ? { assetIds: assetsRef.current.filter((asset) => asset.kind !== "text").map((asset) => asset.id) } : {})
      });
      setSelectedWidgetId(existing.id);
      setWidgetPanelOpen(true);
      setWidgetPanelMode("settings");
      setPhaseMessage(`${existing.title} shown`);
      return;
    }
    const widget: CanvasWidget = {
      id: crypto.randomUUID(),
      kind,
      x: Math.min(.88, Math.max(.12, position.x)),
      y: Math.min(.84, Math.max(.16, position.y)),
      scale: 1,
      title: kind === "bullets" ? "Talking points" : kind === "vinyl" ? "Background music" : kind === "orbit" ? (sceneId ? scenesRef.current.find((scene) => scene.id === sceneId)?.name ?? "Scene files" : "Media files") : kind === "live" ? "Live stream" : kind === "media" ? "Media launcher" : "Action sticker",
      items: kind === "bullets" ? ["First idea", "Second idea", "Third idea"] : [],
      revealed: kind === "bullets" ? 3 : 0,
      sticker: "star",
      volume: kind === "vinyl" ? .8 : undefined,
      assetIds: kind === "orbit" ? (sceneId ? [] : assetsRef.current.filter((asset) => asset.kind !== "text").map((asset) => asset.id)) : undefined,
      sceneIds: kind === "orbit" && sceneId ? [sceneId] : undefined,
      actionAssetId: kind === "media" ? assetsRef.current.find((asset) => asset.kind === "image" || asset.kind === "video")?.id : undefined,
      open: false,
      orbitOffset: 0,
      visible: true
    };
    setWidgets((current) => [...current, widget]);
    widgetsRef.current = [...widgetsRef.current, widget];
    setSelectedWidgetId(widget.id);
    setWidgetPanelOpen(true);
    setWidgetPanelMode("settings");
  };
  const updateCanvasWidget = (id: string, updates: Partial<CanvasWidget>) => {
    widgetsRef.current = widgetsRef.current.map((widget) => widget.id === id ? { ...widget, ...updates } : widget);
    setWidgets((current) => current.map((widget) => widget.id === id ? { ...widget, ...updates } : widget));
  };
  const beginWidgetPointerEdit = (event: ReactPointerEvent<HTMLElement>, widget: CanvasWidget, mode: "drag" | "scale") => {
    if (isRecording || isFinalizing || widget.kind === "live") return;
    const stage = event.currentTarget.closest(".stage-wrap") as HTMLElement | null;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    widgetPointerEditRef.current = {
      pointerId: event.pointerId,
      mode,
      widgetId: widget.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      stageWidth: bounds.width,
      stageHeight: bounds.height,
      initial: { x: widget.x, y: widget.y, scale: widget.scale },
      moved: false
    };
    event.preventDefault();
  };
  const moveWidgetPointerEdit = (event: ReactPointerEvent<HTMLElement>) => {
    const session = widgetPointerEditRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const widget = widgetsRef.current.find((candidate) => candidate.id === session.widgetId);
    if (!widget) return;
    const dx = (event.clientX - session.startClientX) / Math.max(1, session.stageWidth);
    const dy = (event.clientY - session.startClientY) / Math.max(1, session.stageHeight);
    if (Math.hypot(event.clientX - session.startClientX, event.clientY - session.startClientY) > 3) session.moved = true;
    const scale = session.mode === "scale" ? Math.min(3, Math.max(.35, session.initial.scale + (dx + dy) * 1.8)) : session.initial.scale;
    const probe = widgetRect({ ...widget, scale }, outputSize.width, outputSize.height);
    const halfX = Math.min(.48, probe.width / outputSize.width / 2);
    const halfY = Math.min(.48, probe.height / outputSize.height / 2);
    updateCanvasWidget(widget.id, {
      scale,
      x: session.mode === "drag" ? Math.min(1 - halfX, Math.max(halfX, session.initial.x + dx)) : Math.min(1 - halfX, Math.max(halfX, widget.x)),
      y: session.mode === "drag" ? Math.min(1 - halfY, Math.max(halfY, session.initial.y + dy)) : Math.min(1 - halfY, Math.max(halfY, widget.y))
    });
    event.preventDefault();
  };
  const endWidgetPointerEdit = (event: ReactPointerEvent<HTMLElement>) => {
    const session = widgetPointerEditRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    widgetPointerEditRef.current = null;
    if (session.moved) suppressStageClickUntilRef.current = performance.now() + 160;
  };
  const removeCanvasWidget = (widget: CanvasWidget) => {
    const audio = widgetAudioRef.current.get(widget.id);
    if (audio) {
      audio.pause();
      removeVideoAudio(audioMixerRef.current, `widget:${widget.id}`);
      if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
      widgetAudioRef.current.delete(widget.id);
    }
    widgetsRef.current = widgetsRef.current.filter((item) => item.id !== widget.id);
    setWidgets((current) => current.filter((item) => item.id !== widget.id));
    if (selectedWidgetId === widget.id) setSelectedWidgetId(null);
    setWidgetPanelMode("stickers");
    setPhaseMessage(`${widget.title} removed`);
  };
  const activateCanvasWidget = (widget: CanvasWidget) => {
    setSelectedWidgetId(widget.id);
    if (widget.kind === "vinyl") {
      const audio = widgetAudioRef.current.get(widget.id);
      if (!audio) { widgetAudioInputRef.current?.click(); return; }
      audio.volume = Math.min(1, Math.max(0, widget.volume ?? .8));
      if (audio.paused) void ensureAudioMixer().then(async (mixer) => {
        if (mixer) {
          connectVideoAudio(mixer, `widget:${widget.id}`, audio, true, true);
          if (mixer.context.state === "suspended") await mixer.context.resume();
        }
        await audio.play();
        updateCanvasWidget(widget.id, { playing: true });
      }).catch(() => setPhaseMessage("Music could not start — try pointing again"));
      else { audio.pause(); updateCanvasWidget(widget.id, { playing: false }); }
    } else if (widget.kind === "orbit") {
      const assigned = widget.assetIds ?? assetsRef.current.filter((asset) => asset.kind !== "text").map((asset) => asset.id);
      const assignedScenes = (widget.sceneIds ?? []).filter((id) => scenesRef.current.some((scene) => scene.id === id));
      const totalAssigned = assigned.length + assignedScenes.length;
      if (totalAssigned === 1 && assigned.length === 1) {
        const asset = assetsRef.current.find((candidate) => candidate.id === assigned[0]);
        updateCanvasWidget(widget.id, { open: false, assetIds: assigned, sceneIds: assignedScenes });
        if (asset) focusVideoStyleAssetRef.current(asset);
        setPhaseMessage(asset ? `${asset.name} opened from orbit` : "The orbit asset is unavailable");
      } else if (totalAssigned === 1 && assignedScenes.length === 1) {
        const scene = scenesRef.current.find((candidate) => candidate.id === assignedScenes[0]);
        updateCanvasWidget(widget.id, { open: false, assetIds: assigned, sceneIds: assignedScenes });
        const layer = scene ? resolveLayer(sceneLayerId(scene.id), assetsRef.current, scenesRef.current) : null;
        if (layer) activateStudioLayerRef.current(layer);
        setPhaseMessage(scene ? `${scene.name} opened from files` : "The scene is unavailable");
      } else {
        const opening = totalAssigned > 1 && !widget.open;
        updateCanvasWidget(widget.id, { open: opening, openedAt: opening ? performance.now() : undefined, assetIds: assigned, sceneIds: assignedScenes });
        if (!totalAssigned) setPhaseMessage("Add media or scenes before opening the orbit");
        else setPhaseMessage(widget.open ? "Media orbit closed" : "Media orbit open — point at a card");
      }
      pointFocusTrackerRef.current.reset();
      widgetPointTrackerRef.current.reset();
    } else if (widget.kind === "media") {
      const asset = assetsRef.current.find((candidate) => candidate.id === widget.actionAssetId && (candidate.kind === "image" || candidate.kind === "video"));
      if (!asset) {
        setPhaseMessage("Choose one photo or video in the media launcher settings first");
        return;
      }
      const opening = !widget.active || activeLayerIdRef.current !== asset.id;
      widgetsRef.current = widgetsRef.current.map((candidate) => candidate.kind === "media" ? { ...candidate, active: candidate.id === widget.id && opening } : candidate);
      setWidgets(widgetsRef.current);
      if (opening) {
        focusVideoStyleAssetRef.current(asset);
        setPhaseMessage(`${asset.name} is full screen — camera moved to the bottom right`);
      } else {
        hideLayer();
        setPhaseMessage("Media launcher closed");
      }
    } else if (widget.kind === "live") {
      if (screenSettingsRef.current) focusVideoStyleAssetRef.current(screenOverlayAsset(screenSettingsRef.current, screenOverlayRef.current));
      else setPhaseMessage("Choose a live screen or stream in the widget settings first");
    } else if (widget.kind === "bullets") {
      const next = widget.revealed >= widget.items.length ? 1 : widget.revealed + 1;
      updateCanvasWidget(widget.id, { revealed: next });
    } else if (widget.actionAssetId) {
      const asset = assetsRef.current.find((candidate) => candidate.id === widget.actionAssetId);
      if (asset) focusVideoStyleAssetRef.current(asset);
    }
  };
  activateWidgetRef.current = activateCanvasWidget;
  const selectedWidget = widgets.find((widget) => widget.id === selectedWidgetId) ?? null;
  const selectedWidgetRect = selectedWidget?.visible && selectedWidget.kind !== "live" ? widgetRect(selectedWidget, outputSize.width, outputSize.height) : null;
  const importWidgetAudio = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedWidget || selectedWidget.kind !== "vinyl") return;
    const previous = widgetAudioRef.current.get(selectedWidget.id);
    if (previous) { previous.pause(); removeVideoAudio(audioMixerRef.current, `widget:${selectedWidget.id}`); URL.revokeObjectURL(previous.src); }
    const audio = new Audio(URL.createObjectURL(file));
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = Math.min(1, Math.max(0, selectedWidget.volume ?? .8));
    widgetAudioRef.current.set(selectedWidget.id, audio);
    void ensureAudioMixer().then((mixer) => {
      connectVideoAudio(mixer, `widget:${selectedWidget.id}`, audio, true, true);
      setPhaseMessage(`${file.name} ready — point at the vinyl to play`);
    });
    updateCanvasWidget(selectedWidget.id, { audioName: file.name, playing: false });
    event.target.value = "";
  };
  const openTimelineEnd = isRecording ? recordingSeconds * 1000 : 0;
  const timelineDurationMs = Math.max(
    10_000,
    openTimelineEnd + 1_000,
    ...timelineEvents.map((event) => (event.endMs ?? openTimelineEnd) + 1_000)
  );
  const selectedDirectorEvent = selectedDirectorEventId ? timelineEvents.find((event) => event.id === selectedDirectorEventId) ?? null : null;
  const commitDirectorTrack = (next: VisualTimelineEvent[]) => {
    timelineEventsRef.current = next;
    setTimelineEvents(next);
    if (recordingRef.current) return;
    setRecordings((current) => {
      if (!current.length) return current;
      const [latest, ...rest] = current;
      const updated = { ...latest, directorTrack: next };
      if (updated.folderBacked) void saveTake(updated);
      return [updated, ...rest];
    });
  };
  const nudgeSelectedDirectorEvent = (deltaMs: number) => {
    if (!selectedDirectorEventId || isRecording) return;
    commitDirectorTrack(nudgeDirectorEvent(timelineEventsRef.current, selectedDirectorEventId, deltaMs));
  };
  const removeSelectedDirectorEvent = () => {
    if (!selectedDirectorEventId || isRecording) return;
    commitDirectorTrack(removeDirectorEvent(timelineEventsRef.current, selectedDirectorEventId));
    setSelectedDirectorEventId(null);
  };
  const undoLastDirectorAction = () => {
    const last = timelineEventsRef.current.at(-1);
    if (!last) return;
    if (activeLayerIdRef.current === last.assetId) hideLayer();
    const next = removeDirectorEvent(timelineEventsRef.current, last.id);
    commitDirectorTrack(next);
    setSelectedDirectorEventId(next.at(-1)?.id ?? null);
    setPhaseMessage(`Undid ${last.label}`);
  };

  if (welcomeOpen) return (
    <main className="rii-welcome" data-theme={themeMode}>
      <input ref={fileInputRef} data-testid="welcome-asset-input" className="visually-hidden" type="file" multiple accept="image/*,video/*,.csv,text/csv,.json,application/json" onChange={(event) => { void handleImport(event); setWelcomeOpen(false); setTutorialStep(0); setTutorialOpen(true); }} />
      <div className="rii-welcome-motion" aria-hidden="true">
        <span className="motion-point"><i /> POINT</span>
        <span className="motion-focus"><i /> FOCUS</span>
        <span className="motion-flick"><i /> FLICK</span>
        <span className="motion-record"><i /> RECORD</span>
      </div>
      <section>
        <div className="rii-welcome-logo"><Hand size={34} /></div>
        <span className="rii-welcome-wordmark">Rii-Flow</span>
        <h1>Welcome to Rii-Flow</h1>
        <p>Create videos that respond to you.</p>
        <button className="rii-welcome-import" onClick={() => fileInputRef.current?.click()}><Upload size={20} /> Import media</button>
        <button className="rii-welcome-empty" onClick={() => { setWelcomeOpen(false); setTutorialStep(0); setTutorialOpen(true); }}>Enter studio without media</button>
        <div><span><Hand size={15} /> Present naturally</span><span><Sparkles size={15} /> Direct visuals live</span><span><Video size={15} /> Record everything</span></div>
      </section>
    </main>
  );

  return (
    <main
      className={`app-shell video-style-studio ${isRecording ? "presentation-recording" : ""}`}
      data-workflow-step="studio"
      data-tutorial-target={tutorialOpen ? TUTORIAL_STEPS[tutorialStep].target : "none"}
      data-more-options={simpleExtrasOpen ? "open" : "closed"}
      data-theme={themeMode}
      data-recognizer-generation={recognizerGeneration}
      data-camera-switches={cameraSwitches}
      data-old-track-stopped={oldTrackStopped}
      data-recording-bytes={recordingBytes}
      data-recording-count={recordings.length}
      data-recording-audio-tracks={recordingAudioTracks}
      data-recording-bitrate={actualBitrate}
      data-recording-mime={recordingMime}
      data-recording-signature={recordingSignature}
      data-microphone-phase={microphonePhase}
      data-microphone-level={microphoneLevel.toFixed(3)}
      data-audio-context-state={audioMixerRef.current?.context.state ?? "unavailable"}
      data-manipulation-mode={manipulation.mode}
      data-detected-gesture={detected.gesture ?? "none"}
      data-gesture-armed={armed}
      data-hold-progress={holdProgress.toFixed(3)}
      data-gesture-hold-ms={timing.holdMs}
      data-gesture-cooldown-ms={timing.cooldownMs}
      data-gesture-sequence={activeGestureCue?.gesture ?? "none"}
      data-gesture-cue-index={activeGestureCue ? activeGestureCue.index + 1 : 0}
      data-gesture-cue-total={activeGestureCue?.total ?? 0}
      data-live-layer-count={liveLayers.length}
      data-live-layer-ids={liveLayerIds.join(",")}
      data-active-layer-id={activeLayerId ?? "none"}
      data-active-layer-kind={activeLayer?.kind ?? "none"}
      data-active-entrance={activeAsset?.entranceAnimation ?? activeScene?.entranceAnimation ?? "none"}
      data-active-cue-sound={activeAsset?.cueSound ?? activeScene?.cueSound ?? "none"}
      data-active-motion={activeAsset?.motionEffect ?? activeScene?.motionEffect ?? "none"}
      data-active-scale={activeAsset?.transform?.scale ?? activeScene?.transform?.scale ?? 1}
      data-active-size={activeAsset?.size ?? activeScene?.size ?? ""}
      data-active-x={activeAsset?.transform?.x ?? activeScene?.transform?.x ?? ""}
      data-active-y={activeAsset?.transform?.y ?? activeScene?.transform?.y ?? ""}
      data-scene-count={scenes.length}
      data-active-scene-reveal={activeScene?.revealSide ?? "none"}
      data-scene-solo={activeSceneSoloId ?? "none"}
      data-scene-member-target={focusedSceneMemberId ?? "none"}
      data-scene-member-selected={selectedSceneMemberId ?? "none"}
      data-scene-member-scale={activeScene && focusedSceneMemberId ? activeScene.memberTransforms?.[focusedSceneMemberId]?.scale ?? 1 : 1}
      data-caption-status={captionStatus}
      data-caption-segments={captionSegments.length}
      data-caption-source={finishTake?.captionAudioAvailable ? "microphone-only" : "none"}
      data-caption-position={captionStyle.position}
      data-caption-anchor-x={captionStyle.anchorX.toFixed(3)}
      data-caption-anchor-y={captionStyle.anchorY.toFixed(3)}
      data-word-animation-cues={wordAnimationCues.length}
      data-morph-gesture-progress={morphGestureProgress.toFixed(3)}
      data-morph-exit-asset={morphExitAssetId ?? "none"}
      data-inference-mode={inferenceMode}
      data-inference-latency={inferenceLatency}
      data-composition-fps={compositionStats.fps}
      data-compose-ms={compositionStats.averageMs.toFixed(1)}
      data-compose-budget={compositionStats.budgetPercent}
      data-over-budget-frames={compositionStats.overBudgetFrames}
      data-canvas-aspect={aspectId}
      data-canvas-width={outputSize.width}
      data-canvas-height={outputSize.height}
      data-camera-mirrored={mirrorCamera}
      data-camera-frame-mode={cameraFrame.enabled ? cameraFrame.mode : "off"}
      data-camera-frame-enabled={cameraFrame.enabled}
      data-camera-frame-size={cameraFrame.sizePercent}
      data-camera-frame-color={cameraFrameColor(cameraFrame)}
      data-camera-reflow-layer={cameraReflowFrameRef.current.target?.layerId ?? "none"}
      data-camera-reflow-side={cameraReflowFrameRef.current.target?.assetSide ?? "none"}
      data-camera-reflow-width={cameraReflowFrameRef.current.width.toFixed(3)}
      data-screen-overlay={screenSettings && screenOverlay.visible ? "visible" : "hidden"}
      data-screen-overlay-placement={screenOverlay.placement}
      data-screen-overlay-size={screenOverlay.size}
      data-screen-overlay-x={screenOverlay.transform?.x ?? ""}
      data-screen-overlay-y={screenOverlay.transform?.y ?? ""}
      data-screen-overlay-scale={screenOverlay.transform?.scale ?? 1}
      data-screen-phase={screenPhase}
      data-screen-audio={screenSettings?.hasAudio ? "included" : "none"}
      data-screen-width={screenSettings?.width ?? 0}
      data-screen-height={screenSettings?.height ?? 0}
      data-asset-deck-mode={assetDeckMode}
      data-asset-deck-visible={assetDeckVisible}
      data-voice-target-count={voiceTriggerTargets.length}
      data-voice-armed-target={armedVoiceTarget?.id ?? "none"}
      data-voice-armed-source={armedVoiceTarget?.source ?? "none"}
      data-intent-current={intentQueue[0]?.conceptId ?? "none"}
      data-intent-confirmable={intentQueue[0]?.confirmable ?? false}
      data-intent-count={intentQueue.length}
      data-confirm-feedback={confirmFeedback || "none"}
      data-operator-shelf={operatorShelfOpen ? "open" : "closed"}
      data-operator-shelf-target={operatorShelfTargetId ?? "none"}
      data-shelf-point-carryover={shelfPointCarryoverRef.current}
      data-spotlight-target={spotlight?.sceneMemberId ?? spotlight?.layerId ?? "none"}
      data-spotlight-progress={spotlight?.progress.toFixed(3) ?? "0"}
      data-style-screen-asset={styleAssets.some((asset) => asset.id === SCREEN_OVERLAY_ID)}
      data-stage-frame-rate={activeFrameRate}
      data-composition-driver={compositionDriver}
      data-stage-background={stageBackdropForLayers(liveLayers).mode}
      data-project-id={projectId}
      data-project-save-state={projectSaveState}
      data-project-takes={recordings.length}
      data-studio-preset={studioPresetId}
      data-live-visual-limit={MAX_LIVE_VISUALS}
      data-live-moving-limit={MAX_LIVE_MOVING_SOURCES}
      data-budget-hidden-assets={[...budgetHiddenAssetIdsRef.current].join(",")}
      data-point-focus-target={pointFocus?.targetName ?? "none"}
      data-point-focus-progress={pointFocus?.progress.toFixed(3) ?? "0"}
      data-workspace-assets={assets.length}
      data-workspace-scenes={scenes.length}
      data-director-cue-count={directorQueue.length}
      data-director-cursor={directorCurrentIndex}
      data-director-current={activeLayerId ?? "hidden"}
      data-director-focused-asset={directorFocusedAssetId ?? "none"}
      data-trigger-hand="any"
      data-movement-reach="comfort"
      data-recording-finalizing={isFinalizing}
      data-recording-folder={folderPermission === "granted" ? recordingsDirectory?.name ?? "connected" : "session"}
      data-video-style={videoStyleId}
      data-video-style-runtime={videoStyleRef.current}
      data-video-style-assets={styleAssets.length}
      data-video-style-focus={activeAsset && styleAssets.some((asset) => asset.id === activeAsset.id) ? activeAsset.id : "gallery"}
      data-video-style-constrained={currentStyleLayout.constrainedFocus}
      data-timeline-events={timelineEvents.length}
    >
      <div className="studio-grid">
        <aside className="library-panel" aria-label="Media library">
          <div className="app-brand"><div className="app-logo"><Hand size={18} /></div><span><h1>Rii-Flow</h1><small>Your story, directed live</small></span><button className="theme-toggle" aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} theme`} title={`Use ${themeMode === "dark" ? "light" : "dark"} theme`} aria-pressed={themeMode === "dark"} onClick={() => setThemeMode((current) => current === "dark" ? "light" : "dark")}>{themeMode === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button></div>
          <section className="studio-preset-bar" aria-label="Studio preset">
            <span className="studio-preset-icon"><Sparkles size={17} /></span>
            <label>
              <small>Quick setup</small>
              <div className="select-box full">
                <select
                  data-testid="studio-preset-select"
                  aria-label="Studio preset"
                  value={studioPresetId}
                  disabled={isRecording || isFinalizing}
                  onChange={(event) => {
                    const next = event.target.value as StudioPresetId;
                    setStudioPresetId(next);
                    localStorage.setItem("rii-flow-studio-preset", next);
                  }}
                >
                  {STUDIO_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
                <ChevronDown size={15} />
              </div>
              <em>{selectedStudioPreset.detail}</em>
            </label>
            <button data-testid="apply-studio-preset" disabled={isRecording || isFinalizing || phase === "switching"} onClick={() => void applyStudioPreset()}>Apply</button>
          </section>
          <div className="panel-title"><div><span>Tell it in this order</span><h2>Story beats</h2></div><b>{directorQueue.length}</b></div>
          <input ref={fileInputRef} data-testid="asset-input" className="visually-hidden" type="file" multiple accept="image/*,video/*,.csv,text/csv,.json,application/json" onChange={handleImport} />
          <div className="library-actions">
            <button className="import-control" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Import media</button>
            <button className="scene-control" aria-expanded={sceneBuilderOpen} aria-controls="scene-builder-dialog" onClick={() => setSceneBuilderOpen(true)}>
              <span className="scene-control-icon"><LayoutGrid size={20} /></span>
              <span className="scene-control-copy"><strong>Make a layout</strong><small>Combine up to five visuals</small></span>
              <Plus size={18} />
            </button>
          </div>
          <p className="support-copy">Images, videos, CSV, and JSON</p>

          <section className="director-panel" aria-label="Live Director story queue">
            <header className="director-heading">
              <span><Radio size={17} /></span>
              <div><small>Live Director</small><strong>Your story, in order</strong></div>
              <b>{directorQueue.length}</b>
            </header>

            {directorQueue.length === 0 ? (
              <button className="director-empty" onClick={() => fileInputRef.current?.click()}>
                <span><Upload size={20} /></span>
                <strong>Drop in your story beats</strong>
                <small>Rii-Flow builds the live sequence automatically.</small>
              </button>
            ) : (
              <>
                <div className="director-now-next" aria-live="polite">
                  <div className={directorCueLive ? "live" : "ready"}>
                    <small>{directorCueLive ? "On stage" : "Ready"}</small>
                    <strong>{shortName(layerName(directorCurrentCue as StudioLayer), 22)}</strong>
                  </div>
                  <ArrowDown size={15} />
                  <div>
                    <small>Up next</small>
                    <strong>{directorNextCue && directorNextCue.id !== directorCurrentCue?.id ? shortName(layerName(directorNextCue), 22) : "End of story"}</strong>
                  </div>
                </div>

                <ol className="director-queue">
                  {directorQueue.map((layer, index) => {
                    const isCurrent = index === directorCurrentIndex;
                    const isLive = activeLayerId === layer.id;
                    return (
                      <li key={layer.id} className={`${isCurrent ? "current" : ""} ${isLive ? "live" : ""}`}>
                        <button className="director-cue-main" aria-label={`${isLive ? "Live" : "Show"} ${layerName(layer)}`} onClick={() => void activateLayerFromLibrary(layer)}>
                          <b>{String(index + 1).padStart(2, "0")}</b>
                          <i className={`director-cue-thumb ${layer.kind}`}>
                            {layer.kind === "asset"
                              ? layer.asset.kind === "image" ? <img src={layer.asset.sourceUrl} alt="" /> : layer.asset.kind === "video" ? <video src={layer.asset.sourceUrl} muted playsInline preload="metadata" aria-hidden="true" /> : layer.asset.kind === "csv" ? <FileSpreadsheet size={19} /> : <FileJson2 size={19} />
                              : layer.assets.slice(0, 4).map((asset) => asset.kind === "image" ? <img key={asset.id} src={asset.sourceUrl} alt="" /> : <span key={asset.id}>{asset.kind === "video" ? <Video size={11} /> : <FileSpreadsheet size={11} />}</span>)}
                          </i>
                          <span><strong>{shortName(layerName(layer), 25)}</strong><small>{layer.kind === "scene" ? `${layer.assets.length} visuals · composition` : layer.asset.kind === "video" ? "Video beat" : layer.asset.kind === "image" ? "Visual beat" : "Data beat"}</small></span>
                          {isLive ? <em>LIVE</em> : isCurrent ? <em>READY</em> : null}
                        </button>
                        <span className="director-cue-actions">
                          {layer.kind === "asset" && (layer.asset.kind === "image" || layer.asset.kind === "video") && <button aria-label={`${layer.asset.kind === "video" ? "Trim" : "Crop"} ${layer.asset.name}`} onClick={() => openAssetEditor(layer.asset)}>{layer.asset.kind === "video" ? <Scissors size={14} /> : <Crop size={14} />}</button>}
                          <button aria-label={`Remove ${layerName(layer)}`} onClick={() => layer.kind === "asset" ? removeAsset(layer.asset) : removeScene(layer.scene)}><Trash2 size={14} /></button>
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <div className="director-language" aria-label="Universal gesture controls">
                  <span><b>👍</b><small>Next</small></span>
                  <span><b>👎</b><small>Back</small></span>
                  <span><b>✊</b><small>Clear</small></span>
                  <span><b>✋</b><small>Move</small></span>
                  <span><b>☝️</b><small>Focus</small></span>
                </div>
              </>
            )}
          </section>

          {false && gestureCueGroups.length > 0 && (
            <section className="cue-groups-section" aria-label="Cue groups">
              <header className="cue-groups-heading"><span><ListVideo size={17} /></span><div><strong>Cue groups</strong><small>Same gesture, clear order</small></div><b>{gestureCueGroups.length}</b></header>
              <div className="cue-groups-stack">
                {gestureCueGroups.map(({ gesture, order, layers, mode }) => (
                  <article key={gesture.id} className="cue-group" data-testid={`cue-group-${gesture.id}`}>
                    <header>
                      <span className="cue-group-title"><Hand size={15} /><span><strong>{gesture.label}</strong><small>{layers.length} cues</small></span></span>
                      <label><span className="visually-hidden">Sequence behavior</span><select aria-label={`Behavior for ${gesture.label} sequence`} value={mode} onChange={(event) => setGestureSequenceMode(gesture.id, event.target.value as GestureSequenceMode)}><option value="keep">Keep earlier</option><option value="replace">Replace previous</option></select><ChevronDown size={13} /></label>
                    </header>
                    <ol>
                      {layers.map((layer, index) => (
                        <li key={layer.id} className={activeLayerId === layer.id ? "active" : liveLayerIds.includes(layer.id) ? "live" : ""}>
                          <button className="cue-group-jump" aria-label={`Open settings for cue ${index + 1}, ${layerName(layer)}`} onClick={() => focusCueSettings(layer.id)}>
                            <b>{index + 1}</b>
                            <i className={`cue-group-thumb ${layer.kind}`}>
                              {layer.kind === "asset"
                                ? layer.asset.kind === "image" ? <img src={layer.asset.sourceUrl} alt="" /> : layer.asset.kind === "video" ? <Video size={15} /> : <FileSpreadsheet size={15} />
                                : layer.assets.slice(0, 4).map((asset) => asset.kind === "image" ? <img key={asset.id} src={asset.sourceUrl} alt="" /> : <span key={asset.id}>{asset.kind === "video" ? <Video size={10} /> : <FileSpreadsheet size={10} />}</span>)}
                            </i>
                            <span><strong>{shortName(layerName(layer), 24)}</strong><small>{layer.kind === "asset" ? `${PLACEMENTS.find((item) => item.id === layer.asset.placement)?.label} · ${ASSET_SIZES.find((item) => item.id === layer.asset.size)?.label}` : `Scene · ${layer.scene.layout}`}</small></span>
                          </button>
                          <span className="cue-group-order" aria-label={`Cue order for ${layerName(layer)}`}>
                            <button disabled={index === 0} aria-label={`Move ${layerName(layer)} earlier in ${gesture.label} sequence`} title="Move earlier" onClick={() => moveGestureSequenceCue(gesture.id, layer.id, -1)}><ArrowUp size={12} /></button>
                            <button disabled={index === order.length - 1} aria-label={`Move ${layerName(layer)} later in ${gesture.label} sequence`} title="Move later" onClick={() => moveGestureSequenceCue(gesture.id, layer.id, 1)}><ArrowDown size={12} /></button>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>
          )}

          {sceneBuilderOpen && (
            <div className="scene-builder-modal" role="dialog" aria-modal="true" aria-labelledby="scene-builder-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSceneBuilderOpen(false); }}>
              <section id="scene-builder-dialog" className="scene-builder">
                <header className="scene-builder-heading"><span className="scene-builder-heading-icon"><LayoutGrid size={21} /></span><span><small>Hands-free composition</small><strong id="scene-builder-title">Create a collage scene</strong></span><button aria-label="Close scene builder" onClick={() => setSceneBuilderOpen(false)}><X size={18} /></button></header>
                <p className="scene-builder-intro">A scene arranges several assets into one composition. Give the finished scene one gesture and reveal the whole layout together.</p>
                <div className="scene-builder-body">
                  <div className="scene-builder-config">
                    <label><span>Scene name</span><input autoFocus aria-label="Scene name" value={sceneDraftName} onChange={(event) => setSceneDraftName(event.target.value)} /></label>
                    <div className="scene-template-section">
                      <span className="scene-builder-label">Choose a layout</span>
                      <div className="scene-template-grid" role="group" aria-label="Collage template">
                        {SCENE_TEMPLATES.map((template) => <button key={template.id} className={sceneDraftLayout === template.id ? "active" : ""} aria-pressed={sceneDraftLayout === template.id} onClick={() => setSceneDraftLayout(template.id)}><i className={`template-mini ${template.id}`}><b /><b /><b /></i><span><strong>{template.label}</strong><small>{template.detail}</small></span></button>)}
                      </div>
                    </div>
                  </div>
                  <div className="scene-assets-section">
                    <div className="scene-assets-heading"><span><strong>Choose media</strong><small>2–{MAX_SCENE_ASSETS} assets · up to {MAX_SCENE_VIDEO_ASSETS} videos</small></span><b>{sceneDraftMembers.length}/{MAX_SCENE_ASSETS} selected</b></div>
                    {assets.length < 2 ? (
                      <div className="scene-requirement"><span><LayoutGrid size={21} /></span><div><strong>Import at least two media files</strong><small>Images, videos, CSV, and JSON can all be used in a collage.</small></div><button onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Import media</button></div>
                    ) : null}
                    <div className="scene-member-picker">
                      {assets.map((asset) => {
                        const selected = sceneDraftMembers.includes(asset.id);
                        const totalLimitReached = !selected && sceneDraftMembers.length >= MAX_SCENE_ASSETS;
                        const videoLimitReached = !selected && asset.kind === "video" && sceneDraftVideoCount >= MAX_SCENE_VIDEO_ASSETS;
                        const unavailableReason = totalLimitReached ? "Scene is full"
                            : videoLimitReached ? "Two-video limit reached"
                              : asset.kind.toUpperCase();
                        return <button key={asset.id} disabled={totalLimitReached || videoLimitReached} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleSceneDraftMember(asset.id)}><i>{asset.kind === "image" ? <img src={asset.sourceUrl} alt="" /> : asset.kind === "video" ? <Video size={17} /> : <FileSpreadsheet size={17} />}</i><span><strong>{shortName(asset.name, 22)}</strong><small>{unavailableReason}</small></span>{selected ? <Check size={15} /> : null}</button>;
                      })}
                    </div>
                  </div>
                </div>
                <footer className="scene-builder-footer"><small>{sceneDraftMembers.length < 2 ? "Select two or more available assets to continue." : sceneDraftMembers.length === MAX_SCENE_ASSETS ? `Scene full · ${sceneDraftVideoCount}/${MAX_SCENE_VIDEO_ASSETS} videos` : `${sceneDraftMembers.length} assets · ${sceneDraftVideoCount}/${MAX_SCENE_VIDEO_ASSETS} videos`}</small><div><button onClick={() => setSceneBuilderOpen(false)}>Cancel</button><button className="confirm" disabled={sceneDraftMembers.length < 2} onClick={createScene}><Plus size={16} /> Create scene</button></div></footer>
              </section>
            </div>
          )}

          {false && scenes.length > 0 && (
            <section className="scene-section" aria-label="Collage scenes">
              <div className="scene-section-heading"><span className="scene-section-icon"><Layers3 size={18} /></span><span><strong>Scenes</strong></span><b>{scenes.length}</b></div>
              <div className="scene-stack">
                {scenes.map((scene) => {
                  const layerId = sceneLayerId(scene.id);
                  const sceneAssets = scene.memberIds.map((id) => assets.find((asset) => asset.id === id)).filter((asset): asset is StudioAsset => Boolean(asset));
                  const soloId = sceneSolo[scene.id];
                  return (
                    <article id={`library-layer-${layerId}`} tabIndex={-1} key={scene.id} className={`asset-item scene-item ${liveLayerIds.includes(layerId) ? "live" : ""} ${activeLayerId === layerId ? "focused" : ""}`}>
                      <div className="asset-identity-row">
                        <button className={`asset-icon asset-preview-button scene-preview ${scene.layout}`} aria-label={`Activate ${scene.name}`} onClick={() => void activateLayerFromLibrary(resolveLayer(layerId, assets, scenes) as StudioLayer)}>
                          {sceneAssets.slice(0, 4).map((asset) => asset.kind === "image" ? <img key={asset.id} src={asset.sourceUrl} alt="" /> : <span key={asset.id}>{asset.kind === "video" ? <Video size={13} /> : <FileSpreadsheet size={13} />}</span>)}
                        </button>
                        <span className="asset-copy"><input className="scene-name-input" aria-label="Scene name" value={scene.name} onChange={(event) => commitSceneUpdates(scene.id, { name: event.target.value })} /><small>{sceneAssets.length} ASSETS{soloId ? ` · FOCUS ${shortName(sceneAssets.find((asset) => asset.id === soloId)?.name ?? "", 10)}` : liveLayerIds.includes(layerId) ? " · LIVE" : ""}</small></span>
                        <button className="remove-button" aria-label={`Remove ${scene.name}`} onClick={() => removeScene(scene)}><Trash2 size={16} /></button>
                      </div>
                      <div className="scene-member-strip" aria-label={`${scene.name} members`}>
                        {sceneAssets.map((asset) => {
                          const loops = normalizeVideoPlaybackMode(asset.videoPlayback) === "loop";
                          const focusMode = scene.memberFocusModes?.[asset.id] ?? "medium";
                          return <span key={asset.id} className={`scene-member-chip ${asset.kind}`}>
                            <button className={`scene-member-thumb ${soloId === asset.id ? "solo" : ""}`} title="Double-click to focus while live" onDoubleClick={() => toggleSceneSolo(scene, asset.id)}>{asset.kind === "image" ? <img src={asset.sourceUrl} alt="" /> : asset.kind === "video" ? <Video size={15} /> : <FileSpreadsheet size={15} />}</button>
                            {asset.kind === "video" && <>
                              <button data-testid={`scene-video-playback-${asset.id}`} className={`scene-member-playback ${loops ? "loop" : "once"}`} aria-label={`Set ${asset.name} to ${loops ? "play once" : "loop"}`} title={loops ? "Looping · click to play once" : "Plays once, then hides · click to loop"} aria-pressed={loops} onClick={(event) => { event.stopPropagation(); toggleVideoPlayback(asset); }}>{loops ? <Repeat2 size={11} /> : <Play size={11} />}<span>{loops ? "Loop" : "Once"}</span></button>
                              <button data-testid={`scene-video-audio-${asset.id}`} className={`scene-member-audio ${asset.includeAudio ? "active" : ""}`} aria-label={`${asset.includeAudio ? "Mute" : "Include"} ${asset.name} video sound`} title={asset.includeAudio ? "Mute this video" : "Include this video’s sound"} aria-pressed={Boolean(asset.includeAudio)} onClick={(event) => { event.stopPropagation(); toggleVideoAudio(asset); }}>{asset.includeAudio ? <Volume2 size={13} /> : <VolumeX size={13} />}</button>
                            </>}
                            <span className="scene-member-focus"><select data-testid={`scene-member-focus-${asset.id}`} aria-label={`Point focus size for ${asset.name}`} value={focusMode} onChange={(event) => setSceneMemberFocusMode(scene, asset.id, event.target.value as SceneMemberFocusMode)}>{SCENE_MEMBER_FOCUS_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select><ChevronDown size={11} /></span>
                          </span>;
                        })}
                      </div>
                      <div className="scene-inline-controls">
                        <label><span>Scene gesture</span><div className="select-box full"><select data-testid={`scene-gesture-${scene.id}`} aria-label={`Gesture for ${scene.name}`} value={scene.gesture ?? ""} onChange={(event) => assignSceneGesture(scene.id, (event.target.value || undefined) as GestureId | undefined)}><option value="">Unassigned</option>{ACTIVATION_GESTURES.map((gesture) => <option key={gesture.id} value={gesture.id}>{gestureOptionLabel(gesture.id, layerId, scene.gesture)}</option>)}</select><ChevronDown size={15} /></div></label>
                        <label><span>Collage</span><div className="select-box full"><select aria-label={`Collage template for ${scene.name}`} value={scene.layout} onChange={(event) => commitSceneUpdates(scene.id, { layout: event.target.value as SceneLayout, memberTransforms: undefined, memberOrder: undefined })}>{SCENE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select><ChevronDown size={15} /></div></label>
                        <label><span>Camera + scene</span><div className="select-box full"><select data-testid={`scene-reveal-${scene.id}`} aria-label={`Side reveal for ${scene.name}`} value={scene.revealSide ?? "none"} onChange={(event) => commitSceneUpdates(scene.id, { revealSide: event.target.value as SceneRevealSide, transform: undefined })}><option value="none">Static collage</option><option value="left">Reveal from left</option><option value="right">Reveal from right</option></select><ChevronDown size={15} /></div></label>
                        <label><span>{scene.revealSide === "left" || scene.revealSide === "right" ? "Panel width" : "Size"}</span><div className="select-box full"><select data-testid={`scene-size-${scene.id}`} aria-label={`${scene.revealSide === "left" || scene.revealSide === "right" ? "Panel width" : "Size"} for ${scene.name}`} value={scene.size} onChange={(event) => commitSceneUpdates(scene.id, { size: event.target.value as AssetSize, transform: undefined })}>{scene.revealSide === "left" || scene.revealSide === "right" ? <><option value="small">30%</option><option value="medium">40%</option><option value="full">50%</option></> : ASSET_SIZES.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}</select><ChevronDown size={15} /></div></label>
                        {scene.revealSide === "left" || scene.revealSide === "right" ? <label><span>Reveal motion</span><div className="select-box full"><select data-testid={`scene-reveal-motion-${scene.id}`} aria-label={`Reveal motion for ${scene.name}`} value={scene.revealMotion ?? "smooth"} onChange={(event) => commitSceneUpdates(scene.id, { revealMotion: event.target.value as SceneRevealMotion })}>{SCENE_REVEAL_MOTIONS.map((motion) => <option key={motion.id} value={motion.id}>{motion.label}</option>)}</select><ChevronDown size={15} /></div></label> : <label><span>Entrance</span><div className="select-box full"><select aria-label={`Entrance animation for ${scene.name}`} value={scene.entranceAnimation ?? "fade"} onChange={(event) => commitSceneUpdates(scene.id, { entranceAnimation: event.target.value as EntranceAnimation })}>{ENTRANCE_ANIMATIONS.map((animation) => <option key={animation.id} value={animation.id}>{animation.label}</option>)}</select><ChevronDown size={15} /></div></label>}
                        <label><span>While live</span><div className="select-box full"><select data-testid={`scene-motion-${scene.id}`} aria-label={`Motion while ${scene.name} is live`} value={scene.motionEffect ?? "none"} onChange={(event) => commitSceneUpdates(scene.id, { motionEffect: event.target.value as MotionEffect })}>{MOTION_EFFECTS.map((motion) => <option key={motion.id} value={motion.id}>{motion.label}</option>)}</select><ChevronDown size={15} /></div></label>
                        <label><span>Cue sound</span><div className="select-box full"><select aria-label={`Cue sound for ${scene.name}`} value={scene.cueSound ?? "none"} onChange={(event) => commitSceneUpdates(scene.id, { cueSound: event.target.value as CueSound })}>{CUE_SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</select><ChevronDown size={15} /></div></label>
                        <label className="stage-background-control">
                          <span>{scene.revealSide === "left" || scene.revealSide === "right" ? "Panel background" : "Stage behind scene"}</span>
                          <div className={`stage-background-choice ${scene.stageBackground === "custom" ? "with-colour" : ""}`}>
                            <div className="select-box full"><select data-testid={`scene-background-${scene.id}`} aria-label={`Stage background for ${scene.name}`} value={scene.stageBackground ?? "camera"} onChange={(event) => commitSceneUpdates(scene.id, { stageBackground: event.target.value as StageBackground })}>{STAGE_BACKGROUNDS.map((background) => <option key={background.id} value={background.id}>{background.label}</option>)}</select><ChevronDown size={15} /></div>
                            {scene.stageBackground === "custom" && <input data-testid={`scene-background-colour-${scene.id}`} aria-label={`Stage background colour for ${scene.name}`} type="color" value={scene.stageBackgroundColor ?? "#111111"} onChange={(event) => commitSceneUpdates(scene.id, { stageBackgroundColor: event.target.value })} />}
                          </div>
                        </label>
                      </div>
                      <button className="scene-reset-layout" disabled={!scene.memberTransforms && !scene.memberOrder} onClick={() => commitSceneUpdates(scene.id, { memberTransforms: undefined, memberOrder: undefined })}><RotateCcw size={14} /> Reset member layout</button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {false && <><div className="section-label asset-section-label"><span>Standalone media</span><b>{standaloneAssets.length}</b></div>
          <div className="asset-stack">
            {assets.length === 0 ? (
              <div className="empty-assets"><ImageIcon size={21} /><span>Imported assets will appear here.</span></div>
            ) : standaloneAssets.length === 0 ? (
              <p className="grouped-assets-note"><Layers3 size={15} /> All imported media is grouped inside scenes.</p>
            ) : standaloneAssets.map((asset) => (
              <article id={`library-layer-${asset.id}`} tabIndex={-1} key={asset.id} className={`asset-item inline-asset ${liveLayerIds.includes(asset.id) ? "live" : ""} ${asset.id === activeLayerId ? "focused" : ""}`}>
                <div className="asset-identity-row">
                  <button className="asset-icon asset-preview-button" aria-label={`Activate ${asset.name}`} onClick={() => void activateLayerFromLibrary(resolveLayer(asset.id, assets, scenes) as StudioLayer)}>
                    {asset.kind === "image" ? <img src={asset.sourceUrl} alt="" /> : asset.kind === "video" ? <video src={asset.sourceUrl} muted playsInline preload="metadata" aria-hidden="true" /> : asset.kind === "csv" ? <FileSpreadsheet size={26} /> : <FileJson2 size={26} />}
                  </button>
                  <button className="asset-copy asset-copy-activate" aria-label={`Activate ${asset.name} from media library`} onClick={() => void activateLayerFromLibrary(resolveLayer(asset.id, assets, scenes) as StudioLayer)}><strong title={asset.name}>{shortName(asset.name, 28)}</strong><small>{asset.kind.toUpperCase()}{asset.id === activeLayerId ? " · FOCUSED" : liveLayerIds.includes(asset.id) ? " · LIVE" : ""}</small></button>
                  {(asset.kind === "image" || asset.kind === "video") && <button className="media-edit-button" aria-label={`${asset.kind === "video" ? "Trim" : "Crop"} ${asset.name}`} title={asset.kind === "video" ? "Trim video" : "Crop image"} onClick={() => openAssetEditor(asset)}>{asset.kind === "video" ? <Scissors size={16} /> : <Crop size={16} />}</button>}
                  <button className="remove-button" aria-label={`Remove ${asset.name}`} onClick={() => removeAsset(asset)}><Trash2 size={16} /></button>
                </div>

                <div className="asset-inline-controls">
                  <label>
                    <span>Gesture</span>
                    <div className="select-box full">
                      <select data-testid={`gesture-select-${asset.id}`} aria-label={`Gesture for ${asset.name}`} value={asset.gesture ?? ""} onChange={(event) => assignGesture(asset.id, (event.target.value || undefined) as GestureId | undefined)}>
                        <option value="">Unassigned</option>
                        {ACTIVATION_GESTURES.map((gesture) => <option key={gesture.id} value={gesture.id}>{gestureOptionLabel(gesture.id, asset.id, asset.gesture)}</option>)}
                      </select><ChevronDown size={16} />
                    </div>
                  </label>

                  <label>
                    <span>Placement</span>
                    <div className="select-box full">
                      <select data-testid={`placement-select-${asset.id}`} aria-label={`Placement for ${asset.name}`} value={asset.placement} onChange={(event) => updateAsset(asset.id, { placement: event.target.value as Placement, transform: undefined })}>
                        {PLACEMENTS.map((placement) => <option key={placement.id} value={placement.id}>{placement.label}</option>)}
                      </select><ChevronDown size={16} />
                    </div>
                  </label>

                  <label>
                    <span>Size</span>
                    <div className="select-box full">
                      <select data-testid={`size-select-${asset.id}`} aria-label={`Size for ${asset.name}`} value={asset.size} onChange={(event) => updateAsset(asset.id, { size: event.target.value as AssetSize, transform: undefined })}>
                        {ASSET_SIZES.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}
                      </select><ChevronDown size={16} />
                    </div>
                  </label>

                  {(asset.placement === "left" || asset.placement === "right") && (
                    <label className="camera-reflow-control">
                      <span>Camera layout</span>
                      <div className="select-box full"><select data-testid={`camera-reflow-${asset.id}`} aria-label={`Camera layout for ${asset.name}`} value={asset.cameraReflow ?? "overlay"} onChange={(event) => updateAsset(asset.id, { cameraReflow: event.target.value as CameraReflow, transform: undefined })}><option value="overlay">Overlay camera</option><option value="make-room">Make room</option></select><ChevronDown size={16} /></div>
                    </label>
                  )}

                  <label>
                    <span>Entrance</span>
                    <div className="select-box full"><select aria-label={`Entrance animation for ${asset.name}`} value={asset.entranceAnimation ?? "fade"} onChange={(event) => updateAsset(asset.id, { entranceAnimation: event.target.value as EntranceAnimation })}>{ENTRANCE_ANIMATIONS.map((animation) => <option key={animation.id} value={animation.id}>{animation.label}</option>)}</select><ChevronDown size={16} /></div>
                  </label>

                  <label>
                    <span>While live</span>
                    <div className="select-box full"><select data-testid={`motion-select-${asset.id}`} aria-label={`Motion while ${asset.name} is live`} value={asset.motionEffect ?? "none"} onChange={(event) => updateAsset(asset.id, { motionEffect: event.target.value as MotionEffect })}>{MOTION_EFFECTS.map((motion) => <option key={motion.id} value={motion.id}>{motion.label}</option>)}</select><ChevronDown size={16} /></div>
                  </label>

                  <label>
                    <span>Cue sound</span>
                    <div className="select-box full"><select aria-label={`Cue sound for ${asset.name}`} value={asset.cueSound ?? "none"} onChange={(event) => updateAsset(asset.id, { cueSound: event.target.value as CueSound })}>{CUE_SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</select><ChevronDown size={16} /></div>
                  </label>

                  <label className="stage-background-control">
                    <span>Stage behind asset</span>
                    <div className={`stage-background-choice ${asset.stageBackground === "custom" ? "with-colour" : ""}`}>
                      <div className="select-box full">
                        <select data-testid={`background-select-${asset.id}`} aria-label={`Stage background for ${asset.name}`} value={asset.stageBackground ?? "camera"} onChange={(event) => updateAsset(asset.id, { stageBackground: event.target.value as StageBackground })}>
                          {STAGE_BACKGROUNDS.map((background) => <option key={background.id} value={background.id}>{background.label}</option>)}
                        </select><ChevronDown size={16} />
                      </div>
                      {asset.stageBackground === "custom" && <input data-testid={`background-colour-${asset.id}`} aria-label={`Stage background colour for ${asset.name}`} type="color" value={asset.stageBackgroundColor ?? "#111111"} onChange={(event) => updateAsset(asset.id, { stageBackgroundColor: event.target.value })} />}
                    </div>
                  </label>

                  {asset.kind === "video" && (
                    <><div className="video-audio-control">
                        <span><strong>Video sound</strong><small>{asset.includeAudio ? "Included in recordings" : "Muted by default"}</small></span>
                        <button className={asset.includeAudio ? "active" : ""} aria-pressed={Boolean(asset.includeAudio)} onClick={() => toggleVideoAudio(asset)}>
                          {asset.includeAudio ? <Volume2 size={17} /> : <VolumeX size={17} />}{asset.includeAudio ? "On" : "Muted"}
                        </button>
                      </div>
                      <div className="video-audio-control video-playback-control">
                        <span><strong>Playback</strong><small>{normalizeVideoPlaybackMode(asset.videoPlayback) === "loop" ? "Restarts until hidden" : "Hides after the first run"}</small></span>
                        <button data-testid={`video-playback-${asset.id}`} aria-pressed={normalizeVideoPlaybackMode(asset.videoPlayback) === "loop"} onClick={() => toggleVideoPlayback(asset)}>
                          {normalizeVideoPlaybackMode(asset.videoPlayback) === "loop" ? <Repeat2 size={17} /> : <Play size={17} />}{normalizeVideoPlaybackMode(asset.videoPlayback) === "loop" ? "Loop" : "Once"}
                        </button>
                      </div>
                      {hasVideoTrim(asset.videoTrim, asset.mediaDuration ?? 0) && <button className="asset-edit-summary" onClick={() => openAssetEditor(asset)}><Scissors size={14} /> {formatEditTime(normalizeVideoTrim(asset.videoTrim, asset.mediaDuration ?? 0).start)}–{formatEditTime(normalizeVideoTrim(asset.videoTrim, asset.mediaDuration ?? 0).end)}</button>}
                    </>
                  )}

                  {asset.kind === "image" && asset.imageCrop && (() => {
                    const image = imagesRef.current.get(asset.id);
                    const crop = normalizeImageCrop(asset.imageCrop, image?.naturalWidth || 1, image?.naturalHeight || 1);
                    return crop ? <button className="asset-edit-summary" onClick={() => openAssetEditor(asset)}><Crop size={14} /> {crop.aspect === "free" ? "Free" : crop.aspect} crop · {Math.round(crop.width * 100)} × {Math.round(crop.height * 100)}%</button> : null;
                  })()}

                  {(asset.kind === "csv" || asset.kind === "json") && (
                    <div className="data-mode inline-data-mode">
                      <button className={asset.dataView === "table" ? "active" : ""} onClick={() => updateAsset(asset.id, { dataView: "table" })}><FileSpreadsheet size={16} /> Table</button>
                      <button className={asset.dataView === "chart" ? "active" : ""} onClick={() => updateAsset(asset.id, { dataView: "chart" })}><BarChart3 size={16} /> Chart</button>
                    </div>
                  )}
                </div>
                <div className="asset-transform-row">
                  <span>{asset.transform ? `Custom spawn position saved · ${Math.round(asset.transform.scale * 100)}%` : `${PLACEMENTS.find((item) => item.id === asset.placement)?.label} · ${ASSET_SIZES.find((size) => size.id === asset.size)?.label} spawn preset`}</span>
                  <button disabled={!asset.transform} title="Reset to placement preset" onClick={() => updateAsset(asset.id, { transform: undefined })}><RotateCcw size={15} /> Reset position</button>
                </div>
              </article>
            ))}
          </div></>}
          <details className="advanced library-advanced">
            <summary><Settings2 size={16} /> Advanced settings <ChevronDown size={15} /></summary>
            <label><span>Hold threshold <b>{timing.holdMs} ms</b></span><input aria-label="Hold threshold" type="range" min={MIN_GESTURE_HOLD_MS} max="900" step="10" value={timing.holdMs} onChange={(event) => setTiming((current) => ({ ...current, holdMs: Math.max(MIN_GESTURE_HOLD_MS, Number(event.target.value)) }))} /></label>
            <label><span>Cooldown <b>{timing.cooldownMs} ms</b></span><input type="range" min="450" max="1600" step="50" value={timing.cooldownMs} onChange={(event) => setTiming((current) => ({ ...current, cooldownMs: Number(event.target.value) }))} /></label>
            <label><span>Palm lock <b>{palmHoldMs} ms</b></span><input type="range" min="80" max="400" step="20" value={palmHoldMs} onChange={(event) => setPalmHoldMs(Number(event.target.value))} /></label>
            <label className="media-monitor-setting"><span>Monitor enabled video audio <b>{monitorMediaAudio ? "On" : "Off"}</b></span><input type="checkbox" checked={monitorMediaAudio} onChange={toggleMediaMonitoring} /></label>
          </details>
        </aside>

        <section className={`center-panel ${aspectId}`} aria-label="Live output stage">
          <header className="source-toolbar" data-tour-target="devices" aria-label="Studio sources and format">
            <label>
              <span><Camera size={13} /> Camera</span>
              <div className="select-box">
                <select data-testid="camera-select" value={selectedCameraId} disabled={isRecording || phase === "switching"} onChange={(event) => void handleCameraChange(event.target.value)}>
                  {cameras.length === 0 && <option value="">No cameras found</option>}
                  {cameras.map((camera) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>)}
                </select><ChevronDown size={14} />
              </div>
            </label>
            <label className="microphone-field">
              <span><Mic size={13} /> Microphone</span>
              <div className="select-box">
                <select data-testid="microphone-select" value={selectedMicrophoneId || "none"} disabled={isRecording || microphonePhase === "switching" || microphonePhase === "permission"} onChange={(event) => void handleMicrophoneChange(event.target.value)}>
                  <option value="none">Microphone off</option>
                  {microphones.map((microphone) => <option key={microphone.deviceId} value={microphone.deviceId}>{microphone.label}</option>)}
                </select><ChevronDown size={14} />
              </div>
            </label>
            <label className="resolution-field">
              <span><Gauge size={13} /> Quality</span>
              <div className="select-box">
                <select data-testid="quality-select" value={qualityPreset(qualityId).width >= 3_000 ? "4k" : qualityPreset(qualityId).width >= 1_700 ? "1080p" : "720p"} disabled={isRecording || phase === "switching"} onChange={(event) => void handleResolutionChange(event.target.value as "720p" | "1080p" | "4k")}>
                  {OUTPUT_RESOLUTIONS.map((resolution) => <option key={resolution.id} value={resolution.id}>{resolution.label}</option>)}
                </select><ChevronDown size={14} />
              </div>
            </label>
            <label className="fps-field">
              <span><Gauge size={13} /> FPS</span>
              <div className="select-box">
                <select data-testid="fps-select" value={qualityPreset(qualityId).fps} disabled={isRecording || phase === "switching" || qualityId === "4k30"} onChange={(event) => void handleFrameRateChange(Number(event.target.value) as 30 | 60)}>
                  <option value="30">30 fps</option>
                  <option value="60">60 fps</option>
                </select><ChevronDown size={14} />
              </div>
            </label>
            <label className="aspect-field">
              <span><Monitor size={13} /> Ratio</span>
              <div className="select-box">
                <select data-testid="aspect-select" value={aspectId} disabled={isRecording || phase === "switching"} onChange={(event) => handleAspectChange(event.target.value as CanvasAspectId)}>
                  {CANVAS_ASPECTS.map((aspect) => <option key={aspect.id} value={aspect.id}>{aspect.label}</option>)}
                </select><ChevronDown size={14} />
              </div>
            </label>
            <div className={`camera-frame-toolbar ${cameraFrame.enabled ? "active" : ""}`}>
              <button
                className="camera-frame-button"
                type="button"
                aria-label="Camera border settings"
                aria-expanded={cameraFramePanelOpen}
                onClick={() => setCameraFramePanelOpen(true)}
                title="Camera border settings"
              ><Maximize2 size={17} /><span>{cameraFrame.enabled ? `${cameraFrame.sizePercent}%` : "Border"}</span></button>
              <button
                className="camera-frame-toggle"
                type="button"
                aria-label={cameraFrame.enabled ? "Hide camera border" : "Show camera border"}
                aria-pressed={cameraFrame.enabled}
                onClick={() => setCameraFrame((current) => normalizeCameraFrame({ ...current, enabled: !current.enabled }))}
                title={cameraFrame.enabled ? "Hide camera border" : "Show camera border"}
              >{cameraFrame.enabled ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            </div>
            <button
              className={`mirror-camera ${mirrorCamera ? "active" : ""}`}
              type="button"
              aria-label="Mirror camera"
              aria-pressed={mirrorCamera}
              disabled={isRecording}
              onClick={toggleMirrorCamera}
              title={mirrorCamera ? "Turn camera mirroring off" : "Mirror the camera"}
            ><FlipHorizontal2 size={17} /><span>Mirror</span></button>
          </header>

          <div className={`stage-area ${aspectId}`}>
          <div className={`stage-wrap ${aspectId}`} onClick={handleStageClick} onDoubleClick={handleStageDoubleClick}>
            <video ref={cameraVideoRef} className="camera-source" muted playsInline />
            <video ref={screenVideoRef} className="screen-source" muted playsInline />
            <canvas ref={outputCanvasRef} data-testid="output-canvas" width={outputSize.width} height={outputSize.height} />
            <canvas ref={inferenceCanvasRef} className="inference-canvas" width={640} height={360} aria-hidden="true" />
            {studioReady && assetDeckOnStage && (!activeAsset || currentStyleLayout.keepSlotsWhileFocused) && currentStyleLayout.slots.map((slot, index) => {
              const asset = styleAssets[index];
              if (!asset) return null;
              return <button
                key={asset.id}
                className="style-slot-hit-target"
                aria-label={`Focus ${asset.name}`}
                title={`Focus ${asset.name}`}
                style={{ left: `${slot.x / outputSize.width * 100}%`, top: `${slot.y / outputSize.height * 100}%`, width: `${slot.width / outputSize.width * 100}%`, height: `${slot.height / outputSize.height * 100}%` }}
                onClick={(event) => { event.stopPropagation(); focusVideoStyleAsset(asset); }}
              />;
            })}
            {studioReady && activeAsset && activeGeometry && (
              <div
                className={`scene-member-lock active-asset-lock ${manipulation.mode}`}
                data-testid="active-asset-lock"
                aria-hidden="true"
                style={{
                  left: `${activeGeometry.rect.x / outputSize.width * 100}%`,
                  top: `${activeGeometry.rect.y / outputSize.height * 100}%`,
                  width: `${activeGeometry.rect.width / outputSize.width * 100}%`,
                  height: `${activeGeometry.rect.height / outputSize.height * 100}%`
                }}
              />
            )}
            {studioReady && activeSceneMemberGeometry && (
              <div
                className={`scene-member-lock ${manipulation.mode} ${selectedSceneMemberId && !sceneMemberTargetId ? "mouse-selected" : ""}`}
                data-testid="scene-member-lock"
                style={{
                  left: `${activeSceneMemberGeometry.rect.x / outputSize.width * 100}%`,
                  top: `${activeSceneMemberGeometry.rect.y / outputSize.height * 100}%`,
                  width: `${activeSceneMemberGeometry.rect.width / outputSize.width * 100}%`,
                  height: `${activeSceneMemberGeometry.rect.height / outputSize.height * 100}%`
                }}
              ><span>{sceneMemberTargetId ? "Palm locked" : "Selected"} · {shortName(activeSceneMemberGeometry.asset.name, 18)}</span></div>
            )}
            {studioReady && activeLayer && pointerEditorGeometry && !isRecording && !isFinalizing && (
              <div
                className={`stage-layer-editor ${activeSceneMemberEditorGeometry ? "scene-member-editor" : ""}`}
                style={{
                  left: `${pointerEditorGeometry.rect.x / outputSize.width * 100}%`,
                  top: `${pointerEditorGeometry.rect.y / outputSize.height * 100}%`,
                  width: `${pointerEditorGeometry.rect.width / outputSize.width * 100}%`,
                  height: `${pointerEditorGeometry.rect.height / outputSize.height * 100}%`
                }}
                title={activeSceneMemberEditorGeometry ? "Drag this scene asset to position" : activeLayer.kind === "scene" ? "Drag the whole scene to position" : "Drag to position"}
                onPointerDown={(event) => beginPointerEdit(event, "drag")}
                onPointerMove={movePointerEdit}
                onPointerUp={endPointerEdit}
                onPointerCancel={endPointerEdit}
              >
                <span>{shortName(pointerEditorName, 19)}{activeSceneMemberEditorGeometry ? " · scene asset" : activeLayer.kind === "scene" ? " · whole scene" : ""}</span>
                <button
                  aria-label={`Resize ${pointerEditorName}`}
                  title="Drag to resize"
                  onPointerDown={(event) => { event.stopPropagation(); beginPointerEdit(event, "scale"); }}
                  onPointerMove={movePointerEdit}
                  onPointerUp={endPointerEdit}
                  onPointerCancel={endPointerEdit}
                ><Maximize2 size={13} /></button>
              </div>
            )}
            {selectedWidget && selectedWidgetRect && !isRecording && !isFinalizing && (
              <div
                className="stage-widget-editor"
                data-testid="stage-widget-editor"
                style={{
                  left: `${selectedWidgetRect.x / outputSize.width * 100}%`,
                  top: `${selectedWidgetRect.y / outputSize.height * 100}%`,
                  width: `${selectedWidgetRect.width / outputSize.width * 100}%`,
                  height: `${selectedWidgetRect.height / outputSize.height * 100}%`
                }}
                title={`Drag ${selectedWidget.title} to move`}
                onPointerDown={(event) => beginWidgetPointerEdit(event, selectedWidget, "drag")}
                onPointerMove={moveWidgetPointerEdit}
                onPointerUp={endWidgetPointerEdit}
                onPointerCancel={endWidgetPointerEdit}
              >
                <span>{shortName(selectedWidget.title, 18)}</span>
                <button
                  aria-label={`Resize ${selectedWidget.title}`}
                  title="Drag to resize"
                  onPointerDown={(event) => { event.stopPropagation(); beginWidgetPointerEdit(event, selectedWidget, "scale"); }}
                  onPointerMove={moveWidgetPointerEdit}
                  onPointerUp={endWidgetPointerEdit}
                  onPointerCancel={endWidgetPointerEdit}
                ><Maximize2 size={13} /></button>
              </div>
            )}
            {!studioReady && (
              <div className={`stage-empty ${phase === "error" ? "error" : ""}`}>
                <span>{phase === "loading" ? <LoaderCircle className="spin" size={28} /> : phase === "error" ? <AlertTriangle size={28} /> : <Camera size={28} />}</span>
                <strong>{stageStateTitle}</strong>
                <small>{phaseMessage}</small>
              </div>
            )}
            {studioReady && pointFocus && <div className={`point-focus-indicator ${pointFocus.targetName ? "target" : ""}`} data-testid="point-focus-indicator" aria-hidden="true" style={{ left: `${pointFocus.x * 100}%`, top: `${pointFocus.y * 100}%`, background: `conic-gradient(var(--rii-accent) ${Math.max(4, pointFocus.progress * 360)}deg, rgba(255,255,255,.25) 0deg)` }}><i />{pointFocus.targetName && <small>{shortName(pointFocus.targetName, 18)}</small>}</div>}
            {activeLayer && <div className="activation-notice" key={`${activeLayer.id}-${activatedAt}`}><Radio size={13} /> {shortName(layerName(activeLayer), 30)} activated</div>}
            {morphExitAssetId && <div className="morph-exit-notice"><Sparkles size={14} /> Morphing away</div>}
            {spotlight && spotlight.progress >= 0.35 && <div className="spotlight-notice"><Eye size={14} /><span><small>SPOTLIGHT</small><strong>{shortName(spotlight.name, 24)}</strong></span></div>}
            {activeScene && activeSceneSoloId && <div className="scene-solo-badge" data-testid="scene-solo"><Eye size={13} /> FOCUS · {shortName(assets.find((asset) => asset.id === activeSceneSoloId)?.name ?? "Asset", 20)}<small>Point again or double-click to restore</small></div>}
            {liveBudgetNotice && <div className="performance-guard-notice" data-testid="performance-guard"><ShieldCheck size={13} />{liveBudgetNotice}</div>}
            {activeLayer && manipulation.mode !== "idle" && (
              <div className={`manipulation-chip ${manipulation.mode}`} data-testid="manipulation-status">
                {manipulation.mode === "scaling" || manipulation.mode === "arming-scale" ? <Maximize2 size={17} /> : <Move size={17} />}
                <span>{manipulationHeadline}</span>
                {(manipulation.mode === "arming-drag" || manipulation.mode === "arming-scale") && <i><b style={{ width: `${manipulation.progress * 100}%` }} /></i>}
              </div>
            )}

          </div>
          </div>

          <section className="live-timeline" aria-label="Recording timeline">
            <header>
              <span><ListVideo size={16} /><strong>Director Track</strong></span>
              <span className="director-track-actions">
                {selectedDirectorEvent && !isRecording && <>
                  <button type="button" title="Move cue 0.25 seconds earlier" onClick={() => nudgeSelectedDirectorEvent(-250)}>−.25s</button>
                  <button type="button" title="Move cue 0.25 seconds later" onClick={() => nudgeSelectedDirectorEvent(250)}>+.25s</button>
                  <button type="button" className="danger" title="Remove cue from Director Track" onClick={removeSelectedDirectorEvent}><Trash2 size={11} /></button>
                </>}
                <button type="button" disabled={!timelineEvents.length} title="Undo last director action" onClick={undoLastDirectorAction}><RotateCcw size={11} /> Undo</button>
                <small>{isRecording ? "Director Track is recording" : timelineEvents.length ? "Select a cue to edit" : "Appears while recording"}</small>
              </span>
            </header>
            <div className="timeline-ruler" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((tick) => <span key={tick} style={{ left: `${tick * 25}%` }}>{formatDuration(Math.round(timelineDurationMs * tick / 4 / 1000))}</span>)}
            </div>
            <div className="timeline-track camera-track">
              <b>CAM</b><i className="camera-clip"><Camera size={12} /> Camera</i>
            </div>
            <div className="timeline-track visual-track">
              <b>VIS</b><div className="timeline-clips">
                {timelineEvents.map((event) => {
                  const start = event.startMs / timelineDurationMs * 100;
                  const end = (event.endMs ?? openTimelineEnd) / timelineDurationMs * 100;
                  return <button key={event.id} type="button" className={`${event.endMs === null ? "live" : ""} ${event.kind} ${selectedDirectorEventId === event.id ? "selected" : ""}`} aria-label={`${event.kind} cue ${event.label}`} title={`${event.kind === "scene" ? "Scene" : "Visual"}: ${event.label}`} style={{ left: `${start}%`, width: `${Math.max(1.5, end - start)}%` }} onClick={() => setSelectedDirectorEventId(event.id)}><span>{event.kind === "scene" ? "SCENE · " : ""}{shortName(event.label, 18)}</span></button>;
                })}
                {isRecording && <em className="timeline-playhead" style={{ left: `${Math.min(100, openTimelineEnd / timelineDurationMs * 100)}%` }} />}
              </div>
            </div>
          </section>

          <footer className="studio-console" data-tour-target="record" aria-label="Studio status and recording controls">
            <div className={`audio-console ${microphonePhase}`} title={activeMicrophoneLabel} aria-label={`Microphone level · ${activeMicrophoneLabel}`}>
              <span className="audio-icon"><Mic size={17} /></span>
              <i className="audio-level" data-testid="microphone-level"><b style={{ width: `${Math.max(2, Math.round(microphoneLevel * 100))}%` }} /></i>
              <strong className="visually-hidden" data-testid="active-microphone">{activeMicrophoneLabel}</strong>
            </div>

            <div className="transport-actions" aria-label="Recording controls">
              <button
                className={`primary-studio-action ${studioReady ? "record-ready" : "start-ready"}`}
                onClick={() => { if (studioReady) void startRecording(); else if (phase === "error" || phase === "idle") void startStudio(); }}
                disabled={isRecording || isFinalizing || captionBusy || (!studioReady && phase !== "error" && phase !== "idle")}
              >
                {!studioReady || isFinalizing ? <LoaderCircle className={phase === "error" ? "" : "spin"} size={21} /> : <Circle size={21} fill="currentColor" />}
                <span>{isFinalizing ? "Saving" : isRecording ? "Recording" : studioReady ? "Record" : phase === "error" ? "Retry camera" : "Starting camera…"}</span>
              </button>
              {isRecording && <button
                className={`stop-button ${studioReady || ["permission", "loading", "switching", "stopping"].includes(phase) ? "studio-stop" : ""}`}
                onClick={() => stopRecording()}
                disabled={isFinalizing}
                aria-label="Stop recording"
              >
                <Square size={18} fill="currentColor" />
                <span>Stop recording</span>
              </button>}
            </div>

            <div className={`recording-clock ${isRecording ? "active" : recordingSeconds > 0 ? "complete" : "idle"}`} role="timer" aria-label={`Recording duration ${formatDuration(recordingSeconds)}`}>
              <small><i /> Recording duration</small>
              <strong data-testid="recording-duration">{formatDuration(recordingSeconds)}</strong>
            </div>
          </footer>

          <section className="takes-inline-panel canvas-downloads-panel" aria-label="Downloads and edits">
            <div className="takes-inline-heading"><span><Download size={19} /><strong>Downloads & edits</strong></span><b>{recordings.length}</b></div>
            <section className="recordings-panel durable-recordings">
              {recordings.length === 0 ? (
                <div className="empty-recordings"><Video size={22} /><span>Your finished recordings will appear here to rename, trim, caption, download, or delete.</span></div>
              ) : (
                <div className="recording-list" tabIndex={0} aria-label="Finished takes">
                  {recordings.map((recording) => (
                    <article key={recording.id} className={`recording-item ${recording.rating}`}>
                      <button className="take-preview" aria-label={`Preview ${recording.fileName}`} onClick={() => void openTakePreview(recording)}><span><Play size={16} fill="currentColor" /></span></button>
                      <div className="take-copy">
                        {editingTakeId === recording.id ? (
                          <span className="take-rename"><input autoFocus aria-label="Rename recording" placeholder="Name this recording" value={editingTakeName} onChange={(event) => setEditingTakeName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void commitTakeRename(recording); if (event.key === "Escape") { setEditingTakeId(null); setEditingTakeName(""); } }} /><button aria-label="Save recording name" disabled={!editingTakeName.trim()} onClick={() => void commitTakeRename(recording)}><Check size={13} /></button></span>
                        ) : <strong title={recording.fileName}>{shortName(recording.fileName.replace(/\.mp4$/i, ""), 28)}</strong>}
                        <small>{formatDuration(recording.durationSeconds)} · {formatBytes(recording.bytes)} · {recording.width}×{recording.height}</small>
                        <em>{new Date(recording.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</em>
                      </div>
                      <div className="take-actions">
                        <button className={recording.rating === "favorite" ? "active" : ""} aria-label="Favorite take" onClick={() => void rateTake(recording, "favorite")}><Heart size={14} fill={recording.rating === "favorite" ? "currentColor" : "none"} /></button>
                        <button aria-label="Rename recording" onClick={() => { setEditingTakeId(recording.id); setEditingTakeName(recording.fileName.replace(/\.mp4$/i, "")); }}><Pencil size={14} /></button>
                        <button aria-label={`Finish and download ${recording.fileName}`} onClick={() => void openFinishTake(recording)}>{recording.url ? <Download size={14} /> : <Archive size={14} />}</button>
                        <button aria-label={`Remove or delete ${recording.fileName}`} title="Remove or delete take" onClick={() => setPendingDeleteTakeId(recording.id)}><Trash2 size={14} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>

        </section>

        <aside className="signal-rail creator-sidebar" data-sidebar-page={sidebarPage} aria-label="Styles, media, gesture detection and takes">
          <header className="creator-sidebar-header">
            <div className="creator-brand"><span><Hand size={18} /></span><div><strong>Rii-Flow</strong><small>PRESENTATION OS</small></div></div>
            <div className={`creator-gesture ${detected.gesture || manipulation.mode !== "idle" ? "active" : ""}`} aria-live="polite">
              <i />
              <span><small>Gesture</small><strong>{manipulation.mode !== "idle" ? manipulationHeadline : gestureLabel(detected.gesture)}</strong></span>
            </div>
          </header>

          <nav className="creator-page-tabs" aria-label="Sidebar pages">
            <button className={sidebarPage === "setup" ? "active" : ""} onClick={() => { setSidebarPage("setup"); setWidgetPanelOpen(false); }}><LayoutGrid size={15} /> Setup</button>
            <button className={sidebarPage === "widgets" ? "active" : ""} onClick={() => { setSidebarPage("widgets"); setWidgetPanelOpen(true); setWidgetPanelMode("stickers"); }}><Sparkles size={15} /> Widgets</button>
            <button className={sidebarPage === "downloads" ? "active" : ""} onClick={() => { setSidebarPage("downloads"); setWidgetPanelOpen(false); }}><Download size={15} /> Downloads</button>
          </nav>

          {sidebarPage === "setup" && <section className="guided-production-flow" aria-label="Four-step video workflow">
            <header><small>YOUR VIDEO PLAN</small><strong>Four steps. One finished video.</strong><p>Only the highlighted step is open. Finish it, then continue.</p></header>

            <section className={guidedWorkflowStep === 1 ? "current" : guidedWorkflowStep > 1 ? "complete" : "locked"}>
              <button className="workflow-step-heading" onClick={() => setGuidedWorkflowStep(1)}><b>1</b><span><strong>Import media</strong><small>{assets.filter((asset) => asset.kind !== "text").length ? `${assets.filter((asset) => asset.kind !== "text").length} files ready` : "Add what you want to show"}</small></span>{guidedWorkflowStep > 1 && <em><Check size={13} /> Done</em>}</button>
              {guidedWorkflowStep === 1 && <div className="workflow-step-body">
                <button className="workflow-primary" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> {assets.some((asset) => asset.kind !== "text") ? "Import from another folder" : "Choose photos or videos"}</button>
                {assets.some((asset) => asset.kind !== "text") && <p className="workflow-gesture-note"><Hand size={14} /><span><strong>Direct gestures are optional.</strong> Pointing, open palm, thumbs-up and fists remain reserved for universal controls.</span></p>}
                <div className="workflow-media-assignment-list">
                  {assets.filter((asset) => asset.kind !== "text").map((asset) => <div className={`workflow-file-card ${asset.kind}`} key={asset.id}>
                    <div className="workflow-asset-visual">
                      <div className={`workflow-asset-preview ${asset.kind}`} aria-label={`Preview of ${asset.name}`}>
                        {asset.kind === "image" && asset.sourceUrl ? <img src={asset.sourceUrl} alt={`Preview of ${asset.name}`} /> : asset.kind === "video" && asset.sourceUrl ? <video src={asset.sourceUrl} muted playsInline preload="metadata" aria-label={`Paused preview of ${asset.name}`} onLoadedMetadata={(event) => { const video = event.currentTarget; const previewTime = Math.max(.04, asset.videoTrim?.start ?? .04); video.currentTime = Math.min(previewTime, Math.max(0, video.duration - .04)); }} /> : <span>{asset.kind === "csv" ? <FileSpreadsheet size={32} /> : <FileJson2 size={32} />}<strong>{asset.kind.toUpperCase()}</strong></span>}
                        <em>{asset.kind === "video" ? <><Play size={11} fill="currentColor" /> Video preview</> : asset.kind === "image" ? <><ImageIcon size={11} /> Image preview</> : <>Data file</>}</em>
                      </div>
                      <span className="workflow-file"><i>{asset.kind === "video" ? <Video size={13} /> : asset.kind === "image" ? <ImageIcon size={13} /> : <FileSpreadsheet size={13} />}</i><strong title={asset.name}>{shortName(asset.name, 28)}</strong>{(asset.kind === "image" || asset.kind === "video") && <button className="workflow-file-edit" aria-label={`${asset.kind === "video" ? "Trim" : "Crop"} ${asset.name}`} title={asset.kind === "video" ? "Trim video" : "Crop image"} onClick={() => openAssetEditor(asset)}>{asset.kind === "video" ? <Scissors size={13} /> : <Crop size={13} />}<span>{asset.kind === "video" ? "Trim" : "Crop"}</span></button>}<button aria-label={`Remove ${asset.name}`} title="Remove media" onClick={() => removeAsset(asset)}><X size={13} /></button></span>
                    </div>
                    {asset.kind === "video" && <button className={`workflow-video-audio ${asset.includeAudio ? "active" : ""}`} aria-pressed={Boolean(asset.includeAudio)} onClick={() => toggleVideoAudio(asset)}>{asset.includeAudio ? <Volume2 size={13} /> : <VolumeX size={13} />}<span><strong>{asset.includeAudio ? "Video sound included" : "Video sound muted"}</strong><small>{asset.includeAudio ? "Will be heard in the final recording" : "Click to include it in the recording"}</small></span></button>}
                    <div className="workflow-assignment-label"><Sparkles size={13} /><span>Entrance settings</span></div>
                    <div className="workflow-file-options">
                      <label><span>Animation</span><select aria-label={`Spawn animation for ${asset.name}`} value={asset.entranceAnimation ?? "fade"} onChange={(event) => updateAsset(asset.id, { entranceAnimation: event.target.value as EntranceAnimation })}>{ENTRANCE_ANIMATIONS.map((animation) => <option key={animation.id} value={animation.id}>{animation.label}</option>)}</select></label>
                      <label><span>Sound</span><select aria-label={`Spawn sound for ${asset.name}`} value={asset.cueSound ?? "none"} onChange={(event) => updateAsset(asset.id, { cueSound: event.target.value as CueSound })}>{CUE_SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</select></label>
                      <div className="workflow-size-picker" role="group" aria-label={`Spawn size for ${asset.name}`}>
                        <span><strong>Size</strong><small>On screen</small></span>
                        <div>{ASSET_SIZES.map((size) => { const selected = asset.size === size.id; return <button type="button" key={size.id} className={selected ? "active" : ""} aria-label={`${size.label} spawn size for ${asset.name}`} aria-pressed={selected} onClick={() => updateAsset(asset.id, { size: size.id, transform: undefined })}><i className={`spawn-size-visual ${size.id}`}><b /></i><span>{size.label}</span>{selected && <Check size={12} />}</button>; })}</div>
                      </div>
                      <div className="workflow-gesture-picker" role="group" aria-label={`Direct gesture for ${asset.name}`}>
                        <span className="workflow-gesture-picker-title"><Hand size={14} /><strong>Choose a gesture</strong><small>Optional</small></span>
                        <div>
                          <button type="button" className={!asset.gesture ? "active" : ""} aria-label={`No direct gesture for ${asset.name}`} aria-pressed={!asset.gesture} onClick={() => assignGesture(asset.id, undefined)}><i className="gesture-choice-none">—</i><span>None</span>{!asset.gesture && <Check size={12} />}</button>
                          {STANDALONE_ASSET_GESTURES.map((gesture) => {
                            const visual = gesture.id === "double-one" ? "Both index" : gesture.id === "two" ? "Two" : gesture.id === "three" ? "Three" : "Four";
                            const selected = asset.gesture === gesture.id;
                            return <button type="button" key={gesture.id} className={selected ? "active" : ""} title={gestureOptionLabel(gesture.id, asset.id, asset.gesture)} aria-label={`${gesture.label} for ${asset.name}`} aria-pressed={selected} onClick={() => assignGesture(asset.id, gesture.id)}><GesturePosture gesture={gesture.id} /><span>{visual}</span>{selected && <Check size={12} />}</button>;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>)}
                </div>
                <button className="workflow-continue" disabled={!assets.some((asset) => asset.kind !== "text")} onClick={() => setGuidedWorkflowStep(2)}>Media ready—continue <ArrowRight size={14} /></button>
              </div>}
            </section>

            <section data-tour-target="groups" className={guidedWorkflowStep === 2 ? "current" : guidedWorkflowStep > 2 ? "complete" : "locked"}>
              <button className="workflow-step-heading" disabled={guidedWorkflowStep < 2} onClick={() => setGuidedWorkflowStep(2)}><b>2</b><span><strong>Make groups</strong><small>{scenes.length ? `${scenes.length} scene${scenes.length === 1 ? "" : "s"} created` : "Group media that belongs together"}</small></span>{guidedWorkflowStep > 2 && <em><Check size={13} /> Done</em>}</button>
              {guidedWorkflowStep === 2 && <div className="workflow-step-body"><button className="workflow-primary" disabled={assets.filter((asset) => asset.kind !== "text").length < 2} onClick={() => { setSceneBuilderOpen(true); window.setTimeout(() => document.querySelector(".scene-creator-simple")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }}><LayoutGrid size={16} /> {scenes.length ? "Make another scene" : "Make a scene"}</button>{scenes.map((scene) => { const layerId = sceneLayerId(scene.id); return <span className="workflow-scene" key={scene.id}><LayoutGrid size={14} /><strong>{shortName(scene.name, 19)}</strong><span className="workflow-scene-actions"><label><Hand size={12} /><select data-testid={`workflow-scene-gesture-${scene.id}`} aria-label={`Hand gesture for scene ${scene.name}`} value={scene.gesture ?? ""} onChange={(event) => assignSceneGesture(scene.id, (event.target.value || undefined) as GestureId | undefined)}><option value="">No gesture</option>{STANDALONE_ASSET_GESTURES.map((gesture) => <option key={gesture.id} value={gesture.id}>{gestureOptionLabel(gesture.id, layerId, scene.gesture)}</option>)}</select><ChevronDown size={11} /></label></span></span>; })}<p className="workflow-gesture-note"><Hand size={14} /><span><strong>A scene gesture reveals the complete composition.</strong> Widgets stay in the separate advanced Widgets tab.</span></p><button className="workflow-continue" onClick={() => setGuidedWorkflowStep(3)}>{scenes.length ? "Groups are ready" : "Skip groups"}<ArrowRight size={14} /></button></div>}
            </section>

            <section className={guidedWorkflowStep === 3 ? "current" : guidedWorkflowStep > 3 ? "complete" : "locked"}>
              <button className="workflow-step-heading" disabled={guidedWorkflowStep < 3} onClick={() => setGuidedWorkflowStep(3)}><b>3</b><span><strong>Choose deck layout</strong><small>Pick how media waits on screen</small></span>{guidedWorkflowStep > 3 && <em><Check size={13} /> Done</em>}</button>
              {guidedWorkflowStep === 3 && <div className="workflow-decks"><button onClick={() => { selectVideoStyle("top-shelf"); setGuidedWorkflowStep(4); }}><i className="look-preview clean"><b /><b /><b /></i><strong>Top deck</strong></button><button onClick={() => { selectVideoStyle("right-rail"); setGuidedWorkflowStep(4); }}><i className="look-preview side"><b /><b /></i><strong>Side deck</strong></button><button onClick={() => { selectVideoStyle("spatial"); setGuidedWorkflowStep(4); }}><i className="look-preview free"><b /><b /><b /></i><strong>Freeform</strong></button></div>}
            </section>

            <section className={guidedWorkflowStep === 4 ? "current" : "locked"}>
              <button className="workflow-step-heading" disabled={guidedWorkflowStep < 4} onClick={() => setGuidedWorkflowStep(4)}><b>4</b><span><strong>Make the video</strong><small>{studioReady ? "Camera ready—press Record" : "Camera starts automatically"}</small></span>{studioReady && <em><Check size={13} /> Ready</em>}</button>
              {guidedWorkflowStep === 4 && <div className="simple-record-location"><ArrowDown size={16} /><span><strong>{studioReady ? "Press Record below the canvas" : "Camera and gestures are starting automatically"}</strong><small>Talk naturally and use your gestures</small></span></div>}
            </section>

            <section className="workflow-workspace-tools" aria-label="Workspace tools"><label><span><strong>Move dock</strong><small>Slide it to a comfortable position</small></span><input type="range" min={videoStyleId.includes("shelf") ? "0.04" : "0"} max={videoStyleId.includes("shelf") ? "0.8" : "1"} step="0.01" value={deckPlacement} disabled={videoStyleId === "spatial"} onChange={(event) => setDeckPlacement(Number(event.target.value))} /></label><div><span><strong>Workspace editor</strong><small>Edit scenes or clear the project</small></span><button onClick={() => setSceneBuilderOpen(true)}><LayoutGrid size={14} /> Open editor</button><button className="danger" disabled={isRecording || isFinalizing || (!assets.length && !scenes.length && !widgets.length)} onClick={clearWorkspace}><Trash2 size={14} /> Clear</button></div></section>
          </section>}

          {simpleExtrasOpen && sidebarPage === "setup" && <section className="manual-settings-panel" aria-label="Manual controls">
            <header><span><small>OPTIONAL</small><strong>Manual controls</strong><p>Nothing here is required to make a video.</p></span><button aria-label="Close manual controls" onClick={() => setSimpleExtrasOpen(false)}><X size={17} /></button></header>
            <section><header><Monitor size={16} /><span><strong>Video output</strong><small>Standard widescreen recording</small></span></header><div className="manual-field-grid"><label><span>Quality</span><select value={qualityId} disabled={isRecording} onChange={(event) => void handleQualityChange(event.target.value as QualityId)}>{QUALITY_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label><div className="manual-fixed-ratio"><span>Canvas</span><strong>16:9 widescreen</strong></div></div><button className={`manual-toggle ${mirrorCamera ? "active" : ""}`} onClick={() => setMirrorCamera((value) => !value)}><FlipHorizontal2 size={15} /><span><strong>Mirror camera</strong><small>{mirrorCamera ? "On" : "Off"}</small></span><i /></button></section>
            <section><header><Layers3 size={16} /><span><strong>Deck behavior</strong><small>How the deck appears while presenting</small></span></header><div className="manual-choice-row">{ASSET_DECK_MODES.map((mode) => <button key={mode.id} className={assetDeckMode === mode.id ? "active" : ""} onClick={() => chooseAssetDeckMode(mode.id)}>{mode.id === "always" ? <Eye size={14} /> : <Hand size={14} />}{mode.label}</button>)}</div>{videoStyleId !== "spatial" && <label className="manual-range"><span>Deck position</span><input type="range" min={videoStyleId.includes("shelf") ? "0.04" : "0"} max={videoStyleId.includes("shelf") ? "0.8" : "1"} step="0.01" value={deckPlacement} onChange={(event) => setDeckPlacement(Number(event.target.value))} /></label>}</section>
            <section><header><Settings2 size={16} /><span><strong>Workspace</strong><small>Project-level actions</small></span></header><div className="manual-choice-row"><button onClick={() => setSceneBuilderOpen(true)}><LayoutGrid size={14} /> Edit scenes</button><button className="danger" disabled={isRecording || isFinalizing || (!assets.length && !scenes.length && !widgets.length)} onClick={clearWorkspace}><Trash2 size={14} /> Clear workspace</button></div></section>
          </section>}

          <section className="simple-create-flow" aria-labelledby="simple-create-title">
            <header><small>START HERE</small><strong id="simple-create-title">Make a video</strong><p>Three quick choices. You can change any of them later.</p></header>

            <section className="simple-create-step" data-tour-target="media">
              <header><b>1</b><span><strong>Add what you want to show</strong><small>Photos and videos work best</small></span>{assets.length > 0 && <em><Check size={12} /> {assets.filter((asset) => asset.kind !== "text").length}</em>}</header>
              <button className="simple-import" disabled={isFinalizing} onClick={() => fileInputRef.current?.click()}><Upload size={17} /> {assets.length ? "Add more media" : "Choose photos or videos"}</button>
              {assets.filter((asset) => asset.kind !== "text").length > 0 && <div className="simple-media-list">{assets.filter((asset) => asset.kind !== "text").slice(0, 4).map((asset) => <span key={asset.id}><i>{asset.kind === "image" ? <ImageIcon size={13} /> : asset.kind === "video" ? <Video size={13} /> : <FileSpreadsheet size={13} />}</i><strong>{shortName(asset.name, 22)}</strong><button aria-label={`Remove ${asset.name}`} onClick={() => removeAsset(asset)}><X size={13} /></button></span>)}{assets.filter((asset) => asset.kind !== "text").length > 4 && <small>+{assets.filter((asset) => asset.kind !== "text").length - 4} more</small>}</div>}
            </section>

            <section className="simple-create-step simple-look-step" data-tour-target="layout">
              <header><b>2</b><span><strong>Choose a look</strong><small>No design knowledge needed</small></span><em><Check size={12} /> Set</em></header>
              <div className="simple-look-grid">
                <button className={videoStyleId === "center-shelf" || videoStyleId === "top-shelf" ? "active" : ""} disabled={isRecording || isFinalizing} onClick={() => selectVideoStyle("top-shelf")}><i className="look-preview clean"><b /><b /><b /></i><span><strong>Clean</strong><small>Media deck at the top</small></span></button>
                <button className={videoStyleId === "right-rail" || videoStyleId === "left-rail" ? "active" : ""} disabled={isRecording || isFinalizing} onClick={() => selectVideoStyle("right-rail")}><i className="look-preview side"><b /><b /></i><span><strong>Side by side</strong><small>You and media together</small></span></button>
                <button className={videoStyleId === "spatial" ? "active" : ""} disabled={isRecording || isFinalizing} onClick={() => selectVideoStyle("spatial")}><i className="look-preview free"><b /><b /><b /></i><span><strong>Freeform</strong><small>Place things yourself</small></span></button>
              </div>
            </section>

            <section className="simple-create-step simple-ready-step" data-tour-target="record">
              <header><b>3</b><span><strong>{isRecording ? "You’re recording" : studioReady ? "You’re ready to record" : "Start your camera"}</strong><small>{isRecording ? "Everything on the canvas is being captured" : studioReady ? "Use gestures naturally while you talk" : "Use the large button below the canvas"}</small></span>{studioReady && <em><Check size={12} /> Ready</em>}</header>
              <div className="simple-record-location"><ArrowDown size={16} /><span><strong>{isRecording ? "Stop when you’re finished" : studioReady ? "Press Record below the canvas" : "Press Start Studio below the canvas"}</strong><small>That is the only recording control you need</small></span></div>
            </section>

            <button className={`simple-more-toggle ${simpleExtrasOpen ? "active" : ""}`} onClick={() => setSimpleExtrasOpen((open) => !open)}><Settings2 size={16} /><span><strong>{simpleExtrasOpen ? "Hide extra options" : "More options"}</strong><small>Detailed layouts, scenes and controls</small></span><ChevronDown size={15} /></button>
          </section>

          <button className="tutorial-launcher" type="button" onClick={() => { setTutorialStep(0); setTutorialOpen(true); }}><span><HelpCircle size={19} /></span><span><strong>New here?</strong><small>Take the 2-minute guided tour</small></span><ArrowRight size={16} /></button>

          <section className="style-media-panel" data-tour-target="media" aria-labelledby="style-media-title">
            <header>
              <span><small>Visual library</small><strong id="style-media-title">Your media</strong></span>
              <div className="workspace-actions"><button type="button" className="scene-workspace-action" onClick={() => setSceneBuilderOpen((open) => !open)}><span><LayoutGrid size={16} /></span><span><strong>{sceneBuilderOpen ? "Close scene builder" : "Build a scene"}</strong><small>Group media into one reusable layout</small></span></button><button type="button" className="clear-workspace" title="Remove every imported visual, saved scene, and widget from this workspace" disabled={isRecording || isFinalizing || (!assets.length && !scenes.length && !widgets.length)} onClick={clearWorkspace}><span><Trash2 size={17} /></span><span><strong>Clear entire workspace</strong><small>Remove all media, scenes and widgets</small></span></button></div>
            </header>
            <input ref={widgetAudioInputRef} className="visually-hidden" type="file" accept="audio/mpeg,audio/mp3,audio/*" onChange={importWidgetAudio} />
            {sceneBuilderOpen && <div className="quick-creator scene-creator-simple">
              <header><span><small>Saved moment</small><strong>Make a scene</strong></span><button aria-label="Close scene creator" onClick={() => setSceneBuilderOpen(false)}><X size={15} /></button></header>
              <p>A scene shows several things together.</p>
              <input aria-label="Scene name" value={sceneDraftName} onChange={(event) => setSceneDraftName(event.target.value)} />
              <div className="simple-scene-templates">{SCENE_TEMPLATES.map((template) => <button key={template.id} className={sceneDraftLayout === template.id ? "active" : ""} onClick={() => setSceneDraftLayout(template.id)}><i className={`template-mini ${template.id}`}><b /><b /><b /></i><span><strong>{template.label}</strong><small>{template.detail}</small></span></button>)}</div>
              <strong className="simple-step-label">Choose at least two pictures or videos</strong>
              <div className="simple-scene-assets">{assets.filter((asset) => asset.kind !== "text").map((asset) => <button key={asset.id} className={sceneDraftMembers.includes(asset.id) ? "active" : ""} onClick={() => toggleSceneDraftMember(asset.id)}>{asset.kind === "image" ? <img src={asset.sourceUrl} alt="" /> : <Video size={18} />}<span>{shortName(asset.name, 16)}</span>{sceneDraftMembers.includes(asset.id) && <Check size={14} />}</button>)}</div>
              <button className="quick-create-confirm" disabled={sceneDraftMembers.length < 2} onClick={createScene}><Plus size={15} /> Save scene</button>
            </div>}
            {widgetPanelOpen && <div className="quick-creator widget-creator">
              <header><span><small>Canvas stickers</small><strong>{widgetPanelMode === "stickers" ? "Sticker library" : "Sticker settings"}</strong></span><button aria-label="Close widget creator" onClick={() => setWidgetPanelOpen(false)}><X size={15} /></button></header>
              <div className="widget-panel-toggle"><button className={widgetPanelMode === "stickers" ? "active" : ""} onClick={() => setWidgetPanelMode("stickers")}><Sparkles size={13} /> Stickers</button><button className={widgetPanelMode === "settings" ? "active" : ""} disabled={!selectedWidget} onClick={() => setWidgetPanelMode("settings")}><Settings2 size={13} /> Settings</button></div>
              {widgetPanelMode === "stickers" && scenes.length > 0 && <div className="widget-special-picker">{scenes.map((scene) => <button key={scene.id} onClick={() => createCanvasWidget("orbit", { x: .5, y: .5 }, scene.id)}><FolderOpen size={17} /><span><strong>{shortName(scene.name, 20)}</strong><small>Scene file widget</small></span></button>)}</div>}
              {widgetPanelMode === "stickers" ? <><div className="widget-kind-picker"><button onClick={() => createCanvasWidget("vinyl")}><Music2 size={18} /> Music vinyl</button><button onClick={() => createCanvasWidget("orbit")}><FolderOpen size={18} /> Media files</button><button onClick={() => createCanvasWidget("media")}><Maximize2 size={18} /> Media launcher</button><button onClick={() => createCanvasWidget("bullets")}><ListVideo size={18} /> Bullet list</button><button onClick={() => createCanvasWidget("sticker")}><Sparkles size={18} /> Action sticker</button></div>{widgets.length > 0 && <div className="widget-instance-list">{widgets.filter((widget) => widget.kind !== "live").map((widget) => <div key={widget.id} className={widget.id === selectedWidgetId ? "active" : ""}><button className="widget-instance-main" onClick={() => { setSelectedWidgetId(widget.id); setWidgetPanelMode("settings"); }}><span>{widget.kind === "vinyl" ? <Music2 size={15} /> : widget.kind === "orbit" ? <FolderOpen size={15} /> : widget.kind === "media" ? <Maximize2 size={15} /> : widget.kind === "bullets" ? <ListVideo size={15} /> : <Sparkles size={15} />}</span><span><strong>{widget.title}</strong><small>{widget.visible ? "Visible" : "Hidden"} · {widget.kind === "vinyl" ? widget.audioName ?? "Needs MP3" : widget.kind === "orbit" ? `${widget.assetIds?.length ?? 0} files` : widget.kind === "media" ? assets.find((asset) => asset.id === widget.actionAssetId)?.name ?? "Choose one media" : widget.kind === "bullets" ? `${widget.items.length} bullets` : "Action sticker"}</small></span></button><span className="widget-instance-actions"><button className="widget-visibility-toggle" onClick={() => { updateCanvasWidget(widget.id, { visible: !widget.visible, open: widget.visible ? false : widget.open, playing: widget.visible ? false : widget.playing, active: widget.visible ? false : widget.active }); if (widget.visible) widgetAudioRef.current.get(widget.id)?.pause(); }}>{widget.visible ? "Hide" : "Show"}</button><button className="widget-remove-button" aria-label={`Remove ${widget.title}`} onClick={() => removeCanvasWidget(widget)}><Trash2 size={13} /> Remove</button></span></div>)}</div>}</> : !selectedWidget ? <p className="widget-settings-empty">Choose a sticker from the library first.</p> : <>
                <label className="widget-field"><span>Name</span><input value={selectedWidget.title} onChange={(event) => updateCanvasWidget(selectedWidget.id, { title: event.target.value })} /></label>
                <label className="widget-field"><span>Frame</span><select aria-label={`${selectedWidget.title} frame`} value={selectedWidget.frameStyle ?? "none"} onChange={(event) => updateCanvasWidget(selectedWidget.id, { frameStyle: event.target.value as WidgetFrameStyle })}><option value="none">No frame</option><option value="windows">Windows desktop</option><option value="mac">Mac desktop</option><option value="rpg">RPG tile</option></select></label>
                <label className="widget-field"><span>Widget colour</span><input aria-label={`${selectedWidget.title} colour`} type="color" value={selectedWidget.color ?? (selectedWidget.kind === "sticker" ? "#ffffff" : "#68122f")} onChange={(event) => updateCanvasWidget(selectedWidget.id, { color: event.target.value })} /></label>
                {selectedWidget.kind === "vinyl" && <><div className="widget-audio-controls"><button className="widget-audio-button" onClick={() => widgetAudioInputRef.current?.click()}><Music2 size={15} /> {selectedWidget.audioName ?? "Choose an MP3"}</button>{selectedWidget.audioName && <button className="widget-audio-preview" onClick={() => activateCanvasWidget(selectedWidget)}>{selectedWidget.playing ? "Pause music" : "Play music"}</button>}</div><label className="widget-field"><span>Music volume <b>{Math.round((selectedWidget.volume ?? .8) * 100)}%</b></span><input aria-label="Vinyl music volume" type="range" min="0" max="1" step="0.01" value={selectedWidget.volume ?? .8} onChange={(event) => { const volume = Number(event.target.value); const audio = widgetAudioRef.current.get(selectedWidget.id); if (audio) audio.volume = volume; updateCanvasWidget(selectedWidget.id, { volume }); }} /></label><p className="widget-point-help"><MousePointer2 size={13} /> Point and hold on the vinyl to play or pause.</p></>}
                {selectedWidget.kind === "media" && <><label className="widget-field"><span>Standalone media</span><select aria-label="Standalone media" value={selectedWidget.actionAssetId ?? ""} onChange={(event) => updateCanvasWidget(selectedWidget.id, { actionAssetId: event.target.value || undefined, active: false })}><option value="">Choose one photo or video</option>{assets.filter((asset) => asset.kind === "image" || asset.kind === "video").map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label><button className="widget-audio-button" disabled={!selectedWidget.actionAssetId} onClick={() => activateCanvasWidget(selectedWidget)}><Maximize2 size={15} /> {selectedWidget.active ? "Close full screen" : "Preview full screen"}</button><p className="widget-point-help"><MousePointer2 size={13} /> Point and hold on this launcher: the media fills the canvas and your camera moves to the bottom right.</p></>}
                {selectedWidget.kind === "live" && <><p className="widget-point-help"><Radio size={13} /> This widget controls the live screen feed. Point and hold to make it the main visual.</p><button className="widget-audio-button" disabled={!screenCaptureSupported || isRecording} onClick={() => void startScreenShare()}><Monitor size={15} /> {screenSettings ? "Change live feed" : "Choose live feed"}</button></>}
                {selectedWidget.kind === "orbit" && <><p className="widget-point-help"><MousePointer2 size={13} /> Point at the folder to open. Flick your palm tips along the crescent, then point at a file or scene.</p><div className="widget-audio-controls"><button onClick={() => activateCanvasWidget(selectedWidget)}>{selectedWidget.open ? "Close files" : "Preview files"}</button><button onClick={() => updateCanvasWidget(selectedWidget.id, { assetIds: assets.filter((asset) => asset.kind !== "text").map((asset) => asset.id), sceneIds: scenes.map((scene) => scene.id), orbitOffset: 0 })}>Use everything</button></div><strong className="orbit-picker-label">Media files</strong><div className="orbit-asset-picker">{assets.filter((asset) => asset.kind !== "text").map((asset) => { const included = selectedWidget.assetIds?.includes(asset.id) ?? false; return <label key={asset.id} className={included ? "active" : ""}><input type="checkbox" checked={included} onChange={() => updateCanvasWidget(selectedWidget.id, { assetIds: included ? (selectedWidget.assetIds ?? []).filter((id) => id !== asset.id) : [...(selectedWidget.assetIds ?? []), asset.id], orbitOffset: 0 })} /><span>{shortName(asset.name, 22)}</span></label>; })}</div>{scenes.length > 0 && <><strong className="orbit-picker-label">Saved scenes</strong><div className="orbit-asset-picker">{scenes.map((scene) => { const included = selectedWidget.sceneIds?.includes(scene.id) ?? false; return <label key={scene.id} className={included ? "active" : ""}><input type="checkbox" checked={included} onChange={() => updateCanvasWidget(selectedWidget.id, { sceneIds: included ? (selectedWidget.sceneIds ?? []).filter((id) => id !== scene.id) : [...(selectedWidget.sceneIds ?? []), scene.id], orbitOffset: 0 })} /><span>{shortName(scene.name, 22)}</span></label>; })}</div></>}</>}
                {selectedWidget.kind === "bullets" && <label className="widget-field"><span>One bullet per line</span><textarea rows={4} value={selectedWidget.items.join("\n")} onChange={(event) => { const items = event.target.value.split("\n").filter(Boolean); updateCanvasWidget(selectedWidget.id, { items, revealed: items.length }); }} /></label>}
                {selectedWidget.kind === "sticker" && <><label className="widget-field"><span>Sticker</span><select value={selectedWidget.sticker} onChange={(event) => updateCanvasWidget(selectedWidget.id, { sticker: event.target.value as CanvasWidget["sticker"] })}><option value="star">Star</option><option value="heart">Heart</option><option value="spark">Spark</option></select></label><label className="widget-field"><span>Pointing opens</span><select value={selectedWidget.actionAssetId ?? ""} onChange={(event) => updateCanvasWidget(selectedWidget.id, { actionAssetId: event.target.value || undefined })}><option value="">Choose media</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label></>}
                <div className="widget-position-grid"><label><span>Left / right</span><input type="range" min="0.08" max="0.92" step="0.01" value={selectedWidget.x} onChange={(event) => updateCanvasWidget(selectedWidget.id, { x: Number(event.target.value) })} /></label><label><span>Up / down</span><input type="range" min="0.1" max="0.9" step="0.01" value={selectedWidget.y} onChange={(event) => updateCanvasWidget(selectedWidget.id, { y: Number(event.target.value) })} /></label><label><span>Size</span><input aria-label={`${selectedWidget.title} size`} type="range" min={selectedWidget.kind === "orbit" ? "0.28" : "0.55"} max="1.8" step="0.04" value={selectedWidget.scale} onChange={(event) => updateCanvasWidget(selectedWidget.id, { scale: Number(event.target.value) })} /></label></div>
                <div className="widget-editor-actions"><button onClick={() => setWidgetPanelMode("stickers")}>Back to stickers</button><button className={selectedWidget.visible ? "danger" : ""} onClick={() => { updateCanvasWidget(selectedWidget.id, { visible: !selectedWidget.visible, playing: selectedWidget.visible ? false : selectedWidget.playing, active: selectedWidget.visible ? false : selectedWidget.active }); if (selectedWidget.visible) widgetAudioRef.current.get(selectedWidget.id)?.pause(); }}>{selectedWidget.visible ? "Hide sticker" : "Show sticker"}</button></div>
              </>}
            </div>}
            <button className="style-media-import" disabled={isFinalizing} onClick={() => fileInputRef.current?.click()}>
              <span><Upload size={20} /></span>
              <span><strong>Add photos or videos</strong><small>Images, videos, CSV, or JSON</small></span>
              <Plus size={18} />
            </button>
            <div className="style-media-list">
              {scenes.length > 0 && <div className="style-media-section-label"><Layers3 size={12} /><span><strong>Scene effects</strong><small>Reusable arrangements; originals stay separate</small></span></div>}
              {scenes.map((scene) => {
                const sceneAssets = scene.memberIds.map((id) => assets.find((asset) => asset.id === id)).filter((asset): asset is StudioAsset => Boolean(asset));
                return <article key={scene.id} className={`style-media-item voice-scene-item ${activeScene?.id === scene.id ? "focused" : ""}`}>
                  <button className="style-media-thumb scene-grid-thumb" aria-label={`Open ${scene.name}`} onClick={() => { const layer = resolveLayer(sceneLayerId(scene.id), assets, scenes); if (layer) void activateLayerFromLibrary(layer); }}>
                    {sceneAssets.slice(0, 4).map((asset) => asset.kind === "image" ? <img key={asset.id} src={asset.sourceUrl} alt="" /> : <span key={asset.id}>{asset.kind === "video" ? <Video size={13} /> : <FileSpreadsheet size={13} />}</span>)}
                  </button>
                  <div className="style-media-copy"><strong title={scene.name}>{shortName(scene.name, 25)}</strong><small>{activeScene?.id === scene.id ? "Scene on stage" : `${sceneAssets.length} assets · scene option · point to open`}</small></div>
                </article>;
              })}
              {scenes.length > 0 && dockAssets.length > 0 && <div className="style-media-section-label"><ImageIcon size={12} /><span><strong>Individual assets</strong><small>Every original remains independently callable</small></span></div>}
              {dockAssets.length === 0 && scenes.length === 0 ? (
                <div className="style-media-empty"><Hand size={21} /><strong>Your media will appear here</strong><small>Import, then point and hold to open.</small></div>
              ) : dockAssets.map((asset) => (
                <article key={asset.id} className={`style-media-item ${asset.id === SCREEN_OVERLAY_ID ? "screen-asset" : ""} ${activeAsset?.id === asset.id ? "focused" : ""}`}>
                  <button className="style-media-thumb" aria-label={`Focus ${asset.name} from media rail`} onClick={() => focusVideoStyleAsset(asset)}>
                    {asset.id === SCREEN_OVERLAY_ID ? <span className="style-screen-thumb"><Monitor size={22} /><b>LIVE</b></span> : asset.kind === "image" ? <img src={asset.sourceUrl} alt="" /> : asset.kind === "video" ? <video src={asset.sourceUrl} muted playsInline preload="metadata" aria-hidden="true" /> : asset.kind === "text" ? <span className="style-text-thumb"><Type size={22} /><b>{shortName(asset.textContent ?? asset.name, 18)}</b></span> : asset.kind === "csv" ? <FileSpreadsheet size={24} /> : <FileJson2 size={24} />}
                    {asset.kind === "video" && asset.id !== SCREEN_OVERLAY_ID && <em>{activeAsset?.id === asset.id ? "Playing" : "Paused"}</em>}
                  </button>
                  <div className="style-media-copy"><strong title={asset.name}>{asset.id === SCREEN_OVERLAY_ID ? "Shared screen" : shortName(asset.name, 25)}</strong><small>{activeAsset?.id === asset.id ? "Open on stage" : asset.id === SCREEN_OVERLAY_ID ? `${screenSurfaceName} · point to open` : "Point to open"}</small></div>
                  <div className="style-media-actions">
                    {asset.id === SCREEN_OVERLAY_ID ? <>
                      <button disabled={isRecording || screenPhase === "permission"} aria-label="Change shared screen" onClick={() => void startScreenShare()}><Repeat2 size={13} /><span>Change</span></button>
                      <button className="danger" disabled={isRecording} aria-label="Stop screen sharing" onClick={() => endScreenShare()}><X size={13} /><span>Stop</span></button>
                    </> : <>
                      {(asset.kind === "image" || asset.kind === "video") && <button aria-label={`${asset.kind === "video" ? "Trim" : "Crop"} ${asset.name}`} onClick={() => openAssetEditor(asset)}>{asset.kind === "video" ? <Scissors size={13} /> : <Crop size={13} />}<span>{asset.kind === "video" ? "Trim" : "Crop"}</span></button>}
                      <button aria-label={`Remove ${asset.name}`} onClick={() => removeAsset(asset)}><Trash2 size={13} /><span>Remove</span></button>
                    </>}
                  </div>
                  <label className="style-media-spawn"><Sparkles size={13} /><span>Appears with</span><select aria-label={`Spawn style for ${asset.name}`} disabled={isRecording || isFinalizing} value={spawnStyleFor(asset.entranceAnimation, asset.cueSound)} onChange={(event) => applySpawnStyle(asset, event.target.value as SpawnStyleId)}>{spawnStyleFor(asset.entranceAnimation, asset.cueSound) === "custom" && <option value="custom" disabled>Custom setup</option>}{SPAWN_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select><ChevronDown size={13} /></label>
                </article>
              ))}
              {!screenSettings && <article className="style-screen-add">
                <span><Monitor size={20} /></span>
                <span><strong>Add screen recording</strong><small>{studioReady ? "A tab, game, app, or display" : "Available when the camera is ready"}</small></span>
                <button disabled={!screenCaptureSupported || screenPhase === "permission" || !studioReady || isRecording} onClick={() => void startScreenShare()}>{screenPhase === "permission" ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} />} Share</button>
              </article>}
            </div>
            {hiddenStyleAssetCount > 0 && <p className="style-limit-note"><ShieldCheck size={13} /> {videoStyleId === "spatial" ? `Freeform starts with four visible items. Open another from the library whenever you need it.` : videoStyleId === "split-decks" ? `This is a fixed four-card layout. Choose a belt layout to reach ${hiddenStyleAssetCount} more.` : `Four cards visible on stage. Flick near the belt to reach ${hiddenStyleAssetCount} more.`}</p>}
          </section>

          <section className="video-style-panel" data-tour-target="layout" aria-labelledby="video-style-title">
            <header><span><small>Layout</small><strong id="video-style-title">Choose a video layout</strong></span><em>{isRecording ? "Locked while recording" : "Tap the picture you want"}</em></header>
            <div className="video-style-grid">
              {VIDEO_STYLES.map((style) => (
                <button
                  key={style.id}
                  className={`video-style-card ${videoStyleId === style.id ? "active" : ""} ${style.id}`}
                  aria-pressed={videoStyleId === style.id}
                  disabled={isRecording || isFinalizing}
                  onClick={() => selectVideoStyle(style.id)}
                >
                  <span className="style-diagram" aria-hidden="true"><i className="diagram-camera" /><i className="diagram-panel" /><b /><b /><b />{style.id === "split-decks" && <b />}</span>
                  <span><strong>{style.name}</strong><small>{style.detail}</small></span>
                  {videoStyleId === style.id && <Check size={14} />}
                </button>
              ))}
            </div>
            <div className="asset-deck-mode" aria-label="Asset deck visibility">
              <span><Layers3 size={15} /><span><strong>Media deck</strong><small>{assetDeckMode === "always" ? "Ready on stage from the start" : assetDeckVisible ? "Open · fist closes" : "Hidden · thumbs up opens"}</small></span></span>
              <div>
                {ASSET_DECK_MODES.map((mode) => <button key={mode.id} type="button" className={assetDeckMode === mode.id ? "active" : ""} aria-pressed={assetDeckMode === mode.id} disabled={isRecording || isFinalizing} title={mode.detail} onClick={() => chooseAssetDeckMode(mode.id)}>{mode.id === "always" ? <Eye size={13} /> : <Hand size={13} />}{mode.label}</button>)}
              </div>
              {videoStyleId !== "spatial" && videoStyleId !== "split-decks" && <label className="deck-placement-control"><span>{videoStyleId === "top-shelf" || videoStyleId === "center-shelf" || videoStyleId === "bottom-shelf" ? "Move deck up or down" : "Move deck left or right"}</span><input aria-label="Deck placement" type="range" min={videoStyleId.includes("shelf") ? "0.04" : "0"} max={videoStyleId.includes("shelf") ? "0.8" : "1"} step="0.01" value={deckPlacement} onChange={(event) => setDeckPlacement(Number(event.target.value))} /></label>}
              {(videoStyleId === "left-rail" || videoStyleId === "right-rail") && <label className="deck-background-control"><span>Media window background</span><span className="deck-background-options">{[
                ["#15131a", "Ink"], ["#efeae1", "Paper"], ["#5b2027", "Maroon"], ["#17324a", "Blue"]
              ].map(([color, label]) => <button key={color} type="button" className={panelBackground === color ? "active" : ""} aria-label={`${label} media window background`} title={label} style={{ background: color }} onClick={() => setPanelBackground(color)} />)}<input aria-label="Custom media window background" type="color" value={panelBackground} onChange={(event) => setPanelBackground(event.target.value)} /></span></label>}
            </div>
          </section>

          <section className={`gesture-signal ${detected.gesture || manipulation.mode !== "idle" ? "active" : ""}`} aria-live="polite">
            <span className="signal-icon"><Hand size={20} /></span>
            <small>Detected</small>
            <strong data-testid="detected-gesture">{manipulation.mode !== "idle" ? manipulationHeadline : gestureLabel(detected.gesture)}</strong>
            <em>{armed ? "Ready" : "Hold"}</em>
            <i className="signal-progress"><b style={{ width: `${(manipulation.mode.startsWith("arming") ? manipulation.progress : holdProgress) * 100}%` }} /></i>
            {activeGestureCue && activeGestureCue.total > 1 && <span className="live-gesture-cue"><small>{gestureLabel(activeGestureCue.gesture)} sequence</small><strong>{activeGestureCue.index + 1}/{activeGestureCue.total} · {shortName(activeGestureCue.name, 18)}</strong></span>}
          </section>

          <section className="director-rail" aria-label="Live Director status">
            <header><span><Radio size={15} /> Director</span><b>{directorQueue.length ? `${directorCurrentIndex + 1}/${directorQueue.length}` : "0/0"}</b></header>
            {directorCurrentCue ? <>
              <button className={directorCueLive ? "live" : "ready"} onClick={() => void activateLayerFromLibrary(directorCurrentCue)}>
                <small>{directorCueLive ? "ON STAGE" : "READY"}</small>
                <strong>{shortName(layerName(directorCurrentCue), 23)}</strong>
              </button>
              <div><small>UP NEXT</small><strong>{directorNextCue && directorNextCue.id !== directorCurrentCue.id ? shortName(layerName(directorNextCue), 23) : "Story complete"}</strong></div>
            </> : <p>Import a visual to begin.</p>}
          </section>

          <div className="visually-hidden" aria-hidden="true">
            <strong data-testid="actual-resolution">{granted ? `${granted.width}×${granted.height}` : `${outputSize.width}×${outputSize.height}`}</strong>
            <span data-testid="recording-bitrate">MP4 · {formatBitrate(actualBitrate)}</span>
            <strong data-testid="active-camera">{activeCameraLabel}</strong>
            <strong data-testid="canvas-resolution">{outputSize.width} × {outputSize.height}</strong>
          </div>

          {sidebarPage === "downloads" && <section className="creator-recording-destination" data-tour-target="save" aria-label="Recording destination">
            <div className={`workspace-destination ${folderPermission === "granted" ? "ready" : "warning"}`}>
              <span><HardDrive size={18} /></span>
              <div><small>Recording destination</small><strong>{recordingsDirectory?.name ?? "Session memory"}</strong><em>{folderPermission === "granted" ? "Every take saves here as MP4" : recordingsDirectory ? "Reconnect or choose another folder" : folderPermission === "unsupported" ? "Folder selection needs Chrome or Edge" : "Choose where finished recordings are saved"}</em></div>
              <button data-testid="recording-folder-button" disabled={isRecording || isFinalizing} aria-label={recordingsDirectory ? "Change recording folder" : "Choose recording folder"} title={recordingsDirectory ? "Change recording folder" : "Choose recording folder"} onClick={() => void changeRecordingsFolder()}><FolderOpen size={16} /><span>{recordingsDirectory ? "Change" : "Choose folder"}</span></button>
            </div>
          </section>}

          <section className="takes-inline-panel" aria-label="Take library">
            <div className="takes-inline-heading"><span><Download size={19} /><strong>Downloads & edits</strong></span><b data-testid="recording-count">{recordings.length}</b></div>

          <section className="recordings-panel durable-recordings">
            {recordings.length === 0 ? (
              <div className="empty-recordings"><Video size={22} /><span>Recorded MP4s appear here for rename, trim, captions, download or deletion.</span></div>
            ) : (
              <div className="recording-list" data-testid="take-list" tabIndex={0} aria-label="Finished takes">
                {recordings.map((recording) => (
                  <article key={recording.id} className={`recording-item ${recording.rating}`}>
                    <button className="take-preview" aria-label={`Preview ${recording.fileName}`} onClick={() => void openTakePreview(recording)}><span><Play size={16} fill="currentColor" /></span></button>
                    <div className="take-copy">
                      {editingTakeId === recording.id ? (
                        <span className="take-rename"><input autoFocus aria-label="Rename recording" placeholder="Name this recording" value={editingTakeName} onChange={(event) => setEditingTakeName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void commitTakeRename(recording); if (event.key === "Escape") { setEditingTakeId(null); setEditingTakeName(""); } }} /><button aria-label="Save recording name" disabled={!editingTakeName.trim()} onClick={() => void commitTakeRename(recording)}><Check size={13} /></button></span>
                      ) : <strong title={recording.fileName}>{shortName(recording.fileName.replace(/\.mp4$/i, ""), 28)}</strong>}
                      <small>{formatDuration(recording.durationSeconds)} · {formatBytes(recording.bytes)} · {recording.width}×{recording.height}</small>
                      <em>{new Date(recording.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</em>
                    </div>
                    <div className="take-actions">
                      <button className={recording.rating === "favorite" ? "active" : ""} aria-label="Favorite take" onClick={() => void rateTake(recording, "favorite")}><Heart size={14} fill={recording.rating === "favorite" ? "currentColor" : "none"} /></button>
                      <button aria-label="Rename recording" onClick={() => { setEditingTakeId(recording.id); setEditingTakeName(recording.fileName.replace(/\.mp4$/i, "")); }}><Pencil size={14} /></button>
                      <button aria-label={`Finish and download ${recording.fileName}`} onClick={() => void openFinishTake(recording)}>{recording.url ? <Download size={14} /> : <Archive size={14} />}</button>
                      <button aria-label={`Remove or delete ${recording.fileName}`} title="Remove or delete take" onClick={() => setPendingDeleteTakeId(recording.id)}><Trash2 size={14} /></button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="audio-monitor legacy-hidden">
            <div className="rail-section-heading"><span>Audio level</span><Mic size={17} /></div>
            <strong data-testid="active-microphone">{activeMicrophoneLabel}</strong>
            <small>{microphonePhase === "ready" ? "Ready for recording" : microphonePhase === "permission" ? "Waiting for permission" : microphonePhase === "switching" ? "Switching source" : microphonePhase === "off" ? "Microphone disabled" : microphonePhase === "error" ? "Microphone unavailable" : "Starts with the studio"}</small>
            <i className="microphone-meter" data-testid="microphone-level"><b style={{ width: `${Math.round(microphoneLevel * 100)}%` }} /></i>
          </section>

          <section className="recordings-panel legacy-hidden">
            <div className="rail-section-heading"><span>Recordings</span><b>{recordings.length}</b></div>
            {recordings.length === 0 ? (
              <div className="empty-recordings"><Video size={22} /><span>Finished recordings will stay here for this session.</span></div>
            ) : (
              <div className="legacy-recording-list">
                {recordings.map((recording, index) => (
                  <a key={recording.id} className="recording-link" href={recording.url} download={recording.fileName}>
                    <span><strong>Recording {recordings.length - index}</strong><small>{formatDuration(recording.durationSeconds)} · {formatBytes(recording.bytes)} · {new Date(recording.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></span>
                    <Download size={18} />
                  </a>
                ))}
              </div>
            )}
          </section>
          </section>
        </aside>

      </div>

      {cameraFramePanelOpen && (
        <div className="camera-frame-modal" role="dialog" aria-modal="true" aria-label="Camera border settings" onMouseDown={(event) => { if (event.target === event.currentTarget) setCameraFramePanelOpen(false); }}>
          <section>
            <header>
              <span><small>{isRecording ? "Recording · changes are live" : "Camera composition"}</small><strong>Camera border</strong></span>
              <button aria-label="Close camera border settings" onClick={() => setCameraFramePanelOpen(false)}><X size={18} /></button>
            </header>
            <div className="camera-frame-preview" style={{ background: !cameraFrame.enabled ? "#e4e0d8" : cameraFrameColor(cameraFrame) }}>
              <div
                className="camera-frame-preview-feed"
                style={{
                  inset: !cameraFrame.enabled ? 0 : `${cameraFrame.sizePercent}%`
                }}
              ><Camera size={25} /><span>Camera feed</span></div>
            </div>
            <div className="camera-frame-mode-grid" role="group" aria-label="Camera border colour">
              {CAMERA_FRAME_OPTIONS.map((option) => (
                <button key={option.id} className={option.id === "off" ? !cameraFrame.enabled ? "active" : "" : cameraFrame.enabled && cameraFrame.mode === option.id ? "active" : ""} aria-pressed={option.id === "off" ? !cameraFrame.enabled : cameraFrame.enabled && cameraFrame.mode === option.id} onClick={() => setCameraFrame((current) => option.id === "off" ? normalizeCameraFrame({ ...current, enabled: false }) : normalizeCameraFrame({ ...current, enabled: true, mode: option.id }))}>
                  <i className={option.id === "off" ? "off" : ""} style={option.id === "custom" ? { background: cameraFrame.customColor } : option.color ? { background: option.color } : undefined} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <label className="camera-frame-size-control">
              <span>Border size <b>{cameraFrame.sizePercent}%</b></span>
              <div><input aria-label="Camera border size" type="range" min={MIN_CAMERA_FRAME_PERCENT} max={MAX_CAMERA_FRAME_PERCENT} step="1" disabled={!cameraFrame.enabled} value={cameraFrame.sizePercent} onChange={(event) => setCameraFrame((current) => normalizeCameraFrame({ ...current, sizePercent: Number(event.target.value) }))} /><input aria-label="Camera border size percent" type="number" min={MIN_CAMERA_FRAME_PERCENT} max={MAX_CAMERA_FRAME_PERCENT} step="1" disabled={!cameraFrame.enabled} value={cameraFrame.sizePercent} onChange={(event) => setCameraFrame((current) => normalizeCameraFrame({ ...current, sizePercent: Number(event.target.value) }))} /></div>
            </label>
            {cameraFrame.mode === "custom" && (
              <label className="camera-frame-custom-colour"><span>Custom colour</span><div><input aria-label="Camera border custom colour" type="color" value={cameraFrame.customColor} onChange={(event) => setCameraFrame((current) => normalizeCameraFrame({ ...current, customColor: event.target.value }))} /><input key={cameraFrame.customColor} aria-label="Camera border hex colour" type="text" defaultValue={cameraFrame.customColor} maxLength={7} spellCheck={false} onBlur={(event) => setCameraFrame((current) => normalizeCameraFrame({ ...current, customColor: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></div></label>
            )}
            <footer><small>{isRecording ? "Changes appear in the current recording immediately." : `The recording stays at ${outputSize.width} × ${outputSize.height}; only the camera image scales inward.`}</small><button onClick={() => setCameraFramePanelOpen(false)}>Done</button></footer>
          </section>
        </div>
      )}

      {assetEditor && (assetEditor.kind === "image" || assetEditor.kind === "video") && (
        <div className="media-editor-modal" role="dialog" aria-modal="true" aria-label={`${assetEditor.kind === "video" ? "Trim" : "Crop"} ${assetEditor.name}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeAssetEditor(); }}>
          <section>
            <header><span>{assetEditor.kind === "video" ? <Scissors size={18} /> : <Crop size={18} />}<b><small>{assetEditor.kind === "video" ? "Video trim" : "Image crop"}</small><strong>{assetEditor.name}</strong></b></span><button aria-label="Close media editor" onClick={closeAssetEditor}><X size={18} /></button></header>
            {assetEditor.kind === "video" ? (
              <div className="media-editor-body video-trim-editor">
                <video
                  key={assetEditor.sourceUrl}
                  ref={assetEditorVideoRef}
                  src={assetEditor.sourceUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) => syncAssetEditorMetadata(assetEditor, event.currentTarget)}
                  onTimeUpdate={(event) => syncAssetEditorPlayhead(assetEditor, event.currentTarget)}
                  onSeeked={(event) => setAssetEditorPlayhead(event.currentTarget.currentTime)}
                />
                <div className="trim-preview-status"><span><small>Playhead</small><strong>{formatEditTime(assetEditorPlayhead)}</strong></span><span><small>Original</small><strong>{formatEditTime(assetEditorDuration)}</strong></span></div>
                <TrimTimeline
                  sourceUrl={assetEditor.sourceUrl ?? ""}
                  duration={assetEditorDuration}
                  start={assetEditorTrim.start}
                  end={assetEditorTrim.end}
                  playhead={assetEditorPlayhead}
                  generateThumbnails={!isRecording}
                  label="Asset trim"
                  onChange={(start, end, handle) => updateAssetVideoTrim(assetEditor, start, end, handle)}
                  onSeek={seekAssetTimeline}
                />
                <div className="media-editor-actions"><button onClick={() => { updateAsset(assetEditor.id, { videoTrim: undefined }); setAssetEditorPlayhead(0); if (assetEditorVideoRef.current) assetEditorVideoRef.current.currentTime = 0; }}><RotateCcw size={15} /> Use full video</button><button className="primary" onClick={() => void previewAssetTrim(assetEditor)}><Play size={15} /> Preview selection</button></div>
              </div>
            ) : (
              <div className="media-editor-body image-crop-editor">
                <ImageCropEditor
                  sourceUrl={assetEditor.sourceUrl ?? ""}
                  name={assetEditor.name}
                  crop={assetEditor.imageCrop}
                  onChange={(imageCrop) => updateAsset(assetEditor.id, { imageCrop })}
                />
                <div className="crop-controls">
                  <fieldset><legend>Crop shape</legend><div>{(["original", "free", "1:1", "16:9", "9:16"] as const).map((aspect) => <button key={aspect} className={(assetEditor.imageCrop?.aspect ?? "original") === aspect ? "active" : ""} onClick={() => updateImageCrop(assetEditor, aspect)}>{aspect === "original" ? "Original" : aspect === "free" ? "Free crop" : aspect}</button>)}</div></fieldset>
                  {assetEditor.imageCrop ? <div className="crop-direct-help"><Move size={18} /><span><strong>{assetEditor.imageCrop.aspect === "free" ? "Shape it freely" : `${assetEditor.imageCrop.aspect} ratio locked`}</strong><small>Drag inside to reposition. Drag any corner to resize.</small></span></div> : <div className="crop-direct-help original"><ImageIcon size={18} /><span><strong>Full original image</strong><small>Choose Free crop or a fixed ratio to begin.</small></span></div>}
                </div>
                <p><ShieldCheck size={15} /> The original image stays untouched. The crop is saved with this asset and rendered at recording resolution.</p>
              </div>
            )}
            <footer><small>{assetEditor.kind === "video" ? "The selected section restarts from its trim start whenever the asset activates." : "Crop is applied sharply at the recording canvas resolution."}</small><button className="primary" onClick={closeAssetEditor}>Done</button></footer>
          </section>
        </div>
      )}

      {previewTake?.url && (
        <div className="take-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${previewTake.fileName}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewTakeId(null); }}>
          <section>
            <header><span><small>Take preview</small><strong>{previewTake.fileName}</strong></span><button aria-label="Close preview" onClick={() => setPreviewTakeId(null)}><X size={18} /></button></header>
            <video src={previewTake.url} controls playsInline />
            <footer><span>{formatDuration(previewTake.durationSeconds)} · {previewTake.width}×{previewTake.height} · {Math.round(previewTake.frameRate)} fps · {formatBytes(previewTake.bytes)}</span><a href={previewTake.url} download={previewTake.fileName}><Download size={15} /> Download MP4</a></footer>
          </section>
        </div>
      )}

      {pendingDeleteTake && (
        <div className="delete-take-modal" role="dialog" aria-modal="true" aria-label={`Remove or delete ${pendingDeleteTake.fileName}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingTakeId) setPendingDeleteTakeId(null); }}>
          <section>
            <header><span className="delete-take-icon"><Trash2 size={21} /></span><span><small>{pendingDeleteTake.folderBacked ? "Saved recording" : "Session-only recording"}</small><strong>{pendingDeleteTake.folderBacked ? "Remove this take?" : "Delete this take?"}</strong></span><button aria-label="Cancel take deletion" disabled={Boolean(deletingTakeId)} onClick={() => setPendingDeleteTakeId(null)}><X size={18} /></button></header>
            <div className="delete-take-body">
              <strong title={pendingDeleteTake.fileName}>{pendingDeleteTake.fileName}</strong>
              {pendingDeleteTake.folderBacked
                ? <p>The MP4 is saved in your recording destination. You can remove it from Rii-Flow while keeping the file, or delete it from both places.</p>
                : <p>This recording only exists in the current browser session. Deleting it is permanent.</p>}
            </div>
            <footer>
              <button disabled={Boolean(deletingTakeId)} onClick={() => setPendingDeleteTakeId(null)}>Cancel</button>
              {pendingDeleteTake.folderBacked && <button className="keep-file" disabled={Boolean(deletingTakeId)} onClick={() => void removeTake(pendingDeleteTake, false)}><Archive size={16} /> Remove from Rii-Flow<small>Keep MP4 in folder</small></button>}
              <button className="delete-file" disabled={Boolean(deletingTakeId)} onClick={() => void removeTake(pendingDeleteTake, true)}>{deletingTakeId ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}{pendingDeleteTake.folderBacked ? "Delete MP4 too" : "Delete take"}</button>
            </footer>
          </section>
        </div>
      )}

      {finishTake?.url && (
        <div className="finish-take-modal" role="dialog" aria-modal="true" aria-label={`Finish ${finishTake.fileName}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !captionBusy) setFinishTakeId(null); }}>
          <section>
            <header><span><small>Finish take</small><strong>{finishTake.fileName}</strong></span><button aria-label="Close finish take" disabled={captionBusy} onClick={() => setFinishTakeId(null)}><X size={18} /></button></header>
            <div className="finish-take-body">
              <div className="finish-preview-column">
                <div className="caption-preview-heading"><span><small>End-product preview</small><strong>{captionPreviewRendered ? "Rendered edited MP4" : "Live edit preview"}</strong></span><output>{formatEditTime(captionPreviewTime)} / {formatEditTime(captionPreviewRendered ? captionResultTake?.durationSeconds ?? finishTake.durationSeconds : finishDuration)}</output></div>
                <div
                  ref={captionPreviewRef}
                  className={`caption-video-preview ${finishTake.height > finishTake.width ? "portrait" : "landscape"} ${captionDrag.dragging ? "dragging" : ""}`}
                  data-caption-x={captionStyle.anchorX.toFixed(3)}
                  data-caption-y={captionStyle.anchorY.toFixed(3)}
                  data-active-caption={captionPreviewSegment?.id ?? "none"}
                  data-active-word-animation={previewWordAnimation?.id ?? "none"}
                  data-preview-rendered={captionPreviewRendered}
                  style={{ aspectRatio: `${finishTake.width} / ${finishTake.height}` }}
                >
                  <video
                    key={captionPreviewSource}
                    ref={captionPreviewVideoRef}
                    src={captionPreviewSource}
                    controls
                    playsInline
                    onLoadedMetadata={(event) => syncFinishPreviewMetadata(event.currentTarget)}
                    onTimeUpdate={(event) => syncFinishPreviewTime(event.currentTarget)}
                    onSeeked={(event) => syncFinishPreviewTime(event.currentTarget)}
                    onPlay={() => setCaptionPreviewPlaying(true)}
                    onPause={(event) => { setCaptionPreviewPlaying(false); setCaptionPreviewTime(event.currentTarget.currentTime); }}
                    onEnded={() => setCaptionPreviewPlaying(false)}
                  />
                  {!captionPreviewRendered && <canvas ref={captionPreviewCanvasRef} className="caption-preview-overlay" aria-hidden="true" />}
                  {captionEnabled && captionSegments.length > 0 && !captionPreviewRendered && <><i className={`caption-guide vertical ${captionDrag.snapX ? "snapped" : ""}`} aria-hidden="true" /><i className={`caption-guide horizontal ${captionDrag.snapY ? "snapped" : ""}`} aria-hidden="true" /></>}
                  {captionEnabled && captionPreviewSegment?.text && !captionPreviewRendered && <span
                    className="caption-sample caption-drag-target"
                    role="button"
                    tabIndex={0}
                    aria-label="Drag caption position"
                    title="Drag to position caption"
                    style={{
                      left: `${captionStyle.anchorX * 100}%`,
                      top: `${captionStyle.anchorY * 100}%`,
                      maxWidth: finishTake.height > finishTake.width ? "82%" : "74%",
                      fontFamily: captionFontFamily(captionStyle.font),
                      fontSize: `${(finishTake.height > finishTake.width ? 4.5 : 5.2) * captionStyle.fontScale}${finishTake.height > finishTake.width ? "cqw" : "cqh"}`,
                      fontWeight: captionStyle.preset === "bold" ? 800 : 700
                    }}
                    onPointerDown={beginCaptionDrag}
                    onPointerMove={moveCaptionDrag}
                    onPointerUp={endCaptionDrag}
                    onPointerCancel={endCaptionDrag}
                  >{captionPreviewSegment.text}</span>}
                  {previewWordAnimation && !captionPreviewRendered && <span
                    key={previewWordAnimation.id}
                    className={`word-animation-sample ${previewWordAnimation.animation}`}
                    style={{ top: `${captionStyle.anchorY < 0.44 ? 72 : 27}%`, fontFamily: captionFontFamily(captionStyle.font) }}
                  ><strong>{previewWordAnimation.text}</strong><button type="button" aria-label={`Remove ${previewWordAnimation.text} animation`} title="Remove this animation" onClick={() => removeWordAnimation(previewWordAnimation.id)}><X size={14} /></button></span>}
                </div>
                {captionEnabled && captionSegments.length > 0 && <small className="caption-position-hint"><Move size={14} /> Drag the caption anywhere · snaps to horizontal and vertical centre <b>X {Math.round(captionStyle.anchorX * 100)} · Y {Math.round(captionStyle.anchorY * 100)}</b></small>}
                <div className="caption-source-note"><Mic size={15} /><span><strong>English · selected microphone only</strong><small>Video audio, music and cue sounds are excluded.</small></span></div>
                <a className="download-original" href={finishTake.url} download={finishTake.fileName}><Download size={16} /> Download original MP4</a>
              </div>
              <div className="caption-editor-column">
                <section className={`take-trim-panel ${takeIsTrimmed ? "active" : ""}`}>
                  <header><span><Scissors size={17} /><b><strong>Trim final video</strong></b></span>{takeIsTrimmed && <em>{formatEditTime(normalizedTakeTrim.end - normalizedTakeTrim.start)}</em>}</header>
                  <TrimTimeline
                    sourceUrl={finishTake.url}
                    duration={finishDuration}
                    start={normalizedTakeTrim.start}
                    end={normalizedTakeTrim.end}
                    playhead={captionPreviewTime}
                    disabled={captionBusy}
                    label="Final video trim"
                    onChange={updateTakeTrimRange}
                    onSeek={seekFinishTimeline}
                  />
                  <div className="take-trim-actions"><button disabled={!takeIsTrimmed || captionBusy} onClick={resetTakeTrim}><RotateCcw size={14} /> Full length</button><button className="preview" disabled={captionBusy} onClick={() => void previewTakeTrim()}><Play size={14} /> Preview range</button></div>
                </section>
                <label className="caption-enable-row"><span><Captions size={18} /><b><strong>Add captions</strong><small>Created locally after recording</small></b></span><input type="checkbox" checked={captionEnabled} disabled={!finishTake.captionAudioAvailable || captionBusy} onChange={(event) => { setCaptionEnabled(event.target.checked); markCaptionDraftChanged(); }} /></label>
                <div className="caption-source-note"><Mic size={15} /><span><strong>English · selected microphone only</strong><small>Video audio, music and cue sounds are excluded.</small></span></div>
                {!finishTake.captionAudioAvailable && <p className="caption-unavailable"><AlertTriangle size={15} /> This take predates mic-only caption capture. New microphone-enabled takes support captions.</p>}
                {captionEnabled && (
                  <>
                    {!captionSegments.length && !captionBusy && <button className="generate-captions" onClick={() => void generateEnglishCaptions()}><Sparkles size={17} /> Generate captions + word animations</button>}
                    {(captionStatus === "loading" || captionStatus === "transcribing") && <div className="caption-progress"><LoaderCircle className="spin" size={20} /><span><strong>{captionStatus === "loading" ? "Loading local English model" : "Transcribing microphone"}</strong><small>{captionStatus === "loading" && captionProgress ? `${Math.round(captionProgress.percent)}%` : "Audio stays on this device"}</small></span><i><b style={{ width: `${captionStatus === "loading" ? Math.max(3, captionProgress?.percent ?? 0) : 72}%` }} /></i></div>}
                    {captionSegments.length > 0 && (
                      <>
                        <div className="caption-style-grid">
                          <label><span>Font</span><select aria-label="Caption font" value={captionStyle.font} onChange={(event) => updateCaptionStyle({ font: event.target.value as CaptionStyle["font"] })}>{CAPTION_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
                          <label><span>Style</span><select value={captionStyle.preset} onChange={(event) => updateCaptionStyle({ preset: event.target.value as CaptionStyle["preset"] })}><option value="clean">Clean</option><option value="highlight">Highlight</option><option value="bold">Bold creator</option></select></label>
                          <label><span>Position</span><select value={captionStyle.position} onChange={(event) => setCaptionPositionPreset(event.target.value as CaptionStyle["position"])}><option value="top">Top centre</option><option value="center">Dead centre</option><option value="bottom">Bottom centre</option><option value="custom">Custom</option></select></label>
                          <label className="caption-size-control"><span>Exact size <output>{Math.round(captionStyle.fontScale * 100)}%</output></span><div><input aria-label="Caption font size" type="range" min="0.6" max="2" step="0.05" value={captionStyle.fontScale} onChange={(event) => updateCaptionStyle({ fontScale: Number(event.target.value) })} /><input aria-label="Caption size percent" type="number" min="60" max="200" step="5" value={Math.round(captionStyle.fontScale * 100)} onChange={(event) => updateCaptionStyle({ fontScale: Number(event.target.value) / 100 })} /></div></label>
                          <label><span>Text</span><input aria-label="Caption text colour" type="color" value={captionStyle.textColor} onChange={(event) => updateCaptionStyle({ textColor: event.target.value })} /></label>
                          <label className="caption-background-toggle"><span>Background</span><input type="checkbox" checked={captionStyle.background} onChange={(event) => updateCaptionStyle({ background: event.target.checked })} /></label>
                          {captionStyle.preset === "highlight" && <label><span>Highlight</span><input aria-label="Caption highlight colour" type="color" value={captionStyle.accentColor} onChange={(event) => updateCaptionStyle({ accentColor: event.target.value })} /></label>}
                          <div className="caption-coordinate-controls"><span>Exact position</span><label><b>X</b><input aria-label="Caption horizontal position percent" type="number" min="4" max="96" step="1" value={Math.round(captionStyle.anchorX * 100)} onChange={(event) => setCaptionCoordinate("anchorX", Number(event.target.value))} /><em>%</em></label><label><b>Y</b><input aria-label="Caption vertical position percent" type="number" min="6" max="94" step="1" value={Math.round(captionStyle.anchorY * 100)} onChange={(event) => setCaptionCoordinate("anchorY", Number(event.target.value))} /><em>%</em></label></div>
                        </div>
                        <div className="caption-segment-list" aria-label="Editable caption phrases and timing">
                          {captionSegments.map((segment) => <div key={segment.id} className={`caption-segment-editor ${captionPreviewSegment?.id === segment.id ? "active" : ""}`}><button type="button" aria-label={`Preview caption at ${segment.start.toFixed(2)} seconds`} onClick={() => previewCaptionSegment(segment)}><Play size={13} /> Preview</button><div><textarea aria-label={`Caption text at ${segment.start.toFixed(2)} seconds`} value={segment.text} rows={2} onChange={(event) => updateCaptionSegment(segment.id, event.target.value)} /><div className="caption-timing-fields"><label><span>Show at</span><input aria-label={`Caption start time for ${segment.text}`} type="number" min="0" max={finishDuration} step="0.05" value={Number(segment.start.toFixed(2))} onChange={(event) => updateCaptionTiming(segment.id, "start", Number(event.target.value))} /><em>sec</em></label><label><span>Hide at</span><input aria-label={`Caption end time for ${segment.text}`} type="number" min="0.05" max={finishDuration} step="0.05" value={Number(segment.end.toFixed(2))} onChange={(event) => updateCaptionTiming(segment.id, "end", Number(event.target.value))} /><em>sec</em></label></div></div></div>)}
                        </div>
                      </>
                    )}
                  </>
                )}
                {captionSegments.length > 0 && <section className="word-animation-panel" aria-label="Punch lines and word animations">
                  <header><span><Sparkles size={17} /><span><strong>Punch lines & word animations</strong><small>Change exactly when each one appears</small></span></span><b>{wordAnimationCues.length}</b></header>
                  {wordAnimationCues.length > 0 ? <div className="word-animation-points">
                    {wordAnimationCues.map((cue) => <span key={cue.id} className={previewWordAnimation?.id === cue.id ? "active" : ""}>
                      <button type="button" aria-label={`Preview ${cue.text} animation at ${cue.start.toFixed(2)} seconds`} onClick={() => seekWordAnimation(cue)}><small><Play size={11} /> Preview</small><strong>{cue.text}</strong><em>{cue.animation}</em></button>
                      <div className="word-timing-fields"><label><span>Show</span><input aria-label={`Punch line start time for ${cue.text}`} type="number" min="0" max={finishDuration} step="0.05" value={Number(cue.start.toFixed(2))} onChange={(event) => updateWordAnimationTiming(cue.id, "start", Number(event.target.value))} /></label><label><span>Hide</span><input aria-label={`Punch line end time for ${cue.text}`} type="number" min="0.05" max={finishDuration} step="0.05" value={Number(cue.end.toFixed(2))} onChange={(event) => updateWordAnimationTiming(cue.id, "end", Number(event.target.value))} /></label></div>
                      <button type="button" aria-label={`Remove ${cue.text} animation`} title="Remove animation" onClick={() => removeWordAnimation(cue.id)}><X size={14} /></button>
                    </span>)}
                  </div> : <button className="restore-word-animations" type="button" onClick={restoreWordAnimations}><RotateCcw size={14} /> Restore suggested animations</button>}
                </section>}
                {captionStatus === "rendering" && <div className="caption-progress rendering"><LoaderCircle className="spin" size={20} /><span><strong>Rendering edited MP4</strong><small>{Math.round(captionRenderProgress * 100)}% · studio controls stay protected</small></span><i><b style={{ width: `${captionRenderProgress * 100}%` }} /></i></div>}
                {captionStatus === "done" && captionResultTake?.url && <div className="caption-ready"><Check size={18} /><span><strong>Edited take ready</strong><small>The untouched original is still available.</small></span><a href={captionResultTake.url} download={captionResultTake.fileName}><Download size={15} /> Download</a></div>}
              </div>
            </div>
            <footer><small>{hasFinalEdits ? "Trim, captions and word animations render after recording; the original master remains unchanged." : "Download the untouched master or add a trim, captions and automatic word animations."}</small>{hasFinalEdits && captionStatus !== "done" ? <button disabled={captionBusy} onClick={() => void renderEditedVersion()}>{captionStatus === "rendering" ? <LoaderCircle className="spin" size={16} /> : takeIsTrimmed && !captionsReady && !wordAnimationsReady ? <Scissors size={16} /> : <Sparkles size={16} />} Render edited MP4</button> : captionStatus === "done" && captionResultTake?.url ? <a href={captionResultTake.url} download={captionResultTake.fileName}><Download size={15} /> Download edited</a> : <a href={finishTake.url} download={finishTake.fileName}><Download size={15} /> Download original</a>}</footer>
          </section>
        </div>
      )}

      {tutorialOpen && <div className="guided-tour" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
        <button className="guided-tour-scrim" aria-label="Close guided tour" onClick={() => setTutorialOpen(false)} />
        <section>
          <header><span><small>{TUTORIAL_STEPS[tutorialStep].eyebrow}</small><strong id="guided-tour-title">{TUTORIAL_STEPS[tutorialStep].title}</strong></span><button aria-label="Close tutorial" onClick={() => setTutorialOpen(false)}><X size={18} /></button></header>
          {TUTORIAL_STEPS[tutorialStep].target === "gestures" && <div className="tour-gesture-grid"><span><b>☝</b><strong>Point + hold</strong><small>Open an item</small></span><span><b>👍</b><strong>Thumbs-up</strong><small>Open the deck</small></span><span><b>✋</b><strong>Open palm</strong><small>Flick to scroll</small></span><span><b>✊</b><strong>Fist</strong><small>Close visual</small></span></div>}
          <p>{TUTORIAL_STEPS[tutorialStep].body}</p>
          <div className="guided-tour-progress" aria-label={`Tutorial step ${tutorialStep + 1} of ${TUTORIAL_STEPS.length}`}>{TUTORIAL_STEPS.map((step, index) => <i key={step.target} className={index <= tutorialStep ? "active" : ""} />)}</div>
          <footer><button className="tour-skip" onClick={() => setTutorialOpen(false)}>Skip tour</button><span>{tutorialStep + 1} / {TUTORIAL_STEPS.length}</span>{tutorialStep > 0 && <button className="tour-back" onClick={() => setTutorialStep((step) => step - 1)}>Back</button>}<button className="tour-next" onClick={() => { if (tutorialStep === TUTORIAL_STEPS.length - 1) setTutorialOpen(false); else setTutorialStep((step) => step + 1); }}>{tutorialStep === TUTORIAL_STEPS.length - 1 ? <><Check size={16} /> Start creating</> : <>Next <ArrowRight size={16} /></>}</button></footer>
        </section>
      </div>}

      {errorMessage && <div className="error-toast" role="alert"><AlertTriangle size={15} /><span>{errorMessage}</span><button onClick={() => setErrorMessage(null)}>Dismiss</button></div>}
    </main>
  );
}
