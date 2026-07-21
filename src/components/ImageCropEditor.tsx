import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { moveImageCrop, normalizeImageCrop, resizeImageCropFromCorner, type CropCorner } from "../core/mediaEdits";
import type { ImageCrop } from "../types";

type ImageCropEditorProps = {
  sourceUrl: string;
  name: string;
  crop?: ImageCrop;
  onChange: (crop: ImageCrop) => void;
};

type CropDrag = {
  pointerId: number;
  mode: "move" | CropCorner;
  originX: number;
  originY: number;
  crop: ImageCrop;
};

const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

function sameCrop(first: ImageCrop, second: ImageCrop) {
  return first.aspect === second.aspect
    && Math.abs(first.x - second.x) < 0.0001
    && Math.abs(first.y - second.y) < 0.0001
    && Math.abs(first.width - second.width) < 0.0001
    && Math.abs(first.height - second.height) < 0.0001;
}

export function ImageCropEditor({ sourceUrl, name, crop, onChange }: ImageCropEditorProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<CropDrag | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const normalizedCrop = useMemo(
    () => normalizeImageCrop(crop, imageSize.width, imageSize.height),
    [crop, imageSize.height, imageSize.width]
  );

  const pointFromEvent = (event: PointerEvent<HTMLElement>) => {
    const bounds = overlayRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
    };
  };

  const beginDrag = (event: PointerEvent<HTMLElement>, mode: CropDrag["mode"]) => {
    if (!normalizedCrop) return;
    const point = pointFromEvent(event);
    if (!point) return;
    dragRef.current = {
      pointerId: event.pointerId,
      mode,
      originX: point.x,
      originY: point.y,
      crop: normalizedCrop
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  };

  const continueDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const point = pointFromEvent(event);
    if (!point) return;
    const next = drag.mode === "move"
      ? moveImageCrop(drag.crop, point.x - drag.originX, point.y - drag.originY)
      : resizeImageCropFromCorner(drag.crop, drag.mode, point.x, point.y, imageSize.width, imageSize.height);
    onChange(next);
    event.preventDefault();
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!normalizedCrop) return;
    const step = event.shiftKey ? 0.04 : 0.01;
    const delta = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step }
    }[event.key];
    if (!delta) return;
    onChange(moveImageCrop(normalizedCrop, delta.x, delta.y));
    event.preventDefault();
  };

  return (
    <div className="visual-crop-workspace">
      <div className="crop-image-surface">
        <img
          src={sourceUrl}
          alt={`Crop ${name}`}
          draggable={false}
          onLoad={(event) => {
            const size = { width: event.currentTarget.naturalWidth || 1, height: event.currentTarget.naturalHeight || 1 };
            setImageSize(size);
            const modernized = normalizeImageCrop(crop, size.width, size.height);
            if (crop && modernized && !sameCrop(crop, modernized)) onChange(modernized);
          }}
        />
        <div ref={overlayRef} className={`crop-overlay ${normalizedCrop ? "active" : ""}`}>
          {normalizedCrop ? (
            <>
              <i className="crop-shade top" style={{ height: `${normalizedCrop.y * 100}%` }} />
              <i className="crop-shade bottom" style={{ top: `${(normalizedCrop.y + normalizedCrop.height) * 100}%` }} />
              <i className="crop-shade left" style={{ top: `${normalizedCrop.y * 100}%`, width: `${normalizedCrop.x * 100}%`, height: `${normalizedCrop.height * 100}%` }} />
              <i className="crop-shade right" style={{ top: `${normalizedCrop.y * 100}%`, left: `${(normalizedCrop.x + normalizedCrop.width) * 100}%`, height: `${normalizedCrop.height * 100}%` }} />
              <div
                className="crop-selection"
                role="button"
                tabIndex={0}
                aria-label="Move crop selection"
                title="Drag to reposition crop"
                style={{
                  left: `${normalizedCrop.x * 100}%`,
                  top: `${normalizedCrop.y * 100}%`,
                  width: `${normalizedCrop.width * 100}%`,
                  height: `${normalizedCrop.height * 100}%`
                }}
                onPointerDown={(event) => beginDrag(event, "move")}
                onPointerMove={continueDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={moveWithKeyboard}
              >
                <span className="crop-rule vertical first" /><span className="crop-rule vertical second" />
                <span className="crop-rule horizontal first" /><span className="crop-rule horizontal second" />
                {CORNERS.map((corner) => <button
                  key={corner}
                  type="button"
                  className={`crop-corner ${corner}`}
                  aria-label={`Drag ${corner.replace("-", " ")} crop corner`}
                  onPointerDown={(event) => beginDrag(event, corner)}
                  onPointerMove={continueDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                ><i /></button>)}
              </div>
            </>
          ) : <span className="crop-empty-state">Choose a crop shape</span>}
        </div>
      </div>
      {normalizedCrop && <output className="crop-dimensions">{Math.round(normalizedCrop.width * imageSize.width)} × {Math.round(normalizedCrop.height * imageSize.height)} px</output>}
    </div>
  );
}
