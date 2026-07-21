import type { CaptionAudio } from "./captionCapture";
import type { CaptionSegment } from "./captions";

interface CaptionWorkerMessage {
  type: "model-progress" | "status" | "ready" | "result" | "error";
  id?: string;
  status?: string;
  progress?: { status?: string; progress?: number; file?: string };
  segments?: CaptionSegment[];
  text?: string;
  message?: string;
}

export function warmEnglishTranscriber(onProgress?: (progress: CaptionProgress) => void) {
  const id = crypto.randomUUID();
  const activeWorker = captionWorker();
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      activeWorker.removeEventListener("message", listener);
      activeWorker.removeEventListener("error", workerError);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const listener = (event: MessageEvent<CaptionWorkerMessage>) => {
      const message = event.data;
      if (message.type === "model-progress") {
        onProgress?.({ phase: "loading", percent: typeof message.progress?.progress === "number" ? message.progress.progress : 0 });
        return;
      }
      if (message.id !== id) return;
      if (message.type === "ready") finish();
      if (message.type === "error") finish(new Error(message.message ?? "The local English model could not start."));
    };
    const workerError = (event: ErrorEvent) => finish(new Error(event.message || "The local English model could not start."));
    const timeout = window.setTimeout(() => finish(new Error("The local English model took too long to load.")), 2 * 60 * 1000);
    activeWorker.addEventListener("message", listener);
    activeWorker.addEventListener("error", workerError);
    activeWorker.postMessage({ type: "warmup", id });
  });
}

export interface CaptionProgress {
  phase: "loading" | "transcribing";
  percent: number;
}

let worker: Worker | null = null;
const CAPTION_TIMEOUT_MS = 5 * 60 * 1000;

function captionWorker() {
  worker ??= new Worker(new URL("../workers/caption.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

function resetCaptionWorker(target: Worker) {
  if (worker !== target) return;
  target.terminate();
  worker = null;
}

function requestEnglishTranscription(
  audio: CaptionAudio,
  type: "transcribe" | "trigger",
  onProgress?: (progress: CaptionProgress) => void
) {
  const id = crypto.randomUUID();
  const samples = audio.samples.slice().buffer;
  const activeWorker = captionWorker();
  return new Promise<{ segments: CaptionSegment[]; text: string }>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      activeWorker.removeEventListener("message", listener);
      activeWorker.removeEventListener("error", workerError);
      activeWorker.removeEventListener("messageerror", messageError);
    };
    const finish = (result: { segments: CaptionSegment[]; text: string } | { error: Error }, reset = false) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (reset) resetCaptionWorker(activeWorker);
      if ("segments" in result) resolve(result);
      else reject(result.error);
    };
    const listener = (event: MessageEvent<CaptionWorkerMessage>) => {
      const message = event.data;
      if (message.type === "model-progress") {
        const percent = typeof message.progress?.progress === "number" ? message.progress.progress : 0;
        onProgress?.({ phase: "loading", percent });
        return;
      }
      if (message.id !== id) return;
      if (message.type === "status") {
        onProgress?.({ phase: "transcribing", percent: 0 });
        return;
      }
      if (message.type === "result") finish({ segments: message.segments ?? [], text: message.text ?? "" });
      else finish({ error: new Error(message.message ?? "English transcription failed.") }, true);
    };
    const workerError = (event: ErrorEvent) => {
      event.preventDefault();
      finish({ error: new Error(event.message || "The local caption worker could not start.") }, true);
    };
    const messageError = () => finish({ error: new Error("The local caption worker could not read the recorded microphone audio.") }, true);
    const timeout = window.setTimeout(() => finish({ error: new Error("Caption generation took too long. Please retry this take.") }, true), CAPTION_TIMEOUT_MS);
    activeWorker.addEventListener("message", listener);
    activeWorker.addEventListener("error", workerError);
    activeWorker.addEventListener("messageerror", messageError);
    try {
      activeWorker.postMessage({ id, type, samples }, [samples]);
    } catch (error) {
      finish({ error: error instanceof Error ? error : new Error("The local caption worker could not start.") }, true);
    }
  });
}

export function transcribeEnglish(audio: CaptionAudio, onProgress?: (progress: CaptionProgress) => void) {
  return requestEnglishTranscription(audio, "transcribe", onProgress).then((result) => result.segments);
}

/** Fast, timestamp-free path for short live cue phrases. */
export function transcribeTriggerEnglish(audio: CaptionAudio) {
  return requestEnglishTranscription(audio, "trigger").then((result) => result.text.trim());
}
