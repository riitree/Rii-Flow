import type { AssetKind, AssetSize, AssetTransform, DataRow, EntranceAnimation, Placement, ScreenOverlaySettings, StageBackground, StudioAsset, StudioLayer, StudioScene } from "../types";
import { coverSourceCrop } from "./aspect";
import { cameraFrameColor, cameraFrameViewport, DEFAULT_CAMERA_FRAME, normalizeCameraFrame, type CameraFrameSettings } from "./cameraFrame";
import { imageCropSourceRect } from "./mediaEdits";

export interface AssetMedia {
  images: Map<string, HTMLImageElement>;
  videos: Map<string, HTMLVideoElement>;
}

export interface Rect { x: number; y: number; width: number; height: number }
export type CameraCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type CameraEdge = "top" | "right" | "bottom" | "left";
export type CameraSnapTarget = CameraCorner | CameraEdge;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function sizeBounds(canvasWidth: number, canvasHeight: number, size: AssetSize, kind: AssetKind) {
  if (size === "full") return { width: canvasWidth, height: canvasHeight };
  if (size === "medium") return { width: canvasWidth * 0.5, height: canvasHeight * 0.58 };
  return kind === "csv" || kind === "json"
    ? { width: canvasWidth * 0.34, height: canvasHeight * 0.3 }
    : { width: canvasWidth * 0.28, height: canvasHeight * 0.32 };
}

function positionRect(canvasWidth: number, canvasHeight: number, width: number, height: number, placement: Placement): Rect {
  const margin = Math.max(16, Math.min(canvasWidth, canvasHeight) * 0.035);
  const centeredX = (canvasWidth - width) / 2;
  const centeredY = (canvasHeight - height) / 2;
  switch (placement) {
    case "left": return { x: margin, y: centeredY, width, height };
    case "right": return { x: canvasWidth - margin - width, y: centeredY, width, height };
    case "corner": return { x: canvasWidth - margin - width, y: margin, width, height };
    case "lower": return { x: centeredX, y: canvasHeight - margin - height, width, height };
    case "center": return { x: centeredX, y: centeredY, width, height };
  }
}

