// Date-only deadlines mean the end of the due date in the workspace's Cairo timezone.
export function dueInstant(date: string) {
  const target = Date.parse(`${date}T23:59:59Z`);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const local = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
    );
    instant += target - local;
  }
  return instant;
}
export function reminderKind(
  task: { dueDate: string | null; reminderMinutes: number },
  now: Date,
) {
  if (!task.dueDate) return null;
  const due = dueInstant(task.dueDate);
  if (now.getTime() > due) return "overdue";
  return now.getTime() >= due - task.reminderMinutes * 60000
    ? "upcoming"
    : null;
}
