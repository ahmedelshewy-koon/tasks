export type Recurrence = "daily" | "weekly" | "monthly";

function step(date: string, rule: Recurrence, count: number) {
  const [y, m, d] = date.split("-").map(Number);
  if (rule === "monthly") {
    // Clamp to the month's last day, so Jan 31 repeats on Feb 28/29.
    const target = new Date(Date.UTC(y, m - 1 + count, 1));
    const last = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(d, last));
    return target.toISOString().slice(0, 10);
  }
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + count * (rule === "weekly" ? 7 : 1));
  return next.toISOString().slice(0, 10);
}

// The next occurrence after `due`, skipping any that already passed `today`.
export function nextDueDate(due: string, rule: Recurrence, today: string) {
  let count = 1;
  let next = step(due, rule, count);
  while (next < today && count < 5000) next = step(due, rule, ++count);
  return next;
}

// Calendar date in the workspace timezone, matching due-date semantics.
export const cairoToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export function addDays(date: string, count: number) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + count);
  return next.toISOString().slice(0, 10);
}

export const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86400000,
  );
