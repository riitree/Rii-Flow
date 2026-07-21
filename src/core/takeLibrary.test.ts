import { describe, expect, it } from "vitest";
import { mergeTakeLibrary, takesForProject, type ProjectTake } from "./takeLibrary";

interface TestTake extends ProjectTake {
  name: string;
}

const take = (id: string, projectId: string, createdAt: number, folderBacked = true): TestTake => ({
  id,
  projectId,
  createdAt,
  folderBacked,
  name: id
});

describe("project take library", () => {
  it("shows only the takes owned by the selected project", () => {
    const library = [take("a-1", "project-a", 3), take("b-1", "project-b", 2), take("a-2", "project-a", 1)];

    expect(takesForProject(library, "project-a").map((item) => item.id)).toEqual(["a-1", "a-2"]);
    expect(takesForProject(library, "project-b").map((item) => item.id)).toEqual(["b-1"]);
    expect(takesForProject(library, "new-project")).toEqual([]);
  });

  it("keeps session-only takes available while refreshing persisted metadata", () => {
    const persisted = [take("saved", "project-a", 2)];
    const cached = [take("session", "project-a", 3, false), { ...take("saved", "project-a", 1), name: "stale" }];

    const merged = mergeTakeLibrary(persisted, cached);

    expect(merged.map((item) => item.id)).toEqual(["session", "saved"]);
    expect(merged.find((item) => item.id === "saved")?.name).toBe("saved");
  });
});
