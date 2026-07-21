import type { CameraOption, GrantedVideoSettings, MicrophoneOption } from "../types";
import { videoConstraints, type QualityPreset } from "./quality";

export interface CameraFeed {
  stream: MediaStream;
  settings: GrantedVideoSettings;
  label: string;
}

export interface MicrophoneFeed {
  stream: MediaStream;
  label: string;
}

export interface MediaProvider {
  enumerateCameras(): Promise<CameraOption[]>;
  enumerateMicrophones(): Promise<MicrophoneOption[]>;
  openCamera(deviceId: string, preset: QualityPreset): Promise<CameraFeed>;
  openMicrophone(deviceId: string): Promise<MicrophoneFeed>;
  watchDevices(callback: () => void): () => void;
  diagnostics?: { starts: number; stoppedTracks: number };
}

function normalizedSettings(track: MediaStreamTrack, deviceId: string, preset: QualityPreset): GrantedVideoSettings {
  const settings = track.getSettings();
  return {
    width: settings.width ?? preset.width,
    height: settings.height ?? preset.height,
    frameRate: settings.frameRate ?? preset.fps,
    deviceId: settings.deviceId || deviceId
  };
}

export function createBrowserMediaProvider(): MediaProvider {
  return {
    async enumerateCameras() {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`
        }));
    },
    async enumerateMicrophones() {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId || "default",
          label: device.label || `Microphone ${index + 1}`
        }));
    },
    async openCamera(deviceId, preset) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported by this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(deviceId, preset),
        audio: false
      });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("The selected camera did not provide a video track.");
      return {
        stream,
        settings: normalizedSettings(track, deviceId, preset),
        label: track.label || "Active camera"
      };
    },
    async openMicrophone(deviceId) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported by this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          ...(deviceId === "default" ? {} : { deviceId: { exact: deviceId } }),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error("The selected microphone did not provide an audio track.");
      return { stream, label: track.label || "Active microphone" };
    },
    watchDevices(callback) {
      navigator.mediaDevices?.addEventListener?.("devicechange", callback);
      return () => navigator.mediaDevices?.removeEventListener?.("devicechange", callback);
    }
  };
}

function makeSyntheticFrame(label: string, preset: QualityPreset, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const context = canvas.getContext("2d", { alpha: false });
  let frame = 0;
  const paint = () => {
    if (!context) return;
    const block = Math.max(80, Math.round(canvas.width / 10));
    context.fillStyle = "#182026";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#23323a";
    for (let x = 0; x < canvas.width; x += block) {
      for (let y = 0; y < canvas.height; y += block) {
        if ((Math.floor(x / block) + Math.floor(y / block)) % 2 === 0) context.fillRect(x, y, block, block);
      }
    }
    const sweep = (frame * Math.max(6, canvas.width / 160)) % canvas.width;
    context.fillStyle = accent;
    context.fillRect(sweep, 0, Math.max(5, canvas.width / 300), canvas.height);
    context.fillStyle = "#eef4f6";
    context.font = `700 ${Math.max(24, canvas.height / 18)}px sans-serif`;
    context.fillText(label, canvas.width * 0.04, canvas.height * 0.91);
    frame += 1;
  };
  paint();
  const timer = window.setInterval(paint, 100);
  return { canvas, timer };
}

interface GeneratedAudioTrack extends MediaStreamTrack {
  writable: WritableStream<AudioData>;
}

type AudioTrackGeneratorConstructor = new (options: { kind: "audio" }) => GeneratedAudioTrack;

function makeGeneratedAudioStream(frequency: number) {
  const Generator = (globalThis as typeof globalThis & { MediaStreamTrackGenerator?: AudioTrackGeneratorConstructor }).MediaStreamTrackGenerator;
  if (!Generator || typeof AudioData === "undefined") return null;
  const track = new Generator({ kind: "audio" });
  const writer = track.writable.getWriter();
  const sampleRate = 48_000;
  const frameCount = 960;
  let timestamp = 0;
  let phase = 0;
  const timer = window.setInterval(() => {
    const samples = new Float32Array(frameCount);
    for (let index = 0; index < frameCount; index += 1) {
      samples[index] = Math.sin(phase) * 0.08;
      phase += (Math.PI * 2 * frequency) / sampleRate;
    }
    const data = new AudioData({
      format: "f32",
      sampleRate,
      numberOfFrames: frameCount,
      numberOfChannels: 1,
      timestamp,
      data: samples
    });
    timestamp += 20_000;
    void writer.write(data).finally(() => data.close());
  }, 20);
  const originalStop = track.stop.bind(track);
  let stopped = false;
  Object.defineProperty(track, "stop", {
    configurable: true,
    value: () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      void writer.close().catch(() => undefined);
      originalStop();
    }
  });
  return new MediaStream([track]);
}

export function createSyntheticMediaProvider(): MediaProvider {
  const diagnostics = { starts: 0, stoppedTracks: 0 };
  const cameras: CameraOption[] = [
    { deviceId: "diagnostic-camera-a", label: "Studio Camera A" },
    { deviceId: "diagnostic-camera-b", label: "Capture Camera B" }
  ];
  const microphones: MicrophoneOption[] = [
    { deviceId: "diagnostic-microphone-a", label: "Studio Microphone A" },
    { deviceId: "diagnostic-microphone-b", label: "USB Microphone B" }
  ];
  return {
    diagnostics,
    async enumerateCameras() {
      return cameras;
    },
    async enumerateMicrophones() {
      return microphones;
    },
    async openCamera(deviceId, preset) {
      const selected = cameras.find((camera) => camera.deviceId === deviceId) ?? cameras[0];
      const accent = selected.deviceId.endsWith("b") ? "#f3b562" : "#64d8b5";
      const source = makeSyntheticFrame(selected.label, preset, accent);
      const stream = source.canvas.captureStream(preset.fps);
      const track = stream.getVideoTracks()[0];
      diagnostics.starts += 1;
      const originalStop = track.stop.bind(track);
      let stopped = false;
      Object.defineProperty(track, "stop", {
        configurable: true,
        value: () => {
          if (!stopped) {
            stopped = true;
            diagnostics.stoppedTracks += 1;
            window.clearInterval(source.timer);
          }
          originalStop();
        }
      });
      return {
        stream,
        settings: {
          width: preset.width,
          height: preset.height,
          frameRate: preset.fps,
          deviceId: selected.deviceId
        },
        label: selected.label
      };
    },
    async openMicrophone(deviceId) {
      const selected = microphones.find((microphone) => microphone.deviceId === deviceId) ?? microphones[0];
      const generated = makeGeneratedAudioStream(selected.deviceId.endsWith("b") ? 330 : 220);
      if (generated) return { stream: generated, label: selected.label };
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = selected.deviceId.endsWith("b") ? 330 : 220;
      gain.gain.value = 0.06;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      if (context.state === "suspended") void context.resume().catch(() => undefined);
      const stream = destination.stream;
      const track = stream.getAudioTracks()[0];
      const originalStop = track?.stop.bind(track);
      if (track) Object.defineProperty(track, "stop", {
        configurable: true,
        value: () => {
          oscillator.stop();
          void context.close();
          originalStop?.();
        }
      });
      return { stream, label: selected.label };
    },
    watchDevices() {
      return () => undefined;
    }
  };
}

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return 0;
  const tracks = stream.getTracks();
  tracks.forEach((track) => track.stop());
  return tracks.length;
}
