import { captionFontFamily, type CaptionSegment, type CaptionStyle } from "./captions";

export type WordCueAnimation = "punch" | "rise" | "type";

export interface VoiceEmphasisMarker {
  id: string;
  time: number;
  strength: number;
}

export interface WordAnimationCue {
  id: string;
  text: string;
  start: number;
  end: number;
  animation: WordCueAnimation;
  sourceSegmentId: string;
}

interface TimedWord {
  text: string;
  start: number;
  end: number;
  segmentId: string;
  index: number;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "had", "has", "have",
  "he", "her", "his", "i", "if", "in", "is", "it", "its", "me", "my", "of", "on", "or", "our",
  "so", "that", "the", "their", "them", "they", "this", "to", "us", "was", "we", "were", "with",
  "you", "your"
]);

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const cleanWord = (value: string) => value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'-]+$/gu, "").trim();

export function retimeWordAnimationCue(cue: WordAnimationCue, start: number, end: number, durationSeconds: number) {
  const duration = Math.max(0.05, Number.isFinite(durationSeconds) ? durationSeconds : cue.end);
  const safeStart = clamp(Number.isFinite(start) ? start : cue.start, 0, Math.max(0, duration - 0.05));
  const safeEnd = clamp(Number.isFinite(end) ? end : cue.end, safeStart + 0.05, duration);
  return { ...cue, start: safeStart, end: safeEnd };
}

function timedWords(segments: readonly CaptionSegment[]): TimedWord[] {
  const words: TimedWord[] = [];
  segments.forEach((segment) => {
    const tokens = segment.text.split(/\s+/).map(cleanWord).filter(Boolean);
    if (!tokens.length) return;
    const duration = Math.max(0.12, segment.end - segment.start);
    const weights = tokens.map((word) => Math.max(1, Math.sqrt(word.length)));
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    let cursor = segment.start;
    tokens.forEach((word, index) => {
      const share = duration * weights[index] / totalWeight;
      const end = index === tokens.length - 1 ? segment.end : cursor + share;
      words.push({ text: word, start: cursor, end, segmentId: segment.id, index: words.length });
      cursor = end;
    });
  });
  return words;
}

function wordScore(word: TimedWord) {
  const normalized = word.text.toLowerCase();
  const numeric = /\d/.test(word.text);
  const stopPenalty = STOP_WORDS.has(normalized) ? 4 : 0;
  const length = Math.min(10, word.text.length) / 10;
  return (numeric ? 3 : 0) + length * 2 - stopPenalty;
}

function animationForWord(word: string, index: number): WordCueAnimation {
  if (/\d/.test(word)) return "punch";
  if (word.length <= 5) return "punch";
  return index % 2 ? "type" : "rise";
}

/** Selects a deliberately sparse set of editorial word animations. Vocal
 * emphasis wins; meaningful transcript words provide a fallback for older
 * takes that do not have live emphasis markers. */
export function buildWordAnimationCues(
  segments: readonly CaptionSegment[],
  markers: readonly VoiceEmphasisMarker[] = [],
  durationSeconds = segments.at(-1)?.end ?? 0
): WordAnimationCue[] {
  const words = timedWords(segments);
  if (!words.length) return [];
  const duration = Math.max(durationSeconds, words.at(-1)?.end ?? 0);
  const maximum = Math.max(1, Math.min(6, Math.round(Math.max(8, duration) / 15)));
  const selected: Array<{ word: TimedWord; strength: number }> = [];

  const addCandidate = (word: TimedWord | undefined, strength: number) => {
    if (!word || STOP_WORDS.has(word.text.toLowerCase())) return;
    if (selected.some((item) => item.word.text.toLowerCase() === word.text.toLowerCase())) return;
    if (selected.some((item) => Math.abs((item.word.start + item.word.end) / 2 - (word.start + word.end) / 2) < 2.2)) return;
    selected.push({ word, strength });
  };

  [...markers]
    .sort((a, b) => b.strength - a.strength)
    .forEach((marker) => {
      if (selected.length >= maximum) return;
      const nearby = words
        .filter((word) => Math.abs((word.start + word.end) / 2 - marker.time) <= 1.35)
        .sort((a, b) => {
          const scoreA = wordScore(a) - Math.abs((a.start + a.end) / 2 - marker.time) * 0.8;
          const scoreB = wordScore(b) - Math.abs((b.start + b.end) / 2 - marker.time) * 0.8;
          return scoreB - scoreA;
        })[0];
      addCandidate(nearby, marker.strength);
    });

  if (selected.length < maximum) {
    [...words]
      .filter((word) => !STOP_WORDS.has(word.text.toLowerCase()))
      .sort((a, b) => wordScore(b) - wordScore(a) || a.start - b.start)
      .forEach((word) => {
        if (selected.length < maximum) addCandidate(word, 0.45);
      });
  }

  return selected
    .sort((a, b) => a.word.start - b.word.start)
    .map(({ word }, index) => {
      const start = Math.max(0, word.start - 0.08);
      return {
        id: `word-cue-${word.segmentId}-${word.index}`,
        text: word.text,
        start,
        end: Math.max(start + 0.9, Math.min(start + 1.35, word.end + 0.85)),
        animation: animationForWord(word.text, index),
        sourceSegmentId: word.segmentId
      };
    });
}

