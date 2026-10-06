import { CalendarDays, CheckCheck, Clock3, ListTodo } from "lucide-react";
import { summarizeTasks } from "@/modules/tasks/summary";
import type { Task } from "./api";
import { dateToday, type Language } from "./i18n";
import type { Translate } from "./primitives";

export function TeamTaskSummary({
  tasks,
  t,
  lang,
}: {
  tasks: Task[];
  t: Translate;
  lang: Language;
}) {
  const summary = summarizeTasks(tasks, dateToday());
  const number = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-GB");
  const cards = [
    {
      key: "open",
      label: "Open tasks",
      hint: "To do and in progress",
      icon: ListTodo,
    },
    {
      key: "overdue",
      label: "Overdue",
      hint: "Past due and still open",
      icon: Clock3,
    },
    {
      key: "dueToday",
      label: "Due today",
      hint: "Open tasks due today",
      icon: CalendarDays,
    },
    {
      key: "completed",
      label: "Done",
      hint: "Completed team tasks",
      icon: CheckCheck,
    },
  ] as const;
  return (
    <section className="team-task-summary" aria-label={t("Team overview")}>
      <dl className="team-summary-grid">
        {cards.map(({ key, label, hint, icon: Icon }) => (
          <div key={key} className={`team-summary-card summary-${key}`}>
            <dt>
              <span>{t(label)}</span>
              <Icon size={21} aria-hidden="true" />
            </dt>
            <dd>
              {number.format(summary[key])}
              <span className="team-summary-hint">{t(hint)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="team-summary-note">
        {t("Summary includes all team tasks, regardless of filters.")}
      </p>
    </section>
  );
}