export function presetMediaRect(
  canvasWidth: number,
  canvasHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  placement: Placement,
  size: AssetSize
): Rect {
  const bounds = sizeBounds(canvasWidth, canvasHeight, size, "image");
  const scale = Math.min(bounds.width / sourceWidth, bounds.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return positionRect(canvasWidth, canvasHeight, width, height, size === "full" ? "center" : placement);
}

export function screenOverlayBaseRect(
  canvasWidth: number,
  canvasHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  settings: ScreenOverlaySettings
) {
  return presetMediaRect(canvasWidth, canvasHeight, sourceWidth, sourceHeight, settings.placement, settings.size);
}

export function screenOverlayDisplayRect(
  canvasWidth: number,
  canvasHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  settings: ScreenOverlaySettings
) {
  return applyAssetTransform(
    canvasWidth,
    canvasHeight,
    screenOverlayBaseRect(canvasWidth, canvasHeight, sourceWidth, sourceHeight, settings),
    settings.transform
  );
}

export function baseAssetRect(
  canvasWidth: number,
  canvasHeight: number,
  asset: StudioAsset,
  sourceWidth?: number,
  sourceHeight?: number
): Rect {
  if (asset.kind === "csv" || asset.kind === "json") {
    const bounds = sizeBounds(canvasWidth, canvasHeight, asset.size, asset.kind);
    return positionRect(canvasWidth, canvasHeight, bounds.width, bounds.height, asset.size === "full" ? "center" : asset.placement);
  }
  if (!sourceWidth || !sourceHeight) {
    const bounds = sizeBounds(canvasWidth, canvasHeight, asset.size, asset.kind);
    return positionRect(canvasWidth, canvasHeight, bounds.width, bounds.height, asset.size === "full" ? "center" : asset.placement);
  }
  const sourceRect = asset.kind === "image"
    ? imageCropSourceRect(sourceWidth, sourceHeight, asset.imageCrop)
    : { width: sourceWidth, height: sourceHeight };
  return presetMediaRect(canvasWidth, canvasHeight, sourceRect.width, sourceRect.height, asset.placement, asset.size);
}

export function constrainAssetTransform(
  canvasWidth: number,
  canvasHeight: number,
  base: Rect,
  transform: AssetTransform
): AssetTransform {
  const minimumScale = 0.15;
  const maximumScale = Math.max(minimumScale, Math.min(4, canvasWidth / base.width, canvasHeight / base.height));
  const scale = clamp(transform.scale, minimumScale, maximumScale);
  const halfWidth = (base.width * scale) / canvasWidth / 2;
  const halfHeight = (base.height * scale) / canvasHeight / 2;
  const x = halfWidth >= 0.5 ? 0.5 : clamp(transform.x, halfWidth, 1 - halfWidth);
  const y = halfHeight >= 0.5 ? 0.5 : clamp(transform.y, halfHeight, 1 - halfHeight);
  return { x, y, scale };
}

export function applyAssetTransform(
  canvasWidth: number,
  canvasHeight: number,
  base: Rect,
  transform?: AssetTransform
): Rect {
  if (!transform) return base;
  const safe = constrainAssetTransform(canvasWidth, canvasHeight, base, transform);
  const width = base.width * safe.scale;
  const height = base.height * safe.scale;
  return {
    x: safe.x * canvasWidth - width / 2,
    y: safe.y * canvasHeight - height / 2,
    width,
    height
  };
}

/** Snaps a dragged overlay to the camera image border, which may be inset from
 * the recording canvas by a decorative camera frame. Corners take priority;
 * otherwise only the nearby axis is snapped so the overlay remains free to
 * travel along that edge. */
export function snapTransformToCameraBorder(
  canvasWidth: number,
  canvasHeight: number,
  base: Rect,
  transform: AssetTransform,
  cameraViewport: Rect,
  thresholdRatio = 0.0275
): { transform: AssetTransform; target: CameraSnapTarget | null } {
  const safe = constrainAssetTransform(canvasWidth, canvasHeight, base, transform);
  const rect = applyAssetTransform(canvasWidth, canvasHeight, base, safe);
  if (rect.width > cameraViewport.width + 1 || rect.height > cameraViewport.height + 1) return { transform: safe, target: null };

  const threshold = Math.max(18, Math.min(cameraViewport.width, cameraViewport.height) * thresholdRatio);
  const edges = {
    left: Math.abs(rect.x - cameraViewport.x),
    right: Math.abs(rect.x + rect.width - (cameraViewport.x + cameraViewport.width)),
    top: Math.abs(rect.y - cameraViewport.y),
    bottom: Math.abs(rect.y + rect.height - (cameraViewport.y + cameraViewport.height))
  };
  const horizontal = edges.left <= edges.right
    ? { target: "left" as const, distance: edges.left, x: cameraViewport.x }
    : { target: "right" as const, distance: edges.right, x: cameraViewport.x + cameraViewport.width - rect.width };
  const vertical = edges.top <= edges.bottom
    ? { target: "top" as const, distance: edges.top, y: cameraViewport.y }
    : { target: "bottom" as const, distance: edges.bottom, y: cameraViewport.y + cameraViewport.height - rect.height };

  const horizontalSnaps = horizontal.distance <= threshold;
  const verticalSnaps = vertical.distance <= threshold;
  if (!horizontalSnaps && !verticalSnaps) return { transform: safe, target: null };

  const target: CameraSnapTarget = horizontalSnaps && verticalSnaps
    ? `${vertical.target}-${horizontal.target}` as CameraCorner
    : horizontalSnaps ? horizontal.target : vertical.target;
  const freeX = clamp(rect.x, cameraViewport.x, cameraViewport.x + cameraViewport.width - rect.width);
  const freeY = clamp(rect.y, cameraViewport.y, cameraViewport.y + cameraViewport.height - rect.height);
  const x = horizontalSnaps ? horizontal.x : freeX;
  const y = verticalSnaps ? vertical.y : freeY;

  return {
    target,
    transform: constrainAssetTransform(canvasWidth, canvasHeight, base, {
      x: (x + rect.width / 2) / canvasWidth,
      y: (y + rect.height / 2) / canvasHeight,
      scale: safe.scale
    })
  };
}

export function assetDisplayRect(
  canvasWidth: number,
  canvasHeight: number,
  asset: StudioAsset,
  sourceWidth?: number,
  sourceHeight?: number
) {
  const base = baseAssetRect(canvasWidth, canvasHeight, asset, sourceWidth, sourceHeight);
  return applyAssetTransform(canvasWidth, canvasHeight, base, asset.transform);
}

export function snappedAssetSize(canvasWidth: number, canvasHeight: number, rect: Rect): AssetSize | null {
  const coverage = Math.max(rect.width / canvasWidth, rect.height / canvasHeight);
  if (coverage >= 0.8) return "full";
  return null;
}

/** Magnetic snap around the scene template's native 100% scale. */
export function snapScaleToTemplate(scale: number, threshold = 0.08) {
  return Math.abs(scale - 1) <= threshold + 1e-9 ? 1 : scale;
}

function sceneAspect(scene: StudioScene) {
  const count = Math.max(1, scene.memberIds.length);
  if (scene.layout === "row") return Math.min(4, count * 1.15);
  if (scene.layout === "column") return Math.max(0.42, 0.9 / Math.min(4, count));
  if (scene.layout === "spotlight") return 1.6;
  if (scene.layout === "cascade") return 1.3;
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return (columns / rows) * 1.25;
}

export function sceneBaseRect(canvasWidth: number, canvasHeight: number, scene: StudioScene): Rect {
  const fraction = scene.size === "full" ? 1 : scene.size === "medium" ? 0.68 : 0.44;
  const heightFraction = scene.size === "full" ? 1 : scene.size === "medium" ? 0.7 : 0.46;
  const aspect = sceneAspect(scene);
  const maximumWidth = canvasWidth * fraction;
  const maximumHeight = canvasHeight * heightFraction;
  let width = maximumWidth;
  let height = width / aspect;
  if (height > maximumHeight) {
    height = maximumHeight;
    width = height * aspect;
  }
  return positionRect(canvasWidth, canvasHeight, width, height, scene.size === "full" ? "center" : scene.placement);
}

export function sceneDisplayRect(canvasWidth: number, canvasHeight: number, scene: StudioScene) {
  const base = sceneBaseRect(canvasWidth, canvasHeight, scene);
  return applyAssetTransform(canvasWidth, canvasHeight, base, scene.transform);
}

export function sceneMemberRects(scene: StudioScene, rect: Rect): Rect[] {
  const count = Math.max(1, scene.memberIds.length);
  const gap = Math.max(2, Math.min(rect.width, rect.height) * 0.025);

  if (scene.layout === "spotlight" && count > 1) {
    const railWidth = rect.width * 0.34;
    const heroWidth = rect.width - railWidth - gap;
    const railHeight = (rect.height - gap * (count - 2)) / (count - 1);
    return [
      { x: rect.x, y: rect.y, width: heroWidth, height: rect.height },
      ...Array.from({ length: count - 1 }, (_, index) => ({
        x: rect.x + heroWidth + gap,
        y: rect.y + index * (railHeight + gap),
        width: railWidth,
        height: railHeight
      }))
    ];
  }

  if (scene.layout === "cascade" && count > 1) {
    const offsetX = Math.min(rect.width * 0.07, rect.width * 0.22 / (count - 1));
    const offsetY = Math.min(rect.height * 0.07, rect.height * 0.22 / (count - 1));
    const width = rect.width - offsetX * (count - 1);
    const height = rect.height - offsetY * (count - 1);
    return Array.from({ length: count }, (_, index) => ({
      x: rect.x + index * offsetX,
      y: rect.y + index * offsetY,
      width,
      height
    }));
  }

  let columns = 1;
  let rows = count;
  if (scene.layout === "row") {
    columns = count;
    rows = 1;
  } else if (scene.layout === "grid") {
    columns = Math.ceil(Math.sqrt(count));
    rows = Math.ceil(count / columns);
  }
  const cellWidth = (rect.width - gap * (columns - 1)) / columns;
  const cellHeight = (rect.height - gap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, index) => ({
    x: rect.x + (index % columns) * (cellWidth + gap),
    y: rect.y + Math.floor(index / columns) * (cellHeight + gap),
    width: cellWidth,
    height: cellHeight
  }));
}

