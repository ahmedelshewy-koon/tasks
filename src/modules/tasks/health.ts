import { daysBetween as days } from "./recurrence";
export type Health = "on_track" | "at_risk" | "off_track" | "completed";
export type HealthReason =
  | "project_completed"
  | "all_tasks_done"
  | "past_due_date"
  | "overdue_tasks"
  | "many_overdue_tasks"
  | "overdue_milestones"
  | "behind_schedule"
  | "far_behind_schedule"
  | "due_soon";
export type HealthInput = {
  status: "active" | "completed";
  total: number;
  progress: number;
  overdueTasks: number;
  overdueMilestones: number;
  startDate: string | null;
  dueDate: string | null;
  today: string;
};

// Suggested health from delivery signals. Every state lists the signals that
// produced it so managers can see why, and override when they know better.
export function suggestHealth(input: HealthInput): {
  health: Health;
  reasons: HealthReason[];
} {
  if (input.status === "completed")
    return { health: "completed", reasons: ["project_completed"] };
  if (input.total > 0 && input.progress === 100)
    return { health: "completed", reasons: ["all_tasks_done"] };
  const off: HealthReason[] = [];
  const risk: HealthReason[] = [];
  if (input.dueDate && input.dueDate < input.today) off.push("past_due_date");
  const overdueShare = input.total ? input.overdueTasks / input.total : 0;
  // One late task is a risk; a quarter of the plan running late is not on track.
  const manyOverdue = input.overdueTasks >= 2 && overdueShare >= 0.25;
  if (input.overdueTasks > 0)
    (manyOverdue ? off : risk).push(
      manyOverdue ? "many_overdue_tasks" : "overdue_tasks",
    );
  if (input.overdueMilestones > 0)
    (input.overdueMilestones >= 2 ? off : risk).push("overdue_milestones");
  // Compare time elapsed with work completed across the project window.
  if (
    input.startDate &&
    input.dueDate &&
    input.startDate < input.dueDate &&
    input.today > input.startDate &&
    input.today <= input.dueDate &&
    input.total > 0
  ) {
    const elapsed =
      (days(input.startDate, input.today) /
        days(input.startDate, input.dueDate)) *
      100;
    const gap = elapsed - input.progress;
    if (gap >= 40) off.push("far_behind_schedule");
    else if (gap >= 20) risk.push("behind_schedule");
  }
  if (
    input.dueDate &&
    input.dueDate >= input.today &&
    days(input.today, input.dueDate) <= 7 &&
    input.progress < 80
  )
    risk.push("due_soon");
  if (off.length) return { health: "off_track", reasons: [...off, ...risk] };
  if (risk.length) return { health: "at_risk", reasons: risk };
  return { health: "on_track", reasons: [] };
}
