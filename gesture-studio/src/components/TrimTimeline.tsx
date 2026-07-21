import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { moveVideoTrimHandle } from "../core/mediaEdits";

type TrimHandle = "start" | "end";

type TrimTimelineProps = {
  sourceUrl: string;
  duration: number;
  start: number;
  end: number;
  playhead: number;
  disabled?: boolean;
  generateThumbnails?: boolean;
  label: string;
  onChange: (start: number, end: number, handle: TrimHandle) => void;
  onSeek: (time: number) => void;
};

const THUMBNAIL_COUNT = 10;
const thumbnailCache = new Map<string, string[]>();

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function timelineTimeFromPoint(clientX: number, left: number, width: number, duration: number) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(duration) || duration <= 0) return 0;
  return clamp(((clientX - left) / width) * duration, 0, duration);
}

function formatTimelineTime(seconds: number) {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remaining.toFixed(2).padStart(5, "0")}`;
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadedmetadata" | "seeked", timeout = 3500) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Video ${eventName} timed out.`));
    }, timeout);
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video could not be decoded for timeline thumbnails."));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function useTimelineThumbnails(sourceUrl: string, duration: number, enabled: boolean) {
  const cacheKey = `${sourceUrl}|${duration.toFixed(3)}|${THUMBNAIL_COUNT}`;
  const [thumbnails, setThumbnails] = useState<string[]>(() => thumbnailCache.get(cacheKey) ?? []);

  useEffect(() => {
    const cached = thumbnailCache.get(cacheKey);
    if (cached) {
      setThumbnails(cached);
      return;
    }
    setThumbnails([]);
    if (!enabled || !sourceUrl || duration <= 0) return;

    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const createThumbnails = async () => {
      try {
        video.src = sourceUrl;
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) await waitForVideoEvent(video, "loadedmetadata");
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;
        const frames: string[] = [];
        const safeDuration = Math.min(duration, Number.isFinite(video.duration) ? video.duration : duration);
        for (let index = 0; index < THUMBNAIL_COUNT; index += 1) {
          if (cancelled) return;
          const time = Math.min(Math.max(0, safeDuration - 0.04), ((index + 0.5) / THUMBNAIL_COUNT) * safeDuration);
          if (Math.abs(video.currentTime - time) > 0.015) {
            video.currentTime = time;
            await waitForVideoEvent(video, "seeked");
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL("image/jpeg", 0.72));
        }
        if (!cancelled && frames.length) {
          thumbnailCache.set(cacheKey, frames);
          setThumbnails(frames);
        }
      } catch {
        // The timeline remains fully usable if a browser cannot decode thumbnails.
      } finally {
        video.removeAttribute("src");
        video.load();
      }
    };

    void createThumbnails();
    return () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [cacheKey, duration, enabled, sourceUrl]);

  return thumbnails;
}

export function TrimTimeline({ sourceUrl, duration, start, end, playhead, disabled = false, generateThumbnails = true, label, onChange, onSeek }: TrimTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbnails = useTimelineThumbnails(sourceUrl, duration, generateThumbnails);
  const safeDuration = Math.max(0, duration);
  const startPercent = safeDuration ? clamp((start / safeDuration) * 100, 0, 100) : 0;
  const endPercent = safeDuration ? clamp((end / safeDuration) * 100, 0, 100) : 100;
  const playheadPercent = safeDuration ? clamp((playhead / safeDuration) * 100, 0, 100) : 0;
  const frames = useMemo(() => thumbnails.length ? thumbnails : Array.from({ length: THUMBNAIL_COUNT }, () => ""), [thumbnails]);

  const timeAtPointer = (clientX: number) => {
    const bounds = trackRef.current?.getBoundingClientRect();
    return bounds ? timelineTimeFromPoint(clientX, bounds.left, bounds.width, safeDuration) : 0;
  };

  const moveHandle = (handle: TrimHandle, value: number) => {
    if (disabled || !safeDuration) return;
    const next = moveVideoTrimHandle({ start, end }, handle, value, safeDuration);
    onChange(next.start, next.end, handle);
  };

  const beginHandleDrag = (event: PointerEvent<HTMLButtonElement>, handle: TrimHandle) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveHandle(handle, timeAtPointer(event.clientX));
    event.stopPropagation();
    event.preventDefault();
  };

  const continueHandleDrag = (event: PointerEvent<HTMLButtonElement>, handle: TrimHandle) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    moveHandle(handle, timeAtPointer(event.clientX));
    event.stopPropagation();
    event.preventDefault();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, handle: TrimHandle) => {
    if (disabled || !safeDuration) return;
    const current = handle === "start" ? start : end;
    const fineStep = Math.max(0.01, safeDuration / 1000);
    const step = event.shiftKey ? Math.max(0.25, fineStep * 10) : fineStep;
    let next: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - step;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + step;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = safeDuration;
    if (next === null) return;
    moveHandle(handle, next);
    event.preventDefault();
  };

  return (
    <div className={`trim-timeline ${disabled ? "disabled" : ""}`} aria-label={label}>
      <div
        ref={trackRef}
        className="trim-timeline-track"
        onPointerDown={(event) => {
          if (disabled || !safeDuration) return;
          onSeek(timeAtPointer(event.clientX));
          event.preventDefault();
        }}
      >
        <div className={`trim-filmstrip ${thumbnails.length ? "ready" : "loading"}`} aria-hidden="true">
          {frames.map((frame, index) => frame
            ? <img key={`${frame.slice(-16)}-${index}`} src={frame} alt="" draggable={false} />
            : <i key={index} />)}
        </div>
        <i className="trim-outside-mask before" style={{ width: `${startPercent}%` }} aria-hidden="true" />
        <i className="trim-outside-mask after" style={{ left: `${endPercent}%`, width: `${100 - endPercent}%` }} aria-hidden="true" />
        <i className="trim-selected-range" style={{ left: `${startPercent}%`, width: `${Math.max(0, endPercent - startPercent)}%` }} aria-hidden="true" />
        <i className="trim-playhead" style={{ left: `${playheadPercent}%` }} aria-hidden="true"><b /></i>
        {(["start", "end"] as const).map((handle) => {
          const value = handle === "start" ? start : end;
          return <button
            key={handle}
            type="button"
            role="slider"
            className={`trim-handle ${handle}`}
            style={{ left: `${handle === "start" ? startPercent : endPercent}%` }}
            aria-label={`${label} ${handle === "start" ? "in" : "out"} handle`}
            aria-valuemin={0}
            aria-valuemax={safeDuration}
            aria-valuenow={Number(value.toFixed(3))}
            aria-valuetext={formatTimelineTime(value)}
            disabled={disabled || !safeDuration}
            onPointerDown={(event) => beginHandleDrag(event, handle)}
            onPointerMove={(event) => continueHandleDrag(event, handle)}
            onKeyDown={(event) => handleKeyDown(event, handle)}
          ><span>{handle === "start" ? "IN" : "OUT"}</span><i /></button>;
        })}
      </div>
      <div className="trim-timeline-readout">
        <span><small>In</small><strong>{formatTimelineTime(start)}</strong></span>
        <span className="duration"><small>Selected</small><strong>{formatTimelineTime(Math.max(0, end - start))}</strong></span>
        <span><small>Out</small><strong>{formatTimelineTime(end)}</strong></span>
      </div>
      <small className="trim-timeline-hint">Drag the blue handles to choose the start and end. Click the filmstrip to seek.</small>
    </div>
  );
}