/** The template defines each member's available slot, while the returned rect
 * follows the source aspect ratio so selection and manipulation hug the media. */
export function sceneMemberContentRects(
  scene: StudioScene,
  groupRect: Rect,
  assets: readonly StudioAsset[],
  media: AssetMedia
): Rect[] {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  return sceneMemberRects(scene, groupRect).map((slot, index) => {
    const asset = assetById.get(scene.memberIds[index]);
    if (!asset || asset.kind === "csv" || asset.kind === "json") return slot;
    const image = asset.kind === "image" ? media.images.get(asset.id) : undefined;
    const video = asset.kind === "video" ? media.videos.get(asset.id) : undefined;
    const sourceWidth = image?.naturalWidth ?? video?.videoWidth ?? 0;
    const sourceHeight = image?.naturalHeight ?? video?.videoHeight ?? 0;
    if (sourceWidth <= 0 || sourceHeight <= 0) return slot;
    const sourceRect = asset.kind === "image"
      ? imageCropSourceRect(sourceWidth, sourceHeight, asset.imageCrop)
      : { width: sourceWidth, height: sourceHeight };
    return containRect(slot, sourceRect.width, sourceRect.height);
  });
}

/** Member transforms use scene-relative centres so whole-scene mouse movement
 * carries every customised member with it. Scale remains relative to its
 * aspect-fitted media bounds. */
