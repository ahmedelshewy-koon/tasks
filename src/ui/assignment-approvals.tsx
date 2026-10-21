"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { command, type Workspace } from "./api";
import { Avatar, ErrorBox, type Translate } from "./primitives";
import { priorityLabels, type Language } from "./i18n";
import { formatDate } from "./task-views";

// Cross-department requests waiting for this manager's decision.
export function AssignmentApprovals({
  data,
  t,
  lang,
  onChanged,
}: {
  data: Workspace;
  t: Translate;
  lang: Language;
  onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!data.assignmentApprovals.length) return null;
  async function decide(id: string, approve: boolean) {
    setBusy(id);
    setError("");
    try {
      await command("decideAssignment", { approve, note: notes[id] || "" }, id);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel assignment-approvals">
      <h2>{t("Assignment approvals")}</h2>
      <p className="helper">
        {t(
          "Managers from other departments want to assign these tasks to your team.",
        )}
      </p>
      {error && <ErrorBox error={t(error)} />}
      {data.assignmentApprovals.map((r) => (
        <article className="approval-row" key={r.id}>
          <div className="approval-main">
            <strong>{r.task.title}</strong>
            {r.task.description && <p>{r.task.description}</p>}
            <dl>
              <div>
                <dt>{t("For")}</dt>
                <dd>
                  <Avatar small name={r.userName || r.userId} />
                  {r.userName || r.userId}
                </dd>
              </div>
              <div>
                <dt>{t("Requested by")}</dt>
                <dd>{r.requesterName || r.requestedBy}</dd>
              </div>
              <div>
                <dt>{t("Priority")}</dt>
                <dd>{t(priorityLabels[r.task.priority])}</dd>
              </div>
              {r.task.dueDate && (
                <div>
                  <dt>{t("Due")}</dt>
                  <dd>{formatDate(r.task.dueDate, t, lang)}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="approval-actions">
            <input
              placeholder={t("Reason (optional)")}
              maxLength={1000}
              value={notes[r.id] || ""}
              onChange={(e) =>
                setNotes((n) => ({ ...n, [r.id]: e.target.value }))
              }
            />
            <button
              className="button primary small-button"
              disabled={!!busy}
              onClick={() => decide(r.id, true)}
            >
              <Check size={16} />
              {t("Approve")}
            </button>
            <button
              className="button secondary small-button"
              disabled={!!busy}
              onClick={() => decide(r.id, false)}
            >
              <X size={16} />
              {t("Reject")}
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
