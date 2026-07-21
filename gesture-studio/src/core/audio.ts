import type { CueSound } from "../types";

interface VideoAudioRoute {
  source: MediaElementAudioSourceNode;
  recordingGain: GainNode;
  monitorGain: GainNode;
  enabled: boolean;
  monitorAlways: boolean;
}

export interface StudioAudioMixer {
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  recordingBus: GainNode;
  recordingLimiter: DynamicsCompressorNode;
  cueRecordingGain: GainNode;
  cueMonitorGain: GainNode;
  microphoneAnalyser: AnalyserNode;
  microphoneSource: MediaStreamAudioSourceNode | null;
  screenSource: MediaStreamAudioSourceNode | null;
  videoRoutes: Map<string, VideoAudioRoute>;
  monitorMedia: boolean;
}

type AudioContextHost = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export const AUDIO_MIX_LEVELS = {
  // Voice is the primary recording signal. This leaves enough summing
  // headroom for a full microphone peak plus controlled background music.
  recordingHeadroom: 0.8,
  cueRecording: 0.38,
  cueMonitor: 0.5,
  mediaWithMicrophone: 0.42,
  backgroundWithMicrophone: 0.22
} as const;

export function recordingRouteGain(hasMicrophone: boolean, background: boolean) {
  if (!hasMicrophone) return 1;
  return background ? AUDIO_MIX_LEVELS.backgroundWithMicrophone : AUDIO_MIX_LEVELS.mediaWithMicrophone;
}

export async function createStudioAudioMixer(): Promise<StudioAudioMixer | null> {
  const host = globalThis as AudioContextHost;
  const Context = host.AudioContext ?? host.webkitAudioContext;
  if (!Context) return null;
  const context = new Context();
  const destination = context.createMediaStreamDestination();
  const recordingBus = context.createGain();
  const recordingLimiter = context.createDynamicsCompressor();
  const cueRecordingGain = context.createGain();
  const cueMonitorGain = context.createGain();
  const microphoneAnalyser = context.createAnalyser();
  microphoneAnalyser.fftSize = 256;
  microphoneAnalyser.smoothingTimeConstant = 0.72;
  recordingBus.gain.value = AUDIO_MIX_LEVELS.recordingHeadroom;
  recordingLimiter.threshold.value = -2;
  recordingLimiter.knee.value = 0;
  recordingLimiter.ratio.value = 20;
  recordingLimiter.attack.value = 0.001;
  recordingLimiter.release.value = 0.09;
  cueRecordingGain.gain.value = AUDIO_MIX_LEVELS.cueRecording;
  cueMonitorGain.gain.value = 0;
  microphoneAnalyser.connect(recordingBus);
  cueRecordingGain.connect(recordingBus);
  cueMonitorGain.connect(context.destination);
  recordingBus.connect(recordingLimiter);
  recordingLimiter.connect(destination);
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return {
    context,
    destination,
    recordingBus,
    recordingLimiter,
    cueRecordingGain,
    cueMonitorGain,
    microphoneAnalyser,
    microphoneSource: null,
    screenSource: null,
    videoRoutes: new Map(),
    monitorMedia: false
  };
}

function applyCueMonitoring(mixer: StudioAudioMixer) {
  // Generated effects playing through speakers can be recaptured by the mic and
  // provoke aggressive browser echo cancellation. Keep them in the recording
  // mix, but only monitor them locally when no microphone is connected.
  mixer.cueMonitorGain.gain.value = mixer.monitorMedia && !mixer.microphoneSource
    ? AUDIO_MIX_LEVELS.cueMonitor
    : 0;
}

export function connectMicrophone(mixer: StudioAudioMixer | null, stream: MediaStream | null) {
  mixer?.microphoneSource?.disconnect();
  if (!mixer) return;
  mixer.microphoneSource = stream?.getAudioTracks().length
    ? mixer.context.createMediaStreamSource(stream)
    : null;
  mixer.microphoneSource?.connect(mixer.microphoneAnalyser);
  applyCueMonitoring(mixer);
  mixer.videoRoutes.forEach((route) => applyVideoRoute(mixer, route));
}

/** Shared-screen audio is recorded into the master mix but is not routed back
 * to the speakers, avoiding doubled game/tab audio and feedback. */