export function sceneMemberDisplayRects(scene: StudioScene, groupRect: Rect, baseRects = sceneMemberRects(scene, groupRect)): Rect[] {
  return baseRects.map((base, index) => {
    const memberId = scene.memberIds[index];
    const transform = memberId ? scene.memberTransforms?.[memberId] : undefined;
    if (!transform) return base;
    const scale = clamp(transform.scale, 0.15, 4);
    const width = base.width * scale;
    const height = base.height * scale;
    return {
      x: groupRect.x + transform.x * groupRect.width - width / 2,
      y: groupRect.y + transform.y * groupRect.height - height / 2,
      width,
      height
    };
  });
}

export function sceneMemberCanvasTransform(
  canvasWidth: number,
  canvasHeight: number,
  groupRect: Rect,
  baseRect: Rect,
  transform?: AssetTransform
): AssetTransform {
  if (!transform) return {
    x: (baseRect.x + baseRect.width / 2) / canvasWidth,
    y: (baseRect.y + baseRect.height / 2) / canvasHeight,
    scale: 1
  };
  return {
    x: (groupRect.x + transform.x * groupRect.width) / canvasWidth,
    y: (groupRect.y + transform.y * groupRect.height) / canvasHeight,
    scale: transform.scale
  };
}

export function sceneMemberRelativeTransform(
  canvasWidth: number,
  canvasHeight: number,
  groupRect: Rect,
  transform: AssetTransform
): AssetTransform {
  return {
    x: (transform.x * canvasWidth - groupRect.x) / Math.max(1, groupRect.width),
    y: (transform.y * canvasHeight - groupRect.y) / Math.max(1, groupRect.height),
    scale: transform.scale
  };
}

export function sceneMemberDrawOrder(scene: StudioScene) {
  const valid = new Set(scene.memberIds);
  const ordered = (scene.memberOrder ?? []).filter((id, index, list) => valid.has(id) && list.indexOf(id) === index);
  scene.memberIds.forEach((id) => { if (!ordered.includes(id)) ordered.push(id); });
  return ordered;
}

function drawChart(context: CanvasRenderingContext2D, rows: DataRow[], columns: string[], rect: Rect, padding: number, fontSize: number, light: boolean) {
  const numeric = columns.find((column) => rows.some((row) => typeof row[column] === "number"));
  if (!numeric) return false;
  const label = columns.find((column) => column !== numeric) ?? columns[0];
  const sample = rows.slice(0, 7);
  const values = sample.map((row) => Number(row[numeric]) || 0);
  const maximum = Math.max(...values.map(Math.abs), 1);
  const rowHeight = (rect.height - padding * 2) / sample.length;
  const labelWidth = rect.width * 0.26;
  sample.forEach((row, index) => {
    const y = rect.y + padding + index * rowHeight + rowHeight / 2;
    context.font = `600 ${fontSize}px system-ui`;
    context.fillStyle = light ? "#34313b" : "#dce5e9";
    context.textAlign = "left";
    context.fillText(String(row[label] ?? index + 1).slice(0, 18), rect.x + padding, y, labelWidth - padding);
    const barX = rect.x + padding + labelWidth;
    const maxWidth = rect.width - padding * 2 - labelWidth;
    context.fillStyle = light ? "rgba(37,99,235,.12)" : "rgba(96,165,250,.18)";
    context.fillRect(barX, y - rowHeight * 0.22, maxWidth, rowHeight * 0.44);
    context.fillStyle = light ? "#2563eb" : "#60a5fa";
    context.fillRect(barX, y - rowHeight * 0.22, (Math.abs(values[index]) / maximum) * maxWidth, rowHeight * 0.44);
    context.fillStyle = light ? "#17151c" : "#ffffff";
    context.textAlign = "right";
    context.fillText(String(values[index]), rect.x + rect.width - padding, y);
  });
  return true;
}

