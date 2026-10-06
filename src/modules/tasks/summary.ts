import type { Status } from "../shared/types";

export function summarizeTasks(
  tasks: readonly { status: Status; dueDate: string | null }[],
  today: string,
) {
  const summary = { open: 0, overdue: 0, dueToday: 0, completed: 0 };
  for (const task of tasks) {
    if (task.status === "done") {
      summary.completed++;
      continue;
    }
    summary.open++;
    if (task.dueDate && task.dueDate < today) summary.overdue++;
    if (task.dueDate === today) summary.dueToday++;
  }
  return summary;
}
