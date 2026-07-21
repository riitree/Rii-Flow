/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";
import { captionSegmentsFromText, groupCaptionWords, type CaptionWord } from "../core/captions";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";
const wasmBackend = env.backends.onnx.wasm;
if (wasmBackend) {
  wasmBackend.wasmPaths = {
    mjs: "/ort/ort-wasm-simd-threaded.asyncify.mjs",
    wasm: "/ort/ort-wasm-simd-threaded.asyncify.wasm"
  };
  wasmBackend.numThreads = 1;
}

interface CaptionRequest {
  id: string;
  samples: ArrayBuffer;
}

let transcriberPromise: ReturnType<typeof pipeline<"automatic-speech-recognition">> | null = null;

function getTranscriber() {
  transcriberPromise ??= pipeline("automatic-speech-recognition", "whisper-tiny.en", {
    device: "wasm",
    dtype: "q4",
    progress_callback: (progress) => self.postMessage({ type: "model-progress", progress })
  });
  return transcriberPromise;
}

self.onmessage = async (event: MessageEvent<CaptionRequest>) => {
  const { id, samples } = event.data;
  try {
    const pcm = new Int16Array(samples);
    const audio = new Float32Array(pcm.length);
    let peak = 0;
    for (let index = 0; index < pcm.length; index += 1) peak = Math.max(peak, Math.abs(pcm[index]));
    if (peak < 96) throw new Error("No audible microphone speech was found in this take.");
    const gain = Math.min(3.5, 29490 / peak);
    for (let index = 0; index < pcm.length; index += 1) audio[index] = Math.max(-1, Math.min(1, pcm[index] / 32768 * gain));
    self.postMessage({ type: "status", id, status: "transcribing" });
    const transcriber = await getTranscriber();
    const output = await transcriber(audio, {
      return_timestamps: true,
      chunk_length_s: 20,
      stride_length_s: 3
    });
    const single = Array.isArray(output) ? output[0] : output;
    const words: CaptionWord[] = (single.chunks ?? []).flatMap((chunk: { text: string; timestamp: number[] }) => {
      const timestamp = chunk.timestamp;
      const start = Array.isArray(timestamp) ? Number(timestamp[0] ?? 0) : 0;
      const end = Array.isArray(timestamp) ? Number(timestamp[1] ?? start + 0.3) : start + 0.3;
      return [{ text: chunk.text, start, end }];
    });
    const timed = groupCaptionWords(words);
    const segments = timed.length ? timed : captionSegmentsFromText(single.text ?? "", audio.length / 16000);
    if (!segments.length) throw new Error("No clear English speech was found. Check the selected microphone and try another take.");
    self.postMessage({ type: "result", id, text: single.text, segments });
  } catch (error) {
    transcriberPromise = null;
    self.postMessage({ type: "error", id, message: error instanceof Error ? error.message : "English transcription failed." });
  }
};
