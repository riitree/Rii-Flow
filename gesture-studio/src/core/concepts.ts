import type { EntranceAnimation, StudioAsset, StudioScene } from "../types";

export type ConceptConfirmationGesture = "pinch";

export interface StudioConcept {
  id: string;
  displayName: string;
  aliases: string[];
  assetIds: string[];
  primaryAssetId?: string;
  confirmationGesture: ConceptConfirmationGesture;
  animation: EntranceAnimation;
  cooldownMs: number;
  sceneIds: string[];
}

const COMMON_SUFFIXES = new Set([
  "chart", "charts", "diagram", "graph", "image", "page", "photo", "screen", "screenshot",
  "slide", "still", "view", "visual", "video", "demo", "detail", "final", "new", "copy"
]);

export function conceptWords(value: string) {
  return value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeConceptAliases(values: readonly string[]) {
  return [...new Set(values
    .flatMap((value) => value.split(","))
    .map((value) => conceptWords(value).join(" "))
    .filter(Boolean))].slice(0, 8);
}

export function suggestedConceptName(asset: Pick<StudioAsset, "name" | "triggerWord">) {
  const cue = conceptWords(asset.triggerWord ?? "").filter((word) => !COMMON_SUFFIXES.has(word));
  if (cue.length) return titleCase(cue.slice(0, 2).join(" "));
  const words = conceptWords(asset.name);
  const meaningful = words.filter((word) => !COMMON_SUFFIXES.has(word) && !/^\d+$/.test(word));
  return titleCase((meaningful[0] ?? words[0] ?? "Visual"));
}

function conceptGroupKey(asset: Pick<StudioAsset, "id" | "name" | "triggerWord">) {
  const words = conceptWords(asset.triggerWord || asset.name);
  const meaningful = words.filter((word) => !COMMON_SUFFIXES.has(word) && !/^\d+$/.test(word));
  // Camera rolls and exported screenshots commonly share only generic words
  // and dates. Treating those as one Concept made every file look like the
  // first visual. Keep them separate until the creator groups them explicitly.
  return meaningful.length ? meaningful.slice(0, 2).join("-") : `asset-${asset.id}`;
}

function newConcept(id: string, displayName: string, assetIds: string[], aliases: string[], sceneIds: string[] = []): StudioConcept {
  return {
    id,
    displayName,
    aliases: normalizeConceptAliases([displayName, ...aliases]),
    assetIds,
    primaryAssetId: assetIds[0],
    confirmationGesture: "pinch",
    animation: "fade",
    cooldownMs: 650,
    sceneIds
  };
}

function legacyGenericGroup(concept: StudioConcept) {
  if (concept.sceneIds.length || concept.assetIds.length < 2 || !concept.id.startsWith("concept-")) return false;
  const words = conceptWords(concept.displayName);
  return words.length > 0 && words.every((word) => COMMON_SUFFIXES.has(word) || /^\d+$/.test(word));
}

export function deriveConcepts(assets: readonly StudioAsset[], scenes: readonly StudioScene[]) {
  const concepts: StudioConcept[] = [];
  const sceneMembers = new Set<string>();
  scenes.forEach((scene) => {
    const memberIds = scene.memberIds.filter((id) => assets.some((asset) => asset.id === id));
    if (!memberIds.length) return;
    memberIds.forEach((id) => sceneMembers.add(id));
    concepts.push(newConcept(
      `concept-scene-${scene.id}`,
      scene.name || "Composition",
      memberIds,
      [scene.triggerWord ?? ""],
      [scene.id]
    ));
  });

  const groups = new Map<string, StudioAsset[]>();
  assets.filter((asset) => !sceneMembers.has(asset.id)).forEach((asset) => {
    const key = conceptGroupKey(asset);
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  });
  groups.forEach((members, key) => {
    const first = members[0];
    const displayName = suggestedConceptName(first);
    concepts.push(newConcept(
      `concept-${key}-${first.id}`,
      displayName,
      members.map((asset) => asset.id),
      members.flatMap((asset) => [asset.triggerWord ?? "", suggestedConceptName(asset)])
    ));
  });
  return concepts;
}

export function reconcileConcepts(
  current: readonly StudioConcept[],
  assets: readonly StudioAsset[],
  scenes: readonly StudioScene[]
) {
  const assetIds = new Set(assets.map((asset) => asset.id));
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const cleaned = current.map((concept) => {
    const members = concept.assetIds.filter((id) => assetIds.has(id));
    const validScenes = concept.sceneIds.filter((id) => sceneIds.has(id));
    return {
      ...concept,
      aliases: normalizeConceptAliases([concept.displayName, ...concept.aliases]),
      assetIds: members,
      primaryAssetId: members.includes(concept.primaryAssetId ?? "") ? concept.primaryAssetId : members[0],
      confirmationGesture: "pinch" as const,
      animation: concept.animation ?? "fade",
      cooldownMs: Math.max(300, Math.min(3_000, concept.cooldownMs || 650)),
      sceneIds: validScenes
    };
  }).filter((concept) => concept.assetIds.length || concept.sceneIds.length)
    .flatMap((concept) => {
      if (!legacyGenericGroup(concept)) return [concept];
      return concept.assetIds.flatMap((assetId, index) => {
        const asset = assets.find((candidate) => candidate.id === assetId);
        if (!asset) return [];
        const suggested = suggestedConceptName(asset);
        const genericSuggested = conceptWords(suggested).every((word) => COMMON_SUFFIXES.has(word) || /^\d+$/.test(word));
        const displayName = genericSuggested ? `Visual ${index + 1}` : suggested;
        return [newConcept(
          `concept-asset-${asset.id}`,
          displayName,
          [asset.id],
          [asset.triggerWord ?? "", displayName]
        )];
      });
    });

  const assigned = new Set(cleaned.flatMap((concept) => concept.assetIds));
  const missing = assets.filter((asset) => !assigned.has(asset.id));
  if (!missing.length) return cleaned;
  return [...cleaned, ...deriveConcepts(missing, [])];
}

export function conceptLayerId(concept: StudioConcept) {
  return concept.sceneIds[0] ? `scene:${concept.sceneIds[0]}` : concept.primaryAssetId ?? concept.assetIds[0] ?? null;
}
