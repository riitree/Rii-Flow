import { describe, expect, it } from "vitest";
import { activateLayer, hideFocusedLayer, removeLayer } from "./layers";

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
});
