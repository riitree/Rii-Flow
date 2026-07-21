import type { StudioAsset, StudioScene } from "../types";

export type CanvasWidgetKind = "vinyl" | "bullets" | "sticker" | "orbit" | "live" | "media";
export type WidgetFrameStyle = "none" | "windows" | "mac" | "rpg";

export interface CanvasWidget {
  id: string;
  kind: CanvasWidgetKind;
  x: number;
  y: number;
  scale: number;
  title: string;
  items: string[];
  revealed: number;
  sticker: "star" | "heart" | "spark";
  actionAssetId?: string;
  audioName?: string;
  playing?: boolean;
  volume?: number;
  assetIds?: string[];
  sceneIds?: string[];
  frameStyle?: WidgetFrameStyle;
  color?: string;
  open?: boolean;
  openedAt?: number;
  orbitOffset?: number;
  visible: boolean;
  active?: boolean;
}

export interface WidgetRect { x: number; y: number; width: number; height: number }

export function containWidgetMedia(rect: WidgetRect, sourceWidth: number, sourceHeight: number): WidgetRect {
  if (sourceWidth <= 0 || sourceHeight <= 0) return { ...rect };
  const scale = Math.min(rect.width / sourceWidth, rect.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
}

export function widgetRect(widget: CanvasWidget, width: number, height: number): WidgetRect {
  const baseWidth = widget.kind === "bullets" ? width * .25 : widget.kind === "media" ? width * .13 : width * .105;
  const baseHeight = widget.kind === "bullets" ? height * .25 : widget.kind === "media" ? width * .1 : width * .105;
  return {
    x: widget.x * width - baseWidth * widget.scale / 2,
    y: widget.y * height - baseHeight * widget.scale / 2,
    width: baseWidth * widget.scale,
    height: baseHeight * widget.scale
  };
}

export const ORBIT_VISIBLE_CARDS = 5;

/** Cards follow a shallow crescent that opens toward the canvas centre. */
export function orbitCardRects(widget: CanvasWidget, width: number, height: number, count: number): WidgetRect[] {
  if (!widget.open || !widget.visible || count <= 0) return [];
  const anchor = widgetRect(widget, width, height);
  const cx = anchor.x + anchor.width / 2;
  const cy = anchor.y + anchor.height / 2;
  const opensRight = widget.x < .5;
  const cardScale = Math.max(.55, widget.scale);
  const cardSide = Math.min(width * .105, height * .19) * cardScale;
  const radiusX = width * .235 * cardScale;
  const radiusY = height * .31 * cardScale;
  const visible = Math.min(ORBIT_VISIBLE_CARDS, count);
  const offset = widget.orbitOffset ?? 0;
  return Array.from({ length: count }, (_, index) => {
    const position = index - offset;
    // Equal angular increments—not equal Y increments—are what make the
    // cards read as objects arranged around a real semicircular orbit.
    const angle = visible <= 1 ? 0 : -Math.PI / 2 + (position / (visible - 1)) * Math.PI;
    const x = cx + (opensRight ? 1 : -1) * Math.cos(angle) * radiusX - cardSide / 2;
    const y = cy + Math.sin(angle) * radiusY - cardSide / 2;
    return { x, y, width: cardSide, height: cardSide };
  });
}

export function orbitAssetAtPoint(widget: CanvasWidget, assets: readonly StudioAsset[], point: { x: number; y: number }, width: number, height: number) {
  const members = (widget.assetIds ?? []).map((id) => assets.find((asset) => asset.id === id)).filter((asset): asset is StudioAsset => Boolean(asset));
  const rects = orbitCardRects(widget, width, height, members.length);
  for (let index = rects.length - 1; index >= 0; index -= 1) {
    const rect = rects[index];
    if (rect.x + rect.width < 0 || rect.x > width || rect.y + rect.height < 0 || rect.y > height) continue;
    if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) return members[index];
  }
  return null;
}

