import { describe, expect, it } from "vitest";
import { activateLayer, hideFocusedLayer, removeLayer, topmostStageHit, topmostStageHitForPoints } from "./layers";

describe("live overlay layers", () => {
  it("keeps previous media visible when a new asset activates", () => {
    expect(activateLayer(["first"], "second")).toEqual(["first", "second"]);
  });

  it("raises a visible asset without duplicating it", () => {
    expect(activateLayer(["first", "second", "third"], "first")).toEqual(["second", "third", "first"]);
  });

  it("hides only the focused layer and returns focus to the previous one", () => {
    expect(hideFocusedLayer(["first", "second"])).toEqual({
      stack: ["first"],
      hiddenId: "second",
      focusedId: "first"
    });
  });

  it("removes a specific layer without disturbing the others", () => {
    expect(removeLayer(["first", "second", "third"], "second")).toEqual(["first", "third"]);
  });

  it("selects the top-most visual layer at the clicked stage point", () => {
    expect(topmostStageHit([
      { layerId: "first", rect: { x: 0, y: 0, width: 100, height: 100 } },
      { layerId: "second", rect: { x: 50, y: 50, width: 100, height: 100 } }
    ], { x: 75, y: 75 })?.layerId).toBe("second");
  });

  it("preserves a scene member identity in stage hit results", () => {
    expect(topmostStageHit([
      { layerId: "scene:one", rect: { x: 0, y: 0, width: 200, height: 200 } },
      { layerId: "scene:one", sceneMemberId: "asset-two", rect: { x: 100, y: 0, width: 100, height: 200 } }
    ], { x: 150, y: 100 })).toMatchObject({ layerId: "scene:one", sceneMemberId: "asset-two" });
  });

  it("lets either palm target the top-most visible layer", () => {
    expect(topmostStageHitForPoints([
      { layerId: "older", rect: { x: 20, y: 20, width: 80, height: 80 } },
      { layerId: "newer", rect: { x: 140, y: 20, width: 80, height: 80 } }
    ], [{ x: 300, y: 300 }, { x: 60, y: 60 }])?.layerId).toBe("older");
  });
});
