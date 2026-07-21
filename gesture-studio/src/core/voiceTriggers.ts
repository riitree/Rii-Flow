import type { StudioAsset, StudioScene } from "../types";

export interface VoiceTriggerTarget {
  id: string;
  kind: "asset" | "scene";
  name: string;
  triggerWord: string;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "asset", "audio", "collage", "copy", "data", "document", "final", "file",
  "for", "from", "image", "img", "media", "new", "of", "photo", "picture", "scene", "screen",
  "screenshot", "the", "this", "to", "untitled", "video", "visual", "with"
]);

const EXTENSION = /\.(png|jpe?g|gif|webp|avif|mp4|mov|m4v|webm|csv|json)$/i;

function normalizedWords(value: string) {
  return value
    .toLowerCase()
    .replace(EXTENSION, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeTriggerWord(value: string) {
  return normalizedWords(value).slice(0, 3).join(" ");
}

function tokens(value: string) {
  return normalizeTriggerWord(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function distinctCandidate(candidates: readonly string[], used: ReadonlySet<string>) {
  const normalized = candidates.map(normalizeTriggerWord).filter(Boolean);
  return normalized.find((candidate) => !used.has(candidate)) ?? null;
}

function fallbackTrigger(kind: "asset" | "scene", used: ReadonlySet<string>) {
  const base = kind === "scene" ? "composition" : "visual";
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

export function suggestAssetTrigger(asset: Pick<StudioAsset, "name" | "kind" | "rows">, used: ReadonlySet<string> = new Set()) {
  const nameTokens = tokens(asset.name);
  const rowKeys = asset.rows?.[0] ? Object.keys(asset.rows[0]).flatMap(tokens) : [];
  const candidates = [
    ...nameTokens.slice().reverse(),
    ...rowKeys,
    nameTokens.slice(-2).join(" "),
    asset.kind === "csv" || asset.kind === "json" ? "results" : asset.kind === "video" ? "clip" : "visual"
  ];
  return distinctCandidate(candidates, used) ?? fallbackTrigger("asset", used);
}

export function suggestSceneTrigger(
  scene: Pick<StudioScene, "name" | "memberIds">,
  assets: readonly Pick<StudioAsset, "id" | "name" | "kind" | "rows" | "triggerWord">[],
  used: ReadonlySet<string> = new Set()
) {
  const nameTokens = tokens(scene.name);
  const memberWords = scene.memberIds.flatMap((id) => {
    const member = assets.find((asset) => asset.id === id);
    return member ? [member.triggerWord ?? suggestAssetTrigger(member), ...tokens(member.name)] : [];
  });
  return distinctCandidate([...nameTokens.slice().reverse(), ...memberWords, "composition"], used)
    ?? fallbackTrigger("scene", used);
}

export function triggerTargets(assets: readonly StudioAsset[], scenes: readonly StudioScene[]) {
  const sceneMemberIds = new Set(scenes.flatMap((scene) => scene.memberIds));
  const targets: VoiceTriggerTarget[] = [];
  scenes.forEach((scene) => {
    const triggerWord = normalizeTriggerWord(scene.triggerWord ?? "");
    if (triggerWord) targets.push({ id: scene.id, kind: "scene", name: scene.name, triggerWord });
  });
  assets.forEach((asset) => {
    if (sceneMemberIds.has(asset.id)) return;
    const triggerWord = normalizeTriggerWord(asset.triggerWord ?? "");
    if (triggerWord) targets.push({ id: asset.id, kind: "asset", name: asset.name, triggerWord });
  });
  return targets;
}

function canonicalToken(value: string) {
  if (value.length > 4 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 4 && value.endsWith("es")) return value.slice(0, -2);
  if (value.length > 3 && value.endsWith("s")) return value.slice(0, -1);
  return value;
}

function phraseIncludes(transcript: string, cue: string) {
  const heard = normalizedWords(transcript).map(canonicalToken);
  const wanted = normalizeTriggerWord(cue).split(" ").map(canonicalToken);
  if (!wanted.length || heard.length < wanted.length) return false;
  return heard.some((_, start) => wanted.every((token, offset) => heard[start + offset] === token));
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function tokenScore(heard: string, wanted: string) {
  if (heard === wanted) return 1;
  if (heard[0] !== wanted[0]) return 0;
  const longest = Math.max(heard.length, wanted.length);
  const allowed = wanted.length >= 8 ? 2 : wanted.length >= 5 ? 1 : 0;
  if (!allowed) return 0;
  const distance = editDistance(heard, wanted);
  return distance <= allowed ? 1 - distance / longest : 0;
}

function fuzzyPhraseScore(transcript: string, cue: string) {
  const heard = normalizedWords(transcript).map(canonicalToken);
  const wanted = normalizeTriggerWord(cue).split(" ").map(canonicalToken).filter(Boolean);
  if (!wanted.length) return 0;

  // Whisper commonly splits a compound noun such as "dashboard" into
  // "dash board". Join adjacent heard words only for a single-word cue.
  const candidates = wanted.length === 1
    ? [...heard, ...heard.slice(0, -1).map((word, index) => `${word}${heard[index + 1]}`)]
    : [];
  if (wanted.length === 1) return Math.max(0, ...candidates.map((word) => tokenScore(word, wanted[0])));
  if (heard.length < wanted.length) return 0;

  let best = 0;
  for (let start = 0; start <= heard.length - wanted.length; start += 1) {
    const scores = wanted.map((word, offset) => tokenScore(heard[start + offset], word));
    if (scores.some((score) => score === 0)) continue;
    best = Math.max(best, scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }
  return best;
}

/**
 * Exact complete words always win. A conservative spelling fallback recovers
 * common local-transcription errors without allowing unrelated partial words.
 */
export function matchVoiceTrigger(transcript: string, targets: readonly VoiceTriggerTarget[]) {
  const exact = targets
    .filter((target) => phraseIncludes(transcript, target.triggerWord))
    .sort((a, b) => b.triggerWord.split(" ").length - a.triggerWord.split(" ").length || b.triggerWord.length - a.triggerWord.length)[0];
  if (exact) return exact;

  const fuzzy = targets
    .map((target) => ({ target, score: fuzzyPhraseScore(transcript, target.triggerWord) }))
    .filter((match) => match.score >= 0.78)
    .sort((a, b) => b.score - a.score || b.target.triggerWord.length - a.target.triggerWord.length);
  if (!fuzzy.length) return null;
  if (fuzzy[1] && fuzzy[0].score - fuzzy[1].score < 0.08) return null;
  return fuzzy[0].target;
}

export function triggerCollision(value: string, targetId: string, targets: readonly VoiceTriggerTarget[]) {
  const normalized = normalizeTriggerWord(value);
  return Boolean(normalized && targets.some((target) => target.id !== targetId && normalizeTriggerWord(target.triggerWord) === normalized));
}