function drawData(context: CanvasRenderingContext2D, asset: StudioAsset, rect: Rect) {
  const rows = asset.rows ?? [];
  const light = asset.stageBackground === "white" || asset.stageBackground === "cream";
  const radius = Math.max(10, rect.height * 0.045);
  context.save();
  context.fillStyle = light ? "rgba(255,255,255,.94)" : "rgba(13,18,22,.92)";
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
  context.fill();
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
  context.clip();
  const padding = Math.max(18, rect.width * 0.03);
  const fontSize = Math.max(14, Math.min(rect.width / 34, rect.height / 11));
  const columns = Object.keys(rows[0] ?? {}).slice(0, 4);
  context.textBaseline = "middle";
  if (asset.dataView === "chart" && drawChart(context, rows, columns, rect, padding, fontSize, light)) {
    context.restore();
    return;
  }
  const visible = rows.slice(0, 6);
  const cellWidth = (rect.width - padding * 2) / Math.max(columns.length, 1);
  const rowHeight = (rect.height - padding * 2) / Math.max(visible.length + 1, 1);
  context.font = `700 ${fontSize}px system-ui`;
  columns.forEach((column, index) => {
    context.fillStyle = light ? "#1d4ed8" : "#60a5fa";
    context.fillText(column.slice(0, 18), rect.x + padding + index * cellWidth, rect.y + padding + rowHeight / 2, cellWidth - 10);
  });
  context.font = `500 ${fontSize}px system-ui`;
  visible.forEach((row, rowIndex) => {
    const y = rect.y + padding + (rowIndex + 1) * rowHeight;
    context.strokeStyle = light ? "rgba(32,27,42,.12)" : "rgba(255,255,255,.09)";
    context.beginPath();
    context.moveTo(rect.x + padding, y);
    context.lineTo(rect.x + rect.width - padding, y);
    context.stroke();
    columns.forEach((column, columnIndex) => {
      context.fillStyle = light ? "#24212b" : "#edf2f4";
      context.fillText(String(row[column] ?? "").slice(0, 24), rect.x + padding + columnIndex * cellWidth, y + rowHeight / 2, cellWidth - 10);
    });
  });
  context.restore();
}

const dataSurfaceCache = new WeakMap<DataRow[], Map<string, HTMLCanvasElement>>();

/** Rasterizes static CSV/JSON cards once per output size instead of rebuilding
 * every cell, line and label on every recording frame. */
function drawCachedData(context: CanvasRenderingContext2D, asset: StudioAsset, rect: Rect) {
  const rows = asset.rows;
  if (!rows || typeof document === "undefined") {
    drawData(context, asset, rect);
    return;
  }
  const width = Math.max(1, Math.round(rect.width / 4) * 4);
  const height = Math.max(1, Math.round(rect.height / 4) * 4);
  const key = `${asset.dataView}|${asset.stageBackground ?? "camera"}|${width}x${height}`;
  let surfaces = dataSurfaceCache.get(rows);
  if (!surfaces) {
    surfaces = new Map();
    dataSurfaceCache.set(rows, surfaces);
  }
  let surface = surfaces.get(key);
  if (!surface) {
    surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    const surfaceContext = surface.getContext("2d");
    if (!surfaceContext) {
      drawData(context, asset, rect);
      return;
    }
    drawData(surfaceContext, asset, { x: 0, y: 0, width, height });
    surfaces.set(key, surface);
    while (surfaces.size > 4) surfaces.delete(surfaces.keys().next().value!);
  }
  context.drawImage(surface, rect.x, rect.y, rect.width, rect.height);
}

