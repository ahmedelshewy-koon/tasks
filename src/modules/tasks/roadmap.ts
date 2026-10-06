type RoadmapTask = {
  id: string;
  sectionId: string | null;
  parentId: string | null;
  status: string;
  dueDate: string | null;
};
type RoadmapSection = { id: string; name: string; position: number };

export function buildRoadmap<T extends RoadmapTask>(
  sections: RoadmapSection[],
  tasks: T[],
) {
  const roots = tasks.filter((t) => !t.parentId);
  const ordered = [...sections].sort((a, b) => a.position - b.position);
  const ungrouped = roots.filter(
    (t) => !ordered.some((s) => s.id === t.sectionId),
  );
  const groups = ordered.map((s) => ({
    ...s,
    tasks: roots.filter((t) => t.sectionId === s.id),
  }));
  if (ungrouped.length || !groups.length)
    groups.push({
      id: "ungrouped",
      name: "Unassigned stage",
      position: groups.length,
      tasks: ungrouped,
    });
  const stages = groups.map((s) => {
    const completed = s.tasks.filter((t) => t.status === "done").length;
    const dates = s.tasks.flatMap((t) => (t.dueDate ? [t.dueDate] : [])).sort();
    return {
      ...s,
      completed,
      complete: s.tasks.length > 0 && completed === s.tasks.length,
      dueDate: dates.at(-1) ?? null,
    };
  });
  const completed = roots.filter((t) => t.status === "done").length;
  const complete = roots.length > 0 && stages.every((s) => s.complete);
  return {
    stages,
    total: roots.length,
    completed,
    complete,
    progress: complete
      ? 100
      : Math.min(99, Math.round((completed / Math.max(1, roots.length)) * 100)),
  };
}
