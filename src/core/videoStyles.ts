import type { AssetTransform, StudioAsset } from "../types";

export type VideoStyleId = "top-shelf" | "center-shelf" | "bottom-shelf" | "right-rail" | "spatial" | "left-rail" | "split-decks";

export interface StyleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoStyleDefinition {
  id: VideoStyleId;
  name: string;
  detail: string;
  focusBehavior: "center" | "window";
}

export interface VideoStyleLayout {
  camera: StyleRect;
  panel?: StyleRect;
  /** Compact clipped conveyor viewport; independent of the layout panel. */
  deckViewport?: StyleRect;
  slots: StyleRect[];
  focus: StyleRect;
  focusBounds: StyleRect;
  constrainedFocus: boolean;
  keepSlotsWhileFocused: boolean;
}

export interface DeckLayoutState {
  offset: number;
  windowStart: number;
  total: number;
  position?: number;
}

/** Four cards remain readable on the recorded canvas. Larger docks scroll. */
export const MAX_STYLE_ASSETS = 4;

/** Scene membership never removes an asset from the project's main dock.
 * Scenes are reusable arrangements; the dock remains the universal source. */
export function assetsForMainDock(assets: readonly StudioAsset[], screenAsset?: StudioAsset | null) {
  const visualAssets = assets.filter((asset) => asset.kind !== "text");
  return screenAsset && !visualAssets.some((asset) => asset.id === screenAsset.id) ? [...visualAssets, screenAsset] : [...visualAssets];
}

/** Keeps the lightweight preview deck capped, but guarantees that the visual
 * the presenter just confirmed is part of the compositor input. Previously a
 * sixth (or later) asset could become active in state while remaining absent
 * from every rendered frame. */
export function styleAssetsWithFocus(assets: readonly StudioAsset[], focusedAssetId: string | null, limit = MAX_STYLE_ASSETS) {
  const safeLimit = Math.max(0, Math.min(MAX_STYLE_ASSETS, limit));
  const visible = assets.slice(0, safeLimit);
  if (!focusedAssetId || visible.some((asset) => asset.id === focusedAssetId)) return visible;
  const focused = assets.find((asset) => asset.id === focusedAssetId);
  if (!focused) return visible;
  return [...visible.slice(0, Math.max(0, safeLimit - 1)), focused];
}

export const VIDEO_STYLES: readonly VideoStyleDefinition[] = [
  { id: "top-shelf", name: "Media on top", detail: "Your camera stays behind it", focusBehavior: "center" },
  { id: "center-shelf", name: "Media at center", detail: "A central horizontal media belt", focusBehavior: "center" },
  { id: "right-rail", name: "Media on right", detail: "You stay on the left", focusBehavior: "window" },
  { id: "spatial", name: "Freeform", detail: "Place and resize media anywhere", focusBehavior: "center" },
  { id: "left-rail", name: "Media on left", detail: "You stay on the right", focusBehavior: "window" }
] as const;

const rect = (x: number, y: number, width: number, height: number): StyleRect => ({ x, y, width, height });

function horizontalSlots(width: number, height: number, count: number, top: number) {
  const visible = Math.max(0, Math.min(MAX_STYLE_ASSETS, count));
  if (!visible) return [];
  const gap = width * 0.014;
  const available = width * 0.9;
  const slotWidth = Math.min(height * 0.145, (available - gap * (visible - 1)) / visible);
  const total = slotWidth * visible + gap * (visible - 1);
  const start = (width - total) / 2;
  return Array.from({ length: visible }, (_, index) => rect(start + index * (slotWidth + gap), top, slotWidth, slotWidth));
}

function topSlots(width: number, height: number, count: number) {
  return horizontalSlots(width, height, count, height * 0.055);
}

function railSlots(panel: StyleRect, count: number, position = 0.5) {
  const visible = Math.max(0, Math.min(MAX_STYLE_ASSETS, count));
  if (!visible) return [];
  const gap = panel.height * 0.012;
  const slotWidth = panel.width * 0.95;
  const slotHeight = (panel.height * 0.94 - gap * (visible - 1)) / visible;
  const total = slotHeight * visible + gap * (visible - 1);
  const start = panel.y + (panel.height - total) / 2;
  return Array.from({ length: visible }, (_, index) => rect(panel.x + (panel.width - slotWidth) * Math.min(1, Math.max(0, position)), start + index * (slotHeight + gap), slotWidth, slotHeight));
}

function spatialSlots(width: number, height: number, count: number) {
  const side = Math.min(width * 0.13, height * 0.18);
  const candidates = [
    rect(width * 0.035, height * 0.075, side, side),
    rect(width * 0.81, height * 0.075, side, side),
    rect(width * 0.045, height * 0.72, side, side),
    rect(width * 0.82, height * 0.72, side, side),
    rect(width * 0.78, height * 0.4, side, side)
  ];
  return candidates.slice(0, Math.max(0, Math.min(MAX_STYLE_ASSETS, count)));
}

