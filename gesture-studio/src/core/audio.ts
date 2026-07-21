interface VideoAudioRoute {
  source: MediaElementAudioSourceNode;
  recordingGain: GainNode;
  monitorGain: GainNode;
  enabled: boolean;
}

export interface StudioAudioMixer {
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  microphoneAnalyser: AnalyserNode;
  microphoneSource: MediaStreamAudioSourceNode | null;
  screenSource: MediaStreamAudioSourceNode | null;
  videoRoutes: Map<string, VideoAudioRoute>;
  monitorMedia: boolean;
}

type AudioContextHost = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export async function createStudioAudioMixer(): Promise<StudioAudioMixer | null> {
  const host = globalThis as AudioContextHost;
  const Context = host.AudioContext ?? host.webkitAudioContext;
  if (!Context) return null;
  const context = new Context();
  const destination = context.createMediaStreamDestination();
  const microphoneAnalyser = context.createAnalyser();
  microphoneAnalyser.fftSize = 256;
  microphoneAnalyser.smoothingTimeConstant = 0.72;
  microphoneAnalyser.connect(destination);
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return {
    context,
    destination,
    microphoneAnalyser,
    microphoneSource: null,
    screenSource: null,
    videoRoutes: new Map(),
    monitorMedia: false
  };
}

export function connectMicrophone(mixer: StudioAudioMixer | null, stream: MediaStream | null) {
  mixer?.microphoneSource?.disconnect();
  if (!mixer) return;
  mixer.microphoneSource = stream?.getAudioTracks().length
    ? mixer.context.createMediaStreamSource(stream)
    : null;
  mixer.microphoneSource?.connect(mixer.microphoneAnalyser);
}

/** Shared-screen audio is recorded into the master mix but is not routed back
 * to the speakers, avoiding doubled game/tab audio and feedback. */
export function connectScreenAudio(mixer: StudioAudioMixer | null, stream: MediaStream | null) {
  mixer?.screenSource?.disconnect();
  if (!mixer) return false;
  mixer.screenSource = stream?.getAudioTracks().length
    ? mixer.context.createMediaStreamSource(stream)
    : null;
  mixer.screenSource?.connect(mixer.destination);
  return Boolean(mixer.screenSource);
}

function applyVideoRoute(mixer: StudioAudioMixer, route: VideoAudioRoute) {
  route.recordingGain.gain.value = route.enabled ? 1 : 0;
  route.monitorGain.gain.value = route.enabled && mixer.monitorMedia ? 1 : 0;
}

export function connectVideoAudio(mixer: StudioAudioMixer | null, id: string, video: HTMLVideoElement, enabled: boolean) {
  if (!mixer) return;
  const existing = mixer.videoRoutes.get(id);
  if (existing) {
    existing.enabled = enabled;
    applyVideoRoute(mixer, existing);
    return;
  }
  const source = mixer.context.createMediaElementSource(video);
  const recordingGain = mixer.context.createGain();
  const monitorGain = mixer.context.createGain();
  const route = { source, recordingGain, monitorGain, enabled };
  source.connect(recordingGain);
  recordingGain.connect(mixer.destination);
  source.connect(monitorGain);
  monitorGain.connect(mixer.context.destination);
  applyVideoRoute(mixer, route);
  mixer.videoRoutes.set(id, route);
}

export function setVideoAudioEnabled(mixer: StudioAudioMixer | null, id: string, enabled: boolean) {
  if (!mixer) return;
  const route = mixer.videoRoutes.get(id);
  if (!route) return;
  route.enabled = enabled;
  applyVideoRoute(mixer, route);
}

export function setMediaMonitoring(mixer: StudioAudioMixer | null, enabled: boolean) {
  if (!mixer) return;
  mixer.monitorMedia = enabled;
  mixer.videoRoutes.forEach((route) => applyVideoRoute(mixer, route));
}

export function removeVideoAudio(mixer: StudioAudioMixer | null, id: string) {
  const route = mixer?.videoRoutes.get(id);
  if (!mixer || !route) return;
  route.source.disconnect();
  route.recordingGain.disconnect();
  route.monitorGain.disconnect();
  mixer.videoRoutes.delete(id);
}

export function readMicrophoneLevel(mixer: StudioAudioMixer | null) {
  if (!mixer?.microphoneSource) return 0;
  const samples = new Uint8Array(mixer.microphoneAnalyser.fftSize);
  mixer.microphoneAnalyser.getByteTimeDomainData(samples);
  const meanSquare = samples.reduce((total, sample) => {
    const normalized = (sample - 128) / 128;
    return total + normalized * normalized;
  }, 0) / samples.length;
  return Math.min(1, Math.sqrt(meanSquare) * 3.5);
}

export function mixedAudioStream(mixer: StudioAudioMixer | null, fallback: MediaStream | null) {
  return mixer?.destination.stream ?? fallback;
}

export function cueSoundNotes(sound: CueSound): number[] {
  if (sound === "soft") return [440];
  if (sound === "pop") return [260, 390];
  if (sound === "chime") return [523.25, 659.25, 783.99];
  if (sound === "bottle") return [380, 980, 1500];
  if (sound === "enter") return [2600];
  return [];
}

function connectCueGain(mixer: StudioAudioMixer, gain: GainNode) {
  gain.connect(mixer.destination);
  gain.connect(mixer.context.destination);
}

