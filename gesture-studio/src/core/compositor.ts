import type { AssetKind, AssetSize, AssetTransform, DataRow, EntranceAnimation, MotionEffect, Placement, SceneRevealMotion, SceneRevealSide, ScreenOverlaySettings, StageBackground, StudioAsset, StudioLayer, StudioScene } from "../types";
import { coverSourceCrop } from "./aspect";
import { cameraFrameColor, cameraFrameViewport, DEFAULT_CAMERA_FRAME, normalizeCameraFrame, type CameraFrameSettings } from "./cameraFrame";
import { applyCameraReflow, CAMERA_REFLOW_DURATION_MS, cameraReflowPanelRatio, cameraReflowPanelRatioForFrame, cameraReflowPanelRatioForSide, visibleLayersForComposition, type CameraReflowFrame } from "./cameraReflow";
import { imageCropSourceRect } from "./mediaEdits";
import { assetDeckShouldRender } from "./assetDeck";
import { containStyleRect, styleFocusBaseRect, styleTransformBounds, styleUsesUniformPreviews, videoStyleLayout, type VideoStyleId } from "./videoStyles";

export interface AssetMedia {
  images: Map<string, HTMLImageElement>;
  videos: Map<string, HTMLVideoElement>;
}

export type LiveVideoSource = HTMLVideoElement | VideoFrame;

export interface Rect { x: number; y: number; width: number; height: number }

export interface VideoStyleComposition {
  id: VideoStyleId;
  assets: readonly StudioAsset[];
  focusedAssetId: string | null;
  deckVisible: boolean;
  deckScrollOffset?: number;
  deckWindowStart?: number;
  deckTotal?: number;
  deckPlacement?: number;
  /** Background behind focused media in the left/right panel templates. */
  panelBackground?: string;
  screenAssetId?: string;
  pipAssetId?: string;
}

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
  const reflowPanel = reflowAssetPanelRect(canvasWidth, canvasHeight, asset);
  if (asset.kind === "csv" || asset.kind === "json") {
    if (reflowPanel) return reflowPanel;
    const bounds = sizeBounds(canvasWidth, canvasHeight, asset.size, asset.kind);
    return positionRect(canvasWidth, canvasHeight, bounds.width, bounds.height, asset.size === "full" ? "center" : asset.placement);
  }
  if (!sourceWidth || !sourceHeight) {
    if (reflowPanel) return reflowPanel;
    const bounds = sizeBounds(canvasWidth, canvasHeight, asset.size, asset.kind);
    return positionRect(canvasWidth, canvasHeight, bounds.width, bounds.height, asset.size === "full" ? "center" : asset.placement);
  }
  const sourceRect = asset.kind === "image"
    ? imageCropSourceRect(sourceWidth, sourceHeight, asset.imageCrop)
    : { width: sourceWidth, height: sourceHeight };
  if (reflowPanel) return containRect(reflowPanel, sourceRect.width, sourceRect.height);
  return presetMediaRect(canvasWidth, canvasHeight, sourceRect.width, sourceRect.height, asset.placement, asset.size);
}

export function reflowAssetPanelRect(
  canvasWidth: number,
  canvasHeight: number,
  asset: StudioAsset,
  panelRatio = cameraReflowPanelRatio(asset.size)
): Rect | null {
  if (asset.cameraReflow !== "make-room" || (asset.placement !== "left" && asset.placement !== "right")) return null;
  const width = canvasWidth * panelRatio;
  return {
    x: asset.placement === "left" ? 0 : canvasWidth - width,
    y: 0,
    width,
    height: canvasHeight
  };
}