function drawMedia(context: CanvasRenderingContext2D, asset: StudioAsset, canvas: HTMLCanvasElement, media: AssetMedia) {
  if (asset.kind === "csv" || asset.kind === "json") {
    drawCachedData(context, asset, assetDisplayRect(canvas.width, canvas.height, asset));
    return;
  }
  const source = asset.kind === "image" ? media.images.get(asset.id) : media.videos.get(asset.id);
  if (!source) return;
  const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth;
  const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight;
  if (!sourceWidth || !sourceHeight) return;
  const output = assetDisplayRect(canvas.width, canvas.height, asset, sourceWidth, sourceHeight);
  const crop = asset.kind === "image" ? imageCropSourceRect(sourceWidth, sourceHeight, asset.imageCrop) : null;
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (crop) context.drawImage(source, crop.x, crop.y, crop.width, crop.height, output.x, output.y, output.width, output.height);
  else context.drawImage(source, output.x, output.y, output.width, output.height);
  context.restore();
}

function containRect(container: Rect, sourceWidth: number, sourceHeight: number): Rect {
  const scale = Math.min(container.width / sourceWidth, container.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: container.x + (container.width - width) / 2, y: container.y + (container.height - height) / 2, width, height };
}

function drawMediaInRect(context: CanvasRenderingContext2D, asset: StudioAsset, rect: Rect, media: AssetMedia) {
  if (asset.kind === "csv" || asset.kind === "json") {
    drawCachedData(context, asset, rect);
    return;
  }
  const source = asset.kind === "image" ? media.images.get(asset.id) : media.videos.get(asset.id);
  if (!source) return;
  const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth;
  const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight;
  if (!sourceWidth || !sourceHeight) return;
  const crop = asset.kind === "image" ? imageCropSourceRect(sourceWidth, sourceHeight, asset.imageCrop) : null;
  const output = containRect(rect, crop?.width ?? sourceWidth, crop?.height ?? sourceHeight);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (crop) context.drawImage(source, crop.x, crop.y, crop.width, crop.height, output.x, output.y, output.width, output.height);
  else context.drawImage(source, output.x, output.y, output.width, output.height);
  context.restore();
}

export function entranceAnimationFrame(animation: EntranceAnimation | undefined, elapsedMs: number, durationMs = 420) {
  const settled = { alpha: 1, scale: 1, translateY: 0 };
  if (!Number.isFinite(elapsedMs) || !animation || animation === "none") return settled;
  if (animation === "float" && elapsedMs >= durationMs) {
    const cycle = ((elapsedMs - durationMs) / 1500) * Math.PI * 2;
    return { alpha: 1, scale: 1, translateY: Math.sin(cycle) * 0.007 };
  }
  if (elapsedMs >= durationMs) return settled;
  const linear = clamp(elapsedMs / durationMs, 0, 1);
  const eased = 1 - Math.pow(1 - linear, 3);
  if (animation === "fade") return { alpha: eased, scale: 1, translateY: 0 };
  if (animation === "slide") return { alpha: eased, scale: 1, translateY: (1 - eased) * 0.08 };
  if (animation === "float") return { alpha: eased, scale: 0.98 + eased * 0.02, translateY: (1 - eased) * 0.06 };
  if (animation === "bounce") {
    const overshoot = 1.70158;
    const back = 1 + (overshoot + 1) * Math.pow(linear - 1, 3) + overshoot * Math.pow(linear - 1, 2);
    return { alpha: eased, scale: 0.72 + back * 0.28, translateY: 0 };
  }
  return { alpha: eased, scale: 0.82 + eased * 0.18, translateY: 0 };
}

function layerBounds(layer: StudioLayer, canvas: HTMLCanvasElement, media: AssetMedia) {
  if (layer.kind === "scene") return sceneDisplayRect(canvas.width, canvas.height, layer.scene);
  const source = layer.asset.kind === "image" ? media.images.get(layer.asset.id) : layer.asset.kind === "video" ? media.videos.get(layer.asset.id) : null;
  const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : undefined;
  const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : undefined;
  return assetDisplayRect(canvas.width, canvas.height, layer.asset, sourceWidth, sourceHeight);
}