export function connectScreenAudio(mixer: StudioAudioMixer | null, stream: MediaStream | null) {
  mixer?.screenSource?.disconnect();
  if (!mixer) return false;
  mixer.screenSource = stream?.getAudioTracks().length
    ? mixer.context.createMediaStreamSource(stream)
    : null;
  mixer.screenSource?.connect(mixer.recordingBus);
  return Boolean(mixer.screenSource);
}

function applyVideoRoute(mixer: StudioAudioMixer, route: VideoAudioRoute) {
  route.recordingGain.gain.value = route.enabled
    ? recordingRouteGain(Boolean(mixer.microphoneSource), route.monitorAlways)
    : 0;
  // Do not automatically play persistent music through speakers beside a live
  // microphone: browser echo cancellation can then chop the primary voice.
  // Explicit media monitoring remains available for headphone workflows.
  const safeAutomaticMonitor = route.monitorAlways && !mixer.microphoneSource;
  route.monitorGain.gain.value = route.enabled && (safeAutomaticMonitor || mixer.monitorMedia) ? 1 : 0;
}

export function connectVideoAudio(mixer: StudioAudioMixer | null, id: string, video: HTMLMediaElement, enabled: boolean, monitorAlways = false) {
  if (!mixer) return;
  const existing = mixer.videoRoutes.get(id);
  if (existing) {
    existing.enabled = enabled;
    existing.monitorAlways = monitorAlways;
    applyVideoRoute(mixer, existing);
    return;
  }
  const source = mixer.context.createMediaElementSource(video);
  const recordingGain = mixer.context.createGain();
  const monitorGain = mixer.context.createGain();
  const route = { source, recordingGain, monitorGain, enabled, monitorAlways };
  source.connect(recordingGain);
  recordingGain.connect(mixer.recordingBus);
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
  applyCueMonitoring(mixer);
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

export function cueSoundDuration(sound: CueSound) {
  if (sound === "whoosh") return 0.36;
  if (sound === "shutter") return 0.13;
  if (sound === "film") return 0.58;
  if (sound === "soft") return 0.18;
  if (sound === "chime") return 0.39;
  if (sound === "none") return 0;
  return 0.16;
}

function connectCueGain(mixer: StudioAudioMixer, gain: GainNode) {
  gain.connect(mixer.cueRecordingGain);
  gain.connect(mixer.cueMonitorGain);
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

function playWhoosh(mixer: StudioAudioMixer, volume: number, now: number) {
  const air = generatedNoise(mixer.context, 0.36);
  const sweep = mixer.context.createBiquadFilter();
  const airGain = mixer.context.createGain();
  sweep.type = "bandpass";
  sweep.Q.value = 0.72;
  sweep.frequency.setValueAtTime(180, now);
  sweep.frequency.exponentialRampToValueAtTime(4200, now + 0.22);
  sweep.frequency.exponentialRampToValueAtTime(1200, now + 0.35);
  airGain.gain.setValueAtTime(0.0001, now);
  airGain.gain.exponentialRampToValueAtTime(volume * 0.18, now + 0.09);
  airGain.gain.exponentialRampToValueAtTime(volume * 0.11, now + 0.22);
  airGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
  air.connect(sweep);
  sweep.connect(airGain);
  connectCueGain(mixer, airGain);

  const body = mixer.context.createOscillator();
  const bodyGain = mixer.context.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(140, now);
  body.frequency.exponentialRampToValueAtTime(72, now + 0.28);
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(volume * 0.045, now + 0.06);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  body.connect(bodyGain);
  connectCueGain(mixer, bodyGain);

  air.start(now);
  air.stop(now + 0.37);
  body.start(now);
  body.stop(now + 0.31);
  air.addEventListener("ended", () => { air.disconnect(); sweep.disconnect(); airGain.disconnect(); }, { once: true });
  body.addEventListener("ended", () => { body.disconnect(); bodyGain.disconnect(); }, { once: true });
}

function scheduleMechanicalHit(mixer: StudioAudioMixer, volume: number, at: number, clickFrequency: number, bodyFrequency: number) {
  const click = generatedNoise(mixer.context, 0.032);
  const clickFilter = mixer.context.createBiquadFilter();
  const clickGain = mixer.context.createGain();
  clickFilter.type = "bandpass";
  clickFilter.frequency.value = clickFrequency;
  clickFilter.Q.value = 1.35;
  clickGain.gain.setValueAtTime(volume * 0.2, at);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.032);
  click.connect(clickFilter);
  clickFilter.connect(clickGain);
  connectCueGain(mixer, clickGain);

  const body = mixer.context.createOscillator();
  const bodyGain = mixer.context.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(bodyFrequency, at);
  body.frequency.exponentialRampToValueAtTime(Math.max(48, bodyFrequency * 0.58), at + 0.04);
  bodyGain.gain.setValueAtTime(volume * 0.085, at);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  body.connect(bodyGain);
  connectCueGain(mixer, bodyGain);

  click.start(at);
  click.stop(at + 0.034);
  body.start(at);
  body.stop(at + 0.047);
  click.addEventListener("ended", () => { click.disconnect(); clickFilter.disconnect(); clickGain.disconnect(); }, { once: true });
  body.addEventListener("ended", () => { body.disconnect(); bodyGain.disconnect(); }, { once: true });
}

function playCameraShutter(mixer: StudioAudioMixer, volume: number, now: number) {
  scheduleMechanicalHit(mixer, volume, now, 1150, 145);
  scheduleMechanicalHit(mixer, volume * 0.72, now + 0.064, 1750, 185);
}

function playFilmRoll(mixer: StudioAudioMixer, volume: number, now: number) {
  const motor = mixer.context.createOscillator();
  const motorFilter = mixer.context.createBiquadFilter();
  const motorGain = mixer.context.createGain();
  motor.type = "sawtooth";
  motor.frequency.setValueAtTime(74, now);
  motor.frequency.linearRampToValueAtTime(96, now + 0.16);
  motor.frequency.linearRampToValueAtTime(88, now + 0.52);
  motorFilter.type = "lowpass";
  motorFilter.frequency.value = 430;
  motorGain.gain.setValueAtTime(0.0001, now);
  motorGain.gain.exponentialRampToValueAtTime(volume * 0.035, now + 0.045);
  motorGain.gain.setValueAtTime(volume * 0.035, now + 0.46);
  motorGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
  motor.connect(motorFilter);
  motorFilter.connect(motorGain);
  connectCueGain(mixer, motorGain);

  const flutter = generatedNoise(mixer.context, 0.58);
  const flutterFilter = mixer.context.createBiquadFilter();
  const flutterGain = mixer.context.createGain();
  flutterFilter.type = "bandpass";
  flutterFilter.frequency.value = 760;
  flutterFilter.Q.value = 0.75;
  flutterGain.gain.setValueAtTime(0.0001, now);
  flutterGain.gain.exponentialRampToValueAtTime(volume * 0.045, now + 0.055);
  flutterGain.gain.setValueAtTime(volume * 0.04, now + 0.47);
  flutterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
  flutter.connect(flutterFilter);
  flutterFilter.connect(flutterGain);
  connectCueGain(mixer, flutterGain);

  for (let index = 0; index < 7; index += 1) {
    scheduleMechanicalHit(mixer, volume * (index % 2 === 0 ? 0.24 : 0.18), now + 0.055 + index * 0.068, 2100, 210);
  }

  motor.start(now);
  motor.stop(now + 0.59);
  flutter.start(now);
  flutter.stop(now + 0.59);
  motor.addEventListener("ended", () => { motor.disconnect(); motorFilter.disconnect(); motorGain.disconnect(); }, { once: true });
  flutter.addEventListener("ended", () => { flutter.disconnect(); flutterFilter.disconnect(); flutterGain.disconnect(); }, { once: true });
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
  if (sound === "whoosh") {
    playWhoosh(mixer, safeVolume, now);
    return;
  }
  if (sound === "shutter") {
    playCameraShutter(mixer, safeVolume, now);
    return;
  }
  if (sound === "film") {
    playFilmRoll(mixer, safeVolume, now);
    return;
  }
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
    connectCueGain(mixer, gain);
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
  mixer.microphoneAnalyser.disconnect();
  mixer.cueRecordingGain.disconnect();
  mixer.cueMonitorGain.disconnect();
  mixer.recordingBus.disconnect();
  mixer.recordingLimiter.disconnect();
  mixer.destination.stream.getTracks().forEach((track) => track.stop());
  if (mixer.context.state !== "closed") await mixer.context.close();
}
