import { describe, expect, it, vi } from "vitest";
import { preferredCompositionDriver, replaceLatestFrame } from "./framePipeline";

describe("source-driven frame pipeline", () => {
  it("uses media-track frames when the browser exposes a processor", () => {
    class Processor {
      readable = new ReadableStream<VideoFrame>();
    }
    expect(preferredCompositionDriver({ MediaStreamTrackProcessor: Processor } as typeof globalThis & { MediaStreamTrackProcessor: typeof Processor })).toBe("media-track");
    expect(preferredCompositionDriver({} as typeof globalThis)).toBe("display");
  });

  it("closes superseded shared-screen frames", () => {
    const previous = { close: vi.fn() };
    const next = { close: vi.fn() };
    expect(replaceLatestFrame(previous, next)).toBe(next);
    expect(previous.close).toHaveBeenCalledOnce();
    expect(next.close).not.toHaveBeenCalled();
  });
});
