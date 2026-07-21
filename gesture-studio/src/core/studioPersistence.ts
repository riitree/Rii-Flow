import type { CanvasAspectId } from "./aspect";
import { DEFAULT_CAMERA_FRAME, type CameraFrameSettings } from "./cameraFrame";
import type { QualityId } from "./quality";
import type { GestureSequenceMap, StudioAsset, StudioScene, TriggerHand } from "../types";
import type { CaptionSegment, CaptionStyle } from "./captions";
import type { VoiceEmphasisMarker, WordAnimationCue } from "./wordCues";
import type { MovementReachMode } from "./manipulation";
import type { StudioConcept } from "./concepts";
import type { DirectorTrackEvent } from "./directorTrack";
import type { CanvasWidget } from "./widgets";

const DATABASE_NAME = "gesture-studio-local";
const DATABASE_VERSION = 2;
const CURRENT_PROJECT_KEY = "current-project";
const RECORDINGS_DIRECTORY_KEY = "recordings-directory";

export interface TimingSettings {
  holdMs: number;
  cooldownMs: number;
}

export interface StudioProjectSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  assets: StudioAsset[];
  scenes: StudioScene[];
  widgets?: CanvasWidget[];
  concepts?: StudioConcept[];
  gestureSequences?: GestureSequenceMap;
  selectedCameraId: string;
  selectedMicrophoneId: string;
  qualityId: QualityId;
  aspectId: CanvasAspectId;
  mirrorCamera: boolean;
  cameraFrame?: CameraFrameSettings;
  monitorMediaAudio: boolean;
  timing: TimingSettings;
  palmHoldMs: number;
  movementReach?: MovementReachMode;
  triggerHand: TriggerHand;
  takeCounter: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type TakeRating = "neutral" | "favorite";

export interface StoredTake {
  id: string;
  projectId: string;
  projectName: string;
  fileName: string;
  bytes: number;
  durationSeconds: number;
  createdAt: number;
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
  mimeType: string;
  folderBacked: boolean;
  rating: TakeRating;
  captionAudioAvailable?: boolean;
  voiceEmphasis?: VoiceEmphasisMarker[];
  directorTrack?: DirectorTrackEvent[];
}

interface StoredSetting<T = unknown> {
  key: string;
  value: T;
}

interface StoredAssetBlob {
  key: string;
  projectId: string;
  assetId: string;
  blob: Blob;
}

interface StoredCaptionAudio {
  takeId: string;
  sampleRate: 16000;
  blob: Blob;
}

export interface StoredCaptionDocument {
  takeId: string;
  segments: CaptionSegment[];
  style: CaptionStyle;
  wordCues?: WordAnimationCue[];
  updatedAt: number;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local database request failed."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Local database transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local database transaction was cancelled."));
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not provide local project storage."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("projects")) database.createObjectStore("projects", { keyPath: "id" });
      if (!database.objectStoreNames.contains("asset-blobs")) {
        const store = database.createObjectStore("asset-blobs", { keyPath: "key" });
        store.createIndex("projectId", "projectId", { unique: false });
      }
      if (!database.objectStoreNames.contains("takes")) {
        const store = database.createObjectStore("takes", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!database.objectStoreNames.contains("settings")) database.createObjectStore("settings", { keyPath: "key" });
      if (!database.objectStoreNames.contains("caption-audio")) database.createObjectStore("caption-audio", { keyPath: "takeId" });
      if (!database.objectStoreNames.contains("caption-documents")) database.createObjectStore("caption-documents", { keyPath: "takeId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Rii-Flow could not open local storage."));
  });
  return databasePromise;
}

export function createBlankProject(name = "Untitled project"): StudioProjectSnapshot {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    assets: [],
    scenes: [],
    concepts: [],
    gestureSequences: {},
    selectedCameraId: "",
    selectedMicrophoneId: "none",
    qualityId: "720p30",
    aspectId: "landscape",
    mirrorCamera: false,
    cameraFrame: { ...DEFAULT_CAMERA_FRAME },
    monitorMediaAudio: false,
    timing: { holdMs: 75, cooldownMs: 550 },
    palmHoldMs: 220,
    movementReach: "comfort",
    triggerHand: "any",
    takeCounter: 1
  };
}

export async function saveProject(project: StudioProjectSnapshot) {
  const database = await openDatabase();
  const transaction = database.transaction("projects", "readwrite");
  transaction.objectStore("projects").put({
    ...project,
    assets: project.assets.map((asset) => ({ ...asset, sourceUrl: undefined })),
    updatedAt: Date.now()
  });
  await transactionDone(transaction);
}

