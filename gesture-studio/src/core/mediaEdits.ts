import type { ImageCrop, ImageCropAspect, VideoTrim } from "../types";

export const MIN_VIDEO_TRIM_SECONDS = 0.25;

const CROP_RATIOS: Record<Exclude<ImageCropAspect, "free">, number> = {
  "1:1": 1,
  "16:9": 16 / 9,
  "9:16": 9 / 16
};

export type CropCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type LegacyImageCrop = Omit<Partial<ImageCrop>, "aspect"> & {
  aspect?: ImageCropAspect | "4:5";
  focusX?: number;
  focusY?: number;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function cropRectForRatio(targetRatio: number, sourceWidth: number, sourceHeight: number, focusX = 0.5, focusY = 0.5) {
  const sourceRatio = Math.max(0.0001, sourceWidth) / Math.max(0.0001, sourceHeight);
  if (sourceRatio > targetRatio) {
    const width = targetRatio / sourceRatio;
    return { x: (1 - width) * clamp(focusX, 0, 1), y: 0, width, height: 1 };
  }
  const height = sourceRatio / targetRatio;
  return { x: 0, y: (1 - height) * clamp(focusY, 0, 1), width: 1, height };
}

export function normalizeImageCrop(crop: LegacyImageCrop | undefined, sourceWidth = 1, sourceHeight = 1): ImageCrop | undefined {
  if (!crop) return undefined;
  const inputAspect = crop.aspect;
  const aspect: ImageCropAspect | null = inputAspect === "free" || inputAspect === "1:1" || inputAspect === "16:9" || inputAspect === "9:16"
    ? inputAspect
    : inputAspect === "4:5" ? "free" : null;
  if (!aspect) return undefined;

  if (![crop.x, crop.y, crop.width, crop.height].every((value) => Number.isFinite(value))) {
    const legacyRatio = inputAspect === "4:5" ? 4 / 5 : inputAspect && inputAspect !== "free" ? CROP_RATIOS[inputAspect] : null;
    if (legacyRatio) {
      return {
        aspect,
        ...cropRectForRatio(legacyRatio, sourceWidth, sourceHeight, crop.focusX ?? 0.5, crop.focusY ?? 0.5)
      };
    }
    return { aspect: "free", x: 0.06, y: 0.06, width: 0.88, height: 0.88 };
  }

  const minimum = 0.025;
  const x = clamp(Number(crop.x), 0, 1 - minimum);
  const y = clamp(Number(crop.y), 0, 1 - minimum);
  const width = clamp(Number(crop.width), minimum, 1 - x);
  const height = clamp(Number(crop.height), minimum, 1 - y);
  return {
    aspect,
    x,
    y,
    width,
    height
  };
}

export function cropAspectRatio(aspect: ImageCropAspect) {
  return aspect === "free" ? null : CROP_RATIOS[aspect];
}

export function fitImageCropToAspect(
  aspect: ImageCropAspect,
  sourceWidth: number,
  sourceHeight: number,
  current?: LegacyImageCrop
): ImageCrop {
  const normalized = normalizeImageCrop(current, sourceWidth, sourceHeight);
  if (aspect === "free") {
    return normalized
      ? { ...normalized, aspect }
      : { aspect, x: 0.06, y: 0.06, width: 0.88, height: 0.88 };
  }

  const bounds = normalized ?? { aspect, x: 0, y: 0, width: 1, height: 1 };
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const normalizedRatio = CROP_RATIOS[aspect] / (Math.max(0.0001, sourceWidth) / Math.max(0.0001, sourceHeight));
  let width = Math.min(bounds.width, bounds.height * normalizedRatio);
  let height = width / normalizedRatio;
  if (height > bounds.height) {
    height = bounds.height;
    width = height * normalizedRatio;
  }
  const x = clamp(centerX - width / 2, 0, 1 - width);
  const y = clamp(centerY - height / 2, 0, 1 - height);
  return normalizeImageCrop({ aspect, x, y, width, height }, sourceWidth, sourceHeight)!;
}

export function moveImageCrop(crop: ImageCrop, deltaX: number, deltaY: number): ImageCrop {
  const normalized = normalizeImageCrop(crop)!;
  return {
    ...normalized,
    x: clamp(normalized.x + deltaX, 0, 1 - normalized.width),
    y: clamp(normalized.y + deltaY, 0, 1 - normalized.height)
  };
}

export function resizeImageCropFromCorner(
  crop: ImageCrop,
  corner: CropCorner,
  pointerX: number,
  pointerY: number,
  sourceWidth: number,
  sourceHeight: number
): ImageCrop {
  const normalized = normalizeImageCrop(crop, sourceWidth, sourceHeight)!;
  const left = corner.endsWith("left");
  const top = corner.startsWith("top");
  const anchorX = left ? normalized.x + normalized.width : normalized.x;
  const anchorY = top ? normalized.y + normalized.height : normalized.y;
  const maxWidth = left ? anchorX : 1 - anchorX;
  const maxHeight = top ? anchorY : 1 - anchorY;
  const desiredWidth = Math.abs(clamp(pointerX, 0, 1) - anchorX);
  const desiredHeight = Math.abs(clamp(pointerY, 0, 1) - anchorY);
  const minimum = 0.04;

  let width: number;
  let height: number;
  const ratio = cropAspectRatio(normalized.aspect);
  if (ratio) {
    const normalizedRatio = ratio / (Math.max(0.0001, sourceWidth) / Math.max(0.0001, sourceHeight));
    const maxRatioWidth = Math.min(maxWidth, maxHeight * normalizedRatio);
    const minimumWidth = Math.min(maxRatioWidth, Math.max(minimum, minimum * normalizedRatio));
    width = clamp(Math.max(desiredWidth, desiredHeight * normalizedRatio), minimumWidth, maxRatioWidth);
    height = width / normalizedRatio;
  } else {
    width = clamp(desiredWidth, Math.min(minimum, maxWidth), maxWidth);
    height = clamp(desiredHeight, Math.min(minimum, maxHeight), maxHeight);
  }

  return normalizeImageCrop({
    aspect: normalized.aspect,
    x: left ? anchorX - width : anchorX,
    y: top ? anchorY - height : anchorY,
    width,
    height
  }, sourceWidth, sourceHeight)!;
}

export function imageCropSourceRect(sourceWidth: number, sourceHeight: number, crop?: ImageCrop) {
  const safeWidth = Math.max(1, sourceWidth);
  const safeHeight = Math.max(1, sourceHeight);
  const normalized = normalizeImageCrop(crop as LegacyImageCrop | undefined, safeWidth, safeHeight);
  if (!normalized) return { x: 0, y: 0, width: safeWidth, height: safeHeight };
  return {
    x: normalized.x * safeWidth,
    y: normalized.y * safeHeight,
    width: normalized.width * safeWidth,
    height: normalized.height * safeHeight
  };
}

export function normalizeVideoTrim(trim: Partial<VideoTrim> | undefined, duration: number): VideoTrim {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  if (!safeDuration) return { start: 0, end: 0 };
  const minimumSpan = Math.min(MIN_VIDEO_TRIM_SECONDS, safeDuration);
  const requestedStart = Number.isFinite(trim?.start) ? Number(trim?.start) : 0;
  const requestedEnd = Number.isFinite(trim?.end) ? Number(trim?.end) : safeDuration;
  const start = clamp(requestedStart, 0, Math.max(0, safeDuration - minimumSpan));
  const end = clamp(requestedEnd, start + minimumSpan, safeDuration);
  return { start, end };
}

export function moveVideoTrimHandle(
  trim: Partial<VideoTrim> | undefined,
  handle: "start" | "end",
  value: number,
  duration: number
): VideoTrim {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const current = normalizeVideoTrim(trim, safeDuration);
  if (!safeDuration) return current;
  const minimumSpan = Math.min(MIN_VIDEO_TRIM_SECONDS, safeDuration);
  if (handle === "start") {
    return {
      start: clamp(Number.isFinite(value) ? value : current.start, 0, Math.max(0, current.end - minimumSpan)),
      end: current.end
    };
  }
  return {
    start: current.start,
    end: clamp(Number.isFinite(value) ? value : current.end, Math.min(safeDuration, current.start + minimumSpan), safeDuration)
  };
}

export function hasVideoTrim(trim: Partial<VideoTrim> | undefined, duration: number, tolerance = 0.025) {
  if (!trim || !Number.isFinite(duration) || duration <= 0) return false;
  const normalized = normalizeVideoTrim(trim, duration);
  return normalized.start > tolerance || normalized.end < duration - tolerance;
}
