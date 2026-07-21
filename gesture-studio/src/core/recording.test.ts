import { afterEach, describe, expect, it, vi } from "vitest";
import { composedStream, masterRecorderOptions, recordingMimeType } from "./recording";

const originalMediaStream = globalThis.MediaStream;

afterEach(() => { globalThis.MediaStream = originalMediaStream; });

describe("composed recording", () => {
  it("selects a genuine MP4/H.264 recorder without a WebM fallback", () => {
    const supported = new Set(["video/mp4;codecs=avc1,mp4a.40.2"]);
    expect(recordingMimeType((type) => supported.has(type))).toBe("video/mp4;codecs=avc1,mp4a.40.2");
    expect(recordingMimeType(() => false)).toBe("");
  });

  it("uses master-quality audio and editor-friendly keyframes", () => {
    expect(masterRecorderOptions("video/mp4", 80_000_000)).toMatchObject({
      mimeType: "video/mp4",
      videoBitsPerSecond: 80_000_000,
      audioBitsPerSecond: 320_000,
      videoKeyFrameIntervalDuration: 1_000
    });
  });

  it("records the full canvas video track with available microphone audio", () => {
    const canvasTrack = { kind: "video", id: "canvas" } as MediaStreamTrack;
    const audioTrack = { kind: "audio", id: "microphone" } as MediaStreamTrack;
    const constructed: MediaStreamTrack[][] = [];
    class FakeMediaStream {
      constructor(tracks: MediaStreamTrack[]) { constructed.push(tracks); }
    }
    globalThis.MediaStream = FakeMediaStream as unknown as typeof MediaStream;
    const canvas = {
      captureStream: vi.fn(() => ({ getVideoTracks: () => [canvasTrack] }))
    } as unknown as HTMLCanvasElement;
    const audio = { getAudioTracks: () => [audioTrack] } as unknown as MediaStream;

    composedStream(canvas, 60, audio);

    expect(canvas.captureStream).toHaveBeenCalledWith(60);
    expect(constructed[0]).toEqual([canvasTrack, audioTrack]);
  });
});