function generatedNoise(context: AudioContext, seconds: number) {
  const frames = Math.max(1, Math.ceil(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  return source;
}

function playPopOut(mixer: StudioAudioMixer, volume: number, now: number) {
  const lift = mixer.context.createOscillator();
  const liftGain = mixer.context.createGain();
  lift.type = "sine";
  lift.frequency.setValueAtTime(380, now);
  lift.frequency.exponentialRampToValueAtTime(980, now + 0.045);
  lift.frequency.exponentialRampToValueAtTime(720, now + 0.105);
  liftGain.gain.setValueAtTime(0.0001, now);
  liftGain.gain.exponentialRampToValueAtTime(volume * 0.22, now + 0.004);
  liftGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.112);
  lift.connect(liftGain);
  connectCueGain(mixer, liftGain);

  const shine = mixer.context.createOscillator();
  const shineGain = mixer.context.createGain();
  shine.type = "triangle";
  shine.frequency.setValueAtTime(760, now);
  shine.frequency.exponentialRampToValueAtTime(1500, now + 0.04);
  shineGain.gain.setValueAtTime(0.0001, now);
  shineGain.gain.exponentialRampToValueAtTime(volume * 0.075, now + 0.004);
  shineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
  shine.connect(shineGain);
  connectCueGain(mixer, shineGain);

  const snap = generatedNoise(mixer.context, 0.014);
  const filter = mixer.context.createBiquadFilter();
  const snapGain = mixer.context.createGain();
  filter.type = "highpass";
  filter.frequency.value = 2600;
  snapGain.gain.setValueAtTime(volume * 0.055, now);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);
  snap.connect(filter);
  filter.connect(snapGain);
  connectCueGain(mixer, snapGain);

  lift.start(now);
  lift.stop(now + 0.12);
  shine.start(now);
  shine.stop(now + 0.07);
  snap.start(now);
  snap.stop(now + 0.018);
  lift.addEventListener("ended", () => { lift.disconnect(); liftGain.disconnect(); }, { once: true });
  shine.addEventListener("ended", () => { shine.disconnect(); shineGain.disconnect(); }, { once: true });
  snap.addEventListener("ended", () => { snap.disconnect(); filter.disconnect(); snapGain.disconnect(); }, { once: true });
}

function playEnterKey(mixer: StudioAudioMixer, volume: number, now: number) {
  const tick = mixer.context.createOscillator();
  const tickGain = mixer.context.createGain();
  tick.type = "square";
  tick.frequency.setValueAtTime(2600, now);
  tick.frequency.exponentialRampToValueAtTime(1900, now + 0.011);
  tickGain.gain.setValueAtTime(volume * 0.038, now);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);
  tick.connect(tickGain);
  connectCueGain(mixer, tickGain);

  const click = generatedNoise(mixer.context, 0.016);
  const clickFilter = mixer.context.createBiquadFilter();
  const clickGain = mixer.context.createGain();
  clickFilter.type = "highpass";
  clickFilter.frequency.value = 3200;
  clickGain.gain.setValueAtTime(volume * 0.075, now);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
  click.connect(clickFilter);
  clickFilter.connect(clickGain);
  connectCueGain(mixer, clickGain);

  tick.start(now);
  tick.stop(now + 0.018);
  click.start(now);
  click.stop(now + 0.016);
  tick.addEventListener("ended", () => { tick.disconnect(); tickGain.disconnect(); }, { once: true });
  click.addEventListener("ended", () => { click.disconnect(); clickFilter.disconnect(); clickGain.disconnect(); }, { once: true });
}

/** Plays a short generated cue into both the recording mix and local monitor. */
export function playCueSound(mixer: StudioAudioMixer | null, sound: CueSound | undefined, volume = 0.65) {
  if (!mixer || !sound || sound === "none") return;
  const now = mixer.context.currentTime;
  const safeVolume = Math.max(0.001, Math.min(1, volume));
  if (sound === "bottle") {
    playPopOut(mixer, safeVolume, now);
    return;
  }
  if (sound === "enter") {
    playEnterKey(mixer, safeVolume, now);
    return;
  }
  const notes = cueSoundNotes(sound);
  notes.forEach((frequency, index) => {
    const startsAt = now + index * (sound === "chime" ? 0.075 : 0.035);
    const duration = sound === "soft" ? 0.18 : sound === "chime" ? 0.24 : 0.12;
    const oscillator = mixer.context.createOscillator();
    const gain = mixer.context.createGain();
    oscillator.type = sound === "pop" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(safeVolume * 0.16, startsAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    oscillator.connect(gain);
    gain.connect(mixer.destination);
    gain.connect(mixer.context.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + 0.01);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
  });
}

export async function closeStudioAudioMixer(mixer: StudioAudioMixer | null) {
  if (!mixer) return;
  mixer.microphoneSource?.disconnect();
  mixer.screenSource?.disconnect();
  mixer.videoRoutes.forEach((route) => {
    route.source.disconnect();
    route.recordingGain.disconnect();
    route.monitorGain.disconnect();
  });
  mixer.destination.stream.getTracks().forEach((track) => track.stop());
  if (mixer.context.state !== "closed") await mixer.context.close();
}
import type { CueSound } from "../types";
