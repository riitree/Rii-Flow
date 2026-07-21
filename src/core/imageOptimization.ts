export const MAX_COMPOSITION_IMAGE_EDGE = 4096;

export function compositionImageSize(width: number, height: number, maxEdge = MAX_COMPOSITION_IMAGE_EDGE) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const scale = Math.min(1, maxEdge / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    optimized: scale < 1
  };
}
