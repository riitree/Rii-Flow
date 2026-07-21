export const CANVAS_ASPECTS = [
  { id: "landscape", label: "16:9", description: "Horizontal" },
  { id: "portrait", label: "9:16", description: "Vertical" }
] as const;

export type CanvasAspectId = (typeof CANVAS_ASPECTS)[number]["id"];

export interface Dimensions { width: number; height: number }
export interface SourceCrop { x: number; y: number; width: number; height: number }

export function canvasDimensions(sourceWidth: number, sourceHeight: number, aspect: CanvasAspectId): Dimensions {
  const longEdge = Math.max(1, Math.round(Math.max(sourceWidth, sourceHeight)));
  const shortEdge = Math.max(1, Math.round(longEdge * 9 / 16));
  return aspect === "portrait"
    ? { width: shortEdge, height: longEdge }
    : { width: longEdge, height: shortEdge };
}

export function coverSourceCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): SourceCrop {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / targetRatio;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}
