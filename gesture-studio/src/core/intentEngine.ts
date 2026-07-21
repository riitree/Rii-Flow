import { conceptWords, normalizeConceptAliases, type StudioConcept } from "./concepts";

export interface IntentCandidate {
  conceptId: string;
  displayName: string;
  matchedAlias: string;
  confidence: number;
  confirmable: boolean;
  lastMentionedAt: number;
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      diagonal = previous;
    }
  }
  return row[right.length];
}

function aliasScore(transcript: string, alias: string) {
  const heard = conceptWords(transcript);
  const wanted = conceptWords(alias);
  if (!wanted.length || !heard.length) return 0;
  const phrase = heard.join(" ");
  const cue = wanted.join(" ");
  if (` ${phrase} `.includes(` ${cue} `)) {
    const lastIndex = phrase.lastIndexOf(cue);
    return Math.min(0.99, 0.9 + lastIndex / Math.max(1, phrase.length) * 0.08 + Math.min(0.01, wanted.length * 0.004));
  }
  // Streaming speech frequently splits a compound cue ("dashboard" becomes
  // "dash board"). Compare short joined word windows before giving up on an
  // otherwise exact trigger phrase.
  const compactCue = wanted.join("");
  const maxWindow = Math.min(3, heard.length);
  let bestCompactSimilarity = 0;
  for (let size = 1; size <= maxWindow; size += 1) {
    for (let start = 0; start + size <= heard.length; start += 1) {
      const candidate = heard.slice(start, start + size).join("");
      const distance = editDistance(candidate, compactCue);
      bestCompactSimilarity = Math.max(bestCompactSimilarity, 1 - distance / Math.max(candidate.length, compactCue.length, 1));
    }
  }
  if (compactCue.length >= 5 && bestCompactSimilarity >= 0.78) {
    return Math.min(0.89, 0.7 + bestCompactSimilarity * 0.19);
  }
  if (wanted.length === 1) {
    const target = wanted[0];
    const best = Math.min(...heard.map((word) => editDistance(word, target)));
    const allowed = target.length >= 8 ? 2 : target.length >= 5 ? 1 : 0;
    if (best <= allowed) return 0.76 - best * 0.05;
  }
  const overlap = wanted.filter((word) => heard.includes(word)).length / wanted.length;
  return overlap === 1 ? 0.82 : overlap >= 0.5 ? 0.52 : 0;
}

export class IntentEngine {
  private queue: IntentCandidate[] = [];

  reset() { this.queue = []; }

  current() { return this.queue; }

  update(transcript: string, concepts: readonly StudioConcept[], now: number) {
    const previous = new Map(this.queue.map((candidate) => [candidate.conceptId, candidate]));
    const ranked = concepts.map((concept): IntentCandidate | null => {
      const aliases = normalizeConceptAliases([concept.displayName, ...concept.aliases]);
      const matches = aliases
        .map((alias) => ({ alias, score: aliasScore(transcript, alias) }))
        .sort((left, right) => right.score - left.score);
      const match = matches[0];
      const earlier = previous.get(concept.id);
      const decayed = earlier ? earlier.confidence * Math.max(0, 1 - (now - earlier.lastMentionedAt) / 8_000) : 0;
      const confidence = Math.max(match?.score ?? 0, decayed * 0.76);
      if (confidence < 0.18) return null;
      return {
        conceptId: concept.id,
        displayName: concept.displayName,
        matchedAlias: match?.score ? match.alias : earlier?.matchedAlias ?? concept.aliases[0] ?? concept.displayName,
        confidence,
        confirmable: false,
        lastMentionedAt: (match?.score ?? 0) >= 0.5 ? now : earlier?.lastMentionedAt ?? now
      };
    }).filter((candidate): candidate is IntentCandidate => Boolean(candidate))
      .sort((left, right) => right.confidence - left.confidence || right.lastMentionedAt - left.lastMentionedAt)
      .slice(0, 3);

    const top = ranked[0];
    const margin = top ? top.confidence - (ranked[1]?.confidence ?? 0) : 0;
    this.queue = ranked.map((candidate, index) => ({
      ...candidate,
      confirmable: index === 0 && candidate.confidence >= 0.72 && (ranked.length === 1 || margin >= 0.06)
    }));
    return this.queue;
  }
}
