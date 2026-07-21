export interface HiddenLayerResult {
  stack: string[];
  hiddenId: string | null;
  focusedId: string | null;
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