export function constrainAssetTransform(
  canvasWidth: number,
  canvasHeight: number,
  base: Rect,
  transform: AssetTransform,
  bounds?: Rect
): AssetTransform {
  const area = bounds ?? { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  const minimumScale = 0.15;
  const maximumScale = Math.max(minimumScale, Math.min(4, area.width / base.width, area.height / base.height));
  const requestedScale = clamp(transform.scale, minimumScale, maximumScale);
  const snapsToMaximum = requestedScale >= maximumScale * 0.92;
  const scale = snapsToMaximum ? maximumScale : requestedScale;
  const halfWidth = base.width * scale / 2;
  const halfHeight = base.height * scale / 2;
  const minimumX = (area.x + halfWidth) / canvasWidth;
  const maximumX = (area.x + area.width - halfWidth) / canvasWidth;
  const minimumY = (area.y + halfHeight) / canvasHeight;
  const maximumY = (area.y + area.height - halfHeight) / canvasHeight;
  const x = snapsToMaximum || minimumX >= maximumX ? (area.x + area.width / 2) / canvasWidth : clamp(transform.x, minimumX, maximumX);
  const y = snapsToMaximum || minimumY >= maximumY ? (area.y + area.height / 2) / canvasHeight : clamp(transform.y, minimumY, maximumY);
  return { x, y, scale, rotation: transform.rotation };
}

export function applyAssetTransform(
  canvasWidth: number,
  canvasHeight: number,
  base: Rect,
  transform?: AssetTransform,
  bounds?: Rect
): Rect {
  if (!transform) return base;
  const safe = constrainAssetTransform(canvasWidth, canvasHeight, base, transform, bounds);
  const width = base.width * safe.scale;
  const height = base.height * safe.scale;
  return {
    x: safe.x * canvasWidth - width / 2,
    y: safe.y * canvasHeight - height / 2,
    width,
    height
  };
}

export function assetDisplayRect(
  canvasWidth: number,
  canvasHeight: number,
  asset: StudioAsset,
  sourceWidth?: number,
  sourceHeight?: number,
  transformBounds?: Rect
) {
  const base = baseAssetRect(canvasWidth, canvasHeight, asset, sourceWidth, sourceHeight);
  const bounds = transformBounds ?? reflowAssetPanelRect(canvasWidth, canvasHeight, asset) ?? undefined;
  return applyAssetTransform(canvasWidth, canvasHeight, base, asset.transform, bounds);
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
  const revealPanel = sceneRevealPanelRect(canvasWidth, canvasHeight, scene);
  if (revealPanel) return revealPanel;
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
  // Reveal templates define only the initial composition. Once live, creators
  // can freely reposition or resize the group across the full recording stage.
  return applyAssetTransform(canvasWidth, canvasHeight, base, scene.transform);
}

export function sceneRevealPanelRect(
  canvasWidth: number,
  canvasHeight: number,
  scene: StudioScene,
  panelRatio = cameraReflowPanelRatio(scene.size)
): Rect | null {
  if (scene.revealSide !== "left" && scene.revealSide !== "right") return null;
  const width = canvasWidth * clamp(panelRatio, 0, 1);
  return {
    x: scene.revealSide === "left" ? 0 : canvasWidth - width,
    y: 0,
    width,
    height: canvasHeight
  };
}

export interface SceneRevealAnimationFrame {
  translateX: number;
  progress: number;
}

/** One group-level transform keeps Side Reveal animation effectively free at
 * recording resolutions: members are not individually animated or decoded. */
export function sceneRevealAnimationFrame(
  side: SceneRevealSide | undefined,
  motion: SceneRevealMotion | undefined,
  elapsedMs: number,
  panelWidth: number,
  durationMs = CAMERA_REFLOW_DURATION_MS
): SceneRevealAnimationFrame {
  if ((side !== "left" && side !== "right") || !Number.isFinite(elapsedMs) || elapsedMs >= durationMs) {
    return { translateX: 0, progress: 1 };
  }
  const linear = clamp(elapsedMs / Math.max(1, durationMs), 0, 1);
  let progress: number;
  if (motion === "soft") {
    progress = 1 - Math.pow(1 - linear, 3);
  } else if (motion === "bounce") {
    const overshoot = 1.18;
    const shifted = linear - 1;
    progress = 1 + (overshoot + 1) * shifted * shifted * shifted + overshoot * shifted * shifted;
  } else progress = 1 - Math.pow(1 - linear, 3);
  return {
    translateX: (side === "left" ? -1 : 1) * (1 - progress) * panelWidth,
    progress
  };
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
    scale: transform.scale,
    rotation: transform.rotation
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
    scale: transform.scale,
    rotation: transform.rotation
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

function drawTextVisual(context: CanvasRenderingContext2D, asset: StudioAsset, rect: Rect) {
  const text = (asset.textContent || asset.name || "Text").trim();
  const variant = asset.textVariant ?? "title";
  const fontSize = variant === "title" ? rect.height * 0.34 : variant === "subtitle" ? rect.height * 0.25 : rect.height * 0.2;
  const paddingX = fontSize * 0.7;
  const paddingY = fontSize * 0.45;
  context.save();
  context.font = `${variant === "title" ? 850 : 700} ${Math.max(18, fontSize)}px Manrope, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const maxWidth = Math.max(20, rect.width - paddingX * 2);
  let display = text;
  while (display.length > 1 && context.measureText(display).width > maxWidth) display = `${display.slice(0, -2)}…`;
  const measured = Math.min(maxWidth, context.measureText(display).width);
  if (variant === "label") {
    context.fillStyle = "rgba(21, 20, 18, .88)";
    context.beginPath();
    context.roundRect(rect.x + (rect.width - measured) / 2 - paddingX, rect.y + rect.height / 2 - fontSize / 2 - paddingY, measured + paddingX * 2, fontSize + paddingY * 2, fontSize * 0.35);
    context.fill();
  }
  context.fillStyle = asset.textColor ?? "#f7f3ea";
  context.shadowColor = "rgba(0,0,0,.55)";
  context.shadowBlur = variant === "label" ? 0 : fontSize * 0.18;
  context.fillText(display, rect.x + rect.width / 2, rect.y + rect.height / 2, maxWidth);
  context.restore();
}

function drawMedia(context: CanvasRenderingContext2D, asset: StudioAsset, canvas: HTMLCanvasElement, media: AssetMedia, transformBounds?: Rect) {
  if (asset.kind === "text") {
    drawTextVisual(context, asset, assetDisplayRect(canvas.width, canvas.height, asset, undefined, undefined, transformBounds));
    return;
  }
  if (asset.kind === "csv" || asset.kind === "json") {
    drawCachedData(context, asset, assetDisplayRect(canvas.width, canvas.height, asset, undefined, undefined, transformBounds));
    return;
  }
  const source = asset.kind === "image" ? media.images.get(asset.id) : media.videos.get(asset.id);
  if (!source) return;
  const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth;
  const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight;
  if (!sourceWidth || !sourceHeight) return;
  const output = assetDisplayRect(canvas.width, canvas.height, asset, sourceWidth, sourceHeight, transformBounds);
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

export function sceneFocusedMemberRect(
  canvasWidth: number,
  canvasHeight: number,
  scene: StudioScene,
  asset: StudioAsset,
  media: AssetMedia
): Rect {
  const mode = scene.memberFocusModes?.[asset.id] ?? "medium";
  const margin = mode === "full" ? 0 : 0.14;
  const container = {
    x: canvasWidth * margin,
    y: canvasHeight * margin,
    width: canvasWidth * (1 - margin * 2),
    height: canvasHeight * (1 - margin * 2)
  };
  if (asset.kind === "csv" || asset.kind === "json") return container;
  const source = asset.kind === "image" ? media.images.get(asset.id) : media.videos.get(asset.id);
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source?.videoWidth ?? 0;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source?.videoHeight ?? 0;
  if (width <= 0 || height <= 0) return container;
  const crop = asset.kind === "image" ? imageCropSourceRect(width, height, asset.imageCrop) : { width, height };
  return containRect(container, crop.width, crop.height);
}

function drawMediaInRect(context: CanvasRenderingContext2D, asset: StudioAsset, rect: Rect, media: AssetMedia) {
  if (asset.kind === "text") {
    drawTextVisual(context, asset, rect);
    return;
  }
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

export function entranceAnimationFrame(animation: EntranceAnimation | undefined, elapsedMs: number, durationMs = CAMERA_REFLOW_DURATION_MS) {
  const settled = { alpha: 1, scale: 1, translateX: 0, translateY: 0 };
  if (!Number.isFinite(elapsedMs) || !animation || animation === "none") return settled;
  if (elapsedMs >= durationMs) return settled;
  const linear = clamp(elapsedMs / durationMs, 0, 1);
  const eased = 1 - Math.pow(1 - linear, 3);
  if (animation === "fade") return { ...settled, alpha: eased };
  if (animation === "slide") return { ...settled, alpha: eased, translateY: (1 - eased) * 0.08 };
  if (animation === "float") return { ...settled, alpha: eased, scale: 0.98 + eased * 0.02, translateY: (1 - eased) * 0.06 };
  if (animation === "slide-left") return { ...settled, alpha: eased, translateX: -(1 - eased) * 0.14 };
  if (animation === "slide-right") return { ...settled, alpha: eased, translateX: (1 - eased) * 0.14 };
  if (animation === "zoom") return { ...settled, alpha: eased, scale: 1.24 - eased * 0.24 };
  if (animation === "drop") return { ...settled, alpha: eased, scale: 0.96 + eased * 0.04, translateY: -(1 - eased) * 0.12 };
  if (animation === "bounce") {
    const overshoot = 1.70158;
    const back = 1 + (overshoot + 1) * Math.pow(linear - 1, 3) + overshoot * Math.pow(linear - 1, 2);
    return { ...settled, alpha: eased, scale: 0.72 + back * 0.28 };
  }
  return { ...settled, alpha: eased, scale: 0.82 + eased * 0.18 };
}

export interface MotionAnimationFrame {
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

/**
 * Continuous motion is deliberately limited to cheap canvas transforms. Media
 * is never re-decoded or re-rendered for an effect, keeping the recording path
 * identical to the preview path even at high output resolutions.
 */
export function motionAnimationFrame(effect: MotionEffect | undefined, elapsedMs: number, phase = 0): MotionAnimationFrame {
  const settled = { scale: 1, translateX: 0, translateY: 0, rotation: 0 };
  if (!effect || effect === "none" || !Number.isFinite(elapsedMs)) return settled;
  const elapsed = Math.max(0, elapsedMs);
  const strength = clamp(elapsed / 520, 0, 1);
  const cycle = (elapsed / 2200) * Math.PI * 2 + phase;
  if (effect === "float") return { ...settled, translateY: Math.sin(cycle) * 0.012 * strength };
  if (effect === "pulse") return { ...settled, scale: 1 + Math.sin(cycle * 0.82) * 0.025 * strength };
  if (effect === "sway") return { ...settled, rotation: Math.sin(cycle * 0.72) * (Math.PI / 180) * 1.4 * strength };
  return {
    ...settled,
    translateX: Math.sin(cycle * 0.62) * 0.01 * strength,
    translateY: Math.cos(cycle * 0.48) * 0.008 * strength
  };
}

function motionPhaseForLayer(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0;
  return (Math.abs(hash) % 360) * (Math.PI / 180);
}

function layerBounds(layer: StudioLayer, canvas: HTMLCanvasElement, media: AssetMedia, transformBounds?: Rect) {
  if (layer.kind === "scene") return sceneDisplayRect(canvas.width, canvas.height, layer.scene);
  const source = layer.asset.kind === "image" ? media.images.get(layer.asset.id) : layer.asset.kind === "video" ? media.videos.get(layer.asset.id) : null;
  const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : undefined;
  const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : undefined;
  return assetDisplayRect(canvas.width, canvas.height, layer.asset, sourceWidth, sourceHeight, transformBounds);
}

function drawLayer(context: CanvasRenderingContext2D, layer: StudioLayer, canvas: HTMLCanvasElement, media: AssetMedia, activatedAt: number, now: number, soloAssetId?: string, transformBounds?: Rect, hiddenAssetIds: ReadonlySet<string> = new Set()) {
  const animation = layer.kind === "asset" ? layer.asset.entranceAnimation : layer.scene.entranceAnimation;
  const motion = layer.kind === "asset" ? layer.asset.motionEffect : layer.scene.motionEffect;
  const elapsedMs = Math.max(0, now - activatedAt);
  const revealPanel = layer.kind === "scene" ? sceneRevealPanelRect(canvas.width, canvas.height, layer.scene) : null;
  const revealFrame = layer.kind === "scene" && revealPanel
    ? sceneRevealAnimationFrame(layer.scene.revealSide, layer.scene.revealMotion, elapsedMs, revealPanel.width)
    : null;
  const frame = revealFrame ? { alpha: 1, scale: 1, translateX: 0, translateY: 0 } : entranceAnimationFrame(animation, elapsedMs);
  const motionFrame = motionAnimationFrame(motion, elapsedMs, motionPhaseForLayer(layer.id));
  const bounds = layerBounds(layer, canvas, media, transformBounds);
  context.save();
  context.globalAlpha *= frame.alpha;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  context.translate(
    centerX + (motionFrame.translateX + frame.translateX) * canvas.width + (revealFrame?.translateX ?? 0),
    centerY + (frame.translateY + motionFrame.translateY) * canvas.height
  );
  const userRotation = layer.kind === "asset" ? layer.asset.transform?.rotation ?? 0 : layer.scene.transform?.rotation ?? 0;
  context.rotate(motionFrame.rotation + userRotation);
  context.scale(frame.scale * motionFrame.scale, frame.scale * motionFrame.scale);
  context.translate(-centerX, -centerY);
  if (layer.kind === "asset") {
    drawMedia(context, layer.asset, canvas, media, transformBounds);
    context.restore();
    return;
  }
  const groupRect = sceneDisplayRect(canvas.width, canvas.height, layer.scene);
  const memberBases = sceneMemberContentRects(layer.scene, groupRect, layer.assets, media);
  const memberRects = sceneMemberDisplayRects(layer.scene, groupRect, memberBases);
  const rectById = new Map(layer.scene.memberIds.map((id, index) => [id, memberRects[index]]));
  if (soloAssetId) {
    const solo = layer.assets.find((asset) => asset.id === soloAssetId);
    const soloRect = solo ? sceneFocusedMemberRect(canvas.width, canvas.height, layer.scene, solo, media) : undefined;
    if (solo && soloRect && !hiddenAssetIds.has(solo.id)) drawMediaInRect(context, solo, soloRect, media);
    context.restore();
    return;
  }
  const assetById = new Map(layer.assets.map((asset) => [asset.id, asset]));
  sceneMemberDrawOrder(layer.scene).forEach((id) => {
    const asset = assetById.get(id);
    const rect = rectById.get(id);
    if (asset && rect && !hiddenAssetIds.has(asset.id)) {
      const rotation = layer.scene.memberTransforms?.[id]?.rotation ?? 0;
      if (!rotation) drawMediaInRect(context, asset, rect, media);
      else {
        context.save();
        context.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
        context.rotate(rotation);
        context.translate(-(rect.x + rect.width / 2), -(rect.y + rect.height / 2));
        drawMediaInRect(context, asset, rect, media);
        context.restore();
      }
    }
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
  if (layer.kind === "asset") {
    const { asset } = layer;
    // A make-room asset has its own bounded side panel. Its background must
    // never replace the camera across the entire recording stage.
    if (asset.cameraReflow === "make-room" && (asset.placement === "left" || asset.placement === "right")) {
      return { mode: "camera" };
    }
    return configuredStageBackdrop(asset.stageBackground, asset.stageBackgroundColor);
  }
  if (layer.scene.revealSide === "left" || layer.scene.revealSide === "right") return { mode: "camera" };
  return configuredStageBackdrop(layer.scene.stageBackground, layer.scene.stageBackgroundColor);
}

export function reflowLayerPanelBackdropForLayer(
  canvasWidth: number,
  canvasHeight: number,
  layer: StudioLayer | undefined,
  panelRatio?: number
): (StageBackdrop & { rect: Rect }) | null {
  if (!layer) return null;
  const rect = layer.kind === "asset"
    ? reflowAssetPanelRect(canvasWidth, canvasHeight, layer.asset, panelRatio)
    : sceneRevealPanelRect(canvasWidth, canvasHeight, layer.scene, panelRatio);
  if (!rect) return null;
  const backdrop = layer.kind === "asset"
    ? configuredStageBackdrop(layer.asset.stageBackground, layer.asset.stageBackgroundColor)
    : configuredStageBackdrop(layer.scene.stageBackground, layer.scene.stageBackgroundColor);
  if (backdrop.mode === "camera" || !backdrop.color) return null;
  return { ...backdrop, rect };
}

export function reflowAssetPanelBackdropForLayer(
  canvasWidth: number,
  canvasHeight: number,
  layer: StudioLayer | undefined,
  panelRatio?: number
): (StageBackdrop & { rect: Rect }) | null {
  if (!layer || layer.kind !== "asset") return null;
  return reflowLayerPanelBackdropForLayer(canvasWidth, canvasHeight, layer, panelRatio);
}

function liveVideoSourceReady(source: LiveVideoSource) {
  return "readyState" in source ? source.readyState >= 2 : source.displayWidth > 0 && source.displayHeight > 0;
}

function liveVideoSourceSize(source: LiveVideoSource, fallbackWidth: number, fallbackHeight: number) {
  if ("videoWidth" in source) {
    return { width: source.videoWidth || fallbackWidth, height: source.videoHeight || fallbackHeight };
  }
  return { width: source.displayWidth || fallbackWidth, height: source.displayHeight || fallbackHeight };
}

function drawCameraInStyleRect(
  context: CanvasRenderingContext2D,
  camera: LiveVideoSource,
  rect: Rect,
  mirrorCamera: boolean,
  cameraFrame: CameraFrameSettings,
  fallbackWidth: number,
  fallbackHeight: number
) {
  if (!liveVideoSourceReady(camera)) return;
  const normalized = normalizeCameraFrame(cameraFrame);
  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.fillStyle = normalized.enabled ? cameraFrameColor(normalized) : "#05070b";
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  const ratio = normalized.enabled ? normalized.sizePercent / 100 : 0;
  const viewport = {
    x: rect.x + rect.width * ratio,
    y: rect.y + rect.height * ratio,
    width: Math.max(1, rect.width * (1 - ratio * 2)),
    height: Math.max(1, rect.height * (1 - ratio * 2))
  };
  const cameraSize = liveVideoSourceSize(camera, fallbackWidth, fallbackHeight);
  const crop = coverSourceCrop(cameraSize.width, cameraSize.height, viewport.width, viewport.height);
  if (mirrorCamera) {
    context.translate(viewport.x + viewport.width, viewport.y);
    context.scale(-1, 1);
    context.drawImage(camera, crop.x, crop.y, crop.width, crop.height, 0, 0, viewport.width, viewport.height);
  } else {
    context.drawImage(camera, crop.x, crop.y, crop.width, crop.height, viewport.x, viewport.y, viewport.width, viewport.height);
  }
  context.restore();
}

function styleAssetSourceSize(asset: StudioAsset, media: AssetMedia, liveSource?: LiveVideoSource | null) {
  if (liveSource) return liveVideoSourceSize(liveSource, 16, 9);
  if (asset.kind === "text") return { width: 16, height: asset.textVariant === "label" ? 4 : 6 };
  if (asset.kind === "csv" || asset.kind === "json") return { width: 16, height: 10 };
  const source = asset.kind === "image" ? media.images.get(asset.id) : media.videos.get(asset.id);
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source?.videoWidth ?? 0;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source?.videoHeight ?? 0;
  if (asset.kind === "image" && width > 0 && height > 0) {
    const crop = imageCropSourceRect(width, height, asset.imageCrop);
    return { width: crop.width, height: crop.height };
  }
  return { width, height };
}

function drawLiveSourceInRect(context: CanvasRenderingContext2D, source: LiveVideoSource, rect: Rect, cover: boolean) {
  if (!liveVideoSourceReady(source)) return;
  const size = liveVideoSourceSize(source, rect.width, rect.height);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (cover) {
    const crop = coverSourceCrop(size.width, size.height, rect.width, rect.height);
    context.drawImage(source, crop.x, crop.y, crop.width, crop.height, rect.x, rect.y, rect.width, rect.height);
  } else {
    const output = containRect(rect, size.width, size.height);
    context.drawImage(source, output.x, output.y, output.width, output.height);
  }
  context.restore();
}

function drawMediaCoverInRect(context: CanvasRenderingContext2D, asset: StudioAsset, rect: Rect, media: AssetMedia) {
  if (asset.kind === "text") {
    drawTextVisual(context, asset, rect);
    return;
  }
  if (asset.kind === "csv" || asset.kind === "json") {
    drawCachedData(context, asset, rect);
    return;
  }
  const source = asset.kind === "image" ? media.images.get(asset.id) : media.videos.get(asset.id);
  if (!source) return;
  const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth;
  const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight;
  if (!sourceWidth || !sourceHeight) return;
  const editCrop = asset.kind === "image" ? imageCropSourceRect(sourceWidth, sourceHeight, asset.imageCrop) : { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  const coverCrop = coverSourceCrop(editCrop.width, editCrop.height, rect.width, rect.height);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    editCrop.x + coverCrop.x,
    editCrop.y + coverCrop.y,
    coverCrop.width,
    coverCrop.height,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  );
  context.restore();
}

function drawStyleSlot(
  context: CanvasRenderingContext2D,
  asset: StudioAsset,
  rect: Rect,
  media: AssetMedia,
  focused: boolean,
  uniform: boolean,
  liveSource?: LiveVideoSource | null
) {
  const source = styleAssetSourceSize(asset, media, liveSource);
  const visualRect = uniform ? rect : containStyleRect(rect, source.width, source.height);
  const radius = Math.max(4, Math.min(visualRect.width, visualRect.height) * 0.04);
  // Two quiet depth layers read more naturally than one heavy black halo.
  context.save();
  context.shadowColor = "rgba(12, 20, 34, .11)";
  context.shadowBlur = Math.max(14, Math.min(28, visualRect.width * 0.18));
  context.shadowOffsetY = Math.max(5, visualRect.height * 0.065);
  context.fillStyle = "rgba(14, 18, 27, .28)";
  context.beginPath();
  context.roundRect(visualRect.x, visualRect.y, visualRect.width, visualRect.height, radius);
  context.fill();
  context.restore();
  context.save();
  context.shadowColor = "rgba(12, 20, 34, .16)";
  context.shadowBlur = Math.max(4, Math.min(9, visualRect.width * 0.055));
  context.shadowOffsetY = Math.max(1.5, visualRect.height * 0.018);
  context.fillStyle = "rgba(14, 18, 27, .18)";
  context.beginPath();
  context.roundRect(visualRect.x, visualRect.y, visualRect.width, visualRect.height, radius);
  context.fill();
  context.restore();
  context.save();
  context.beginPath();
  context.roundRect(visualRect.x, visualRect.y, visualRect.width, visualRect.height, radius);
  context.clip();
  if (liveSource) drawLiveSourceInRect(context, liveSource, visualRect, uniform);
  else if (uniform) drawMediaCoverInRect(context, asset, visualRect, media);
  else drawMediaInRect(context, asset, visualRect, media);
  context.restore();
  context.save();
  context.strokeStyle = focused ? "#35c9f2" : "rgba(255,255,255,.3)";
  context.lineWidth = focused ? Math.max(3, visualRect.width * 0.012) : Math.max(1.5, visualRect.width * 0.006);
  context.beginPath();
  context.roundRect(visualRect.x, visualRect.y, visualRect.width, visualRect.height, radius);
  context.stroke();
  context.restore();
}

function drawVideoStyle(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  camera: LiveVideoSource,
  media: AssetMedia,
  style: VideoStyleComposition,
  activationTimes: Readonly<Record<string, number>>,
  now: number,
  mirrorCamera: boolean,
  cameraFrame: CameraFrameSettings,
  screen: LiveVideoSource | null,
  _screenOverlay: ScreenOverlaySettings | null,
  backgroundOverlay?: () => void
) {
  const assets = style.assets.slice(0, 5);
  const layout = videoStyleLayout(style.id, canvas.width, canvas.height, assets.length, {
    offset: style.deckScrollOffset ?? 0,
    windowStart: style.deckWindowStart ?? 0,
    total: style.deckTotal ?? assets.length,
    position: style.deckPlacement
  });
  const focusedAsset = style.focusedAssetId ? assets.find((asset) => asset.id === style.focusedAssetId) : undefined;
  const deckRendered = assetDeckShouldRender(style.deckVisible, focusedAsset?.id ?? null);
  context.fillStyle = "#080b11";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const deckViewport = layout.deckViewport ?? layout.panel;
  const cameraRect = deckRendered ? layout.camera : { x: 0, y: 0, width: canvas.width, height: canvas.height };
  drawCameraInStyleRect(context, camera, cameraRect, mirrorCamera, cameraFrame, canvas.width, canvas.height);
  if (deckRendered && layout.constrainedFocus && layout.panel) {
    context.fillStyle = style.panelBackground ?? "#15131a";
    context.fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
  }

  if (deckRendered && (!focusedAsset || layout.keepSlotsWhileFocused)) {
    context.save();
    if (deckViewport) {
      const viewportRadius = Math.max(8, Math.min(deckViewport.width, deckViewport.height) * 0.045);
      context.beginPath();
      context.roundRect(deckViewport.x, deckViewport.y, deckViewport.width, deckViewport.height, viewportRadius);
      context.clip();
    }
    layout.slots.forEach((slot, index) => {
      const asset = assets[index];
      if (!asset) return;
      const liveSource = asset.id === style.screenAssetId ? screen : null;
      drawStyleSlot(context, asset, slot, media, asset.id === focusedAsset?.id, styleUsesUniformPreviews(style.id), liveSource);
    });
    context.restore();
  }

  if (!focusedAsset) return;
  backgroundOverlay?.();
  const focusedLiveSource = focusedAsset.id === style.screenAssetId ? screen : null;
  if (focusedAsset.id === style.pipAssetId) {
    const full = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    drawMediaCoverInRect(context, focusedAsset, full, media);
    const pip = { x: canvas.width * .69, y: canvas.height * .66, width: canvas.width * .28, height: canvas.height * .29 };
    context.save();
    context.shadowColor = "rgba(0,0,0,.42)"; context.shadowBlur = Math.max(14, canvas.width * .012); context.shadowOffsetY = 6;
    context.fillStyle = "#111"; context.beginPath(); context.roundRect(pip.x, pip.y, pip.width, pip.height, Math.max(12, pip.width * .045)); context.fill();
    context.shadowColor = "transparent"; context.beginPath(); context.roundRect(pip.x, pip.y, pip.width, pip.height, Math.max(12, pip.width * .045)); context.clip();
    drawCameraInStyleRect(context, camera, pip, mirrorCamera, cameraFrame, canvas.width, canvas.height);
    context.restore();
    context.save(); context.strokeStyle = "rgba(255,255,255,.72)"; context.lineWidth = Math.max(2, canvas.width * .002); context.beginPath(); context.roundRect(pip.x, pip.y, pip.width, pip.height, Math.max(12, pip.width * .045)); context.stroke(); context.restore();
    return;
  }
  if (focusedLiveSource && liveVideoSourceReady(focusedLiveSource)) {
    const full = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    drawLiveSourceInRect(context, focusedLiveSource, full, true);
    const pip = { x: canvas.width * .69, y: canvas.height * .66, width: canvas.width * .28, height: canvas.height * .29 };
    context.save();
    context.shadowColor = "rgba(0,0,0,.42)"; context.shadowBlur = Math.max(14, canvas.width * .012); context.shadowOffsetY = 6;
    context.fillStyle = "#111"; context.beginPath(); context.roundRect(pip.x, pip.y, pip.width, pip.height, Math.max(12, pip.width * .045)); context.fill();
    context.shadowColor = "transparent"; context.beginPath(); context.roundRect(pip.x, pip.y, pip.width, pip.height, Math.max(12, pip.width * .045)); context.clip();
    drawCameraInStyleRect(context, camera, pip, mirrorCamera, cameraFrame, canvas.width, canvas.height);
    context.restore();
    context.save(); context.strokeStyle = "rgba(255,255,255,.72)"; context.lineWidth = Math.max(2, canvas.width * .002); context.beginPath(); context.roundRect(pip.x, pip.y, pip.width, pip.height, Math.max(12, pip.width * .045)); context.stroke(); context.restore();
    return;
  }
  const sourceSize = styleAssetSourceSize(focusedAsset, media, focusedLiveSource);
  const base = styleFocusBaseRect(layout, focusedAsset, sourceSize.width, sourceSize.height);
  const bounds = styleTransformBounds(layout);
  let output = applyAssetTransform(canvas.width, canvas.height, base, focusedAsset.transform, bounds);
  const entrance = entranceAnimationFrame(focusedAsset.entranceAnimation ?? "pop", Math.max(0, now - (activationTimes[focusedAsset.id] ?? now)));
  output = {
    x: output.x + output.width * (1 - entrance.scale) / 2 + entrance.translateX * canvas.width,
    y: output.y + output.height * (1 - entrance.scale) / 2 + entrance.translateY * canvas.height,
    width: output.width * entrance.scale,
    height: output.height * entrance.scale
  };
  context.save();
  context.globalAlpha = entrance.alpha;
  if (layout.constrainedFocus) {
    context.beginPath();
    context.rect(layout.focusBounds.x, layout.focusBounds.y, layout.focusBounds.width, layout.focusBounds.height);
    context.clip();
  } else {
    context.shadowColor = "rgba(0,0,0,.5)";
    context.shadowBlur = Math.max(18, canvas.width * 0.018);
  }
  if (focusedAsset.transform?.rotation) {
    context.translate(output.x + output.width / 2, output.y + output.height / 2);
    context.rotate(focusedAsset.transform.rotation);
    context.translate(-(output.x + output.width / 2), -(output.y + output.height / 2));
  }
  context.fillStyle = "rgba(7,9,14,.92)";
  context.fillRect(output.x, output.y, output.width, output.height);
  if (focusedLiveSource) drawLiveSourceInRect(context, focusedLiveSource, output, false);
  else if (layout.constrainedFocus) drawMediaCoverInRect(context, focusedAsset, output, media);
  else drawMediaInRect(context, focusedAsset, output, media);
  context.restore();
}

export function composeFrame(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  camera: LiveVideoSource,
  liveLayers: readonly StudioLayer[],
  media: AssetMedia,
  activationTimes: Readonly<Record<string, number>>,
  now: number,
  cameraReflow?: CameraReflowFrame,
  mirrorCamera = false,
  cameraFrame: CameraFrameSettings = DEFAULT_CAMERA_FRAME,
  sceneSolo: Readonly<Record<string, string>> = {},
  screen: LiveVideoSource | null = null,
  screenOverlay: ScreenOverlaySettings | null = null,
  hiddenAssetIds: ReadonlySet<string> = new Set(),
  videoStyle?: VideoStyleComposition,
  backgroundOverlay?: () => void
) {
  if (videoStyle) {
    drawVideoStyle(context, canvas, camera, media, videoStyle, activationTimes, now, mirrorCamera, cameraFrame, screen, screenOverlay, backgroundOverlay);
    return;
  }
  const compositionLayers = visibleLayersForComposition(liveLayers).filter((layer) => layer.kind === "scene" || !hiddenAssetIds.has(layer.asset.id));
  const backdrop = stageBackdropForLayers(compositionLayers);
  const normalizedCameraFrame = normalizeCameraFrame(cameraFrame);
  context.fillStyle = backdrop.color ?? (!normalizedCameraFrame.enabled ? "#060809" : cameraFrameColor(normalizedCameraFrame));
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (backdrop.mode === "camera" && liveVideoSourceReady(camera)) {
      const cameraSize = liveVideoSourceSize(camera, canvas.width, canvas.height);
      const viewport = applyCameraReflow(cameraFrameViewport(canvas.width, canvas.height, normalizedCameraFrame), cameraReflow);
      const crop = coverSourceCrop(cameraSize.width, cameraSize.height, viewport.width, viewport.height);
      context.save();
      if (mirrorCamera) {
        context.translate(viewport.x + viewport.width, viewport.y);
        context.scale(-1, 1);
        context.drawImage(camera, crop.x, crop.y, crop.width, crop.height, 0, 0, viewport.width, viewport.height);
      } else {
        context.drawImage(camera, crop.x, crop.y, crop.width, crop.height, viewport.x, viewport.y, viewport.width, viewport.height);
      }
      context.restore();
  }
  const reflowPanelLayer = cameraReflow?.target
    ? compositionLayers.find((layer) => layer.id === cameraReflow.target?.layerId)
    : undefined;
  const reflowPanelBackdrop = reflowLayerPanelBackdropForLayer(
    canvas.width,
    canvas.height,
    reflowPanelLayer,
    cameraReflowPanelRatioForFrame(cameraReflow)
  );
  if (reflowPanelBackdrop) {
    context.fillStyle = reflowPanelBackdrop.color!;
    context.fillRect(
      reflowPanelBackdrop.rect.x,
      reflowPanelBackdrop.rect.y,
      reflowPanelBackdrop.rect.width,
      reflowPanelBackdrop.rect.height
    );
  }
  backgroundOverlay?.();
  if (screen && screenOverlay?.visible && liveVideoSourceReady(screen)) {
    const screenSize = liveVideoSourceSize(screen, canvas.width, canvas.height);
    const output = screenOverlayDisplayRect(canvas.width, canvas.height, screenSize.width, screenSize.height, screenOverlay);
    context.drawImage(screen, output.x, output.y, output.width, output.height);
  }
  compositionLayers.forEach((layer) => {
    const panelRatio = layer.kind === "asset" && (layer.asset.placement === "left" || layer.asset.placement === "right")
      ? cameraReflowPanelRatioForSide(compositionLayers, layer.asset.placement)
      : null;
    const transformBounds = layer.kind === "asset" && panelRatio !== null
      ? reflowAssetPanelRect(canvas.width, canvas.height, layer.asset, panelRatio) ?? undefined
      : undefined;
    drawLayer(
      context,
      layer,
      canvas,
      media,
      activationTimes[layer.id] ?? 0,
      now,
      layer.kind === "scene" ? sceneSolo[layer.scene.id] : undefined,
      transformBounds,
      hiddenAssetIds
    );
  });
}