export async function loadProject(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction("projects", "readonly");
  return requestResult(transaction.objectStore("projects").get(id)) as Promise<StudioProjectSnapshot | undefined>;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const database = await openDatabase();
  const transaction = database.transaction("projects", "readonly");
  const projects = await requestResult(transaction.objectStore("projects").getAll()) as StudioProjectSnapshot[];
  return projects
    .map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function setCurrentProjectId(id: string) {
  return putSetting(CURRENT_PROJECT_KEY, id);
}

export async function getCurrentProjectId() {
  return getSetting<string>(CURRENT_PROJECT_KEY);
}

export async function saveAssetBlob(projectId: string, assetId: string, blob: Blob) {
  const database = await openDatabase();
  const transaction = database.transaction("asset-blobs", "readwrite");
  const record: StoredAssetBlob = { key: `${projectId}:${assetId}`, projectId, assetId, blob };
  transaction.objectStore("asset-blobs").put(record);
  await transactionDone(transaction);
}

export async function loadAssetBlob(projectId: string, assetId: string) {
  const database = await openDatabase();
  const transaction = database.transaction("asset-blobs", "readonly");
  const record = await requestResult(transaction.objectStore("asset-blobs").get(`${projectId}:${assetId}`)) as StoredAssetBlob | undefined;
  return record?.blob;
}

export async function deleteAssetBlob(projectId: string, assetId: string) {
  const database = await openDatabase();
  const transaction = database.transaction("asset-blobs", "readwrite");
  transaction.objectStore("asset-blobs").delete(`${projectId}:${assetId}`);
  await transactionDone(transaction);
}

export async function saveTake(take: StoredTake) {
  const database = await openDatabase();
  const transaction = database.transaction("takes", "readwrite");
  const stored: StoredTake = {
    id: take.id,
    projectId: take.projectId,
    projectName: take.projectName,
    fileName: take.fileName,
    bytes: take.bytes,
    durationSeconds: take.durationSeconds,
    createdAt: take.createdAt,
    width: take.width,
    height: take.height,
    frameRate: take.frameRate,
    bitrate: take.bitrate,
    mimeType: take.mimeType,
    folderBacked: take.folderBacked,
    rating: take.rating,
    captionAudioAvailable: Boolean(take.captionAudioAvailable),
    voiceEmphasis: take.voiceEmphasis?.slice(0, 120),
    directorTrack: take.directorTrack?.slice(0, 500)
  };
  transaction.objectStore("takes").put(stored);
  await transactionDone(transaction);
}

export async function listTakes(): Promise<StoredTake[]> {
  const database = await openDatabase();
  const transaction = database.transaction("takes", "readonly");
  const takes = await requestResult(transaction.objectStore("takes").getAll()) as StoredTake[];
  return takes.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteTake(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction(["takes", "caption-audio", "caption-documents"], "readwrite");
  transaction.objectStore("takes").delete(id);
  transaction.objectStore("caption-audio").delete(id);
  transaction.objectStore("caption-documents").delete(id);
  await transactionDone(transaction);
}

export async function saveCaptionAudio(takeId: string, samples: Int16Array) {
  const database = await openDatabase();
  const transaction = database.transaction("caption-audio", "readwrite");
  const copy = samples.slice();
  const record: StoredCaptionAudio = { takeId, sampleRate: 16000, blob: new Blob([copy.buffer], { type: "application/octet-stream" }) };
  transaction.objectStore("caption-audio").put(record);
  await transactionDone(transaction);
}

export async function loadCaptionAudio(takeId: string) {
  const database = await openDatabase();
  const transaction = database.transaction("caption-audio", "readonly");
  const record = await requestResult(transaction.objectStore("caption-audio").get(takeId)) as StoredCaptionAudio | undefined;
  if (!record) return null;
  return { sampleRate: record.sampleRate, samples: new Int16Array(await record.blob.arrayBuffer()) } as const;
}

export async function saveCaptionDocument(document: StoredCaptionDocument) {
  const database = await openDatabase();
  const transaction = database.transaction("caption-documents", "readwrite");
  transaction.objectStore("caption-documents").put(document);
  await transactionDone(transaction);
}

export async function loadCaptionDocument(takeId: string) {
  const database = await openDatabase();
  const transaction = database.transaction("caption-documents", "readonly");
  return requestResult(transaction.objectStore("caption-documents").get(takeId)) as Promise<StoredCaptionDocument | undefined>;
}

async function putSetting<T>(key: string, value: T) {
  const database = await openDatabase();
  const transaction = database.transaction("settings", "readwrite");
  const record: StoredSetting<T> = { key, value };
  transaction.objectStore("settings").put(record);
  await transactionDone(transaction);
}

async function getSetting<T>(key: string) {
  const database = await openDatabase();
  const transaction = database.transaction("settings", "readonly");
  const setting = await requestResult(transaction.objectStore("settings").get(key)) as StoredSetting<T> | undefined;
  return setting?.value;
}

export async function saveRecordingsDirectory(handle: FileSystemDirectoryHandle) {
  return putSetting(RECORDINGS_DIRECTORY_KEY, handle);
}

export async function loadRecordingsDirectory() {
  return getSetting<FileSystemDirectoryHandle>(RECORDINGS_DIRECTORY_KEY);
}

export function safeFileBase(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return (cleaned || "Rii-Flow Take").slice(0, 110);
}

export function takeFileName(value: string) {
  return `${safeFileBase(value)}.mp4`;
}

export function defaultTakeName(projectName: string, takeCounter: number) {
  return `${safeFileBase(projectName)} — Take ${String(Math.max(1, takeCounter)).padStart(2, "0")}`;
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
