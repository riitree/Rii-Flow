import { describe, expect, it } from "vitest";
import type { StudioConcept } from "./concepts";
import { IntentEngine } from "./intentEngine";

const concept = (id: string, name: string, aliases: string[]): StudioConcept => ({
  id,
  displayName: name,
  aliases,
  assetIds: [id],
  primaryAssetId: id,
  confirmationGesture: "pinch",
  animation: "fade",
  cooldownMs: 650,
  sceneIds: []
});

describe("intent engine", () => {
  const concepts = [concept("dashboard", "Dashboard", ["dashboard", "analytics"]), concept("pricing", "Pricing", ["pricing", "plans"]), concept("architecture", "Architecture", ["architecture", "system design"])];

  it("ranks every mentioned concept without spawning anything", () => {
    const queue = new IntentEngine().update("Today let's compare the dashboard with the pricing page", concepts, 1_000);
    expect(queue.map((candidate) => candidate.conceptId)).toEqual(expect.arrayContaining(["dashboard", "pricing"]));
    expect(queue).toHaveLength(2);
  });

  it("withholds confirmation when two concepts are equally likely", () => {
    const queue = new IntentEngine().update("dashboard pricing", concepts, 1_000);
    expect(queue[0].confirmable).toBe(false);
  });

  it("moves immediately to the latest distinct concept", () => {
    const engine = new IntentEngine();
    expect(engine.update("dashboard", concepts, 1_000)[0].conceptId).toBe("dashboard");
    expect(engine.update("pricing", concepts, 1_500)[0]).toMatchObject({ conceptId: "pricing", confirmable: true });
  });

  it("accepts natural aliases and conservative transcription errors", () => {
    const engine = new IntentEngine();
    expect(engine.update("let's see the plans", concepts, 1_000)[0]).toMatchObject({ conceptId: "pricing", confirmable: true });
    expect(engine.update("open the dashbord", concepts, 2_000)[0].conceptId).toBe("dashboard");
    expect(engine.update("show the dash board", concepts, 3_000)[0]).toMatchObject({ conceptId: "dashboard", confirmable: true });
  });
});