export function orbitTargetAtPoint(widget: CanvasWidget, assets: readonly StudioAsset[], scenes: readonly StudioScene[], point: { x: number; y: number }, width: number, height: number) {
  const entries = [
    ...(widget.assetIds ?? []).map((id) => assets.find((asset) => asset.id === id)).filter((item): item is StudioAsset => Boolean(item)).map((asset) => ({ kind: "asset" as const, asset })),
    ...(widget.sceneIds ?? []).map((id) => scenes.find((scene) => scene.id === id)).filter((item): item is StudioScene => Boolean(item)).map((scene) => ({ kind: "scene" as const, scene }))
  ];
  const rects = orbitCardRects(widget, width, height, entries.length);
  for (let index = rects.length - 1; index >= 0; index -= 1) {
    const rect = rects[index];
    if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) return entries[index] ?? null;
  }
  return null;
}

export function pointNearOrbit(widget: CanvasWidget, point: { x: number; y: number }, width: number, height: number, padding: number) {
  const rects = orbitCardRects(widget, width, height, (widget.assetIds?.length ?? 0) + (widget.sceneIds?.length ?? 0));
  return rects.some((rect) => point.x >= rect.x - padding && point.x <= rect.x + rect.width + padding && point.y >= rect.y - padding && point.y <= rect.y + rect.height + padding);
}

/** Requires a deliberate retreat before an orbit can accept another point. */
export function orbitPointRearmed(origin: { x: number; y: number }, point: { x: number; y: number }, width: number, height: number) {
  return Math.hypot(point.x - origin.x, point.y - origin.y) >= Math.min(width, height) * .12;
}

export function widgetAtPoint(widgets: readonly CanvasWidget[], point: { x: number; y: number }, width: number, height: number) {
  return [...widgets].reverse().find((widget) => {
    if (!widget.visible) return false;
    const rect = widgetRect(widget, width, height);
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  }) ?? null;
}

function roundedRect(context: CanvasRenderingContext2D, rect: WidgetRect, radius: number) {
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
}

function drawWidgetFrame(context: CanvasRenderingContext2D, rect: WidgetRect, style: WidgetFrameStyle) {
  if (style === "none") return;
  const pad = Math.max(7, rect.width * .09);
  const top = style === "rpg" ? pad : Math.max(15, rect.height * .2);
  const frame = { x: rect.x - pad, y: rect.y - top, width: rect.width + pad * 2, height: rect.height + top + pad };
  context.save();
  if (style === "windows") {
    context.shadowColor = "rgba(0,0,0,.3)"; context.shadowBlur = 12; context.shadowOffsetY = 4;
    context.fillStyle = "rgba(246,249,252,.96)"; context.fillRect(frame.x, frame.y, frame.width, frame.height);
    context.shadowColor = "transparent"; context.fillStyle = "#1674d1"; context.fillRect(frame.x, frame.y, frame.width, top);
    context.fillStyle = "#fff"; context.fillRect(frame.x + frame.width - top * .8, frame.y + top * .43, top * .28, 1.5);
    context.strokeStyle = "rgba(13,65,116,.45)"; context.strokeRect(frame.x, frame.y, frame.width, frame.height);
  } else if (style === "mac") {
    context.shadowColor = "rgba(0,0,0,.25)"; context.shadowBlur = 14; context.shadowOffsetY = 5;
    roundedRect(context, frame, Math.max(9, frame.width * .06)); context.fillStyle = "rgba(247,247,249,.97)"; context.fill();
    context.shadowColor = "transparent";
    ["#ff5f57", "#febc2e", "#28c840"].forEach((color, index) => { context.fillStyle = color; context.beginPath(); context.arc(frame.x + 12 + index * 13, frame.y + top / 2, 4, 0, Math.PI * 2); context.fill(); });
    context.strokeStyle = "rgba(36,36,40,.2)"; roundedRect(context, frame, Math.max(9, frame.width * .06)); context.stroke();
  } else {
    context.shadowColor = "rgba(0,0,0,.34)"; context.shadowBlur = 10; context.shadowOffsetY = 4;
    roundedRect(context, frame, Math.max(5, frame.width * .035)); context.fillStyle = "#2b1e19"; context.fill();
    context.shadowColor = "transparent"; context.strokeStyle = "#d7a94c"; context.lineWidth = Math.max(3, pad * .32); roundedRect(context, frame, Math.max(5, frame.width * .035)); context.stroke();
    context.strokeStyle = "#76501f"; context.lineWidth = 1.5; const inset = pad * .55; context.strokeRect(frame.x + inset, frame.y + inset, frame.width - inset * 2, frame.height - inset * 2);
  }
  context.restore();
}

