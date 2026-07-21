import { describe, expect, it, vi } from "vitest";
import { AUDIO_MIX_LEVELS, connectScreenAudio, cueSoundDuration, cueSoundNotes, mixedAudioStream, readMicrophoneLevel, setMediaMonitoring, setVideoAudioEnabled, type StudioAudioMixer } from "./audio";

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
    cueMonitorGain: { gain: { value: 0 } },
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
    expect(mixer.cueMonitorGain.gain.value).toBe(0);
    mixer.microphoneSource = null;
    setMediaMonitoring(mixer, true);
    expect(mixer.cueMonitorGain.gain.value).toBe(AUDIO_MIX_LEVELS.cueMonitor);
    setMediaMonitoring(mixer, false);
    expect(mixer.cueMonitorGain.gain.value).toBe(0);
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
    expect(cueSoundNotes("whoosh")).toEqual([]);
    expect(cueSoundDuration("whoosh")).toBeCloseTo(0.36);
    expect(cueSoundDuration("shutter")).toBeCloseTo(0.13);
    expect(cueSoundDuration("film")).toBeCloseTo(0.58);
  });

  it("keeps recorded cues behind speech with master headroom", () => {
    expect(AUDIO_MIX_LEVELS.recordingHeadroom).toBeLessThan(1);
    expect(AUDIO_MIX_LEVELS.cueRecording).toBeLessThan(AUDIO_MIX_LEVELS.recordingHeadroom / 2);
  });

  it("adds shared-screen audio only to the recording mix", () => {
    const connect = vi.fn();
    const disconnect = vi.fn();
    const source = { connect, disconnect };
    const destination = {} as MediaStreamAudioDestinationNode;
    const recordingBus = {} as GainNode;
    const mixer = {
      context: { createMediaStreamSource: vi.fn(() => source) },
      destination,
      recordingBus,
      screenSource: null
    } as unknown as StudioAudioMixer;
    const screen = { getAudioTracks: () => [{ id: "screen-audio" }] } as unknown as MediaStream;
    expect(connectScreenAudio(mixer, screen)).toBe(true);
    expect(connect).toHaveBeenCalledWith(recordingBus);
    expect(connectScreenAudio(mixer, null)).toBe(false);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
