import { activeCaptionAt, drawCaption, type CaptionSegment, type CaptionStyle } from "./captions";
import { normalizedCompositionFps, shouldComposeFrame } from "./performance";
import { composedStream, masterRecorderOptions, recordingMimeType } from "./recording";

type CaptureVideo = HTMLVideoElement & { captureStream?: () => MediaStream };

export function captionedFileName(fileName: string) {
  return `${fileName.replace(/\.mp4$/i, "")}-captioned.mp4`;
}

export function editedFileName(fileName: string, edits: { captions: boolean; trimmed: boolean }) {
  const suffix = edits.captions && edits.trimmed ? "edited" : edits.captions ? "captioned" : "trimmed";
  return `${fileName.replace(/\.mp4$/i, "")}-${suffix}.mp4`;
}

export function normalizeRenderRange(duration: number, startTime?: number, endTime?: number) {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const start = Math.min(Math.max(0, Number.isFinite(startTime) ? startTime! : 0), Math.max(0, safeDuration - 0.05));
  const end = Math.min(safeDuration, Math.max(start + 0.05, Number.isFinite(endTime) ? endTime! : safeDuration));
  return { start, end, duration: Math.max(0.05, end - start) };
}

function waitForMetadata(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("The original take could not be opened for caption rendering.")), { once: true });
  });
}

function seekVideo(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.01) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", ready);
      video.removeEventListener("error", failed);
    };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("The original take could not seek to the trim start.")); };
    video.addEventListener("seeked", ready, { once: true });
    video.addEventListener("error", failed, { once: true });
    video.currentTime = time;
  });
}

export async function renderCaptionedTake(options: {
  sourceUrl: string;
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
  segments?: CaptionSegment[];
  style?: CaptionStyle;
  startTime?: number;
  endTime?: number;
  onProgress?: (progress: number) => void;
}) {
  const mimeType = recordingMimeType();
  if (!mimeType) throw new Error("This browser cannot render a captioned MP4.");
  const video = document.createElement("video") as CaptureVideo;
  video.src = options.sourceUrl;
  video.preload = "auto";
  video.playsInline = true;
  video.muted = true;
  await waitForMetadata(video);
  if (!video.captureStream) throw new Error("This browser cannot preserve take audio while rendering captions.");
  const range = normalizeRenderRange(video.duration, options.startTime, options.endTime);
  await seekVideo(video, range.start);

  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("The caption rendering canvas could not start.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const sourceStream = video.captureStream();
  const audioOnly = new MediaStream(sourceStream.getAudioTracks());
  const output = composedStream(canvas, Math.max(1, Math.round(options.frameRate)), audioOnly);
  const recorder = new MediaRecorder(output, masterRecorderOptions(mimeType, options.bitrate));
  const chunks: Blob[] = [];
  let animationId = 0;
  let settled = false;
  let stopping = false;
  let lastComposedAt = Number.NEGATIVE_INFINITY;
  const targetFps = normalizedCompositionFps(options.frameRate);

  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => {
      cancelAnimationFrame(animationId);
      output.getTracks().forEach((track) => track.stop());
      sourceStream.getTracks().forEach((track) => track.stop());
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const stopAtEditEnd = () => {
      if (stopping || recorder.state !== "recording") return;
      stopping = true;
      video.pause();
      options.onProgress?.(1);
      recorder.requestData();
      window.setTimeout(() => recorder.state === "recording" && recorder.stop(), 50);
    };
    const draw = (now: number) => {
      if (shouldComposeFrame(now, lastComposedAt, targetFps)) {
        lastComposedAt = now;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (options.segments?.length && options.style) {
          drawCaption(context, canvas.width, canvas.height, activeCaptionAt(options.segments, video.currentTime), options.style);
        }
        options.onProgress?.(Math.min(1, Math.max(0, (video.currentTime - range.start) / range.duration)));
      }
      if (video.ended || video.currentTime >= range.end - 1 / Math.max(1, options.frameRate)) stopAtEditEnd();
      else animationId = requestAnimationFrame(draw);
    };
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => fail(new Error("The browser encoder could not render the captioned MP4."));
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      cleanup();
      if (!blob.size) reject(new Error("The captioned MP4 was empty."));
      else resolve(blob);
    };
    video.addEventListener("ended", stopAtEditEnd, { once: true });
    recorder.start(1000);
    void video.play().then(() => draw(performance.now())).catch((error) => fail(error instanceof Error ? error : new Error("Caption rendering could not begin.")));
  });
}
