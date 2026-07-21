import type { GestureId, RecognizedGesture, TriggerHand } from "../types";

export interface Landmark { x: number; y: number; z?: number }

export interface GestureResolution {
  gesture: RecognizedGesture;
  source: "model" | "landmarks" | "composite" | "none";
  confidence: number;
  quality: number;
}

const MODEL_MAP: Record<string, RecognizedGesture> = {
  Pointing_Up: "one",
  Victory: "two",
  Open_Palm: "palm",
  Thumb_Up: "thumb",
  Thumb_Down: "thumb-down",
  ILoveYou: "love",
  Closed_Fist: "fist"
};

const MODEL_THRESHOLDS: Partial<Record<Exclude<RecognizedGesture, null>, number>> = {
  fist: 0.54,
  palm: 0.5,
  one: 0.6,
  two: 0.6,
  thumb: 0.62,
  "thumb-down": 0.62,
  love: 0.62
};

export function matchesTriggerHand(triggerHand: TriggerHand, handedness?: string) {
  return triggerHand === "any" || handedness?.toLowerCase() === triggerHand;
}

const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const normalized = clamp01((value - edge0) / Math.max(0.00001, edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
};

function jointAngle(a: Landmark, joint: Landmark, b: Landmark) {
  const first = { x: a.x - joint.x, y: a.y - joint.y, z: (a.z ?? 0) - (joint.z ?? 0) };
  const second = { x: b.x - joint.x, y: b.y - joint.y, z: (b.z ?? 0) - (joint.z ?? 0) };
  const denominator = Math.hypot(first.x, first.y, first.z) * Math.hypot(second.x, second.y, second.z);
  if (denominator < 0.00001) return 0;
  const cosine = Math.min(1, Math.max(-1, (first.x * second.x + first.y * second.y + first.z * second.z) / denominator));
  return Math.acos(cosine) * 180 / Math.PI;
}

/** Rejects tiny, clipped, or incomplete hands before they can become intent. */
export function landmarkQuality(landmarks: Landmark[]) {
  if (landmarks.length < 21) return 1;
  const palmWidth = distance(landmarks[5], landmarks[17]);
  const palmLength = distance(landmarks[0], landmarks[9]);
  const size = smoothstep(0.045, 0.13, Math.max(palmWidth, palmLength));
  const outside = landmarks.filter((point) => point.x < -0.02 || point.x > 1.02 || point.y < -0.02 || point.y > 1.02).length;
  const edge = clamp01(1 - outside / 4);
  return clamp01(0.25 + size * 0.65 + edge * 0.1);
}

function fingerExtensionScore(landmarks: Landmark[], chain: readonly [number, number, number, number]) {
  const [mcp, pip, dip, tip] = chain.map((index) => landmarks[index]) as [Landmark, Landmark, Landmark, Landmark];
  const wrist = landmarks[0];
  const palmScale = Math.max(distance(landmarks[5], landmarks[17]), distance(wrist, landmarks[9]), 0.035);
  const pipStraightness = smoothstep(118, 172, jointAngle(mcp, pip, dip));
  const dipStraightness = smoothstep(125, 174, jointAngle(pip, dip, tip));
  const reach = smoothstep(0.04, 0.42, (distance(tip, wrist) - distance(pip, wrist)) / palmScale);
  return clamp01(pipStraightness * 0.42 + dipStraightness * 0.38 + reach * 0.2);
}

function extensionScores(landmarks: Landmark[]) {
  if (landmarks.length < 21) return { fingers: [0, 0, 0, 0], thumb: 0 };
  const fingers = ([
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20]
  ] as const).map((chain) => fingerExtensionScore(landmarks, chain));
  const palm = {
    x: (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5,
    y: (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5,
    z: ((landmarks[0].z ?? 0) + (landmarks[5].z ?? 0) + (landmarks[9].z ?? 0) + (landmarks[13].z ?? 0) + (landmarks[17].z ?? 0)) / 5
  };
  const palmScale = Math.max(distance(landmarks[5], landmarks[17]), 0.035);
  const thumbStraightness = (smoothstep(105, 168, jointAngle(landmarks[1], landmarks[2], landmarks[3]))
    + smoothstep(115, 170, jointAngle(landmarks[2], landmarks[3], landmarks[4]))) / 2;
  const thumbReach = smoothstep(0.05, 0.5, (distance(landmarks[4], palm) - distance(landmarks[3], palm)) / palmScale);
  return { fingers, thumb: clamp01(thumbStraightness * 0.62 + thumbReach * 0.38) };
}

export function resolveGesture(categoryName: string | undefined, confidence: number, landmarks: Landmark[] = []): GestureResolution {
  const model = categoryName ? MODEL_MAP[categoryName] : null;
  const quality = landmarkQuality(landmarks);
  if (model) {
    const threshold = MODEL_THRESHOLDS[model] ?? 0.55;
    if (confidence >= threshold) return { gesture: model, source: "model", confidence, quality };
    // A moderately confident Open_Palm must not fall through and become the
    // visually similar landmark-only four-finger pose.
    if (model === "palm" && confidence >= 0.36) return { gesture: "palm", source: "model", confidence, quality };
  }

  const hand = extensionScores(landmarks);
  const extended = hand.fingers.map((score) => score >= 0.68);
  const count = extended.filter(Boolean).length;
  const extendedScores = hand.fingers.filter((_, index) => extended[index]);
  const foldedScores = hand.fingers.filter((_, index) => !extended[index]);
  const separation = foldedScores.length ? 1 - Math.max(...foldedScores) : 1;
  const landmarkConfidence = clamp01((Math.min(...extendedScores, 1) * 0.72 + separation * 0.28) * quality);
  // MediaPipe can keep returning a useful 21-point skeleton while the wrist
  // and part of the palm are clipped by the camera edge. In that case the
  // index chain is still enough to drive the literal fingertip pointer.
  if (count === 1 && extended[0] && landmarkConfidence >= 0.48) return { gesture: "one", source: "landmarks", confidence: landmarkConfidence, quality };
  if (count === 2 && extended[0] && extended[1] && landmarkConfidence >= 0.52) return { gesture: "two", source: "landmarks", confidence: landmarkConfidence, quality };
  if (count === 3 && landmarkConfidence >= 0.56) return { gesture: "three", source: "landmarks", confidence: landmarkConfidence, quality };
  if (count === 4 && hand.thumb < 0.52 && landmarkConfidence >= 0.6) return { gesture: "four", source: "landmarks", confidence: landmarkConfidence, quality };
  return { gesture: null, source: "none", confidence: 0, quality };
}

/**
 * Resolves deliberately matched two-hand poses before either hand can be
 * mistaken for its single-hand assignment.
 */
export function resolveCompositeGesture(hands: readonly GestureResolution[]): GestureResolution | null {
  const eligible = hands
    .filter((hand): hand is GestureResolution & { gesture: "one" | "two" | "thumb" | "fist" } => (
      (hand.gesture === "one" || hand.gesture === "two" || hand.gesture === "thumb" || hand.gesture === "fist")
      && hand.confidence * hand.quality >= 0.62
    ))
    .sort((a, b) => (b.confidence * b.quality) - (a.confidence * a.quality));
  if (eligible.length < 2) return null;
  const pair = eligible.slice(0, 2);
  const gestures = pair.map((hand) => hand.gesture).sort();
  const gesture: GestureId | null = gestures[0] === "fist" && gestures[1] === "fist"
    ? "double-fist"
    : gestures[0] === "one" && gestures[1] === "one"
      ? "double-one"
    : gestures[0] === "two" && gestures[1] === "two"
      ? "double-two"
    : gestures[0] === "thumb" && gestures[1] === "thumb"
      ? "double-thumb"
      : gestures.includes("thumb") && gestures.includes("two")
        ? "thumb-two"
        : null;
  if (!gesture) return null;
  return {
    gesture,
    source: "composite",
    confidence: Math.min(...pair.map((hand) => hand.confidence)),
    quality: Math.min(...pair.map((hand) => hand.quality))
  };
}

export interface GestureObservation {
  gesture: RecognizedGesture;
  confidence: number;
  quality?: number;
}

export interface StabilizedGesture extends GestureObservation {
  samples: number;
  rawGesture: RecognizedGesture;
}

export interface GestureStabilizerSettings {
  windowMs: number;
  minimumSamples: number;
  enterRatio: number;
  exitRatio: number;
  neutralReleaseMs: number;
  fistSamples: number;
  fistMaximumGapMs: number;
}

const DEFAULT_STABILIZER: GestureStabilizerSettings = {
  windowMs: 420,
  minimumSamples: 4,
  enterRatio: 0.72,
  exitRatio: 0.5,
  neutralReleaseMs: 120,
  fistSamples: 2,
  fistMaximumGapMs: 140
};

type StabilizedIntent = GestureId | "pinch" | "palm";

const ENTER_SCORE: Record<StabilizedIntent, number> = {
  one: 0.62,
  two: 0.62,
  three: 0.7,
  four: 0.72,
  pinch: 0.64,
  palm: 0.64,
  thumb: 0.66,
  "thumb-down": 0.66,
  love: 0.66,
  "double-fist": 0.72,
  "double-one": 0.72,
  "double-two": 0.72,
  "double-thumb": 0.72,
  "thumb-two": 0.72
};

/**
 * Converts noisy per-frame classifier output into deliberate user intent.
 * It combines confidence, hand quality, majority voting and hysteresis.
 */
export class GestureStabilizer {
  private history: Array<{ gesture: StabilizedIntent | null; score: number; at: number }> = [];
  private stable: StabilizedIntent | null = null;
  private neutralSince: number | null = null;
  private fistRun = 0;
  private lastFistAt = Number.NEGATIVE_INFINITY;

  constructor(private settings: GestureStabilizerSettings = DEFAULT_STABILIZER) {}

  configure(settings: Partial<GestureStabilizerSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  reset() {
    this.history = [];
    this.stable = null;
    this.neutralSince = null;
    this.fistRun = 0;
    this.lastFistAt = Number.NEGATIVE_INFINITY;
  }

  update(observation: GestureObservation, now: number): StabilizedGesture {
    const score = clamp01(observation.confidence * (observation.quality ?? 1));
    const rawGesture = observation.gesture;
    if (rawGesture === "fist" && score >= 0.5) {
      this.fistRun = now - this.lastFistAt <= this.settings.fistMaximumGapMs ? this.fistRun + 1 : 1;
      this.lastFistAt = now;
      this.neutralSince = null;
      if (this.fistRun >= this.settings.fistSamples) {
        this.stable = null;
        this.history = [];
        return { gesture: "fist", confidence: score, quality: observation.quality, samples: this.fistRun, rawGesture };
      }
      return { gesture: null, confidence: score, quality: observation.quality, samples: this.fistRun, rawGesture };
    }
    this.fistRun = 0;

    const gesture = rawGesture && rawGesture !== "fist" ? rawGesture : null;
    const accepted = gesture && score >= 0.32 ? gesture : null;
    this.history.push({ gesture: accepted, score, at: now });
    this.history = this.history.filter((item) => now - item.at <= this.settings.windowMs);

    if (!accepted) {
      if (this.neutralSince === null) this.neutralSince = now;
      if (now - this.neutralSince >= this.settings.neutralReleaseMs) this.stable = null;
    } else {
      this.neutralSince = null;
    }

    const candidates = [...new Set(this.history.map((item) => item.gesture).filter((item): item is StabilizedIntent => Boolean(item)))];
    const ranked = candidates.map((candidate) => {
      const matches = this.history.filter((item) => item.gesture === candidate);
      return {
        gesture: candidate,
        samples: matches.length,
        ratio: matches.length / Math.max(1, this.history.length),
        confidence: matches.reduce((sum, item) => sum + item.score, 0) / Math.max(1, matches.length)
      };
    }).sort((a, b) => (b.ratio * b.confidence) - (a.ratio * a.confidence));

    const best = ranked[0];
    if (best) {
      const continuing = best.gesture === this.stable;
      const requiredSamples = continuing ? Math.max(2, this.settings.minimumSamples - 1) : this.settings.minimumSamples;
      const requiredRatio = continuing ? this.settings.exitRatio : this.settings.enterRatio;
      const requiredScore = continuing ? ENTER_SCORE[best.gesture] - 0.14 : ENTER_SCORE[best.gesture];
      const recent = this.history.slice(-2);
      const fastHighConfidenceEntry = !continuing
        && recent.length === 2
        && recent.every((item) => item.gesture === best.gesture && item.score >= requiredScore + 0.08);
      if (fastHighConfidenceEntry || (best.samples >= requiredSamples && best.ratio >= requiredRatio && best.confidence >= requiredScore)) this.stable = best.gesture;
      else if (!continuing && this.stable && best.ratio > 1 - this.settings.exitRatio) this.stable = null;
    }

    const stableResult = ranked.find((item) => item.gesture === this.stable);
    return {
      gesture: this.stable,
      confidence: stableResult?.confidence ?? 0,
      quality: observation.quality,
      samples: stableResult?.samples ?? 0,
      rawGesture
    };
  }
}

export interface HoldSettings { holdMs: number; cooldownMs: number }
export interface HoldEvent { trigger?: GestureId | "pinch"; hide: boolean; progress: number; armed: boolean }
export const MIN_GESTURE_HOLD_MS = 75;
type GateGesture = GestureId | "pinch" | "palm";

function normalizeHoldSettings(settings: HoldSettings): HoldSettings {
  return {
    ...settings,
    holdMs: Number.isFinite(settings.holdMs)
      ? Math.max(MIN_GESTURE_HOLD_MS, settings.holdMs)
      : MIN_GESTURE_HOLD_MS
  };
}

export class GestureGate {
  private candidate: GateGesture | null = null;
  private since = 0;
  private lastTrigger = Number.NEGATIVE_INFINITY;
  private lastTriggeredGesture: GateGesture | null = null;
  private releaseObserved = false;
  private fistLatched = false;
  private armed = true;
  private settings: HoldSettings;

  constructor(settings: HoldSettings) {
    this.settings = normalizeHoldSettings(settings);
  }

  configure(settings: HoldSettings) { this.settings = normalizeHoldSettings(settings); }
  reset() {
    this.candidate = null;
    this.lastTrigger = Number.NEGATIVE_INFINITY;
    this.lastTriggeredGesture = null;
    this.releaseObserved = false;
    this.fistLatched = false;
    this.armed = true;
  }

  /**
   * Temporarily ignores recognition without pretending the hand was released.
   * This keeps post-activation and manipulation guards from treating an ignored
   * frame as a deliberate pose change.
   */
  suppress(): HoldEvent {
    this.candidate = null;
    return { hide: false, progress: 0, armed: this.armed };
  }

  /** Locks activation until a deliberate neutral or different-pose release. */
  disarm(now: number) {
    this.candidate = null;
    this.lastTrigger = now;
    this.lastTriggeredGesture = null;
    this.releaseObserved = false;
    this.fistLatched = false;
    this.armed = false;
  }

  update(gesture: GateGesture | "fist" | null, now: number, canTrigger = gesture !== "palm"): HoldEvent {
    if (gesture === "fist") {
      const hide = !this.fistLatched;
      this.fistLatched = true;
      this.candidate = null;
      this.releaseObserved = true;
      this.armed = false;
      return { hide, progress: 0, armed: false };
    }
    this.fistLatched = false;
    if (gesture === null) {
      this.candidate = null;
      this.releaseObserved = true;
      if (!this.armed && now - this.lastTrigger >= this.settings.cooldownMs) {
        this.armed = true;
        this.lastTriggeredGesture = null;
      }
      return { hide: false, progress: 0, armed: this.armed };
    }
    if (!this.armed) {
      this.candidate = null;
      const changedPose = gesture !== this.lastTriggeredGesture;
      if (changedPose) this.releaseObserved = true;
      if (!changedPose && !this.releaseObserved) {
        return { hide: false, progress: 0, armed: false };
      }
      if (now - this.lastTrigger >= this.settings.cooldownMs) {
        this.armed = true;
        this.lastTriggeredGesture = null;
        this.releaseObserved = false;
        if (canTrigger && gesture !== "palm") {
          this.candidate = gesture;
          this.since = now;
        }
      }
      return { hide: false, progress: 0, armed: this.armed };
    }
    this.releaseObserved = false;
    if (!canTrigger || gesture === "palm") {
      this.candidate = null;
      return { hide: false, progress: 0, armed: true };
    }
    if (this.candidate !== gesture) {
      this.candidate = gesture;
      this.since = now;
      return { hide: false, progress: 0, armed: true };
    }
    const held = now - this.since;
    const progress = Math.min(1, held / this.settings.holdMs);
    if (held >= this.settings.holdMs && now - this.lastTrigger >= this.settings.cooldownMs) {
      this.lastTrigger = now;
      this.lastTriggeredGesture = gesture;
      this.candidate = null;
      this.releaseObserved = false;
      this.armed = false;
      return { trigger: gesture, hide: false, progress: 1, armed: false };
    }
    return { hide: false, progress, armed: true };
  }
}
