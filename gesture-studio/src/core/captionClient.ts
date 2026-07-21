import type { CaptionAudio } from "./captionCapture";
import type { CaptionSegment } from "./captions";

interface CaptionWorkerMessage {
  type: "model-progress" | "status" | "result" | "error";
  id?: string;
  status?: string;
  progress?: { status?: string; progress?: number; file?: string };
  segments?: CaptionSegment[];
  message?: string;
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

export function transcribeEnglish(audio: CaptionAudio, onProgress?: (progress: CaptionProgress) => void) {
  const id = crypto.randomUUID();
  const samples = audio.samples.slice().buffer;
  const activeWorker = captionWorker();
  return new Promise<CaptionSegment[]>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      activeWorker.removeEventListener("message", listener);
      activeWorker.removeEventListener("error", workerError);
      activeWorker.removeEventListener("messageerror", messageError);
    };
    const finish = (result: { segments: CaptionSegment[] } | { error: Error }, reset = false) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (reset) resetCaptionWorker(activeWorker);
      if ("segments" in result) resolve(result.segments);
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
      if (message.type === "result") finish({ segments: message.segments ?? [] });
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
      activeWorker.postMessage({ id, samples }, [samples]);
    } catch (error) {
      finish({ error: error instanceof Error ? error : new Error("The local caption worker could not start.") }, true);
    }
  });
}
