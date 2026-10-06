import type { Actor, Employee } from "../shared/types";

export const reportIds = (actor: Actor) =>
  actor.subordinateIds ?? actor.directReportIds;

// HR manager references are employee IDs; task assignments use user IDs.
export function subordinateUserIds(
  me: Employee,
  directory: Employee[],
): string[] {
  const employees = new Map(
    directory.map((employee) => [employee.employeeId, employee]),
  );
  employees.set(me.employeeId, me);
  const ancestors = new Set<string>([me.employeeId]);
  let managerId = me.managerId;
  while (managerId) {
    if (ancestors.has(managerId)) return [];
    ancestors.add(managerId);
    managerId = employees.get(managerId)?.managerId ?? null;
  }
  const descendants = new Set<string>();
  // Multiple active login identities can reference the same HR employee.
  // Use the map for manager traversal, but retain every assignable user ID.
  for (const employee of directory) {
    if (ancestors.has(employee.employeeId) || employee.userId === me.userId)
      continue;
    const visited = new Set<string>([employee.employeeId]);
    let parent = employee.managerId;
    while (parent && !visited.has(parent)) {
      if (parent === me.employeeId) {
        descendants.add(employee.userId);
        break;
      }
      visited.add(parent);
      parent = employees.get(parent)?.managerId ?? null;
    }
  }
  return [...descendants];
}
