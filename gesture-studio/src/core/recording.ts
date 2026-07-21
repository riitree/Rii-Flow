export const MP4_MIME_TYPES = [
  "video/mp4;codecs=avc1.640034,mp4a.40.2",
  "video/mp4;codecs=avc1.4d0033,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/mp4"
] as const;

export const MASTER_AUDIO_BITRATE = 320_000;

export interface MasterRecorderOptions extends MediaRecorderOptions {
  videoKeyFrameIntervalDuration?: number;
}

/** Returns only a genuine MP4 recorder type; there is no mislabeled WebM fallback. */
export function recordingMimeType(isSupported = (type: string) => MediaRecorder.isTypeSupported(type)) {
  return MP4_MIME_TYPES.find((type) => isSupported(type)) ?? "";
}

export function masterRecorderOptions(mimeType: string, videoBitsPerSecond: number): MasterRecorderOptions {
  return {
    mimeType,
    videoBitsPerSecond,
    audioBitsPerSecond: MASTER_AUDIO_BITRATE,
    // A two-second GOP keeps seeking responsive while giving H.264 enough
    // temporal context for cleaner frames and lower encoder pressure.
    videoKeyFrameIntervalDuration: 2_000
  };
}

export function composedStream(canvas: HTMLCanvasElement, frameRate: number, audioStream: MediaStream | null) {
  const videoStream = canvas.captureStream(frameRate);
  return new MediaStream([
    ...videoStream.getVideoTracks(),
    ...(audioStream?.getAudioTracks() ?? [])
  ]);
}