export function liveStickerRect(width: number, height: number): WidgetRect {
  return { x: width * .025, y: height * .035, width: Math.max(72, width * .082), height: Math.max(28, height * .052) };
}

export function drawLiveSticker(context: CanvasRenderingContext2D, width: number, height: number, active = false) {
  const rect = liveStickerRect(width, height);
  context.save();
  context.shadowColor = "rgba(0,0,0,.2)"; context.shadowBlur = 12; context.shadowOffsetY = 3;
  roundedRect(context, rect, rect.height / 2);
  context.fillStyle = active ? "#d62445" : "rgba(24,20,22,.88)"; context.fill();
  context.shadowColor = "transparent";
  context.fillStyle = "#ff365f"; context.beginPath(); context.arc(rect.x + rect.height * .48, rect.y + rect.height / 2, rect.height * .12, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#fff"; context.font = `700 ${Math.max(11, rect.height * .34)}px Manrope, sans-serif`; context.textAlign = "left"; context.textBaseline = "middle";
  context.fillText("LIVE", rect.x + rect.height * .76, rect.y + rect.height / 2);
  context.restore();
}

export function drawRecordingFrame(context: CanvasRenderingContext2D, width: number, height: number, style: WidgetFrameStyle) {
  if (style === "none") return;
  const edge = Math.max(8, Math.min(width, height) * .018);
  context.save();
  if (style === "windows") {
    const bar = Math.max(28, height * .052);
    context.fillStyle = "rgba(247,249,252,.96)"; context.fillRect(0, 0, width, bar);
    context.fillStyle = "#1674d1"; context.fillRect(0, 0, width, Math.max(4, bar * .14));
    context.strokeStyle = "rgba(12,54,96,.65)"; context.lineWidth = edge; context.strokeRect(edge / 2, edge / 2, width - edge, height - edge);
    context.fillStyle = "#29323c"; context.fillRect(width - bar * .86, bar * .5, bar * .26, 2);
    context.strokeStyle = "#29323c"; context.lineWidth = 1.5; context.strokeRect(width - bar * .52, bar * .33, bar * .2, bar * .2);
  } else if (style === "mac") {
    const bar = Math.max(30, height * .054);
    context.fillStyle = "rgba(247,247,249,.96)"; context.fillRect(0, 0, width, bar);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((color, index) => { context.fillStyle = color; context.beginPath(); context.arc(18 + index * 18, bar / 2, 6, 0, Math.PI * 2); context.fill(); });
    context.strokeStyle = "rgba(38,38,42,.5)"; context.lineWidth = edge; context.strokeRect(edge / 2, edge / 2, width - edge, height - edge);
  } else {
    context.strokeStyle = "#2b1e19"; context.lineWidth = edge * 1.8; context.strokeRect(edge * .9, edge * .9, width - edge * 1.8, height - edge * 1.8);
    context.strokeStyle = "#d7a94c"; context.lineWidth = edge * .55; context.strokeRect(edge, edge, width - edge * 2, height - edge * 2);
    context.strokeStyle = "#76501f"; context.lineWidth = 2; context.strokeRect(edge * 1.55, edge * 1.55, width - edge * 3.1, height - edge * 3.1);
    [[edge, edge], [width - edge, edge], [edge, height - edge], [width - edge, height - edge]].forEach(([x, y]) => { context.fillStyle = "#d7a94c"; context.beginPath(); context.arc(x, y, edge * .45, 0, Math.PI * 2); context.fill(); });
  }
  context.restore();
}

export function drawCanvasWidgets(context: CanvasRenderingContext2D, width: number, height: number, widgets: readonly CanvasWidget[], now: number, assets: readonly StudioAsset[] = [], images: ReadonlyMap<string, HTMLImageElement> = new Map(), videos: ReadonlyMap<string, HTMLVideoElement> = new Map(), scenes: readonly StudioScene[] = []) {
  widgets.forEach((widget) => {
    if (!widget.visible) return;
    const rect = widgetRect(widget, width, height);
    context.save();
    drawWidgetFrame(context, rect, widget.frameStyle ?? "none");
    context.shadowColor = "rgba(0,0,0,.22)";
    context.shadowBlur = Math.max(8, width * .008);
    if (widget.kind === "orbit") {
      const members = [
        ...(widget.assetIds ?? []).map((id) => assets.find((asset) => asset.id === id)).filter((item): item is StudioAsset => Boolean(item)).map((asset) => ({ kind: "asset" as const, asset })),
        ...(widget.sceneIds ?? []).map((id) => scenes.find((scene) => scene.id === id)).filter((item): item is StudioScene => Boolean(item)).map((scene) => ({ kind: "scene" as const, scene }))
      ];
      const cards = orbitCardRects(widget, width, height, members.length);
      if (widget.open && cards.length) {
        const visibleCards = cards.map((card, index) => ({ card, member: members[index] })).filter(({ card }) => card.y + card.height > 0 && card.y < height && card.x + card.width > 0 && card.x < width);
        visibleCards.forEach(({ card, member }, visibleIndex) => {
          const elapsed = Math.max(0, now - (widget.openedAt ?? now - 600) - visibleIndex * 55);
          const raw = Math.min(1, elapsed / 360);
          const fan = 1 - Math.pow(1 - raw, 3);
          const anchorX = rect.x + rect.width / 2;
          const anchorY = rect.y + rect.height / 2;
          const animatedCard = {
            x: anchorX + (card.x - anchorX) * fan,
            y: anchorY + (card.y - anchorY) * fan,
            width: card.width * (.72 + .28 * fan),
            height: card.height * (.72 + .28 * fan)
          };
          const radius = Math.max(7, card.width * .1);
          context.save();
          context.globalAlpha = fan;
          context.shadowColor = "rgba(27,18,23,.22)"; context.shadowBlur = Math.max(8, card.width * .12); context.shadowOffsetY = 4;
          roundedRect(context, animatedCard, radius); context.clip();
          context.fillStyle = "#f5f0e8"; context.fillRect(animatedCard.x, animatedCard.y, animatedCard.width, animatedCard.height);
          const previewAsset = member?.kind === "scene" ? assets.find((asset) => member.scene.memberIds.includes(asset.id) && (asset.kind === "image" || asset.kind === "video")) : member?.asset;
          const source = previewAsset?.kind === "image" ? images.get(previewAsset.id) : previewAsset?.kind === "video" ? videos.get(previewAsset.id) : undefined;
          if (source) {
            const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth;
            const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight;
            if (sourceWidth && sourceHeight) {
              const mediaRect = containWidgetMedia(animatedCard, sourceWidth, sourceHeight);
              context.drawImage(source, mediaRect.x, mediaRect.y, mediaRect.width, mediaRect.height);
            }
          }
          if (member?.kind === "scene") {
            context.fillStyle = "rgba(23,19,17,.78)"; context.fillRect(animatedCard.x, animatedCard.y + animatedCard.height * .72, animatedCard.width, animatedCard.height * .28);
            context.fillStyle = "#fff"; context.font = `600 ${Math.max(9, animatedCard.width * .09)}px Manrope, sans-serif`; context.textAlign = "center"; context.textBaseline = "middle";
            context.fillText(member.scene.name, animatedCard.x + animatedCard.width / 2, animatedCard.y + animatedCard.height * .86, animatedCard.width * .86);
          }
          context.restore();
        });
      }
      context.shadowColor = "rgba(0,0,0,.28)";
      context.shadowBlur = Math.max(4, rect.width * .06);
      const cx = rect.x + rect.width / 2; const cy = rect.y + rect.height / 2;
      context.fillStyle = "transparent"; context.beginPath(); context.arc(cx, cy, rect.width * .46, 0, Math.PI * 2); context.fill();
      context.strokeStyle = "transparent"; context.lineWidth = 0; context.stroke();
      const folder = { x: rect.x + rect.width * .06, y: rect.y + rect.height * .25, width: rect.width * .88, height: rect.height * .62 };
      const folderGradient = context.createLinearGradient(folder.x, folder.y, folder.x, folder.y + folder.height);
      folderGradient.addColorStop(0, widget.color ?? "#66c8ff"); folderGradient.addColorStop(1, widget.color ?? "#168bf2");
      context.fillStyle = widget.color ?? "#3eaaf8"; context.beginPath(); context.roundRect(folder.x + folder.width * .07, rect.y + rect.height * .12, folder.width * .46, folder.height * .3, rect.width * .075); context.fill();
      context.fillStyle = folderGradient; context.beginPath(); context.roundRect(folder.x, folder.y, folder.width, folder.height, rect.width * .12); context.fill();
      context.strokeStyle = "rgba(255,255,255,.48)"; context.lineWidth = Math.max(1, rect.width * .016); context.beginPath(); context.roundRect(folder.x + 1, folder.y + 1, folder.width - 2, folder.height - 2, rect.width * .11); context.stroke();
    } else if (widget.kind === "media") {
      const asset = assets.find((candidate) => candidate.id === widget.actionAssetId && (candidate.kind === "image" || candidate.kind === "video"));
      const source = asset?.kind === "image" ? images.get(asset.id) : asset?.kind === "video" ? videos.get(asset.id) : undefined;
      const radius = Math.max(8, rect.width * .1);
      roundedRect(context, rect, radius);
      context.fillStyle = widget.color ?? "#171311";
      context.fill();
      context.shadowColor = "transparent";
      context.save();
      roundedRect(context, { x: rect.x + 2, y: rect.y + 2, width: rect.width - 4, height: rect.height - 4 }, Math.max(6, radius - 2));
      context.clip();
      if (source) {
        const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth;
        const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight;
        if (sourceWidth > 0 && sourceHeight > 0) {
          const scale = Math.max(rect.width / sourceWidth, rect.height / sourceHeight);
          const drawWidth = sourceWidth * scale;
          const drawHeight = sourceHeight * scale;
          context.drawImage(source, rect.x + (rect.width - drawWidth) / 2, rect.y + (rect.height - drawHeight) / 2, drawWidth, drawHeight);
        }
      } else {
        context.fillStyle = "rgba(255,255,255,.09)";
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      context.restore();
      context.save();
      context.strokeStyle = widget.active ? "#ffffff" : "rgba(255,255,255,.72)";
      context.lineWidth = widget.active ? Math.max(3, rect.width * .028) : Math.max(1.5, rect.width * .015);
      roundedRect(context, rect, radius);
      context.stroke();
      context.fillStyle = widget.active ? "#68122f" : "rgba(23,19,17,.84)";
      context.beginPath();
      context.arc(rect.x + rect.width * .82, rect.y + rect.height * .2, rect.height * .14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#fff";
      context.lineWidth = Math.max(1.5, rect.width * .014);
      context.beginPath();
      context.moveTo(rect.x + rect.width * .78, rect.y + rect.height * .24);
      context.lineTo(rect.x + rect.width * .86, rect.y + rect.height * .16);
      context.moveTo(rect.x + rect.width * .81, rect.y + rect.height * .16);
      context.lineTo(rect.x + rect.width * .86, rect.y + rect.height * .16);
      context.lineTo(rect.x + rect.width * .86, rect.y + rect.height * .21);
      context.stroke();
      context.restore();
    } else if (widget.kind === "bullets") {
      roundedRect(context, rect, Math.max(8, rect.width * .045));
      context.fillStyle = "rgba(255,254,250,.96)";
      context.fill();
      context.shadowColor = "transparent";
      context.fillStyle = "#171311";
      context.font = `600 ${Math.max(14, rect.width * .065)}px Manrope, sans-serif`;
      context.fillText(widget.title || "Notes", rect.x + rect.width * .08, rect.y + rect.height * .18, rect.width * .84);
      context.font = `500 ${Math.max(12, rect.width * .052)}px Manrope, sans-serif`;
      widget.items.slice(0, widget.revealed || widget.items.length).forEach((item, index) => {
        const y = rect.y + rect.height * (.36 + index * .18);
        context.fillStyle = widget.color ?? "#68122f";
        context.beginPath();
        context.arc(rect.x + rect.width * .1, y - 4, 3.5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#2d2723";
        context.fillText(item, rect.x + rect.width * .16, y, rect.width * .76);
      });
    } else if (widget.kind === "vinyl") {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      if (widget.playing) {
        context.shadowColor = "rgba(104,18,47,.32)";
        context.shadowBlur = Math.max(10, rect.width * .12);
        context.strokeStyle = "#68122f";
        context.lineWidth = Math.max(3, rect.width * .035);
        context.beginPath(); context.arc(cx, cy, rect.width * .56, 0, Math.PI * 2); context.stroke();
        context.shadowColor = "transparent";
      }
      context.translate(cx, cy);
      context.save();
      if (widget.playing) context.rotate((now % 3600) / 3600 * Math.PI * 2);
      context.fillStyle = "#171311";
      context.beginPath(); context.arc(0, 0, rect.width / 2, 0, Math.PI * 2); context.fill();
      context.strokeStyle = "rgba(255,255,255,.22)";
      for (let ring = .22; ring < .46; ring += .07) { context.beginPath(); context.arc(0, 0, rect.width * ring, 0, Math.PI * 2); context.stroke(); }
      context.fillStyle = widget.color ?? "#68122f";
      context.beginPath(); context.arc(0, 0, rect.width * .18, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#fffefa";
      context.beginPath(); context.arc(0, 0, rect.width * .035, 0, Math.PI * 2); context.fill();
      context.restore();
      if (widget.playing) {
        const badgeRadius = rect.width * .115;
        context.fillStyle = "#68122f";
        context.beginPath(); context.arc(rect.width * .38, -rect.height * .38, badgeRadius, 0, Math.PI * 2); context.fill();
        context.fillStyle = "#fffefa";
        context.beginPath();
        context.moveTo(rect.width * .35, -rect.height * .43);
        context.lineTo(rect.width * .35, -rect.height * .33);
        context.lineTo(rect.width * .43, -rect.height * .38);
        context.closePath(); context.fill();
      }
    } else if (widget.kind === "live") {
      roundedRect(context, rect, rect.height / 2);
      context.fillStyle = "rgba(23,19,17,.9)"; context.fill();
      context.shadowColor = "transparent";
      context.fillStyle = "#ff365f"; context.beginPath(); context.arc(rect.x + rect.height * .28, rect.y + rect.height / 2, rect.height * .1, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#fff"; context.font = `700 ${Math.max(10, rect.height * .24)}px Manrope, sans-serif`; context.textAlign = "left"; context.textBaseline = "middle";
      context.fillText("LIVE", rect.x + rect.height * .46, rect.y + rect.height / 2);
    } else {
      context.shadowColor = "rgba(0,0,0,.3)";
      context.shadowBlur = Math.max(5, rect.width * .065);
      context.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
      context.fillStyle = "transparent";
      context.strokeStyle = widget.color ?? "rgba(255,255,255,.96)";
      context.lineWidth = Math.max(2, rect.width * .05);
      context.font = `700 ${rect.width * .72}px Manrope, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.strokeText(widget.sticker === "heart" ? "♥" : widget.sticker === "spark" ? "✦" : "★", 0, 0);
    }
    context.restore();
  });
}
