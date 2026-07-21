import { describe, expect, it } from "vitest";
import { appendDirectorEvent, closeOpenDirectorEvents, nudgeDirectorEvent, removeDirectorEvent, type DirectorTrackEvent } from "./directorTrack";

const event: DirectorTrackEvent = { id: "one", assetId: "asset", label: "Logo", startMs: 100, endMs: 400, kind: "visual", source: "gesture" };

describe("director track", () => {
  it("closes an open cue before appending the next one", () => {
    const result = appendDirectorEvent([{ ...event, endMs: null }], { ...event, startMs: 500, endMs: null, label: "Scene" }, "two");
    expect(result[0].endMs).toBe(500);
    expect(result[1].id).toBe("two");
  });

  it("nudges without moving before zero and keeps duration", () => {
    expect(nudgeDirectorEvent([event], "one", -250)[0]).toMatchObject({ startMs: 0, endMs: 300 });
  });

  it("removes one event and safely closes open events", () => {
    expect(removeDirectorEvent([event], "one")).toEqual([]);
    expect(closeOpenDirectorEvents([{ ...event, startMs: 500, endMs: null }], 200)[0].endMs).toBe(500);
  });
});