export function activeWordAnimationAt(cues: readonly WordAnimationCue[], time: number) {
  return cues.find((cue) => time >= cue.start && time < cue.end) ?? null;
}

/** Detects a sustained microphone-only energy lift. It runs on the existing
 * 5 Hz UI meter and therefore adds no audio processing node or render work. */
export class VoiceEmphasisTracker {
  private baseline = 0.035;
  private candidateSince = 0;
  private peak = 0;
  private lastMarkerAt = Number.NEGATIVE_INFINITY;

  reset() {
    this.baseline = 0.035;
    this.candidateSince = 0;
    this.peak = 0;
    this.lastMarkerAt = Number.NEGATIVE_INFINITY;
  }

  update(level: number, timeMs: number): VoiceEmphasisMarker | null {
    const safeLevel = clamp(Number.isFinite(level) ? level : 0, 0, 1);
    const threshold = Math.max(0.14, this.baseline * 1.7 + 0.035);
    const eligible = timeMs >= 550 && timeMs - this.lastMarkerAt >= 1_650;
    if (eligible && safeLevel >= threshold) {
      if (!this.candidateSince) this.candidateSince = timeMs;
      this.peak = Math.max(this.peak, safeLevel);
      if (timeMs - this.candidateSince >= 140) {
        const strength = clamp((this.peak - threshold) / Math.max(0.1, 1 - threshold), 0.2, 1);
        const marker = { id: `voice-${Math.round(timeMs)}`, time: timeMs / 1_000, strength };
        this.lastMarkerAt = timeMs;
        this.candidateSince = 0;
        this.peak = 0;
        this.baseline = this.baseline * 0.92 + Math.min(safeLevel, 0.22) * 0.08;
        return marker;
      }
    } else {
      this.candidateSince = 0;
      this.peak = 0;
    }
    this.baseline = this.baseline * 0.94 + Math.min(safeLevel, 0.28) * 0.06;
    return null;
  }
}

function easeOutBack(value: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

export function drawWordAnimation(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cue: WordAnimationCue | null,
  time: number,
  captionStyle?: CaptionStyle
) {
  if (!cue?.text) return;
  const duration = Math.max(0.01, cue.end - cue.start);
  const progress = clamp((time - cue.start) / duration, 0, 1);
  const enter = clamp(progress / 0.22, 0, 1);
  const exit = clamp((1 - progress) / 0.18, 0, 1);
  const alpha = Math.min(enter, exit);
  const base = Math.min(width, height);
  const fontSize = Math.max(34, Math.round(base * 0.09));
  const anchorY = (captionStyle?.anchorY ?? 0.84) < 0.44 ? 0.72 : 0.27;
  const visibleText = cue.animation === "type"
    ? cue.text.slice(0, Math.max(1, Math.ceil(cue.text.length * clamp(progress / 0.42, 0, 1))))
    : cue.text;
  const scale = cue.animation === "punch" ? 0.48 + easeOutBack(enter) * 0.52 : 1;
  const translateY = cue.animation === "rise" ? (1 - enter) * base * 0.07 : 0;

  context.save();
  context.globalAlpha = alpha;
  context.translate(width * 0.5, height * anchorY + translateY);
  context.scale(scale, scale);
  context.font = `850 ${fontSize}px ${captionFontFamily(captionStyle?.font)}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const measured = Math.min(width * 0.78, context.measureText(visibleText).width);
  const paddingX = fontSize * 0.48;
  const paddingY = fontSize * 0.3;
  context.shadowColor = "rgba(0, 0, 0, .38)";
  context.shadowBlur = fontSize * 0.3;
  context.fillStyle = "rgba(5, 13, 19, .88)";
  context.beginPath();
  context.roundRect(-measured / 2 - paddingX, -fontSize / 2 - paddingY, measured + paddingX * 2, fontSize + paddingY * 2, fontSize * 0.28);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(69, 212, 247, .8)";
  context.lineWidth = Math.max(2, base * 0.003);
  context.stroke();
  context.fillStyle = "#f3fbff";
  context.fillText(visibleText, 0, 0, width * 0.72);
  context.restore();
}
