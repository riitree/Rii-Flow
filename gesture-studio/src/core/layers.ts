export interface HiddenLayerResult {
  stack: string[];
  hiddenId: string | null;
  focusedId: string | null;
}

export interface StageHitCandidate {
  layerId: string;
  rect: { x: number; y: number; width: number; height: number };
  sceneMemberId?: string;
}

/** Returns the top-most visual candidate containing a point. Candidates follow painter order. */
export function topmostStageHit(
  candidates: readonly StageHitCandidate[],
  point: { x: number; y: number }
): StageHitCandidate | null {
  return topmostStageHitForPoints(candidates, [point]);
}

/** Finds the top-most candidate touched by any supplied control point. */
export function topmostStageHitForPoints(
  candidates: readonly StageHitCandidate[],
  points: readonly { x: number; y: number }[]
): StageHitCandidate | null {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    const { rect } = candidate;
    if (points.some((point) => (
      point.x >= rect.x
      && point.x <= rect.x + rect.width
      && point.y >= rect.y
      && point.y <= rect.y + rect.height
    ))) return candidate;
  }
  return null;
}

/** Adds a layer to the front, or raises an existing layer without duplicating it. */
export function activateLayer(stack: readonly string[], assetId: string): string[] {
  return [...stack.filter((id) => id !== assetId), assetId];
}

/** Hides the focused (front-most) layer and focuses the next visible layer. */
export function hideFocusedLayer(stack: readonly string[]): HiddenLayerResult {
  if (!stack.length) return { stack: [], hiddenId: null, focusedId: null };
  const next = stack.slice(0, -1);
  return {
    stack: next,
    hiddenId: stack[stack.length - 1] ?? null,
    focusedId: next[next.length - 1] ?? null
  };
}

/** Removes a specific asset while preserving the remaining layer order. */
export function removeLayer(stack: readonly string[], assetId: string): string[] {
  return stack.filter((id) => id !== assetId);
}
