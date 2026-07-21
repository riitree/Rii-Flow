import {
  AlertTriangle,
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
  Move,
  Pencil,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Scissors,
  ScreenShare,
  ScreenShareOff,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Trash2,
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
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import { ImageCropEditor } from "./components/ImageCropEditor";
import { TrimTimeline } from "./components/TrimTimeline";
import { applyAssetTransform, baseAssetRect, composeFrame, constrainAssetTransform, sceneBaseRect, sceneDisplayRect, sceneMemberCanvasTransform, sceneMemberContentRects, sceneMemberDisplayRects, sceneMemberDrawOrder, sceneMemberRelativeTransform, snapScaleToTemplate, snapTransformToCameraBorder, snappedAssetSize, stageBackdropForLayers, type CameraSnapTarget, type Rect } from "./core/compositor";
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
import { transcribeEnglish, type CaptionProgress } from "./core/captionClient";
import { editedFileName, renderCaptionedTake } from "./core/captionRender";
import { activeCaptionAt, CAPTION_FONTS, captionAnchorFromPoint, captionFontFamily, captionPresetAnchor, DEFAULT_CAPTION_STYLE, drawCaption, normalizeCaptionStyle, type CaptionSegment, type CaptionStyle } from "./core/captions";
import { cameraFrameColor, cameraFrameViewport, DEFAULT_CAMERA_FRAME, MAX_CAMERA_FRAME_PERCENT, MIN_CAMERA_FRAME_PERCENT, normalizeCameraFrame, type CameraFrameMode, type CameraFrameSettings } from "./core/cameraFrame";
import { parseCsv, parseJson } from "./core/data";
import { GestureGate, GestureStabilizer, MIN_GESTURE_HOLD_MS, resolveCompositeGesture, resolveGesture, type Landmark } from "./core/gesture";
import { createGestureInferenceClient, type GestureFrameResult, type GestureInferenceClient, type InferenceCategory } from "./core/gestureInference";
import { activateLayer, hideFocusedLayer, removeLayer } from "./core/layers";
import { ManipulationTracker, mapControlPointForMirror, mapPointForMovementReach, palmControlPoint, PalmSignalTracker, type ManipulationMode, type ManipulationUpdate, type PalmObservation } from "./core/manipulation";
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
  type QualityId,
  type QualityPreset
} from "./core/quality";
import { compositionFrameBudget, compositionHealth, normalizedCompositionFps, shouldComposeFrame, type CompositionHealth } from "./core/performance";
import { composedStream, masterRecorderOptions, recordingMimeType } from "./core/recording";
import { findGestureLayer, gestureOwner, layerAssetIds, layerName, removeAssetFromScenes, resolveLayer, sceneLayerId } from "./core/scenes";
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
  type CueSound,
  type EntranceAnimation,
  type GestureId,
  type GrantedVideoSettings,
  type ImageCropAspect,
  type MicrophoneOption,
  type Placement,
  type RecognizedGesture,
  type ScreenCaptureSettings,
  type ScreenOverlaySettings,
  type StudioAsset,
  type StudioLayer,
  type StudioScene,
  type SceneLayout
} from "./types";

type StudioPhase = "idle" | "permission" | "loading" | "switching" | "stopping" | "ready" | "error";
type MicrophonePhase = "idle" | "permission" | "switching" | "ready" | "off" | "error";
type ScreenPhase = "idle" | "permission" | "ready" | "error";
type CaptionEditorStatus = "idle" | "loading" | "transcribing" | "ready" | "rendering" | "done" | "error";
type ThemeMode = "dark" | "light";

interface RecordedClip extends StoredTake {
  url?: string;
  availability: "ready" | "permission" | "missing" | "session";
}

interface PointerEditSession {
  pointerId: number;
  mode: "drag" | "scale";
  startClientX: number;
  startClientY: number;
  stageWidth: number;
  stageHeight: number;
  base: Rect;
  initial: { x: number; y: number; scale: number };
  layerId: string;
  sceneMemberId?: string;
  sceneGroupRect?: Rect;
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
  { id: "float", label: "Float" }
];

const CUE_SOUNDS: { id: CueSound; label: string }[] = [
  { id: "none", label: "No sound" },
  { id: "soft", label: "Soft tone" },
  { id: "pop", label: "Quick pop" },
  { id: "chime", label: "Chime" },
  { id: "bottle", label: "Pop out" },
  { id: "enter", label: "Click" }
];

const SCENE_TEMPLATES: { id: SceneLayout; label: string; detail: string }[] = [
  { id: "grid", label: "Balanced grid", detail: "Equal collage tiles" },
  { id: "row", label: "Horizontal split", detail: "Side-by-side panels" },
  { id: "column", label: "Vertical strip", detail: "Stacked panels" },
  { id: "spotlight", label: "Hero + rail", detail: "One lead visual with supporting tiles" },
  { id: "cascade", label: "Layered cards", detail: "Overlapping editorial collage" }
];

function normalizeStageBackground(value: unknown): StageBackground {
  if (value === "black" || value === "white" || value === "cream" || value === "custom" || value === "camera") return value;
  return "camera";
}

const DEFAULT_TIMING = { holdMs: 350, cooldownMs: 700, rearmMs: 500 };
const DEFAULT_MANIPULATION = { armMs: 220, releaseGraceMs: 150, hitPadding: 0.035 };
const SCREEN_OVERLAY_ID = "__live-screen-overlay__";
const DEFAULT_SCREEN_OVERLAY: ScreenOverlaySettings = { placement: "right", size: "medium", visible: true };
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

