export interface CaptionWord {
  text: string;
  start: number;
  end: number;
}

export interface CaptionSegment {
  id: string;
  text: string;
  start: number;
  end: number;
}

export type CaptionStyleId = "clean" | "highlight" | "bold";
export type CaptionPosition = "top" | "center" | "bottom" | "custom";
export type CaptionFontId = "system" | "arial" | "impact" | "georgia" | "courier";

export const CAPTION_FONTS: ReadonlyArray<{ id: CaptionFontId; label: string; family: string }> = [
  { id: "system", label: "System sans", family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { id: "arial", label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { id: "impact", label: "Impact", family: "Impact, 'Arial Black', sans-serif" },
  { id: "georgia", label: "Georgia", family: "Georgia, 'Times New Roman', serif" },
  { id: "courier", label: "Courier New", family: "'Courier New', Consolas, monospace" }
];

export interface CaptionStyle {
  preset: CaptionStyleId;
  font: CaptionFontId;
  position: CaptionPosition;
  fontScale: number;
  textColor: string;
  accentColor: string;
  background: boolean;
  anchorX: number;
  anchorY: number;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  preset: "clean",
  font: "system",
  position: "bottom",
  fontScale: 1,
  textColor: "#ffffff",
  accentColor: "#6f62ff",
  background: true,
  anchorX: 0.5,
  anchorY: 0.84
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const normalizeWord = (value: string) => value.replace(/\s+/g, " ").trim();

export function captionPresetAnchor(position: CaptionPosition) {
  if (position === "top") return { anchorX: 0.5, anchorY: 0.16 };
  if (position === "center") return { anchorX: 0.5, anchorY: 0.5 };
  return { anchorX: 0.5, anchorY: 0.84 };
}

export function normalizeCaptionStyle(style: Partial<CaptionStyle>): CaptionStyle {
  const position = style.position ?? DEFAULT_CAPTION_STYLE.position;
  const fallback = captionPresetAnchor(position);
  const font = CAPTION_FONTS.some((option) => option.id === style.font) ? style.font! : DEFAULT_CAPTION_STYLE.font;
  return {
    ...DEFAULT_CAPTION_STYLE,
    ...style,
    font,
    position,
    fontScale: clamp(Number.isFinite(style.fontScale) ? style.fontScale! : DEFAULT_CAPTION_STYLE.fontScale, 0.6, 2),
    anchorX: clamp(Number.isFinite(style.anchorX) ? style.anchorX! : fallback.anchorX, 0.04, 0.96),
    anchorY: clamp(Number.isFinite(style.anchorY) ? style.anchorY! : fallback.anchorY, 0.06, 0.94)
  };
}

export function captionFontFamily(font: CaptionFontId | undefined) {
  return CAPTION_FONTS.find((option) => option.id === font)?.family ?? CAPTION_FONTS[0].family;
}

export function captionAnchorFromPoint(x: number, y: number, snapThreshold = 0.025) {
  const clampedX = clamp(x, 0.04, 0.96);
  const clampedY = clamp(y, 0.06, 0.94);
  const snapX = Math.abs(clampedX - 0.5) <= snapThreshold;
  const snapY = Math.abs(clampedY - 0.5) <= snapThreshold;
  return {
    anchorX: snapX ? 0.5 : clampedX,
    anchorY: snapY ? 0.5 : clampedY,
    snapX,
    snapY
  };
}

export function groupCaptionWords(words: readonly CaptionWord[], maxCharacters = 34, maxWords = 6): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let current: CaptionWord[] = [];
  const flush = () => {
    if (!current.length) return;
    const text = current.map((word) => normalizeWord(word.text)).filter(Boolean).join(" ").replace(/\s+([,.;!?])/g, "$1");
    if (text) segments.push({ id: `caption-${segments.length + 1}`, text, start: current[0].start, end: current.at(-1)?.end ?? current[0].end });
    current = [];
  };
  words.forEach((word) => {
    const clean = normalizeWord(word.text);
    if (!clean) return;
    const projected = [...current.map((item) => normalizeWord(item.text)), clean].join(" ");
    if (current.length && (projected.length > maxCharacters || current.length >= maxWords)) flush();
    current.push({ ...word, text: clean });
    if (/[.!?]$/.test(clean) || (current.at(-1)!.end - current[0].start) >= 3.2) flush();
  });
  flush();
  return segments;
}

/** Builds usable timings when Whisper returns text without word timestamps. */
export function captionSegmentsFromText(text: string, durationSeconds: number): CaptionSegment[] {
  const words = normalizeWord(text).split(" ").filter(Boolean);
  if (!words.length) return [];
  const duration = Math.max(0.8, durationSeconds);
  const wordDuration = duration / words.length;
  return groupCaptionWords(words.map((word, index) => ({
    text: word,
    start: index * wordDuration,
    end: Math.min(duration, (index + 1) * wordDuration)
  })));
}

export function activeCaptionAt(segments: readonly CaptionSegment[], time: number) {
  return segments.find((segment) => time >= segment.start && time < segment.end) ?? null;
}

export function retimeCaptionSegment(segment: CaptionSegment, start: number, end: number, durationSeconds: number) {
  const duration = Math.max(0.05, Number.isFinite(durationSeconds) ? durationSeconds : segment.end);
  const safeStart = clamp(Number.isFinite(start) ? start : segment.start, 0, Math.max(0, duration - 0.05));
  const safeEnd = clamp(Number.isFinite(end) ? end : segment.end, safeStart + 0.05, duration);
  return { ...segment, start: safeStart, end: safeEnd };
}

export function drawCaption(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  segment: CaptionSegment | null,
  style: CaptionStyle
) {
  if (!segment?.text) return;
  const normalizedStyle = normalizeCaptionStyle(style);
  const portrait = height > width;
  const base = Math.min(width, height);
  const fontSize = Math.max(28, Math.round(base * (portrait ? 0.045 : 0.052) * normalizedStyle.fontScale));
  const maxWidth = width * (portrait ? 0.82 : 0.74);
  const paddingX = fontSize * 0.55;
  const paddingY = fontSize * 0.35;
  context.save();
  context.font = `${normalizedStyle.preset === "bold" ? 800 : 700} ${fontSize}px ${captionFontFamily(normalizedStyle.font)}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const words = segment.text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  const visible = lines.slice(0, 2);
  const lineHeight = fontSize * 1.18;
  const blockHeight = visible.length * lineHeight + paddingY * 2;
  const widest = Math.min(maxWidth, Math.max(...visible.map((item) => context.measureText(item).width)));
  const horizontalHalf = (widest + (normalizedStyle.background ? paddingX * 2 : 0)) / 2;
  const verticalHalf = blockHeight / 2;
  const centerX = clamp(normalizedStyle.anchorX * width, horizontalHalf, width - horizontalHalf);
  const centerY = clamp(normalizedStyle.anchorY * height, verticalHalf, height - verticalHalf);
  const top = centerY - blockHeight / 2;
  if (normalizedStyle.background) {
    context.fillStyle = normalizedStyle.preset === "highlight" ? normalizedStyle.accentColor : "rgba(8, 8, 10, .78)";
    context.beginPath();
    context.roundRect(centerX - widest / 2 - paddingX, top, widest + paddingX * 2, blockHeight, fontSize * 0.28);
    context.fill();
  }
  context.fillStyle = normalizedStyle.textColor;
  context.shadowColor = "rgba(0,0,0,.45)";
  context.shadowBlur = normalizedStyle.background ? 0 : fontSize * 0.18;
  visible.forEach((item, index) => context.fillText(item, centerX, top + paddingY + lineHeight * (index + 0.5)));
  context.restore();
}
