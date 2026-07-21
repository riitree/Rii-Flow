import type { StudioAudioMixer } from "./audio";

export interface CaptionAudio {
  sampleRate: 16000;
  samples: Int16Array;
}

export interface CaptionCaptureSession {
  stop: () => Promise<CaptionAudio>;
}

const loadedContexts = new WeakSet<AudioContext>();

export async function ensureCaptionCaptureWorklet(context: AudioContext) {
  if (loadedContexts.has(context)) return;
  await context.audioWorklet.addModule("/audio/caption-capture.worklet.js");
  loadedContexts.add(context);
}

export async function startCaptionCapture(mixer: StudioAudioMixer | null): Promise<CaptionCaptureSession | null> {
  if (!mixer?.microphoneSource) return null;
  await ensureCaptionCaptureWorklet(mixer.context);
  const node = new AudioWorkletNode(mixer.context, "rii-flow-caption-capture");
  const silent = mixer.context.createGain();
  silent.gain.value = 0;
  const chunks: Int16Array[] = [];
  let stopped = false;
  let resolveStopped: (() => void) | null = null;
  node.port.onmessage = (event) => {
    if (event.data?.type === "chunk" && event.data.samples instanceof ArrayBuffer) chunks.push(new Int16Array(event.data.samples));
    if (event.data?.type === "stopped") resolveStopped?.();
  };
  mixer.microphoneSource.connect(node);
  node.connect(silent);
  silent.connect(mixer.context.destination);

  return {
    stop: async () => {
      if (!stopped) {
        stopped = true;
        await new Promise<void>((resolve) => {
          resolveStopped = resolve;
          node.port.postMessage({ type: "stop" });
          window.setTimeout(resolve, 500);
        });
      }
      mixer.microphoneSource?.disconnect(node);
      node.disconnect();
      silent.disconnect();
      const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
      const samples = new Int16Array(length);
      let offset = 0;
      chunks.forEach((chunk) => {
        samples.set(chunk, offset);
        offset += chunk.length;
      });
      return { sampleRate: 16000, samples };
    }
  };
}