function paddedSlotBounds(slots: readonly StyleRect[], paddingX: number, paddingY: number): StyleRect | undefined {
  if (!slots.length) return undefined;
  const left = Math.min(...slots.map((slot) => slot.x));
  const top = Math.min(...slots.map((slot) => slot.y));
  const right = Math.max(...slots.map((slot) => slot.x + slot.width));
  const bottom = Math.max(...slots.map((slot) => slot.y + slot.height));
  return rect(left - paddingX, top - paddingY, right - left + paddingX * 2, bottom - top + paddingY * 2);
}

export function videoStyleLayout(id: VideoStyleId, width: number, height: number, assetCount: number, deck?: DeckLayoutState): VideoStyleLayout {
  const full = rect(0, 0, width, height);
  const centerFocus = rect(width * 0.16, height * 0.12, width * 0.68, height * 0.76);
  const scrolling = id !== "spatial" && id !== "split-decks" && Boolean(deck && deck.total > MAX_STYLE_ASSETS);
  const globalIndices = Array.from({ length: assetCount }, (_, index) => (deck?.windowStart ?? 0) + index);
  if (id === "top-shelf" || id === "center-shelf" || id === "bottom-shelf") {
    const defaultPosition = id === "top-shelf" ? 0.055 : id === "center-shelf" ? 0.425 : 0.77;
    const shelfTop = height * Math.min(0.8, Math.max(0.04, deck?.position ?? defaultPosition));
    const canonicalSlots = horizontalSlots(width, height, scrolling ? MAX_STYLE_ASSETS : assetCount, shelfTop);
    const slots = scrolling ? (() => {
      const gap = width * 0.014;
      const slotWidth = Math.min(height * 0.145, (width * 0.9 - gap * (MAX_STYLE_ASSETS - 1)) / MAX_STYLE_ASSETS);
      const start = (width - (slotWidth * MAX_STYLE_ASSETS + gap * (MAX_STYLE_ASSETS - 1))) / 2;
      return globalIndices.map((index) => rect(start + (index - deck!.offset) * (slotWidth + gap), shelfTop, slotWidth, slotWidth));
    })() : horizontalSlots(width, height, assetCount, shelfTop);
    return {
      camera: full,
      panel: id === "top-shelf" ? rect(0, 0, width, height * 0.26) : id === "center-shelf" ? rect(0, height * 0.34, width, height * 0.32) : rect(0, height * 0.7, width, height * 0.3),
      deckViewport: paddedSlotBounds(canonicalSlots, width * 0.012, height * 0.018),
      slots,
      focus: centerFocus,
      focusBounds: full,
      constrainedFocus: false,
      keepSlotsWhileFocused: false
    };
  }
  if (id === "spatial") {
    const slots = scrolling ? (() => {
      const gap = width * 0.018;
      const slotWidth = Math.min(width * 0.13, height * 0.18);
      const start = width * 0.12;
      return globalIndices.map((index) => rect(start + (index - deck!.offset) * (slotWidth + gap), height * 0.72, slotWidth, slotWidth));
    })() : spatialSlots(width, height, assetCount);
    return {
      camera: full,
      panel: scrolling ? rect(0, height * 0.66, width, height * 0.34) : undefined,
      slots,
      focus: centerFocus,
      focusBounds: full,
      constrainedFocus: false,
      keepSlotsWhileFocused: false
    };
  }
  if (id === "split-decks") {
    const side = Math.min(width * 0.13, height * 0.19);
    const slots = [
      rect(width * 0.035, height * 0.19, side, side),
      rect(width * 0.035, height * 0.61, side, side),
      rect(width - width * 0.035 - side, height * 0.19, side, side),
      rect(width - width * 0.035 - side, height * 0.61, side, side)
    ].slice(0, Math.min(MAX_STYLE_ASSETS, assetCount));
    return {
      camera: full,
      slots,
      focus: centerFocus,
      focusBounds: full,
      constrainedFocus: false,
      keepSlotsWhileFocused: false
    };
  }
  const railTotal = deck?.total ?? assetCount;
  const compactRail = railTotal > MAX_STYLE_ASSETS;
  const panelWidth = width * (compactRail ? 0.33 : 0.42);
  const panelHeight = height * (compactRail ? 0.78 : 1);
  const panelTop = (height - panelHeight) / 2;
  const panel = id === "left-rail" ? rect(0, panelTop, panelWidth, panelHeight) : rect(width - panelWidth, panelTop, panelWidth, panelHeight);
  const camera = id === "left-rail" ? rect(panelWidth, 0, width - panelWidth, height) : rect(0, 0, width - panelWidth, height);
  const focus = rect(panel.x, panel.y + panel.height * 0.055, panel.width, panel.height * 0.89);
  const railPosition = deck?.position ?? 0.5;
  const slots = scrolling ? (() => {
    const gap = panel.height * 0.012;
    const slotWidth = panel.width * 0.95;
    const slotHeight = (panel.height * 0.94 - gap * (MAX_STYLE_ASSETS - 1)) / MAX_STYLE_ASSETS;
    const start = panel.y + (panel.height - (slotHeight * MAX_STYLE_ASSETS + gap * (MAX_STYLE_ASSETS - 1))) / 2;
    return globalIndices.map((index) => rect(panel.x + (panel.width - slotWidth) * railPosition, start + (index - deck!.offset) * (slotHeight + gap), slotWidth, slotHeight));
  })() : railSlots(panel, assetCount, railPosition);
  const canonicalRailSlots = railSlots(panel, scrolling ? MAX_STYLE_ASSETS : assetCount, railPosition);
  return {
    camera,
    panel,
    deckViewport: paddedSlotBounds(canonicalRailSlots, panel.width * 0.015, panel.height * 0.012),
    slots,
    focus,
    focusBounds: focus,
    constrainedFocus: true,
    keepSlotsWhileFocused: false
  };
}

