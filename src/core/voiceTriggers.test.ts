import { describe, expect, it } from "vitest";
import { matchVoiceTrigger, normalizeTriggerWord, suggestAssetTrigger, suggestSceneTrigger, triggerCollision, triggerTargets } from "./voiceTriggers";
import type { StudioAsset, StudioScene } from "../types";

const asset = (id: string, name: string, triggerWord?: string): StudioAsset => ({ id, name, triggerWord, kind: "image", placement: "corner", size: "small", dataView: "table" });

describe("voice trigger suggestions", () => {
  it("picks a meaningful distinct noun from a filename", () => {
    expect(suggestAssetTrigger(asset("a", "Sales dashboard final.png"), new Set(["sales"]))).toBe("dashboard");
  });

  it("uses data headings when a filename is generic", () => {
    expect(suggestAssetTrigger({ name: "data.csv", kind: "csv", rows: [{ Revenue: 20, Quarter: "Q1" }] })).toBe("revenue");
  });

  it("can derive a scene cue from its members", () => {
    const assets = [asset("a", "Product.png", "product"), asset("b", "Proof.png", "proof")];
    expect(suggestSceneTrigger({ name: "New collage", memberIds: ["a", "b"] }, assets)).toBe("product");
  });
});

describe("voice trigger matching", () => {
  const targets = [
    { id: "a", kind: "asset" as const, name: "Dashboard", triggerWord: "dashboard" },
    { id: "b", kind: "scene" as const, name: "Sales dashboard", triggerWord: "sales dashboard" }
  ];

  it("finds a cue inside natural speech and prefers the longer phrase", () => {
    expect(matchVoiceTrigger("and here is the sales dashboards", targets)?.id).toBe("b");
  });

  it("does not match partial words", () => {
    expect(matchVoiceTrigger("we dashed forward", targets)).toBeNull();
  });

  it("recovers common transcription spelling and compound-word errors", () => {
    expect(matchVoiceTrigger("here is the dash board", targets)?.id).toBe("a");
    expect(matchVoiceTrigger("show the dashbord please", targets)?.id).toBe("a");
  });

  it("keeps fuzzy recovery strict enough to reject unrelated words", () => {
    const pricing = [{ id: "price", kind: "asset" as const, name: "Pricing", triggerWord: "pricing" }];
    expect(matchVoiceTrigger("the numbers are rising", pricing)).toBeNull();
    expect(matchVoiceTrigger("we need more productivity", [{ ...targets[0], triggerWord: "product" }])).toBeNull();
  });

  it("detects conflicts across assets and scenes", () => {
    expect(triggerCollision("Dashboard", "other", targets)).toBe(true);
    expect(normalizeTriggerWord("  Product---View  ")).toBe("product view");
  });

  it("excludes scene members from the voice target list", () => {
    const assets = [asset("a", "One.png", "one"), asset("b", "Two.png", "two")];
    const scenes: StudioScene[] = [{ id: "s", name: "Group", triggerWord: "group", memberIds: ["a"], placement: "center", size: "medium", layout: "grid" }];
    expect(triggerTargets(assets, scenes).map((target) => target.id)).toEqual(["s", "b"]);
  });
});
