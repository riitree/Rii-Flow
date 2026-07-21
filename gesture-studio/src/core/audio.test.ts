import { describe, expect, it, vi } from "vitest";
import { connectScreenAudio, cueSoundNotes, mixedAudioStream, readMicrophoneLevel, setMediaMonitoring, setVideoAudioEnabled, type StudioAudioMixer } from "./audio";

function fakeMixer() {
  const route = {
    source: { disconnect: vi.fn() },
    recordingGain: { gain: { value: 0 } },
    monitorGain: { gain: { value: 0 } },
    enabled: false
  };
  const destinationStream = { id: "mixed" } as unknown as MediaStream;
  const mixer = {
    destination: { stream: destinationStream },
    microphoneSource: {} as MediaStreamAudioSourceNode,
    microphoneAnalyser: {
      fftSize: 4,
      getByteTimeDomainData: (samples: Uint8Array) => samples.set([128, 160, 128, 96])
    },
    videoRoutes: new Map([["clip", route]]),
    monitorMedia: false
  } as unknown as StudioAudioMixer;
  return { mixer, route, destinationStream };
}

describe("studio audio mixing", () => {
  it("keeps video audio muted until the clip is explicitly enabled", () => {
    const { mixer, route } = fakeMixer();
    setVideoAudioEnabled(mixer, "clip", true);
    expect(route.recordingGain.gain.value).toBe(1);
    expect(route.monitorGain.gain.value).toBe(0);
    setMediaMonitoring(mixer, true);
    expect(route.monitorGain.gain.value).toBe(1);
  });

  it("uses the stable mixed track and exposes microphone activity", () => {
    const { mixer, destinationStream } = fakeMixer();
    expect(mixedAudioStream(mixer, null)).toBe(destinationStream);
    expect(readMicrophoneLevel(mixer)).toBeGreaterThan(0);
  });

  it("uses tiny generated note recipes instead of loading external sound files", () => {
    expect(cueSoundNotes("none")).toEqual([]);
    expect(cueSoundNotes("soft")).toHaveLength(1);
    expect(cueSoundNotes("chime")).toHaveLength(3);
    expect(cueSoundNotes("bottle")).toEqual([380, 980, 1500]);
    expect(cueSoundNotes("enter")).toEqual([2600]);
  });

  it("adds shared-screen audio only to the recording mix", () => {
    const connect = vi.fn();
    const disconnect = vi.fn();
    const source = { connect, disconnect };
    const destination = {} as MediaStreamAudioDestinationNode;
    const mixer = {
      context: { createMediaStreamSource: vi.fn(() => source) },
      destination,
      screenSource: null
    } as unknown as StudioAudioMixer;
    const screen = { getAudioTracks: () => [{ id: "screen-audio" }] } as unknown as MediaStream;
    expect(connectScreenAudio(mixer, screen)).toBe(true);
    expect(connect).toHaveBeenCalledWith(destination);
    expect(connectScreenAudio(mixer, null)).toBe(false);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