function cameraSnapLabel(target: CameraSnapTarget) {
  const label = target.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
  return `${label} camera ${target.includes("-") ? "corner" : "edge"}`;
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

function gestureLabel(gesture: RecognizedGesture) {
  if (gesture === "fist") return "Fist";
  if (gesture === "palm") return "Open palm";
  return GESTURES.find((item) => item.id === gesture)?.label ?? "None";
}

function shortName(name: string, length = 24) {
  return name.length > length ? `${name.slice(0, length - 1)}…` : name;
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
    context.fillStyle = "#4f6fe7";
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
    stageBackground: "camera"
  };
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const diagnostics = import.meta.env.DEV && params.has("diagnostics");
  const diagnosticScenario = diagnostics ? params.get("scenario") : null;
  const provider = useMemo<MediaProvider>(
    () => diagnostics ? createSyntheticMediaProvider() : createBrowserMediaProvider(),
    [diagnostics]
  );

  const [phase, setPhase] = useState<StudioPhase>("idle");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => localStorage.getItem("rii-flow-theme") === "light" ? "light" : "dark");
  const [phaseMessage, setPhaseMessage] = useState("Select a camera and start the studio");
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
  const [qualityId, setQualityId] = useState<QualityId>(() => diagnostics ? "720p30" : (localStorage.getItem("gesture-studio-quality") as QualityId) || "720p30");
  const [aspectId, setAspectId] = useState<CanvasAspectId>("landscape");
  const [mirrorCamera, setMirrorCamera] = useState(() => diagnostics ? false : localStorage.getItem("gesture-studio-mirror") === "true");
  const [cameraFrame, setCameraFrame] = useState<CameraFrameSettings>({ ...DEFAULT_CAMERA_FRAME });
  const [cameraFramePanelOpen, setCameraFramePanelOpen] = useState(false);
  const [outputSize, setOutputSize] = useState(() => {
    const preset = qualityPreset(qualityId);
    return canvasDimensions(preset.width, preset.height, aspectId);
  });
  const [granted, setGranted] = useState<GrantedVideoSettings | null>(null);
  const [compositionStats, setCompositionStats] = useState<CompositionHealth>({ fps: 0, averageMs: 0, budgetPercent: 0, overBudgetFrames: 0 });
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("Untitled project");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectHydrated, setProjectHydrated] = useState(diagnostics);
  const [projectSaveState, setProjectSaveState] = useState<"loading" | "saved" | "saving" | "error">(diagnostics ? "saved" : "loading");
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [scenes, setScenes] = useState<StudioScene[]>([]);
  const [sceneBuilderOpen, setSceneBuilderOpen] = useState(false);
  const [sceneDraftName, setSceneDraftName] = useState("New collage");
  const [sceneDraftLayout, setSceneDraftLayout] = useState<SceneLayout>("grid");
  const [sceneDraftMembers, setSceneDraftMembers] = useState<string[]>([]);
  const [sceneSolo, setSceneSolo] = useState<Record<string, string>>({});
  const [liveLayerIds, setLiveLayerIds] = useState<string[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [detected, setDetected] = useState<{ gesture: RecognizedGesture; confidence: number; source: string }>({ gesture: null, confidence: 0, source: "none" });
  const [holdProgress, setHoldProgress] = useState(0);
  const [armed, setArmed] = useState(true);
  const [timing, setTiming] = useState(DEFAULT_TIMING);
  const [palmHoldMs, setPalmHoldMs] = useState(DEFAULT_MANIPULATION.armMs);
  const [manipulation, setManipulation] = useState<{ mode: ManipulationMode; progress: number }>({ mode: "idle", progress: 0 });
  const [sceneTemplateSnapped, setSceneTemplateSnapped] = useState(false);
  const [cameraBorderSnap, setCameraBorderSnap] = useState<CameraSnapTarget | null>(null);
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
  const assetsRef = useRef(assets);
  const scenesRef = useRef(scenes);
  const liveLayerIdsRef = useRef(liveLayerIds);
  const activeLayerIdRef = useRef(activeLayerId);
  const activatedAtRef = useRef(activatedAt);
  const studioReadyRef = useRef(studioReady);
  const recordingRef = useRef(isRecording);
  const selectedCameraRef = useRef(selectedCameraId);
  const selectedMicrophoneRef = useRef(selectedMicrophoneId);
  const grantedRef = useRef(granted);
  const screenSettingsRef = useRef(screenSettings);
  const screenOverlayRef = useRef(screenOverlay);
  const qualityRef = useRef(qualityId);
  const aspectRef = useRef(aspectId);
  const mirrorCameraRef = useRef(mirrorCamera);
  const cameraFrameRef = useRef(cameraFrame);
  const monitorMediaAudioRef = useRef(monitorMediaAudio);
  const phaseRef = useRef(phase);
  const gateRef = useRef(new GestureGate(DEFAULT_TIMING));
  const stabilizerRef = useRef(new GestureStabilizer());
  const manipulationTrackerRef = useRef(new ManipulationTracker(DEFAULT_MANIPULATION));
  const palmSignalTrackerRef = useRef(new PalmSignalTracker());
  const manipulationGuardUntilRef = useRef(0);
  const sceneMemberTargetIdRef = useRef<string | null>(null);
  const switchCameraRef = useRef<(deviceId: string, preset: QualityPreset, initial?: boolean) => Promise<void>>(async () => undefined);
  const switchMicrophoneRef = useRef<(deviceId: string, initial?: boolean, force?: boolean) => Promise<void>>(async () => undefined);
  const stopRecordingRef = useRef<() => void>(() => undefined);
  const studioSessionRef = useRef(0);
  const studioStartingRef = useRef(false);
  const pendingFallbackRef = useRef<string | null>(null);
  const diagnosticSequenceStartRef = useRef(0);
  const pointerEditRef = useRef<PointerEditSession | null>(null);
  const suppressStageClickUntilRef = useRef(0);
  const sceneSoloRef = useRef<Record<string, string>>({});
  const captionCaptureRef = useRef<CaptionCaptureSession | null>(null);
  const captionAudioCacheRef = useRef(new Map<string, CaptionAudio>());
  const captionPreviewRef = useRef<HTMLDivElement>(null);
  const captionPreviewVideoRef = useRef<HTMLVideoElement>(null);
  const assetEditorVideoRef = useRef<HTMLVideoElement>(null);
  const captionPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const captionDragPointerRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const liveScreenAsset = useMemo(() => screenSettings ? screenOverlayAsset(screenSettings, screenOverlay) : null, [screenOverlay, screenSettings]);
  const activeLayer = useMemo(() => activeLayerId === SCREEN_OVERLAY_ID && liveScreenAsset
    ? { id: SCREEN_OVERLAY_ID, kind: "asset" as const, asset: liveScreenAsset }
    : activeLayerId ? resolveLayer(activeLayerId, assets, scenes) : null, [activeLayerId, assets, liveScreenAsset, scenes]);
  const activeAsset = activeLayer?.kind === "asset" ? activeLayer.asset : null;
  const activeScene = activeLayer?.kind === "scene" ? activeLayer.scene : null;
  const activeSceneSoloId = activeScene ? sceneSolo[activeScene.id] : undefined;
  const focusedSceneMemberId = sceneMemberTargetId ?? selectedSceneMemberId;
  const activeGeometry = useMemo(() => {
    if (!activeLayer) return null;
    if (activeLayer.kind === "scene") {
      const base = sceneBaseRect(outputSize.width, outputSize.height, activeLayer.scene);
      return { base, rect: applyAssetTransform(outputSize.width, outputSize.height, base, activeLayer.scene.transform), transform: activeLayer.scene.transform };
    }
    const source = activeLayer.asset.id === SCREEN_OVERLAY_ID
      ? undefined
      : activeLayer.asset.kind === "image" ? imagesRef.current.get(activeLayer.asset.id) : activeLayer.asset.kind === "video" ? videosRef.current.get(activeLayer.asset.id) : undefined;
    const sourceWidth = activeLayer.asset.id === SCREEN_OVERLAY_ID ? screenSettings?.width : source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : undefined;
    const sourceHeight = activeLayer.asset.id === SCREEN_OVERLAY_ID ? screenSettings?.height : source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : undefined;
    const base = baseAssetRect(outputSize.width, outputSize.height, activeLayer.asset, sourceWidth, sourceHeight);
    return { base, rect: applyAssetTransform(outputSize.width, outputSize.height, base, activeLayer.asset.transform), transform: activeLayer.asset.transform };
  }, [activeLayer, outputSize.height, outputSize.width, screenSettings?.height, screenSettings?.width]);
  const activeSceneMemberGeometry = useMemo(() => {
    if (!activeScene || !activeGeometry || !focusedSceneMemberId) return null;
    const index = activeScene.memberIds.indexOf(focusedSceneMemberId);
    if (index < 0) return null;
    const bases = sceneMemberContentRects(activeScene, activeGeometry.rect, assets, { images: imagesRef.current, videos: videosRef.current });
    const rect = sceneMemberDisplayRects(activeScene, activeGeometry.rect, bases)[index];
    const asset = assets.find((item) => item.id === focusedSceneMemberId);
    return rect && asset ? { rect, asset } : null;
  }, [activeGeometry, activeScene, assets, focusedSceneMemberId]);
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
  const assetSceneMembership = useMemo(() => {
    const membership = new Map<string, StudioScene>();
    scenes.forEach((scene) => scene.memberIds.forEach((id) => membership.set(id, scene)));
    return membership;
  }, [scenes]);
  const standaloneAssets = useMemo(() => assets.filter((asset) => !assetSceneMembership.has(asset.id)), [assetSceneMembership, assets]);
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
  const finishDuration = Math.max(0, finishTakeMediaDuration || finishTake?.durationSeconds || 0);
  const normalizedTakeTrim = normalizeVideoTrim(takeTrim, finishDuration);
  const takeIsTrimmed = hasVideoTrim(normalizedTakeTrim, finishDuration);
  const captionsReady = captionEnabled && captionSegments.length > 0;
  const hasFinalEdits = takeIsTrimmed || captionsReady;

  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem("rii-flow-theme", themeMode);
  }, [themeMode]);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => { sceneSoloRef.current = sceneSolo; }, [sceneSolo]);
  useEffect(() => { liveLayerIdsRef.current = liveLayerIds; }, [liveLayerIds]);
  useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
  useEffect(() => { sceneMemberTargetIdRef.current = sceneMemberTargetId; }, [sceneMemberTargetId]);
  useEffect(() => {
    if (sceneMemberTargetId && (!activeScene || !activeScene.memberIds.includes(sceneMemberTargetId))) {
      sceneMemberTargetIdRef.current = null;
      setSceneMemberTargetId(null);
    }
  }, [activeScene, sceneMemberTargetId]);
  useEffect(() => {
    if (selectedSceneMemberId && (!activeScene || !activeScene.memberIds.includes(selectedSceneMemberId))) setSelectedSceneMemberId(null);
  }, [activeScene, selectedSceneMemberId]);
  useEffect(() => { activatedAtRef.current = activatedAt; }, [activatedAt]);
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
  useEffect(() => { qualityRef.current = qualityId; }, [qualityId]);
  useEffect(() => { aspectRef.current = aspectId; }, [aspectId]);
  useEffect(() => { mirrorCameraRef.current = mirrorCamera; }, [mirrorCamera]);
  useEffect(() => { cameraFrameRef.current = cameraFrame; }, [cameraFrame]);
  useEffect(() => { monitorMediaAudioRef.current = monitorMediaAudio; }, [monitorMediaAudio]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (!finishTake || !captionSegments.length || diagnostics || captionBusy) return;
    const timer = window.setTimeout(() => {
      void saveCaptionDocument({ takeId: finishTake.id, segments: captionSegments, style: normalizeCaptionStyle(captionStyle), updatedAt: Date.now() });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [captionBusy, captionSegments, captionStyle, diagnostics, finishTake]);
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
    if (manipulation.mode !== "dragging") setCameraBorderSnap(null);
  }, [manipulation.mode]);
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

  const commitAssetUpdates = useCallback((assetId: string, updates: Partial<StudioAsset>) => {
    if (assetId === SCREEN_OVERLAY_ID) {
      const current = screenOverlayRef.current;
      const next: ScreenOverlaySettings = {
        ...current,
        ...(updates.placement ? { placement: updates.placement } : {}),
        ...(updates.size ? { size: updates.size } : {}),
        ...("transform" in updates ? { transform: updates.transform } : {})
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
      initial,
      layerId: activeLayer.id,
      sceneMemberId: activeLayer.kind === "scene" && activeSceneMemberEditorGeometry ? selectedSceneMemberId ?? undefined : undefined,
      sceneGroupRect: activeLayer.kind === "scene" && activeSceneMemberEditorGeometry ? activeSceneMemberEditorGeometry.groupRect : undefined,
      moved: false
    };
    setSceneTemplateSnapped(false);
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
    const constrained = constrainAssetTransform(outputSize.width, outputSize.height, session.base, candidate);
    const borderResult = session.mode === "drag"
      ? snapTransformToCameraBorder(
          outputSize.width,
          outputSize.height,
          session.base,
          constrained,
          cameraFrameViewport(outputSize.width, outputSize.height, cameraFrameRef.current)
        )
      : { transform: constrained, target: null };
    const transform = borderResult.transform;
    setCameraBorderSnap((current) => current === borderResult.target ? current : borderResult.target);
    const layer = session.layerId === SCREEN_OVERLAY_ID && screenSettingsRef.current
      ? { id: SCREEN_OVERLAY_ID, kind: "asset" as const, asset: screenOverlayAsset(screenSettingsRef.current, screenOverlayRef.current) }
      : resolveLayer(session.layerId, assetsRef.current, scenesRef.current);
    if (layer?.kind === "asset") {
      setSceneTemplateSnapped(false);
      commitAssetUpdates(layer.asset.id, { transform });
    }
    if (layer?.kind === "scene") {
      const snappedScale = session.mode === "scale" ? snapScaleToTemplate(transform.scale) : transform.scale;
      const templateSnapped = session.mode === "scale" && snappedScale === 1 && Math.abs(transform.scale - 1) > 1e-9;
      setSceneTemplateSnapped(templateSnapped);
      const snappedTransform = { ...transform, scale: snappedScale };
      if (session.sceneMemberId && session.sceneGroupRect) {
        const order = sceneMemberDrawOrder(layer.scene).filter((id) => id !== session.sceneMemberId);
        order.push(session.sceneMemberId);
        commitSceneUpdates(layer.scene.id, {
          memberTransforms: {
            ...layer.scene.memberTransforms,
            [session.sceneMemberId]: sceneMemberRelativeTransform(outputSize.width, outputSize.height, session.sceneGroupRect, snappedTransform)
          },
          memberOrder: order
        });
      } else commitSceneUpdates(layer.scene.id, { transform: snappedTransform });
    }
    event.preventDefault();
  };

  const endPointerEdit = (event: ReactPointerEvent<HTMLElement>) => {
    const session = pointerEditRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    pointerEditRef.current = null;
    if (session.moved) suppressStageClickUntilRef.current = performance.now() + 160;
    setManipulation({ mode: "idle", progress: 0 });
    if (session.mode === "scale") {
      const layer = session.layerId === SCREEN_OVERLAY_ID && screenSettingsRef.current
        ? { id: SCREEN_OVERLAY_ID, kind: "asset" as const, asset: screenOverlayAsset(screenSettingsRef.current, screenOverlayRef.current) }
        : resolveLayer(session.layerId, assetsRef.current, scenesRef.current);
      if (layer?.kind === "asset") {
        const rect = applyAssetTransform(outputSize.width, outputSize.height, session.base, layer.asset.transform);
        if (snappedAssetSize(outputSize.width, outputSize.height, rect) === "full") commitAssetUpdates(layer.asset.id, { size: "full", transform: undefined });
      } else if (layer?.kind === "scene" && !session.sceneMemberId) {
        const rect = sceneDisplayRect(outputSize.width, outputSize.height, layer.scene);
        if (snappedAssetSize(outputSize.width, outputSize.height, rect) === "full") commitSceneUpdates(layer.scene.id, { size: "full", transform: undefined });
      }
    }
    setSceneTemplateSnapped(false);
  };

  const sceneMemberAtStagePoint = (event: ReactMouseEvent<HTMLElement>) => {
    if (!activeScene || !activeGeometry || !liveLayerIdsRef.current.includes(sceneLayerId(activeScene.id))) return null;
    const bounds = outputCanvasRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return null;
    const point = {
      x: ((event.clientX - bounds.left) / bounds.width) * outputSize.width,
      y: ((event.clientY - bounds.top) / bounds.height) * outputSize.height
    };
    const memberBases = sceneMemberContentRects(activeScene, activeGeometry.rect, assets, { images: imagesRef.current, videos: videosRef.current });
    const memberRects = sceneMemberDisplayRects(activeScene, activeGeometry.rect, memberBases);
    const rectById = new Map(activeScene.memberIds.map((id, index) => [id, memberRects[index]]));
    const eligibleOrder = activeSceneSoloId ? [activeSceneSoloId] : sceneMemberDrawOrder(activeScene);
    return [...eligibleOrder].reverse().find((id) => {
      const rect = rectById.get(id);
      return rect && point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
    }) ?? null;
  };

  const handleStageClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (isRecording || isFinalizing || performance.now() < suppressStageClickUntilRef.current) return;
    if (!activeScene) return;
    setSelectedSceneMemberId(sceneMemberAtStagePoint(event));
  };

  const handleStageDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!activeScene || !activeGeometry || !liveLayerIdsRef.current.includes(sceneLayerId(activeScene.id))) return;
    if (activeSceneSoloId) {
      toggleSceneSolo(activeScene, activeSceneSoloId);
      return;
    }
    const assetId = sceneMemberAtStagePoint(event);
    if (assetId) toggleSceneSolo(activeScene, assetId);
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
    liveLayerIdsRef.current = [];
    activeLayerIdRef.current = null;
    setLiveLayerIds([]);
    setActiveLayerId(null);
  }, []);

  const materializeProjectAssets = useCallback(async (snapshot: StudioProjectSnapshot) => {
    clearRuntimeAssets();
    const restored: StudioAsset[] = [];
    for (const stored of snapshot.assets) {
      const legacyBackground = (stored as StudioAsset & { background?: unknown }).background;
      const asset: StudioAsset = {
        ...stored,
        gesture: (stored.gesture as string | undefined) === "palm" ? undefined : stored.gesture,
        entranceAnimation: stored.entranceAnimation ?? "fade",
        cueSound: stored.cueSound ?? "none",
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
            const image = new Image();
            image.src = sourceUrl;
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
    const restoredScenes = (snapshot.scenes ?? []).map((scene) => ({
      ...scene,
      memberIds: scene.memberIds.filter((id) => availableIds.has(id)),
      placement: scene.placement ?? "center" as const,
      size: scene.size ?? "full" as const,
      stageBackground: normalizeStageBackground(scene.stageBackground),
      stageBackgroundColor: scene.stageBackgroundColor ?? "#111111",
      entranceAnimation: scene.entranceAnimation ?? "fade" as const,
      cueSound: scene.cueSound ?? "none" as const,
      cueVolume: scene.cueVolume ?? 0.65
    })).filter((scene) => scene.memberIds.length >= 2);
    const sceneMemberIds = new Set(restoredScenes.flatMap((scene) => scene.memberIds));
    restoredAssets = restoredAssets.map((asset) => sceneMemberIds.has(asset.id) ? { ...asset, gesture: undefined } : asset);
    assetsRef.current = restoredAssets;
    scenesRef.current = restoredScenes;
    projectIdRef.current = snapshot.id;
    selectedCameraRef.current = snapshot.selectedCameraId || selectedCameraRef.current;
    selectedMicrophoneRef.current = snapshot.selectedMicrophoneId || "none";
    qualityRef.current = snapshot.qualityId || "720p30";
    aspectRef.current = snapshot.aspectId || "landscape";
    mirrorCameraRef.current = Boolean(snapshot.mirrorCamera);
    const restoredCameraFrame = normalizeCameraFrame(snapshot.cameraFrame);
    cameraFrameRef.current = restoredCameraFrame;
    monitorMediaAudioRef.current = Boolean(snapshot.monitorMediaAudio);
    setProjectId(snapshot.id);
    setProjectName(snapshot.name);
    setAssets(restoredAssets);
    setScenes(restoredScenes);
    setSelectedCameraId(selectedCameraRef.current);
    setSelectedMicrophoneId(selectedMicrophoneRef.current);
    setQualityId(qualityRef.current);
    setAspectId(aspectRef.current);
    setMirrorCamera(mirrorCameraRef.current);
    setCameraFrame(restoredCameraFrame);
    setMonitorMediaAudio(monitorMediaAudioRef.current);
    const savedTiming = snapshot.timing || DEFAULT_TIMING;
    const restoredHoldMs = savedTiming.holdMs === 550 ? DEFAULT_TIMING.holdMs : savedTiming.holdMs;
    setTiming({
      holdMs: Number.isFinite(restoredHoldMs) ? Math.max(MIN_GESTURE_HOLD_MS, restoredHoldMs) : DEFAULT_TIMING.holdMs,
      cooldownMs: savedTiming.cooldownMs === 900 ? DEFAULT_TIMING.cooldownMs : savedTiming.cooldownMs,
      rearmMs: !savedTiming.rearmMs || savedTiming.rearmMs === 220 ? DEFAULT_TIMING.rearmMs : savedTiming.rearmMs
    });
    setPalmHoldMs(snapshot.palmHoldMs || DEFAULT_MANIPULATION.armMs);
    const source = qualityPreset(qualityRef.current);
    const dimensions = canvasDimensions(source.width, source.height, aspectRef.current);
    if (outputCanvasRef.current) {
      outputCanvasRef.current.width = dimensions.width;
      outputCanvasRef.current.height = dimensions.height;
    }
    setOutputSize(dimensions);
    setProjectHydrated(true);
    setProjectSaveState("saved");
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
  }, [aspectId, assets, cameraFrame, diagnostics, mirrorCamera, monitorMediaAudio, palmHoldMs, projectHydrated, projectId, projectName, qualityId, scenes, selectedCameraId, selectedMicrophoneId, timing]);

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
        setPhaseMessage("Studio ready — hold an assigned gesture");
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

  const updateScreenOverlay = (updates: Partial<ScreenOverlaySettings>) => {
    if (recordingRef.current) return;
    const next = { ...screenOverlayRef.current, ...updates };
    screenOverlayRef.current = next;
    setScreenOverlay(next);
    if (!next.visible && activeLayerIdRef.current === SCREEN_OVERLAY_ID) {
      const fallback = liveLayerIdsRef.current.at(-1) ?? null;
      activeLayerIdRef.current = fallback;
      setActiveLayerId(fallback);
    }
  };

  const selectScreenOverlay = () => {
    if (!screenSettingsRef.current || recordingRef.current) return;
    if (!screenOverlayRef.current.visible) updateScreenOverlay({ visible: true });
    activeLayerIdRef.current = SCREEN_OVERLAY_ID;
    setActiveLayerId(SCREEN_OVERLAY_ID);
    setSelectedSceneMemberId(null);
    sceneMemberTargetIdRef.current = null;
    setSceneMemberTargetId(null);
    manipulationTrackerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    setManipulation({ mode: "idle", progress: 0 });
  };

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
        hasAudio: nextStream.getAudioTracks().length > 0
      };
      const mixer = await ensureAudioMixer();
      connectScreenAudio(mixer, nextStream);
      screenStreamRef.current = nextStream;
      screenSettingsRef.current = capture;
      setScreenSettings(capture);
      screenOverlayRef.current = { ...screenOverlayRef.current, visible: true };
      setScreenOverlay(screenOverlayRef.current);
      activeLayerIdRef.current = SCREEN_OVERLAY_ID;
      setActiveLayerId(SCREEN_OVERLAY_ID);
      setScreenPhase("ready");
      setPhaseMessage(capture.hasAudio ? "Screen overlay and shared audio are live" : "Screen overlay is live — microphone audio remains active");

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
    if (!diagnostics || !["gesture", "palm", "double", "manipulation", "corner-snap", "stack", "scene", "scene-manipulation", "workspace"].includes(diagnosticScenario ?? "")) return;
    if (diagnosticScenario === "scene" || diagnosticScenario === "scene-manipulation" || diagnosticScenario === "workspace") {
      const samples: StudioAsset[] = [
        { id: "scene-member-a", name: "Portrait.png", kind: "image", sourceUrl: diagnosticAsset("PORTRAIT", "#e8b35d"), placement: "corner", size: "small", dataView: "table" },
        { id: "scene-member-b", name: "Product.png", kind: "image", sourceUrl: diagnosticAsset("PRODUCT", "#c8d9b0"), placement: "corner", size: "small", dataView: "table" },
        { id: "scene-member-c", name: "Detail.png", kind: "image", sourceUrl: diagnosticAsset("DETAIL", "#9fcbd0"), placement: "corner", size: "small", dataView: "table" }
      ];
      samples.forEach((sample) => {
        const image = new Image();
        image.src = sample.sourceUrl ?? "";
        imagesRef.current.set(sample.id, image);
      });
      const sampleScene: StudioScene = {
        id: "diagnostic-scene",
        name: "Product story",
        memberIds: samples.map((sample) => sample.id),
        gesture: "one",
        placement: "center",
        size: "small",
        layout: "grid"
      };
      assetsRef.current = samples;
      scenesRef.current = [sampleScene];
      setAssets(samples);
      setScenes([sampleScene]);
      return;
    }
    if (diagnosticScenario === "stack") {
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
          gesture: "two",
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
    if (diagnosticScenario === "corner-snap") {
      const diagnosticFrame = normalizeCameraFrame({ enabled: true, mode: "black", sizePercent: 10, customColor: "#3157d5" });
      cameraFrameRef.current = diagnosticFrame;
      setCameraFrame(diagnosticFrame);
    }
  }, [diagnosticScenario, diagnostics]);

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
      folderBacked: false,
      rating: index === 1 ? "favorite" : "neutral",
      availability: "session"
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
    liveLayerIdsRef.current = [];
    activeLayerIdRef.current = null;
    setLiveLayerIds([]);
    setActiveLayerId(null);
    videosRef.current.forEach((overlay) => overlay.pause());
    gateRef.current.reset();
    stabilizerRef.current.reset();
    manipulationTrackerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    sceneMemberTargetIdRef.current = null;
    setSceneMemberTargetId(null);
    setSelectedSceneMemberId(null);
    setManipulation({ mode: "idle", progress: 0 });
    setSceneTemplateSnapped(false);
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
    setPhaseMessage("Select a camera and start the studio");
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
    setPhaseMessage("Select a camera and start the studio");
  };

  const startStudio = async () => {
    if (studioStartingRef.current || ["permission", "loading", "switching", "stopping"].includes(phase) || studioReadyRef.current) return;
    const studioSession = ++studioSessionRef.current;
    studioStartingRef.current = true;
    setErrorMessage(null);
    gateRef.current.reset();
    stabilizerRef.current.reset();
    palmSignalTrackerRef.current.reset();
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
      setPhaseMessage("Studio ready — hold an assigned gesture");
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
    let cachedStack: StudioLayer[] = [];
    let cachedPlayingVideos: Array<{ asset: StudioAsset; overlay: HTMLVideoElement }> = [];
    const targetFps = normalizedCompositionFps(activeFrameRate);
    const frameBudget = compositionFrameBudget(targetFps);

    const refreshLayerCache = () => {
      if (cachedLayerIds === liveLayerIdsRef.current && cachedAssets === assetsRef.current && cachedScenes === scenesRef.current && cachedSceneSolo === sceneSoloRef.current) return;
      cachedLayerIds = liveLayerIdsRef.current;
      cachedAssets = assetsRef.current;
      cachedScenes = scenesRef.current;
      cachedSceneSolo = sceneSoloRef.current;
      cachedStack = liveLayerIdsRef.current
        .map((id) => resolveLayer(id, assetsRef.current, scenesRef.current))
        .filter((layer): layer is StudioLayer => Boolean(layer));
      const assetById = new Map(assetsRef.current.map((asset) => [asset.id, asset]));
      const playingVideoIds = new Set(cachedStack.flatMap((layer) => {
        if (layer.kind === "asset") return layer.asset.kind === "video" ? [layer.asset.id] : [];
        const soloId = sceneSoloRef.current[layer.scene.id];
        return layer.assets.filter((asset) => asset.kind === "video" && (!soloId || asset.id === soloId)).map((asset) => asset.id);
      }));
      cachedPlayingVideos = [...playingVideoIds].flatMap((id) => {
        const asset = assetById.get(id);
        const overlay = videosRef.current.get(id);
        return asset && overlay ? [{ asset, overlay }] : [];
      });
    };

    const draw = (now: number) => {
      if (stopped) return;
      if (shouldComposeFrame(now, lastComposedAt, targetFps)) {
        lastComposedAt = now;
        refreshLayerCache();
        cachedPlayingVideos.forEach(({ asset, overlay }) => {
          if (!Number.isFinite(overlay.duration) || overlay.duration <= 0) return;
          const trim = normalizeVideoTrim(asset.videoTrim, overlay.duration);
          if (overlay.currentTime < trim.start - 0.04 || overlay.currentTime >= trim.end - 0.025 || overlay.ended) {
            overlay.currentTime = trim.start;
            void overlay.play().catch(() => undefined);
          }
        });
        const composeStarted = performance.now();
        composeFrame(context, canvas, video, cachedStack, { images: imagesRef.current, videos: videosRef.current }, activatedAtRef.current, now, mirrorCameraRef.current, cameraFrameRef.current, sceneSoloRef.current, screenVideoRef.current, screenOverlayRef.current);
        const composeMs = performance.now() - composeStarted;
        composedFrames += 1;
        totalComposeMs += composeMs;
        if (composeMs > frameBudget) overBudgetFrames += 1;
      }
      if (now - statsStarted >= 1000) {
        const elapsed = now - statsStarted;
        const nextHealth = compositionHealth(composedFrames, totalComposeMs, elapsed, targetFps, overBudgetFrames);
        setCompositionStats((current) => current.fps === nextHealth.fps
          && current.averageMs === nextHealth.averageMs
          && current.budgetPercent === nextHealth.budgetPercent
          && current.overBudgetFrames === nextHealth.overBudgetFrames
          ? current
          : nextHealth);
        composedFrames = 0;
        totalComposeMs = 0;
        overBudgetFrames = 0;
        statsStarted = now;
      }
      outputAnimationRef.current = requestAnimationFrame(draw);
    };
    outputAnimationRef.current = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      if (outputAnimationRef.current !== null) cancelAnimationFrame(outputAnimationRef.current);
    };
  }, [activeFrameRate, studioReady]);

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
    setCaptionStyle({ ...DEFAULT_CAPTION_STYLE });
    setCaptionDrag({ dragging: false, snapX: false, snapY: false });
    setCaptionPreviewTime(0);
    setCaptionPreviewPlaying(false);
    captionDragPointerRef.current = null;
    if (diagnostics && diagnosticScenario === "caption-layout") {
      setCaptionEnabled(true);
      setCaptionSegments([{ id: "caption-layout-sample", text: "Place this caption exactly where you want it", start: 0, end: 5 }]);
      setCaptionStatus("ready");
      return;
    }
    if (!diagnostics) {
      const saved = await loadCaptionDocument(take.id).catch(() => undefined);
      if (saved) {
        setCaptionSegments(saved.segments);
        setCaptionStyle(normalizeCaptionStyle(saved.style));
        setCaptionStatus("ready");
      }
    }
  };

  const generateEnglishCaptions = async () => {
    if (!finishTake) return;
    try {
      setCaptionStatus("loading");
      setCaptionProgress({ phase: "loading", percent: 0 });
      let audio = captionAudioCacheRef.current.get(finishTake.id) ?? null;
      if (!audio && !diagnostics) audio = await loadCaptionAudio(finishTake.id);
      if (!audio?.samples.length) throw new Error("This take has no mic-only caption source. Record a new take with the microphone enabled.");
      captionAudioCacheRef.current.set(finishTake.id, audio);
      const segments = await transcribeEnglish(audio, (progress) => {
        setCaptionProgress(progress);
        setCaptionStatus(progress.phase === "loading" ? "loading" : "transcribing");
      });
      if (!segments.length) throw new Error("No clear English speech was found in the selected microphone feed.");
      setCaptionSegments(segments);
      setCaptionStatus("ready");
      setCaptionProgress(null);
      if (!diagnostics) await saveCaptionDocument({ takeId: finishTake.id, segments, style: captionStyle, updatedAt: Date.now() });
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
      if (!diagnostics && captionsReady) await saveCaptionDocument({ takeId: finishTake.id, segments: captionSegments, style: captionStyle, updatedAt: Date.now() });
      const blob = await renderCaptionedTake({
        sourceUrl: finishTake.url,
        width: finishTake.width,
        height: finishTake.height,
        frameRate: finishTake.frameRate,
        bitrate: finishTake.bitrate,
        segments: captionsReady ? captionSegments : [],
        style: captionsReady ? captionStyle : undefined,
        startTime: normalizedTakeTrim.start,
        endTime: normalizedTakeTrim.end,
        onProgress: setCaptionRenderProgress
      });
      let fileName = editedFileName(finishTake.fileName, { captions: captionsReady, trimmed: takeIsTrimmed });
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

  const removeTake = async (take: RecordedClip) => {
    if (!window.confirm(`Delete ${take.fileName}${take.folderBacked ? " from the recordings folder" : " from this session"}?`)) return;
    try {
      if (take.folderBacked && recordingsDirectoryRef.current && await directoryPermission(recordingsDirectoryRef.current, true) === "granted") {
        await recordingsDirectoryRef.current.removeEntry(take.fileName);
      }
      if (take.url) URL.revokeObjectURL(take.url);
      await deleteTake(take.id);
      takeLibraryRef.current = takeLibraryRef.current.filter((item) => item.id !== take.id);
      setRecordings((current) => current.filter((item) => item.id !== take.id));
      if (previewTakeId === take.id) setPreviewTakeId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The take could not be deleted.");
    }
  };

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
    const hidden = resolveLayer(result.hiddenId, assetsRef.current, scenesRef.current);
    const remainingAssetIds = new Set(result.stack.flatMap((id) => {
      const layer = resolveLayer(id, assetsRef.current, scenesRef.current);
      return layer ? layerAssetIds(layer) : [];
    }));
    hidden && layerAssetIds(hidden).forEach((id) => {
      if (!remainingAssetIds.has(id)) videosRef.current.get(id)?.pause();
    });
    if (hidden?.kind === "scene") {
      const nextSolo = { ...sceneSoloRef.current };
      delete nextSolo[hidden.scene.id];
      sceneSoloRef.current = nextSolo;
      setSceneSolo(nextSolo);
    }
    manipulationTrackerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    sceneMemberTargetIdRef.current = null;
    setSceneMemberTargetId(null);
    setSelectedSceneMemberId(null);
    manipulationGuardUntilRef.current = performance.now() + 450;
    setManipulation({ mode: "idle", progress: 0 });
    setSceneTemplateSnapped(false);
    liveLayerIdsRef.current = result.stack;
    activeLayerIdRef.current = result.focusedId;
    setLiveLayerIds(result.stack);
    setActiveLayerId(result.focusedId);
  }, []);

  const activateStudioLayer = useCallback((layer: StudioLayer) => {
    sceneSoloRef.current = {};
    setSceneSolo({});
    setSelectedSceneMemberId(null);
    layerAssetIds(layer).forEach((id) => {
      const overlayVideo = videosRef.current.get(id);
      if (!overlayVideo) return;
      const asset = assetsRef.current.find((item) => item.id === id);
      const trim = normalizeVideoTrim(asset?.videoTrim, asset?.mediaDuration ?? overlayVideo.duration);
      overlayVideo.currentTime = trim.start;
      void overlayVideo.play().catch(() => undefined);
    });
    const now = performance.now();
    const cueSound = layer.kind === "asset" ? layer.asset.cueSound : layer.scene.cueSound;
    const cueVolume = layer.kind === "asset" ? layer.asset.cueVolume : layer.scene.cueVolume;
    playCueSound(audioMixerRef.current, cueSound, cueVolume);
    manipulationTrackerRef.current.reset();
    palmSignalTrackerRef.current.reset();
    manipulationGuardUntilRef.current = now + 700;
    setManipulation({ mode: "idle", progress: 0 });
    setSceneTemplateSnapped(false);
    const nextStack = activateLayer(liveLayerIdsRef.current, layer.id);
    liveLayerIdsRef.current = nextStack;
    activeLayerIdRef.current = layer.id;
    activatedAtRef.current = now;
    setLiveLayerIds(nextStack);
    setActiveLayerId(layer.id);
    setActivatedAt(now);
  }, []);

  const activateLayerFromLibrary = async (layer: StudioLayer) => {
    activateStudioLayer(layer);
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
    const category = (categoryName: string): InferenceCategory => ({ categoryName, score: 0.99, index: 0, displayName: "" });

    const applyDiagnostics = (result: GestureFrameResult, now: number) => {
      let categories = result.gestures.map((gestures) => gestures[0]);
      let landmarkSets = result.landmarks ?? [];
      let handednesses = result.handednesses ?? [];
      const elapsed = now - diagnosticSequenceStartRef.current;
      if (diagnosticScenario === "gesture" || diagnosticScenario === "palm" || diagnosticScenario === "scene") {
        if (elapsed < 3000) categories = [category(diagnosticScenario === "palm" ? "Open_Palm" : "Pointing_Up")];
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
      } else if (diagnosticScenario === "manipulation" || diagnosticScenario === "corner-snap" || diagnosticScenario === "scene-manipulation") {
        const cameraX = (displayX: number) => mirrorCameraRef.current ? 1 - displayX : displayX;
        const activationWindow = diagnosticScenario === "scene-manipulation" ? 2500 : 1200;
        categories = elapsed < activationWindow ? [category("Pointing_Up")] : [];
        landmarkSets = [];
        if (diagnosticScenario === "corner-snap" && elapsed >= 2500 && elapsed < 3200) {
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.84), 0.18)];
        } else if (diagnosticScenario === "corner-snap" && elapsed >= 3200 && elapsed < 5200) {
          const progress = (elapsed - 3200) / 2000;
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.84 - progress * 0.585), 0.18 + progress * 0.065)];
        } else if (diagnosticScenario === "corner-snap" && elapsed >= 5200 && elapsed < 6500) {
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.255), 0.245)];
        } else if (diagnosticScenario === "scene-manipulation" && elapsed >= 3500 && elapsed < 4200) {
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
        } else if (elapsed >= 3200 && elapsed < 5000) {
          const progress = (elapsed - 3200) / 1800;
          landmarkSets = [diagnosticPalmLandmarks(cameraX(0.84 - progress * 0.17), 0.18 + progress * 0.2)];
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
      const rawResolution = handResults.find((item) => item.gesture === "fist")
        ?? compositeResult
        ?? triggerResults.filter((item) => item.gesture !== null && item.gesture !== "palm").sort((a, b) => (b.confidence * b.quality) - (a.confidence * a.quality))[0]
        ?? { gesture: null, source: "none" as const, confidence: 0, quality: 1 };
      const stable = stabilizerRef.current.update(rawResolution, now);
      const palmObservations: PalmObservation[] = [];
      handResults.forEach((hand, index) => {
        if (hand.gesture !== "palm" || hand.confidence * hand.quality < 0.46) return;
        const point = palmControlPoint(landmarkSets[index] ?? []);
        if (!point) return;
        const handedness = handednesses[index]?.[0]?.categoryName || `hand-${index}`;
        palmObservations.push({ id: handedness, point: mapControlPointForMirror(point, mirrorCameraRef.current) });
      });
      const palmPoints = palmSignalTrackerRef.current.update(palmObservations, now);
      const movementPoints = palmPoints.map((point) => mapPointForMovementReach(point, "comfort", aspectRef.current));
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

      let event;
      if (stable.gesture === "fist") {
        manipulationTrackerRef.current.reset();
        palmSignalTrackerRef.current.reset();
        sceneMemberTargetIdRef.current = null;
        setSceneMemberTargetId(null);
        setManipulation({ mode: "idle", progress: 0 });
        setSceneTemplateSnapped(false);
        event = gateRef.current.update("fist", now);
      } else {
        const active = activeLayerIdRef.current === SCREEN_OVERLAY_ID && screenSettingsRef.current && screenOverlayRef.current.visible
          ? { id: SCREEN_OVERLAY_ID, kind: "asset" as const, asset: screenOverlayAsset(screenSettingsRef.current, screenOverlayRef.current) }
          : activeLayerIdRef.current ? resolveLayer(activeLayerIdRef.current, assetsRef.current, scenesRef.current) : null;
        let manipulationUpdate: ManipulationUpdate = { mode: "idle", progress: 0, suppressActivation: false };

        if (active && now >= manipulationGuardUntilRef.current) {
          let base: Rect | null = null;
          let rect: Rect | null = null;
          let currentTransform: StudioAsset["transform"];
          let sceneMemberContext: { memberId: string; groupRect: Rect } | null = null;
          let sourceWidth: number | undefined;
          let sourceHeight: number | undefined;
          if (active.kind === "asset") {
            const source = active.asset.id === SCREEN_OVERLAY_ID
              ? undefined
              : active.asset.kind === "image" ? imagesRef.current.get(active.asset.id) : active.asset.kind === "video" ? videosRef.current.get(active.asset.id) : undefined;
            sourceWidth = active.asset.id === SCREEN_OVERLAY_ID ? screenSettingsRef.current?.width : source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : undefined;
            sourceHeight = active.asset.id === SCREEN_OVERLAY_ID ? screenSettingsRef.current?.height : source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : undefined;
            base = baseAssetRect(outputCanvas.width, outputCanvas.height, active.asset, sourceWidth, sourceHeight);
            rect = applyAssetTransform(outputCanvas.width, outputCanvas.height, base, active.asset.transform);
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
            const eligibleOrder = soloId ? [soloId] : sceneMemberDrawOrder(active.scene);
            let targetId = sceneMemberTargetIdRef.current;
            if (targetId && (!active.scene.memberIds.includes(targetId) || (soloId && targetId !== soloId))) targetId = null;
            if (!targetId && movementPoints.length) {
              const paddingX = outputCanvas.width * 0.018;
              const paddingY = outputCanvas.height * 0.018;
              const reversedOrder = [...eligibleOrder].reverse();
              const containsPalm = (id: string, points: typeof palmPoints) => {
                const targetRect = rectById.get(id);
                return Boolean(targetRect && points.some((point) => {
                  const x = point.x * outputCanvas.width;
                  const y = point.y * outputCanvas.height;
                  return x >= targetRect.x - paddingX && x <= targetRect.x + targetRect.width + paddingX
                    && y >= targetRect.y - paddingY && y <= targetRect.y + targetRect.height + paddingY;
                }));
              };
              const directTargetId = reversedOrder.find((id) => containsPalm(id, palmPoints));
              targetId = directTargetId ?? reversedOrder.find((id) => containsPalm(id, movementPoints)) ?? null;
              if (targetId) {
                manipulationTrackerRef.current.reset();
                sceneMemberTargetIdRef.current = targetId;
                setSceneMemberTargetId(targetId);
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
              palmPoints
            );
          }

          if (base && currentTransform && manipulationUpdate.transform) {
            const target = constrainAssetTransform(outputCanvas.width, outputCanvas.height, base, manipulationUpdate.transform);
            const snappedScale = active.kind === "scene" && sceneMemberContext && manipulationUpdate.mode === "scaling"
              ? snapScaleToTemplate(target.scale)
              : target.scale;
            const templateSnapped = active.kind === "scene"
              && Boolean(sceneMemberContext)
              && manipulationUpdate.mode === "scaling"
              && snappedScale === 1
              && Math.abs(target.scale - 1) > 1e-9;
            setSceneTemplateSnapped((current) => current === templateSnapped ? current : templateSnapped);
            const desired = { ...target, scale: snappedScale };
            const borderResult = manipulationUpdate.mode === "dragging"
              ? snapTransformToCameraBorder(
                  outputCanvas.width,
                  outputCanvas.height,
                  base,
                  desired,
                  cameraFrameViewport(outputCanvas.width, outputCanvas.height, cameraFrameRef.current)
                )
              : { transform: desired, target: null };
            setCameraBorderSnap((current) => current === borderResult.target ? current : borderResult.target);
            const smoothing = borderResult.target ? 1 : manipulationUpdate.mode === "scaling" ? 0.76 : 0.84;
            const smoothed = {
              x: currentTransform.x + (borderResult.transform.x - currentTransform.x) * smoothing,
              y: currentTransform.y + (borderResult.transform.y - currentTransform.y) * smoothing,
              scale: templateSnapped ? 1 : currentTransform.scale + (borderResult.transform.scale - currentTransform.scale) * smoothing
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
            if (manipulationUpdate.endedMode === "scaling" && active.kind === "asset") {
              const latest = assetsRef.current.find((asset) => asset.id === active.asset.id) ?? active.asset;
              const latestBase = baseAssetRect(outputCanvas.width, outputCanvas.height, latest, sourceWidth, sourceHeight);
              const latestRect = applyAssetTransform(outputCanvas.width, outputCanvas.height, latestBase, latest.transform);
              const snappedSize = snappedAssetSize(outputCanvas.width, outputCanvas.height, latestRect);
              if (snappedSize) commitAssetUpdates(latest.id, { size: snappedSize, transform: undefined });
            }
            sceneMemberTargetIdRef.current = null;
            setSceneMemberTargetId(null);
            setSceneTemplateSnapped(false);
            manipulationGuardUntilRef.current = now + 650;
            gateRef.current.disarm(now);
            stabilizerRef.current.reset();
          } else if (active.kind === "scene" && !palmPoints.length && manipulationUpdate.mode === "idle" && sceneMemberTargetIdRef.current) {
            sceneMemberTargetIdRef.current = null;
            setSceneMemberTargetId(null);
            setSceneTemplateSnapped(false);
          }
        } else if (!active) {
          manipulationTrackerRef.current.reset();
          sceneMemberTargetIdRef.current = null;
          setSceneMemberTargetId(null);
          setSceneTemplateSnapped(false);
        }

        setManipulation((current) => current.mode === manipulationUpdate.mode && Math.abs(current.progress - manipulationUpdate.progress) < 0.06
          ? current
          : { mode: manipulationUpdate.mode, progress: manipulationUpdate.progress });

        const routedLayer = stable.gesture && stable.gesture !== "palm"
          ? findGestureLayer(stable.gesture, assetsRef.current, scenesRef.current)
          : null;
        const suppressActivation = manipulationUpdate.suppressActivation || now < manipulationGuardUntilRef.current;
        event = suppressActivation
          ? gateRef.current.suppress()
          : gateRef.current.update(stable.gesture, now, Boolean(routedLayer));
      }
      setHoldProgress((current) => {
        const boundaryChanged = (event.progress === 0 && current !== 0) || (event.progress === 1 && current !== 1);
        return !boundaryChanged && Math.abs(current - event.progress) < 0.07 ? current : event.progress;
      });
      setArmed(event.armed);
      if (event.hide) hideLayer();
      if (event.trigger) {
        const layer = findGestureLayer(event.trigger, assetsRef.current, scenesRef.current);
        if (layer) activateStudioLayer(layer);
      }
    };

    const infer = async (now: number) => {
      if (stopped || busy || now - lastInferenceAt < 70 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      busy = true;
      lastInferenceAt = now;
      try {
        context.drawImage(video, 0, 0, 640, 360);
        processResult(await recognizer.recognize(inferenceCanvas, now), now);
      } catch (error) {
        if (!stopped) console.error("Gesture inference frame failed", error);
      } finally {
        busy = false;
      }
    };

    const schedule = () => {
      if (stopped) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        frameCallbackId = video.requestVideoFrameCallback((now) => {
          schedule();
          void infer(now);
        });
      } else {
        animationId = requestAnimationFrame((now) => {
          schedule();
          void infer(now);
        });
      }
    };
    schedule();
    return () => {
      stopped = true;
      if (frameCallbackId !== null && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(frameCallbackId);
      if (animationId !== null) cancelAnimationFrame(animationId);
    };
  }, [activateStudioLayer, commitAssetUpdates, commitSceneUpdates, diagnosticScenario, hideLayer, studioReady]);

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
    }, 200);
    return () => {
      window.clearInterval(timer);
      setMicrophoneLevel(0);
    };
  }, [studioReady]);

  const startRecording = async () => {
    const canvas = outputCanvasRef.current;
    if (!canvas || !granted || !studioReadyRef.current || recordingRef.current || isFinalizing) return;
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
      setRecordingBytes(0);
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
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.requestData();
      window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 150);
    }
  }, []);

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

  const toggleMirrorCamera = () => {
    if (recordingRef.current) return;
    const next = !mirrorCameraRef.current;
    mirrorCameraRef.current = next;
    setMirrorCamera(next);
    if (!diagnostics) localStorage.setItem("gesture-studio-mirror", String(next));
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
          const image = new Image();
          image.src = sourceUrl;
          imagesRef.current.set(id, image);
          imported.push({ id, name: file.name, kind: "image", sourceUrl, placement: "corner", size: "small", dataView: "table", stageBackground: "camera", stageBackgroundColor: "#111111", entranceAnimation: "fade", cueSound: "none", cueVolume: 0.65 });
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
            connectVideoAudio(audioMixerRef.current, id, overlayVideo, false);
          }
          imported.push({ id, name: file.name, kind: "video", sourceUrl, placement: "corner", size: "small", dataView: "table", includeAudio: false, mediaDuration: duration || undefined, stageBackground: "camera", stageBackgroundColor: "#111111", entranceAnimation: "fade", cueSound: "none", cueVolume: 0.65 });
          if (!diagnostics && projectIdRef.current) await saveAssetBlob(projectIdRef.current, id, file);
        } else if (file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv") {
          imported.push({ id, name: file.name, kind: "csv", rows: parseCsv(await file.text()), placement: "lower", size: "small", dataView: "table", stageBackground: "camera", stageBackgroundColor: "#111111", entranceAnimation: "fade", cueSound: "none", cueVolume: 0.65 });
        } else if (file.name.toLowerCase().endsWith(".json") || file.type === "application/json") {
          imported.push({ id, name: file.name, kind: "json", rows: parseJson(await file.text()), placement: "lower", size: "small", dataView: "table", stageBackground: "camera", stageBackgroundColor: "#111111", entranceAnimation: "fade", cueSound: "none", cueVolume: 0.65 });
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

  const toggleSceneDraftMember = (assetId: string) => {
    setSceneDraftMembers((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]);
  };

  const createScene = () => {
    const members = sceneDraftMembers.filter((id) => assetsRef.current.some((asset) => asset.id === id) && !scenesRef.current.some((scene) => scene.memberIds.includes(id)));
    if (members.length < 2) {
      setErrorMessage("Choose at least two unused assets for a collage scene.");
      return;
    }
    const scene: StudioScene = {
      id: crypto.randomUUID(),
      name: sceneDraftName.trim() || `Scene ${scenesRef.current.length + 1}`,
      memberIds: members,
      placement: "center",
      size: "full",
      layout: sceneDraftLayout,
      stageBackground: "camera",
      stageBackgroundColor: "#111111",
      entranceAnimation: "fade",
      cueSound: "none",
      cueVolume: 0.65
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
    const nextStack = removeLayer(liveLayerIdsRef.current, layerId);
    const nextFocus = activeLayerIdRef.current === layerId ? nextStack.at(-1) ?? null : activeLayerIdRef.current;
    const nextSolo = { ...sceneSoloRef.current };
    delete nextSolo[scene.id];
    scenesRef.current = nextScenes;
    liveLayerIdsRef.current = nextStack;
    activeLayerIdRef.current = nextFocus;
    sceneSoloRef.current = nextSolo;
    setScenes(nextScenes);
    setLiveLayerIds(nextStack);
    setActiveLayerId(nextFocus);
    setSceneSolo(nextSolo);
  };

  const assignSceneGesture = (sceneId: string, gesture: GestureId | undefined) => {
    const owner = gesture ? gestureOwner(gesture, assetsRef.current, scenesRef.current, { kind: "scene", id: sceneId }) : null;
    if (gesture && owner) {
      setErrorMessage(`${gestureLabel(gesture)} is already assigned to ${owner.name}.`);
      return;
    }
    setErrorMessage(null);
    commitSceneUpdates(sceneId, { gesture });
  };

  function toggleSceneSolo(scene: StudioScene, assetId: string) {
    if (!liveLayerIdsRef.current.includes(sceneLayerId(scene.id))) return;
    const current = sceneSoloRef.current[scene.id];
    const next = { ...sceneSoloRef.current };
    if (current === assetId) delete next[scene.id];
    else next[scene.id] = assetId;
    sceneSoloRef.current = next;
    setSceneSolo(next);
    scene.memberIds.forEach((id) => {
      const asset = assetsRef.current.find((item) => item.id === id);
      const video = videosRef.current.get(id);
      const visible = !next[scene.id] || next[scene.id] === id;
      if (video) {
        if (visible) void video.play().catch(() => undefined);
        else video.pause();
      }
      setVideoAudioEnabled(audioMixerRef.current, id, Boolean(visible && asset?.includeAudio));
    });
  }

  const assignGesture = (assetId: string, gesture: GestureId | undefined) => {
    const scene = scenesRef.current.find((item) => item.memberIds.includes(assetId));
    if (scene) {
      setErrorMessage(`${scene.name} owns the gesture for this asset.`);
      return;
    }
    const owner = gesture ? gestureOwner(gesture, assetsRef.current, scenesRef.current, { kind: "asset", id: assetId }) : null;
    if (gesture && owner) {
      setErrorMessage(`${gestureLabel(gesture)} is already assigned to ${owner.name}.`);
      return;
    }
    setErrorMessage(null);
    updateAsset(assetId, { gesture });
  };

  const removeAsset = (asset: StudioAsset) => {
    if (asset.sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(asset.sourceUrl);
    imagesRef.current.delete(asset.id);
    videosRef.current.get(asset.id)?.pause();
    removeVideoAudio(audioMixerRef.current, asset.id);
    videosRef.current.delete(asset.id);
    const remainingAssets = assetsRef.current.filter((item) => item.id !== asset.id);
    const sceneResult = removeAssetFromScenes(asset.id, scenesRef.current);
    let nextStack = removeLayer(liveLayerIdsRef.current, asset.id);
    sceneResult.removedSceneIds.forEach((id) => { nextStack = removeLayer(nextStack, sceneLayerId(id)); });
    const activeWasRemoved = activeLayerIdRef.current === asset.id
      || sceneResult.removedSceneIds.some((id) => activeLayerIdRef.current === sceneLayerId(id));
    const nextFocus = activeWasRemoved ? nextStack[nextStack.length - 1] ?? null : activeLayerIdRef.current;
    assetsRef.current = remainingAssets;
    scenesRef.current = sceneResult.scenes;
    liveLayerIdsRef.current = nextStack;
    activeLayerIdRef.current = nextFocus;
    setAssets(remainingAssets);
    setScenes(sceneResult.scenes);
    setLiveLayerIds(nextStack);
    setActiveLayerId(nextFocus);
    if (!diagnostics && projectIdRef.current) void deleteAssetBlob(projectIdRef.current, asset.id);
    if (nextFocus !== activeLayerId) {
      manipulationTrackerRef.current.reset();
      palmSignalTrackerRef.current.reset();
      setManipulation({ mode: "idle", progress: 0 });
      setSceneTemplateSnapped(false);
    }
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

  const stageStateTitle = phase === "permission" ? "Camera permission" : phase === "loading" ? "Loading MediaPipe" : phase === "stopping" ? "Stopping studio" : phase === "error" ? "Studio error" : "Studio is off";
  const manipulationSubject = activeSceneMemberGeometry?.asset.name
    ? shortName(activeSceneMemberGeometry.asset.name, 18)
    : activeLayer?.kind;
  const pointerEditorGeometry = activeSceneMemberEditorGeometry ?? activeGeometry;
  const pointerEditorName = activeSceneMemberEditorGeometry?.asset.name ?? (activeLayer ? layerName(activeLayer) : "Asset");
  const visibleCameraViewport = cameraFrameViewport(outputSize.width, outputSize.height, cameraFrame);
  const manipulationHeadline = cameraBorderSnap
    ? cameraSnapLabel(cameraBorderSnap)
    : sceneTemplateSnapped
    ? "Template size"
    : manipulationLabel(manipulation.mode, manipulationSubject);
  const previewTake = previewTakeId ? recordings.find((take) => take.id === previewTakeId) ?? null : null;
  const screenCaptureSupported = diagnostics || Boolean(navigator.mediaDevices?.getDisplayMedia);
  const screenSurfaceName = screenSettings?.displaySurface === "browser"
    ? "Browser tab"
    : screenSettings?.displaySurface === "window"
    ? "Window"
    : screenSettings?.displaySurface === "monitor"
    ? "Display"
    : "Shared screen";

  return (
    <main
      className="app-shell"
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
      data-scene-template-snapped={sceneTemplateSnapped}
      data-camera-border-snap={cameraBorderSnap ?? "none"}
      data-detected-gesture={detected.gesture ?? "none"}
      data-gesture-armed={armed}
      data-hold-progress={holdProgress.toFixed(3)}
      data-live-layer-count={liveLayers.length}
      data-live-layer-ids={liveLayerIds.join(",")}
      data-active-layer-kind={activeLayer?.kind ?? "none"}
      data-active-scale={activeAsset?.transform?.scale ?? activeScene?.transform?.scale ?? 1}
      data-active-size={activeAsset?.size ?? activeScene?.size ?? ""}
      data-active-x={activeAsset?.transform?.x ?? activeScene?.transform?.x ?? ""}
      data-active-y={activeAsset?.transform?.y ?? activeScene?.transform?.y ?? ""}
      data-scene-count={scenes.length}
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
      data-stage-frame-rate={activeFrameRate}
      data-stage-background={stageBackdropForLayers(liveLayers).mode}
      data-project-id={projectId}
      data-project-save-state={projectSaveState}
      data-project-takes={recordings.length}
      data-workspace-assets={assets.length}
      data-workspace-scenes={scenes.length}
      data-trigger-hand="any"
      data-movement-reach="comfort"
      data-recording-finalizing={isFinalizing}
      data-recording-folder={folderPermission === "granted" ? recordingsDirectory?.name ?? "connected" : "session"}
    >
      <div className="studio-grid">
        <aside className="library-panel" aria-label="Media library">
          <div className="app-brand"><div className="app-logo"><Hand size={18} /></div><span><h1>Rii-Flow</h1><small>Turn gestures into on-camera visuals</small></span><button className="theme-toggle" aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} theme`} title={`Use ${themeMode === "dark" ? "light" : "dark"} theme`} aria-pressed={themeMode === "dark"} onClick={() => setThemeMode((current) => current === "dark" ? "light" : "dark")}>{themeMode === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button></div>
          <section className="recording-destination-bar" aria-label="Recording destination">
            <div className={`workspace-destination ${folderPermission === "granted" ? "ready" : "warning"}`}>
              <span><HardDrive size={16} /></span>
              <div><small>Recording destination</small><strong>{recordingsDirectory?.name ?? "Session memory"}</strong><em>{folderPermission === "granted" ? "Direct MP4 saving" : recordingsDirectory ? "Reconnect or choose another folder" : folderPermission === "unsupported" ? "Folder selection needs Chrome or Edge" : "Choose a folder for long takes"}</em></div>
              <button data-testid="recording-folder-button" disabled={isRecording || isFinalizing} aria-label={recordingsDirectory ? "Change recording folder" : "Choose recording folder"} title={recordingsDirectory ? "Change recording folder" : "Choose recording folder"} onClick={() => void changeRecordingsFolder()}><FolderOpen size={15} /><span>{recordingsDirectory ? "Change" : "Choose"}</span></button>
            </div>
          </section>
          <div className="panel-title"><div><span>Live visual library</span><h2>Media</h2></div><b>{assets.length}</b></div>
          <input ref={fileInputRef} data-testid="asset-input" className="visually-hidden" type="file" multiple accept="image/*,video/*,.csv,text/csv,.json,application/json" onChange={handleImport} />
          <div className="library-actions">
            <button className="import-control" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Import media</button>
            <button className="scene-control" aria-expanded={sceneBuilderOpen} aria-controls="scene-builder-dialog" onClick={() => setSceneBuilderOpen(true)}>
              <span className="scene-control-icon"><LayoutGrid size={20} /></span>
              <span className="scene-control-copy"><strong>Create collage scene</strong><small>Group media in one layout · trigger together</small></span>
              <Plus size={18} />
            </button>
          </div>
          <p className="support-copy">Images, videos, CSV, and JSON</p>

          {sceneBuilderOpen && (
            <div className="scene-builder-modal" role="dialog" aria-modal="true" aria-labelledby="scene-builder-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSceneBuilderOpen(false); }}>
              <section id="scene-builder-dialog" className="scene-builder">
                <header className="scene-builder-heading"><span className="scene-builder-heading-icon"><LayoutGrid size={21} /></span><span><small>Hands-free composition</small><strong id="scene-builder-title">Create a collage scene</strong></span><button aria-label="Close scene builder" onClick={() => setSceneBuilderOpen(false)}><X size={18} /></button></header>
                <p className="scene-builder-intro">A scene arranges several assets into one composition. Assign one gesture to the finished scene and every item appears together.</p>
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
                    <div className="scene-assets-heading"><span><strong>Choose media</strong><small>At least two available assets</small></span><b>{sceneDraftMembers.length} selected</b></div>
                    {assets.length < 2 ? (
                      <div className="scene-requirement"><span><LayoutGrid size={21} /></span><div><strong>Import at least two media files</strong><small>Images, videos, CSV, and JSON can all be used in a collage.</small></div><button onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Import media</button></div>
                    ) : assets.filter((asset) => !assetSceneMembership.has(asset.id)).length < 2 ? (
                      <div className="scene-requirement used"><span><Layers3 size={21} /></span><div><strong>Not enough available media</strong><small>Assets already inside a scene cannot be reused. Remove an existing scene or import more media.</small></div><button onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Import more</button></div>
                    ) : null}
                    <div className="scene-member-picker">
                      {assets.map((asset) => {
                        const owner = assetSceneMembership.get(asset.id);
                        return <button key={asset.id} disabled={Boolean(owner)} className={sceneDraftMembers.includes(asset.id) ? "selected" : ""} aria-pressed={sceneDraftMembers.includes(asset.id)} onClick={() => toggleSceneDraftMember(asset.id)}><i>{asset.kind === "image" ? <img src={asset.sourceUrl} alt="" /> : asset.kind === "video" ? <Video size={17} /> : <FileSpreadsheet size={17} />}</i><span><strong>{shortName(asset.name, 22)}</strong><small>{owner ? `Used in ${shortName(owner.name, 18)}` : asset.kind.toUpperCase()}</small></span>{sceneDraftMembers.includes(asset.id) ? <Check size={15} /> : null}</button>;
                      })}
                    </div>
                  </div>
                </div>
                <footer className="scene-builder-footer"><small>{sceneDraftMembers.length < 2 ? "Select two or more available assets to continue." : `${sceneDraftMembers.length} assets will appear together when this scene is triggered.`}</small><div><button onClick={() => setSceneBuilderOpen(false)}>Cancel</button><button className="confirm" disabled={sceneDraftMembers.length < 2} onClick={createScene}><Plus size={16} /> Create scene</button></div></footer>
              </section>
            </div>
          )}

          {scenes.length > 0 && (
            <section className="scene-section" aria-label="Collage scenes">
              <div className="scene-section-heading"><span className="scene-section-icon"><Layers3 size={18} /></span><span><strong>Scenes</strong></span><b>{scenes.length}</b></div>
              <div className="scene-stack">
                {scenes.map((scene) => {
                  const layerId = sceneLayerId(scene.id);
                  const sceneAssets = scene.memberIds.map((id) => assets.find((asset) => asset.id === id)).filter((asset): asset is StudioAsset => Boolean(asset));
                  const soloId = sceneSolo[scene.id];
                  return (
                    <article key={scene.id} className={`asset-item scene-item ${liveLayerIds.includes(layerId) ? "live" : ""} ${activeLayerId === layerId ? "focused" : ""}`}>
                      <div className="asset-identity-row">
                        <button className={`asset-icon asset-preview-button scene-preview ${scene.layout}`} aria-label={`Activate ${scene.name}`} onClick={() => void activateLayerFromLibrary(resolveLayer(layerId, assets, scenes) as StudioLayer)}>
                          {sceneAssets.slice(0, 4).map((asset) => asset.kind === "image" ? <img key={asset.id} src={asset.sourceUrl} alt="" /> : <span key={asset.id}>{asset.kind === "video" ? <Video size={13} /> : <FileSpreadsheet size={13} />}</span>)}
                        </button>
                        <span className="asset-copy"><input className="scene-name-input" aria-label="Scene name" value={scene.name} onChange={(event) => commitSceneUpdates(scene.id, { name: event.target.value })} /><small>{sceneAssets.length} ASSETS{soloId ? ` · SOLO ${shortName(sceneAssets.find((asset) => asset.id === soloId)?.name ?? "", 10)}` : liveLayerIds.includes(layerId) ? " · LIVE" : ""}</small></span>
                        <button className="remove-button" aria-label={`Remove ${scene.name}`} onClick={() => removeScene(scene)}><Trash2 size={16} /></button>
                      </div>
                      <div className="scene-member-strip" aria-label={`${scene.name} members`}>
                        {sceneAssets.map((asset) => <button key={asset.id} className={soloId === asset.id ? "solo" : ""} title="Double-click to solo while live" onDoubleClick={() => toggleSceneSolo(scene, asset.id)}>{asset.kind === "image" ? <img src={asset.sourceUrl} alt="" /> : asset.kind === "video" ? <Video size={15} /> : <FileSpreadsheet size={15} />}</button>)}
                      </div>
                      <div className="scene-inline-controls">
                        <label><span>Scene gesture</span><div className="select-box full"><select data-testid={`scene-gesture-${scene.id}`} aria-label={`Gesture for ${scene.name}`} value={scene.gesture ?? ""} onChange={(event) => assignSceneGesture(scene.id, (event.target.value || undefined) as GestureId | undefined)}><option value="">Unassigned</option>{GESTURES.map((gesture) => { const owner = gestureOwner(gesture.id, assets, scenes, { kind: "scene", id: scene.id }); return <option key={gesture.id} value={gesture.id} disabled={Boolean(owner)}>{gesture.label}{owner ? ` — ${shortName(owner.name, 14)}` : ""}</option>; })}</select><ChevronDown size={15} /></div></label>
                        <label><span>Collage</span><div className="select-box full"><select aria-label={`Collage template for ${scene.name}`} value={scene.layout} onChange={(event) => commitSceneUpdates(scene.id, { layout: event.target.value as SceneLayout, memberTransforms: undefined, memberOrder: undefined })}>{SCENE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select><ChevronDown size={15} /></div></label>
                        <label><span>Size</span><div className="select-box full"><select data-testid={`scene-size-${scene.id}`} aria-label={`Size for ${scene.name}`} value={scene.size} onChange={(event) => commitSceneUpdates(scene.id, { size: event.target.value as AssetSize, transform: undefined })}>{ASSET_SIZES.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}</select><ChevronDown size={15} /></div></label>
                        <label><span>Entrance</span><div className="select-box full"><select aria-label={`Entrance animation for ${scene.name}`} value={scene.entranceAnimation ?? "fade"} onChange={(event) => commitSceneUpdates(scene.id, { entranceAnimation: event.target.value as EntranceAnimation })}>{ENTRANCE_ANIMATIONS.map((animation) => <option key={animation.id} value={animation.id}>{animation.label}</option>)}</select><ChevronDown size={15} /></div></label>
                        <label><span>Cue sound</span><div className="select-box full"><select aria-label={`Cue sound for ${scene.name}`} value={scene.cueSound ?? "none"} onChange={(event) => commitSceneUpdates(scene.id, { cueSound: event.target.value as CueSound })}>{CUE_SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</select><ChevronDown size={15} /></div></label>
                        <label className="stage-background-control">
                          <span>Stage behind scene</span>
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

          <div className="section-label asset-section-label"><span>Standalone media</span><b>{standaloneAssets.length}</b></div>
          <div className="asset-stack">
            {assets.length === 0 ? (
              <div className="empty-assets"><ImageIcon size={21} /><span>Imported assets will appear here.</span></div>
            ) : standaloneAssets.length === 0 ? (
              <p className="grouped-assets-note"><Layers3 size={15} /> All imported media is grouped inside scenes.</p>
            ) : standaloneAssets.map((asset) => (
              <article key={asset.id} className={`asset-item inline-asset ${liveLayerIds.includes(asset.id) ? "live" : ""} ${asset.id === activeLayerId ? "focused" : ""}`}>
                <div className="asset-identity-row">
                  <button className="asset-icon asset-preview-button" aria-label={`Activate ${asset.name}`} onClick={() => void activateLayerFromLibrary(resolveLayer(asset.id, assets, scenes) as StudioLayer)}>
                    {asset.kind === "image" ? <img src={asset.sourceUrl} alt="" /> : asset.kind === "video" ? <video src={asset.sourceUrl} muted playsInline preload="metadata" aria-hidden="true" /> : asset.kind === "csv" ? <FileSpreadsheet size={26} /> : <FileJson2 size={26} />}
                  </button>
                  <span className="asset-copy"><strong title={asset.name}>{shortName(asset.name, 28)}</strong><small>{asset.kind.toUpperCase()}{asset.id === activeLayerId ? " · FOCUSED" : liveLayerIds.includes(asset.id) ? " · LIVE" : ""}</small></span>
                  {(asset.kind === "image" || asset.kind === "video") && <button className="media-edit-button" aria-label={`${asset.kind === "video" ? "Trim" : "Crop"} ${asset.name}`} title={asset.kind === "video" ? "Trim video" : "Crop image"} onClick={() => openAssetEditor(asset)}>{asset.kind === "video" ? <Scissors size={16} /> : <Crop size={16} />}</button>}
                  <button className="remove-button" aria-label={`Remove ${asset.name}`} onClick={() => removeAsset(asset)}><Trash2 size={16} /></button>
                </div>

                <div className="asset-inline-controls">
                  <label>
                    <span>Gesture</span>
                    <div className="select-box full">
                      <select data-testid={`gesture-select-${asset.id}`} aria-label={`Gesture for ${asset.name}`} value={asset.gesture ?? ""} onChange={(event) => assignGesture(asset.id, (event.target.value || undefined) as GestureId | undefined)}>
                        <option value="">Unassigned</option>
                        {GESTURES.map((gesture) => {
                          const owner = gestureOwner(gesture.id, assets, scenes, { kind: "asset", id: asset.id });
                          return <option key={gesture.id} value={gesture.id} disabled={Boolean(owner)}>{gesture.label}{owner ? ` — ${shortName(owner.name, 14)}` : ""}</option>;
                        })}
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

                  <label>
                    <span>Entrance</span>
                    <div className="select-box full"><select aria-label={`Entrance animation for ${asset.name}`} value={asset.entranceAnimation ?? "fade"} onChange={(event) => updateAsset(asset.id, { entranceAnimation: event.target.value as EntranceAnimation })}>{ENTRANCE_ANIMATIONS.map((animation) => <option key={animation.id} value={animation.id}>{animation.label}</option>)}</select><ChevronDown size={16} /></div>
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
          </div>
          <details className="advanced library-advanced">
            <summary><Settings2 size={16} /> Advanced settings <ChevronDown size={15} /></summary>
            <label><span>Hold threshold <b>{timing.holdMs} ms</b></span><input aria-label="Hold threshold" type="range" min={MIN_GESTURE_HOLD_MS} max="900" step="50" value={timing.holdMs} onChange={(event) => setTiming((current) => ({ ...current, holdMs: Math.max(MIN_GESTURE_HOLD_MS, Number(event.target.value)) }))} /></label>
            <label><span>Cooldown <b>{timing.cooldownMs} ms</b></span><input type="range" min="450" max="1600" step="50" value={timing.cooldownMs} onChange={(event) => setTiming((current) => ({ ...current, cooldownMs: Number(event.target.value) }))} /></label>
            <label><span>Palm lock <b>{palmHoldMs} ms</b></span><input type="range" min="150" max="500" step="25" value={palmHoldMs} onChange={(event) => setPalmHoldMs(Number(event.target.value))} /></label>
            <label className="media-monitor-setting"><span>Monitor enabled video audio <b>{monitorMediaAudio ? "On" : "Off"}</b></span><input type="checkbox" checked={monitorMediaAudio} onChange={toggleMediaMonitoring} /></label>
          </details>
        </aside>

        <section className={`center-panel ${aspectId}`} aria-label="Live output stage">
          <header className="source-toolbar" aria-label="Studio sources and format">
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
            <label>
              <span><Gauge size={13} /> Quality</span>
              <div className="select-box">
                <select data-testid="quality-select" value={qualityId} disabled={isRecording || phase === "switching"} onChange={(event) => void handleQualityChange(event.target.value as QualityId)}>
                  {QUALITY_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select><ChevronDown size={14} />
              </div>
            </label>
            <label>
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

          <section className={`screen-share-bar ${screenPhase}`} aria-label="Screen capture source">
            <div className="screen-share-copy">
              <span className="screen-share-icon">{screenPhase === "permission" ? <LoaderCircle className="spin" size={18} /> : <ScreenShare size={18} />}</span>
              <span>
                <strong>{screenPhase === "ready" ? screenSettings?.label || screenSurfaceName : screenPhase === "permission" ? "Choose what to share" : "Live screen capture"}</strong>
                <small>{screenPhase === "ready" && screenSettings
                  ? `${screenSurfaceName} · ${screenSettings.width}×${screenSettings.height} · ${Math.round(screenSettings.frameRate)} fps · ${screenSettings.hasAudio ? "shared audio on" : "no shared audio"} · camera stays live`
                  : !screenCaptureSupported
                  ? "Use a current Chrome or Edge browser"
                  : studioReady
                  ? "Choose the content tab or game window — do not select Rii-Flow itself"
                  : "Start Studio, then share a tab, window, or display"}</small>
                {screenPhase === "ready" && <em>Repeating preview? Choose Change and share the content, not this studio.</em>}
              </span>
            </div>
            {screenPhase === "ready" && screenSettings && (
              <div className="screen-overlay-controls" aria-label="Screen overlay settings">
                <label><span>Placement</span><select aria-label="Screen overlay placement" disabled={isRecording} value={screenOverlay.placement} onChange={(event) => updateScreenOverlay({ placement: event.target.value as Placement, transform: undefined })}>{PLACEMENTS.map((placement) => <option key={placement.id} value={placement.id}>{placement.label}</option>)}</select></label>
                <label><span>Size</span><select aria-label="Screen overlay size" disabled={isRecording} value={screenOverlay.size} onChange={(event) => updateScreenOverlay({ size: event.target.value as AssetSize, transform: undefined })}>{ASSET_SIZES.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}</select></label>
                <button className={screenOverlay.visible ? "active" : ""} aria-label={screenOverlay.visible ? "Hide screen overlay" : "Show screen overlay"} aria-pressed={screenOverlay.visible} disabled={isRecording} onClick={() => updateScreenOverlay({ visible: !screenOverlay.visible })}>{screenOverlay.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                <button className={activeLayerId === SCREEN_OVERLAY_ID ? "active" : ""} aria-label="Adjust screen overlay on stage" aria-pressed={activeLayerId === SCREEN_OVERLAY_ID} disabled={isRecording || !screenOverlay.visible} onClick={selectScreenOverlay}><Move size={16} /><span>Adjust</span></button>
                <button aria-label="Reset screen overlay position" title="Reset screen overlay position" disabled={isRecording || !screenOverlay.transform} onClick={() => updateScreenOverlay({ transform: undefined })}><RotateCcw size={15} /></button>
              </div>
            )}
            <div className="screen-share-actions">
              <button className="screen-share-start" disabled={!studioReady || isRecording || screenPhase === "permission" || !screenCaptureSupported} onClick={() => void startScreenShare()}>{screenPhase === "ready" ? "Change" : "Share screen"}</button>
              {screenPhase === "ready" && <button className="screen-share-stop" aria-label="Stop screen sharing" title="Stop screen sharing" disabled={isRecording} onClick={() => endScreenShare()}><ScreenShareOff size={17} /></button>}
            </div>
          </section>

          <div className="stage-area">
          <div className={`stage-wrap ${aspectId}`} onClick={handleStageClick} onDoubleClick={handleStageDoubleClick}>
            <video ref={cameraVideoRef} className="camera-source" muted playsInline />
            <video ref={screenVideoRef} className="screen-source" muted playsInline />
            <canvas ref={outputCanvasRef} data-testid="output-canvas" width={outputSize.width} height={outputSize.height} />
            <canvas ref={inferenceCanvasRef} className="inference-canvas" width={640} height={360} aria-hidden="true" />
            {studioReady && cameraBorderSnap && manipulation.mode === "dragging" && (
              <div
                className={`camera-border-snap ${cameraBorderSnap}`}
                data-testid="camera-border-snap"
                aria-hidden="true"
                style={{
                  left: `${visibleCameraViewport.x / outputSize.width * 100}%`,
                  top: `${visibleCameraViewport.y / outputSize.height * 100}%`,
                  width: `${visibleCameraViewport.width / outputSize.width * 100}%`,
                  height: `${visibleCameraViewport.height / outputSize.height * 100}%`
                }}
              ><i /></div>
            )}
            {studioReady && activeSceneMemberGeometry && (
              <div
                className={`scene-member-lock ${manipulation.mode} ${sceneTemplateSnapped && manipulation.mode !== "idle" ? "template-snapped" : ""} ${selectedSceneMemberId && !sceneMemberTargetId ? "mouse-selected" : ""}`}
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
                className={`stage-layer-editor ${activeSceneMemberEditorGeometry ? "scene-member-editor" : ""} ${activeLayer.kind === "scene" && sceneTemplateSnapped && manipulation.mode !== "idle" ? "template-snapped" : ""}`}
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
            {!studioReady && (
              <div className={`stage-empty ${phase === "error" ? "error" : ""}`}>
                <span>{phase === "loading" ? <LoaderCircle className="spin" size={28} /> : phase === "error" ? <AlertTriangle size={28} /> : <Camera size={28} />}</span>
                <strong>{stageStateTitle}</strong>
                <small>{phaseMessage}</small>
              </div>
            )}
            {activeLayer && <div className="activation-notice" key={`${activeLayer.id}-${activatedAt}`}><Radio size={13} /> {shortName(layerName(activeLayer), 30)} activated</div>}
            {activeScene && activeSceneSoloId && <div className="scene-solo-badge" data-testid="scene-solo"><Eye size={13} /> SOLO · {shortName(assets.find((asset) => asset.id === activeSceneSoloId)?.name ?? "Asset", 20)}<small>Double-click to restore collage</small></div>}
            {activeLayer && manipulation.mode !== "idle" && (
              <div className={`manipulation-chip ${manipulation.mode} ${sceneTemplateSnapped ? "template-snapped" : ""}`} data-testid="manipulation-status">
                {manipulation.mode === "scaling" || manipulation.mode === "arming-scale" ? <Maximize2 size={17} /> : <Move size={17} />}
                <span>{manipulationHeadline}</span>
                {(manipulation.mode === "arming-drag" || manipulation.mode === "arming-scale") && <i><b style={{ width: `${manipulation.progress * 100}%` }} /></i>}
              </div>
            )}

          </div>
          </div>

          <footer className="studio-console" aria-label="Studio status and recording controls">
            <div className={`audio-console ${microphonePhase}`} title={activeMicrophoneLabel} aria-label={`Microphone level · ${activeMicrophoneLabel}`}>
              <span className="audio-icon"><Mic size={17} /></span>
              <i className="audio-level" data-testid="microphone-level"><b style={{ width: `${Math.max(2, Math.round(microphoneLevel * 100))}%` }} /></i>
              <strong className="visually-hidden" data-testid="active-microphone">{activeMicrophoneLabel}</strong>
            </div>

            <div className="transport-actions" aria-label="Recording controls">
              <button
                className={`primary-studio-action ${studioReady ? "record-ready" : "start-ready"}`}
                onClick={() => { if (studioReady) void startRecording(); else void startStudio(); }}
                disabled={isRecording || isFinalizing || captionBusy || (!studioReady && ["permission", "loading", "switching", "stopping"].includes(phase))}
              >
                {["permission", "loading", "stopping"].includes(phase) || isFinalizing ? <LoaderCircle className="spin" size={21} /> : studioReady ? <Circle size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
                <span>{isFinalizing ? "Saving" : isRecording ? "Recording" : phase === "stopping" ? "Stopping" : ["permission", "loading", "switching"].includes(phase) ? "Starting" : studioReady ? "Record" : "Start Studio"}</span>
              </button>
              <button
                className={`stop-button ${studioReady || ["permission", "loading", "switching", "stopping"].includes(phase) ? "studio-stop" : ""}`}
                onClick={() => { if (isRecording) stopRecording(); else stopStudio(); }}
                disabled={isFinalizing || (!isRecording && !studioReady && !["permission", "loading", "switching"].includes(phase))}
                aria-label={isRecording ? "Stop recording" : "Stop studio"}
              >
                <Square size={18} fill="currentColor" />
                <span>{isRecording ? "Stop" : "Stop Studio"}</span>
              </button>
            </div>

            <div className={`recording-clock ${isRecording ? "active" : recordingSeconds > 0 ? "complete" : "idle"}`} role="timer" aria-label={`Recording duration ${formatDuration(recordingSeconds)}`}>
              <small><i /> Recording duration</small>
              <strong data-testid="recording-duration">{formatDuration(recordingSeconds)}</strong>
            </div>
          </footer>

        </section>

        <aside className="signal-rail" aria-label="Gesture detection and takes">
          <section className={`gesture-signal ${detected.gesture || manipulation.mode !== "idle" ? "active" : ""}`} aria-live="polite">
            <span className="signal-icon"><Hand size={20} /></span>
            <small>Detected</small>
            <strong data-testid="detected-gesture">{manipulation.mode !== "idle" ? manipulationHeadline : gestureLabel(detected.gesture)}</strong>
            <em>{armed ? "Armed" : "Re-arm"}</em>
            <i className="signal-progress"><b style={{ width: `${(manipulation.mode.startsWith("arming") ? manipulation.progress : holdProgress) * 100}%` }} /></i>
          </section>

          <div className="visually-hidden" aria-hidden="true">
            <strong data-testid="actual-resolution">{granted ? `${granted.width}×${granted.height}` : `${outputSize.width}×${outputSize.height}`}</strong>
            <span data-testid="recording-bitrate">MP4 · {formatBitrate(actualBitrate)}</span>
            <strong data-testid="active-camera">{activeCameraLabel}</strong>
            <strong data-testid="canvas-resolution">{outputSize.width} × {outputSize.height}</strong>
          </div>

          <section className="takes-inline-panel" aria-label="Take library">
            <div className="takes-inline-heading"><span><ListVideo size={19} /><strong>Takes</strong></span><b data-testid="recording-count">{recordings.length}</b></div>

          <section className="recordings-panel durable-recordings">
            {recordings.length === 0 ? (
              <div className="empty-recordings"><Video size={22} /><span>Your finished takes will collect here.</span></div>
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
                      <button aria-label="Delete take" onClick={() => void removeTake(recording)}><Trash2 size={14} /></button>
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
                    {!captionSegments.length && !captionBusy && <button className="generate-captions" onClick={() => void generateEnglishCaptions()}><Sparkles size={17} /> Generate English captions</button>}
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
                        <div className="caption-segment-list" aria-label="Editable caption phrases">
                          {captionSegments.map((segment) => <label key={segment.id} className={captionPreviewSegment?.id === segment.id ? "active" : ""}><button type="button" aria-label={`Preview caption at ${segment.start.toFixed(1)} seconds`} onClick={() => previewCaptionSegment(segment)}>{segment.start.toFixed(1)}s</button><textarea value={segment.text} rows={2} onChange={(event) => updateCaptionSegment(segment.id, event.target.value)} /></label>)}
                        </div>
                      </>
                    )}
                  </>
                )}
                {captionStatus === "rendering" && <div className="caption-progress rendering"><LoaderCircle className="spin" size={20} /><span><strong>Rendering edited MP4</strong><small>{Math.round(captionRenderProgress * 100)}% · studio controls stay protected</small></span><i><b style={{ width: `${captionRenderProgress * 100}%` }} /></i></div>}
                {captionStatus === "done" && captionResultTake?.url && <div className="caption-ready"><Check size={18} /><span><strong>Edited take ready</strong><small>The untouched original is still available.</small></span><a href={captionResultTake.url} download={captionResultTake.fileName}><Download size={15} /> Download</a></div>}
              </div>
            </div>
            <footer><small>{hasFinalEdits ? "Trim and captions render after recording; the original master remains unchanged." : "Download the untouched master or add a trim and editable English captions."}</small>{hasFinalEdits && captionStatus !== "done" ? <button disabled={captionBusy} onClick={() => void renderEditedVersion()}>{captionStatus === "rendering" ? <LoaderCircle className="spin" size={16} /> : takeIsTrimmed && !captionsReady ? <Scissors size={16} /> : <Captions size={16} />} Render edited MP4</button> : captionStatus === "done" && captionResultTake?.url ? <a href={captionResultTake.url} download={captionResultTake.fileName}><Download size={15} /> Download edited</a> : <a href={finishTake.url} download={finishTake.fileName}><Download size={15} /> Download original</a>}</footer>
          </section>
        </div>
      )}

      {errorMessage && <div className="error-toast" role="alert"><AlertTriangle size={15} /><span>{errorMessage}</span><button onClick={() => setErrorMessage(null)}>Dismiss</button></div>}
    </main>
  );
}
