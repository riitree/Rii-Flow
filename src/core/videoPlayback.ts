import type { VideoPlaybackMode, VideoTrim } from "../types";

export type VideoBoundaryAction = "none" | "restart" | "complete";

export function normalizeVideoPlaybackMode(value: unknown): VideoPlaybackMode {
  return value === "once" ? "once" : "loop";
}

/** Keeps trim-boundary playback decisions deterministic in the composition loop. */
export function videoBoundaryAction(
  mode: VideoPlaybackMode,
  currentTime: number,
  trim: VideoTrim,
  ended: boolean
): VideoBoundaryAction {
  if (currentTime < trim.start - 0.04) return "restart";
  if (!ended && currentTime < trim.end - 0.025) return "none";
  return mode === "once" ? "complete" : "restart";
}
