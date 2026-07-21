import { describe, expect, it } from "vitest";
import { DeckScrollController } from "./deckScroll";

describe("continuous deck scrolling", () => {
  it("tracks two-finger movement continuously and clamps both edges", () => {
    const scroll = new DeckScrollController();
    scroll.drag(0.8, 0, 4);
    const tracked = scroll.drag(0.69, 16, 4).offset;
    expect(tracked).toBeGreaterThan(0);
    expect(tracked).toBeGreaterThan(0.5);
    expect(tracked).toBeLessThan(1.5);
    let point = 0.69;
    for (let at = 32; at <= 192; at += 16) {
      point -= 0.12;
      scroll.drag(point, at, 4);
    }
    let edge = tracked;
    for (let at = 208; at <= 520; at += 16) edge = scroll.frame(at, 4).offset;
    expect(edge).toBeCloseTo(4, 1);
    scroll.reset(2);
    scroll.drag(0.2, 40, 4);
    point = 0.2;
    for (let at = 56; at <= 216; at += 16) {
      point += 0.12;
      scroll.drag(point, at, 4);
    }
    for (let at = 232; at <= 544; at += 16) edge = scroll.frame(at, 4).offset;
    expect(edge).toBeCloseTo(0, 1);
  });

  it("continues with decaying inertia after release", () => {
    const scroll = new DeckScrollController();
    scroll.drag(0.8, 0, 5);
    const dragged = scroll.drag(0.58, 16, 5).offset;
    scroll.release(20, 5);
    const glide = scroll.release(36, 5);
    expect(glide.offset).toBeGreaterThan(dragged);
    expect(glide.moving).toBe(true);
  });
});
