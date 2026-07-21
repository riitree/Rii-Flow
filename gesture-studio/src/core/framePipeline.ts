export type CompositionDriver = "media-track" | "display";

export interface VideoFrameProcessor {
  readable: ReadableStream<VideoFrame>;
}

export type VideoFrameProcessorConstructor = new (options: {
  track: MediaStreamTrack;
  maxBufferSize?: number;
}) => VideoFrameProcessor;

type FramePipelineScope = typeof globalThis & {
  MediaStreamTrackProcessor?: VideoFrameProcessorConstructor;
};

export function videoFrameProcessor(scope: FramePipelineScope = globalThis as FramePipelineScope) {
  return typeof scope.MediaStreamTrackProcessor === "function" ? scope.MediaStreamTrackProcessor : null;
}

export function preferredCompositionDriver(scope: FramePipelineScope = globalThis as FramePipelineScope): CompositionDriver {
  return videoFrameProcessor(scope) ? "media-track" : "display";
}

export function replaceLatestFrame<T extends { close(): void }>(current: T | null, next: T) {
  current?.close();
  return next;
}
