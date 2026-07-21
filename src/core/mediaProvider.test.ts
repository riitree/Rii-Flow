import { describe, expect, it, vi } from "vitest";
import { stopMediaStream } from "./mediaProvider";

describe("camera stream cleanup", () => {
  it("stops every old track during a camera switch", () => {
    const stopVideo = vi.fn();
    const stopAudio = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopVideo }, { stop: stopAudio }]
    } as unknown as MediaStream;
    expect(stopMediaStream(stream)).toBe(2);
    expect(stopVideo).toHaveBeenCalledOnce();
    expect(stopAudio).toHaveBeenCalledOnce();
  });
});
