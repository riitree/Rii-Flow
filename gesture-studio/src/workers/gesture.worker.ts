/// <reference lib="webworker" />

import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import type { GestureFrameResult, InferenceCategory } from "../core/gestureInference";
import type { Landmark } from "../core/gesture";

declare const self: DedicatedWorkerGlobalScope;

let recognizer: GestureRecognizer | null = null;

function serializeCategories(items: readonly (readonly { categoryName: string; score: number; index?: number; displayName?: string }[])[]): InferenceCategory[][] {
  return items.map((categories) => categories.map((category) => ({
    categoryName: category.categoryName,
    score: category.score,
    index: category.index,
    displayName: category.displayName
  })));
}

function serializeLandmarks(items: readonly (readonly Landmark[])[]): Landmark[][] {
  return items.map((landmarks) => landmarks.map(({ x, y, z }) => ({ x, y, z })));
}

self.onmessage = async (event: MessageEvent<
  | { type: "init"; wasmRoot: string; modelPath: string }
  | { type: "frame"; id: number; timestamp: number; bitmap: ImageBitmap }
  | { type: "close" }
>) => {
  const message = event.data;
  if (message.type === "close") {
    recognizer?.close();
    recognizer = null;
    self.close();
    return;
  }
  if (message.type === "init") {
    try {
      // Module workers cannot use importScripts(). MediaPipe's module loader is
      // purpose-built for this context and exposes ModuleFactory on globalThis.
      const files = await FilesetResolver.forVisionTasks(message.wasmRoot, true);
      const options = {
        runningMode: "VIDEO" as const,
        numHands: 2,
        minHandDetectionConfidence: 0.58,
        minHandPresenceConfidence: 0.58,
        minTrackingConfidence: 0.56,
        cannedGesturesClassifierOptions: { scoreThreshold: 0.34 }
      };
      try {
        recognizer = await GestureRecognizer.createFromOptions(files, {
          ...options,
          baseOptions: { modelAssetPath: message.modelPath, delegate: "GPU" as const }
        });
      } catch {
        recognizer = await GestureRecognizer.createFromOptions(files, {
          ...options,
          baseOptions: { modelAssetPath: message.modelPath }
        });
      }
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({ type: "error", message: error instanceof Error ? error.message : "MediaPipe could not initialize in the gesture worker." });
    }
    return;
  }
  if (message.type === "frame") {
    if (!recognizer) {
      message.bitmap.close();
      self.postMessage({ type: "error", id: message.id, message: "Gesture recognizer is not initialized." });
      return;
    }
    try {
      const started = performance.now();
      const result = recognizer.recognizeForVideo(message.bitmap, message.timestamp);
      const response: GestureFrameResult = {
        gestures: serializeCategories(result.gestures),
        landmarks: serializeLandmarks(result.landmarks),
        worldLandmarks: serializeLandmarks(result.worldLandmarks),
        handednesses: serializeCategories(result.handednesses),
        inferenceMs: performance.now() - started
      };
      self.postMessage({ type: "result", id: message.id, result: response });
    } catch (error) {
      self.postMessage({ type: "error", id: message.id, message: error instanceof Error ? error.message : "Gesture inference failed." });
    } finally {
      message.bitmap.close();
    }
  }
};

export {};
