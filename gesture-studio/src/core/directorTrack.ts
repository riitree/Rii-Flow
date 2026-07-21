export type DirectorEventKind = "visual" | "scene" | "deck" | "transform" | "spotlight";
export type DirectorEventSource = "gesture" | "pointer" | "director" | "system";

export interface DirectorTrackEvent {
  id: string;
  assetId: string;
  label: string;
  startMs: number;
  endMs: number | null;
  kind: DirectorEventKind;
  source: DirectorEventSource;
  action?: string;
}

export function closeOpenDirectorEvents(events: DirectorTrackEvent[], atMs: number) {
  const safeTime = Math.max(0, atMs);
  return events.map((event) => event.endMs === null
    ? { ...event, endMs: Math.max(event.startMs, safeTime) }
    : event);
}

export function appendDirectorEvent(
  events: DirectorTrackEvent[],
  event: Omit<DirectorTrackEvent, "id">,
  id: string = crypto.randomUUID()
) {
  const closed = closeOpenDirectorEvents(events, event.startMs);
  return [...closed, { ...event, id }];
}

export function removeDirectorEvent(events: DirectorTrackEvent[], id: string) {
  return events.filter((event) => event.id !== id);
}

export function nudgeDirectorEvent(events: DirectorTrackEvent[], id: string, deltaMs: number) {
  return events.map((event) => {
    if (event.id !== id) return event;
    const duration = event.endMs === null ? null : Math.max(0, event.endMs - event.startMs);
    const startMs = Math.max(0, event.startMs + deltaMs);
    return { ...event, startMs, endMs: duration === null ? null : startMs + duration };
  }).sort((a, b) => a.startMs - b.startMs);
}

export function normalizeDirectorTrack(events: DirectorTrackEvent[] | undefined) {
  if (!Array.isArray(events)) return [];
  return events
    .filter((event) => event && typeof event.id === "string" && Number.isFinite(event.startMs))
    .map((event) => ({
      ...event,
      startMs: Math.max(0, event.startMs),
      endMs: event.endMs === null ? null : Math.max(Math.max(0, event.startMs), Number(event.endMs) || 0),
      kind: event.kind ?? "visual",
      source: event.source ?? "system"
    }))
    .sort((a, b) => a.startMs - b.startMs);
}
