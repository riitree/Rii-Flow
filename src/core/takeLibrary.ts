export interface ProjectTake {
  id: string;
  projectId: string;
  createdAt: number;
  folderBacked: boolean;
}

export function mergeTakeLibrary<T extends ProjectTake>(persisted: T[], cached: T[]) {
  const merged = new Map(persisted.map((take) => [take.id, take]));
  cached.forEach((take) => {
    if (!take.folderBacked) merged.set(take.id, take);
  });
  return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function takesForProject<T extends ProjectTake>(takes: T[], projectId: string) {
  return takes.filter((take) => take.projectId === projectId);
}