function drawLayer(context: CanvasRenderingContext2D, layer: StudioLayer, canvas: HTMLCanvasElement, media: AssetMedia, activatedAt: number, now: number, soloAssetId?: string) {
  const animation = layer.kind === "asset" ? layer.asset.entranceAnimation : layer.scene.entranceAnimation;
  const frame = entranceAnimationFrame(animation, Math.max(0, now - activatedAt));
  const bounds = layerBounds(layer, canvas, media);
  context.save();
  context.globalAlpha *= frame.alpha;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  context.translate(centerX, centerY + frame.translateY * canvas.height);
  context.scale(frame.scale, frame.scale);
  context.translate(-centerX, -centerY);
  if (layer.kind === "asset") {
    drawMedia(context, layer.asset, canvas, media);
    context.restore();
    return;
  }
  const groupRect = sceneDisplayRect(canvas.width, canvas.height, layer.scene);
  const memberBases = sceneMemberContentRects(layer.scene, groupRect, layer.assets, media);
  const memberRects = sceneMemberDisplayRects(layer.scene, groupRect, memberBases);
  const rectById = new Map(layer.scene.memberIds.map((id, index) => [id, memberRects[index]]));
  if (soloAssetId) {
    const solo = layer.assets.find((asset) => asset.id === soloAssetId);
    const soloRect = rectById.get(soloAssetId);
    if (solo && soloRect) drawMediaInRect(context, solo, soloRect, media);
    context.restore();
    return;
  }
  const assetById = new Map(layer.assets.map((asset) => [asset.id, asset]));
  sceneMemberDrawOrder(layer.scene).forEach((id) => {
    const asset = assetById.get(id);
    const rect = rectById.get(id);
    if (asset && rect) drawMediaInRect(context, asset, rect, media);
  });
  context.restore();
}

export interface StageBackdrop {
  mode: StageBackground;
  color?: string;
}

function configuredStageBackdrop(stageBackground?: StageBackground, stageBackgroundColor?: string): StageBackdrop {
  const mode = stageBackground ?? "camera";
  if (mode === "camera") return { mode };
  if (mode === "white") return { mode, color: "#ffffff" };
  if (mode === "cream") return { mode, color: "#f5f0e6" };
  if (mode === "custom") {
    const custom = stageBackgroundColor;
    return { mode, color: custom && /^#[0-9a-f]{6}$/i.test(custom) ? custom : "#111111" };
  }
  return { mode: "black", color: "#050505" };
}

export function stageBackdropForLayers(liveLayers: readonly StudioLayer[]): StageBackdrop {
  const layer = liveLayers[liveLayers.length - 1];
  if (!layer) return { mode: "camera" };
  if (layer.kind === "asset") return configuredStageBackdrop(layer.asset.stageBackground, layer.asset.stageBackgroundColor);
  return configuredStageBackdrop(layer.scene.stageBackground, layer.scene.stageBackgroundColor);
}

export function composeFrame(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  camera: HTMLVideoElement,
  liveLayers: readonly StudioLayer[],
  media: AssetMedia,
  activatedAt: number,
  now: number,
  mirrorCamera = false,
  cameraFrame: CameraFrameSettings = DEFAULT_CAMERA_FRAME,
  sceneSolo: Readonly<Record<string, string>> = {},
  screen: HTMLVideoElement | null = null,
  screenOverlay: ScreenOverlaySettings | null = null
) {
  const backdrop = stageBackdropForLayers(liveLayers);
  const normalizedCameraFrame = normalizeCameraFrame(cameraFrame);
  context.fillStyle = backdrop.color ?? (!normalizedCameraFrame.enabled ? "#060809" : cameraFrameColor(normalizedCameraFrame));
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (backdrop.mode === "camera" && camera.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const crop = coverSourceCrop(camera.videoWidth || canvas.width, camera.videoHeight || canvas.height, canvas.width, canvas.height);
      const viewport = cameraFrameViewport(canvas.width, canvas.height, normalizedCameraFrame);
      context.save();
      if (mirrorCamera) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(camera, crop.x, crop.y, crop.width, crop.height, viewport.x, viewport.y, viewport.width, viewport.height);
      context.restore();
  }
  if (screen && screenOverlay?.visible && screen.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    const output = screenOverlayDisplayRect(canvas.width, canvas.height, screen.videoWidth || canvas.width, screen.videoHeight || canvas.height, screenOverlay);
    context.drawImage(screen, output.x, output.y, output.width, output.height);
  }
  const focusedId = liveLayers.at(-1)?.id;
  liveLayers.forEach((layer) => drawLayer(context, layer, canvas, media, layer.id === focusedId ? activatedAt : 0, layer.id === focusedId ? now : Number.POSITIVE_INFINITY, layer.kind === "scene" ? sceneSolo[layer.scene.id] : undefined));
}
