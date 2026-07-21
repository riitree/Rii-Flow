import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import type { Landmark } from "./gesture";

export interface InferenceCategory {
  categoryName: string;
  score: number;
  index?: number;
  displayName?: string;
}

export interface GestureFrameResult {
  gestures: InferenceCategory[][];
  landmarks: Landmark[][];
  worldLandmarks: Landmark[][];
  handednesses: InferenceCategory[][];
  inferenceMs: number;
}

export interface GestureInferenceClient {
  readonly mode: "worker" | "main-thread";
  initialize(): Promise<void>;
  recognize(canvas: HTMLCanvasElement, timestamp: number): Promise<GestureFrameResult>;
  close(): void;
}

const OPTIONS = {
  runningMode: "VIDEO" as const,
  numHands: 2,
  minHandDetectionConfidence: 0.58,
  minHandPresenceConfidence: 0.58,
  minTrackingConfidence: 0.56,
  cannedGesturesClassifierOptions: { scoreThreshold: 0.34 }
};

const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

class MainThreadGestureClient implements GestureInferenceClient {
  readonly mode = "main-thread" as const;
  private recognizer: GestureRecognizer | null = null;

  async initialize() {
    const files = await FilesetResolver.forVisionTasks(publicAsset("mediapipe/wasm"));
    try {
      this.recognizer = await GestureRecognizer.createFromOptions(files, {
        ...OPTIONS,
        baseOptions: { modelAssetPath: publicAsset("models/gesture_recognizer.task"), delegate: "GPU" }
      });
    } catch {
      this.recognizer = await GestureRecognizer.createFromOptions(files, {
        ...OPTIONS,
        baseOptions: { modelAssetPath: publicAsset("models/gesture_recognizer.task") }
      });
    }
  }

  async recognize(canvas: HTMLCanvasElement, timestamp: number): Promise<GestureFrameResult> {
    if (!this.recognizer) throw new Error("Gesture recognizer is not initialized.");
    const started = performance.now();
    const result = this.recognizer.recognizeForVideo(canvas, timestamp);
    return {
      gestures: result.gestures,
      landmarks: result.landmarks as Landmark[][],
      worldLandmarks: result.worldLandmarks as Landmark[][],
      handednesses: result.handednesses,
      inferenceMs: performance.now() - started
    };
  }

  close() {
    this.recognizer?.close();
    this.recognizer = null;
  }
}

type WorkerResponse =
  | { type: "ready" }
  | { type: "result"; id: number; result: GestureFrameResult }
  | { type: "error"; id?: number; message: string };

class WorkerGestureClient implements GestureInferenceClient {
  readonly mode = "worker" as const;
  private worker: Worker | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (result: GestureFrameResult) => void; reject: (error: Error) => void }>();
  private ready: { resolve: () => void; reject: (error: Error) => void } | null = null;

  async initialize() {
    const worker = new Worker(new URL("../workers/gesture.worker.ts", import.meta.url), { type: "module", name: "gesture-recognizer" });
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "ready") {
        this.ready?.resolve();
        this.ready = null;
        return;
      }
      if (message.type === "result") {
        const request = this.pending.get(message.id);
        this.pending.delete(message.id);
        request?.resolve(message.result);
        return;
      }
      const error = new Error(message.message);
      if (message.id !== undefined) {
        const request = this.pending.get(message.id);
        this.pending.delete(message.id);
        request?.reject(error);
      } else {
        this.ready?.reject(error);
        this.ready = null;
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "The gesture worker stopped unexpectedly.");
      this.ready?.reject(error);
      this.ready = null;
      this.pending.forEach((request) => request.reject(error));
      this.pending.clear();
    };
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Gesture worker initialization timed out.")), 20000);
      this.ready = {
        resolve: () => { window.clearTimeout(timeout); resolve(); },
        reject: (error) => { window.clearTimeout(timeout); reject(error); }
      };
      worker.postMessage({
        type: "init",
        wasmRoot: publicAsset("mediapipe/wasm"),
        modelPath: publicAsset("models/gesture_recognizer.task")
      });
    });
  }

  async recognize(canvas: HTMLCanvasElement, timestamp: number) {
    if (!this.worker) throw new Error("Gesture worker is not initialized.");
    const id = ++this.requestId;
    const bitmap = await createImageBitmap(canvas);
    return new Promise<GestureFrameResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker?.postMessage({ type: "frame", id, timestamp, bitmap }, [bitmap]);
    });
  }

  close() {
    this.pending.forEach((request) => request.reject(new Error("Gesture recognizer closed.")));
    this.pending.clear();
    this.worker?.postMessage({ type: "close" });
    this.worker?.terminate();
    this.worker = null;
  }
}

/** Prefers isolated inference and safely falls back on browsers without worker canvas support. */
export async function createGestureInferenceClient(): Promise<GestureInferenceClient> {
  if (typeof Worker !== "undefined" && typeof createImageBitmap === "function") {
    const worker = new WorkerGestureClient();
    try {
      await worker.initialize();
      return worker;
    } catch (error) {
      worker.close();
      console.warn("Gesture worker unavailable; using main-thread recognition.", error);
    }
  }
  const fallback = new MainThreadGestureClient();
  await fallback.initialize();
  return fallback;
}
