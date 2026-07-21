import { describe, expect, it } from "vitest";
import { moveVideoTrimHandle } from "./mediaEdits";
import { timelineTimeFromPoint } from "../components/TrimTimeline";

describe("visual trim timeline", () => {
  it("maps pointer position to video time and clamps beyond the track", () => {
    expect(timelineTimeFromPoint(150, 100, 200, 20)).toBe(5);
    expect(timelineTimeFromPoint(20, 100, 200, 20)).toBe(0);
    expect(timelineTimeFromPoint(400, 100, 200, 20)).toBe(20);
  });

  it("moves the in handle without changing the out point", () => {
    expect(moveVideoTrimHandle({ start: 1, end: 8 }, "start", 3.5, 10)).toEqual({ start: 3.5, end: 8 });
  });

  it("moves the out handle without changing the in point", () => {
    expect(moveVideoTrimHandle({ start: 2, end: 9 }, "end", 6.25, 10)).toEqual({ start: 2, end: 6.25 });
  });

  it("keeps the minimum trim span when handles meet", () => {
    expect(moveVideoTrimHandle({ start: 2, end: 8 }, "start", 9, 10)).toEqual({ start: 7.75, end: 8 });
    expect(moveVideoTrimHandle({ start: 2, end: 8 }, "end", 1, 10)).toEqual({ start: 2, end: 2.25 });
  });
});