export function containStyleRect(container: StyleRect, sourceWidth: number, sourceHeight: number): StyleRect {
  if (sourceWidth <= 0 || sourceHeight <= 0) return { ...container };
  const scale = Math.min(container.width / sourceWidth, container.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: container.x + (container.width - width) / 2, y: container.y + (container.height - height) / 2, width, height };
}

export function styleFocusBaseRect(layout: VideoStyleLayout, asset: StudioAsset, sourceWidth?: number, sourceHeight?: number): StyleRect {
  if (asset.kind === "video" && asset.size === "full") {
    const regions = [layout.camera, layout.panel, layout.focusBounds].filter((region): region is StyleRect => Boolean(region));
    const left = Math.min(...regions.map((region) => region.x));
    const top = Math.min(...regions.map((region) => region.y));
    const right = Math.max(...regions.map((region) => region.x + region.width));
    const bottom = Math.max(...regions.map((region) => region.y + region.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
  const sizeScale = layout.constrainedFocus ? 1 : asset.size === "small" ? 0.58 : 1;
  const sizedFocus = sizeScale === 1 ? layout.focus : rect(
    layout.focus.x + layout.focus.width * (1 - sizeScale) / 2,
    layout.focus.y + layout.focus.height * (1 - sizeScale) / 2,
    layout.focus.width * sizeScale,
    layout.focus.height * sizeScale
  );
  if (asset.kind === "csv" || asset.kind === "json" || !sourceWidth || !sourceHeight) return { ...sizedFocus };
  return containStyleRect(sizedFocus, sourceWidth, sourceHeight);
}

export function styleTransformBounds(layout: VideoStyleLayout, asset?: StudioAsset) {
  if (asset?.kind === "video" && asset.size === "full") return undefined;
  return layout.constrainedFocus ? layout.focusBounds : undefined;
}

export function styleUsesUniformPreviews(id: VideoStyleId) {
  return id !== "spatial";
}

/** The gesture belongs to the deck only while the hand is visibly over, or
 * just behind, its conveyor-belt viewport. */
export function pointNearStyleDeck(
  layout: VideoStyleLayout,
  point: { x: number; y: number },
  padding: number
) {
  const belt = layout.deckViewport ?? layout.panel;
  if (!belt) return false;
  return point.x >= belt.x - padding
    && point.x <= belt.x + belt.width + padding
    && point.y >= belt.y - padding
    && point.y <= belt.y + belt.height + padding;
}

export function styleSlotAssetId(assets: readonly StudioAsset[], slotIndex: number) {
  return assets.slice(0, MAX_STYLE_ASSETS)[slotIndex]?.id ?? null;
}

export function styleAssetAtPoint(
  layout: VideoStyleLayout,
  assets: readonly StudioAsset[],
  point: { x: number; y: number },
  focusedAssetId: string | null
) {
  const visible = assets;
  const deckViewport = layout.deckViewport ?? layout.panel;
  if (deckViewport && (point.x < deckViewport.x || point.x > deckViewport.x + deckViewport.width || point.y < deckViewport.y || point.y > deckViewport.y + deckViewport.height)) return null;
  const focusedVisibleAsset = Boolean(focusedAssetId && visible.some((asset) => asset.id === focusedAssetId));
  if (focusedVisibleAsset && !layout.keepSlotsWhileFocused) return null;
  for (let index = Math.min(layout.slots.length, visible.length) - 1; index >= 0; index -= 1) {
    const slot = layout.slots[index];
    if (point.x >= slot.x && point.x <= slot.x + slot.width && point.y >= slot.y && point.y <= slot.y + slot.height) {
      return visible[index] ?? null;
    }
  }
  return null;
}

export function initialStyleTransform(base: StyleRect, canvasWidth: number, canvasHeight: number): AssetTransform {
  return {
    x: (base.x + base.width / 2) / canvasWidth,
    y: (base.y + base.height / 2) / canvasHeight,
    scale: 1
  };
}

/** Use the centered spawn transform only once. Once a presenter has moved or
 * resized an asset, every later reveal must reuse that authored layout. */
export function retainedStyleTransform(
  current: AssetTransform | undefined,
  base: StyleRect,
  canvasWidth: number,
  canvasHeight: number
): AssetTransform {
  return current ?? initialStyleTransform(base, canvasWidth, canvasHeight);
}
