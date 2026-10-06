"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { command, type Field as CustomField, type Project } from "./api";
import { ErrorBox, Field, Modal, type Translate } from "./primitives";

const typeLabels = {
  text: "Text",
  number: "Number",
  select: "Select",
  date: "Date",
} as const;

export function FieldsManager({
  project,
  t,
  onClose,
}: {
  project: Project;
  t: Translate;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<CustomField | "new" | null>(null);
  const [type, setType] = useState<CustomField["type"]>("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string>();
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await client.invalidateQueries({ queryKey: ["workspace"] });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const current = editing && editing !== "new" ? editing : null;
  return (
    <Modal
      title={t("Custom fields")}
      description={t(
        "Project-level fields shown in task details and the list view.",
      )}
      t={t}
      onClose={onClose}
    >
      <div className="form-body">
        {!project.fields.length && !editing && (
          <p className="helper">{t("No custom fields yet.")}</p>
        )}
        {!editing && (
          <ul className="field-list">
            {project.fields.map((f) => (
              <li key={f.id}>
                <span dir="auto">
                  <strong>{f.name}</strong>
                  <small className="muted">
                    {t(typeLabels[f.type])}
                    {f.type === "select" && ` · ${f.options.join("، ")}`}
                  </small>
                </span>
                <button
                  className="icon-button"
                  aria-label={`${t("Edit")}: ${f.name}`}
                  onClick={() => {
                    setType(f.type);
                    setEditing(f);
                  }}
                >
                  <Pencil size={14} />
                </button>
                {removing === f.id ? (
                  <span className="button-group">
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          await run(() =>
                            command(
                              "removeField",
                              { fieldId: f.id },
                              project.id,
                            ),
                          )
                        )
                          setRemoving(undefined);
                      }}
                    >
                      {t("Remove field and its values")}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setRemoving(undefined)}
                    >
                      {t("Cancel")}
                    </button>
                  </span>
                ) : (
                  <button
                    className="icon-button"
                    aria-label={`${t("Remove")}: ${f.name}`}
                    onClick={() => setRemoving(f.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {editing ? (
          <form
            key={current?.id ?? "new"}
            className="feature-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (
                await run(() =>
                  command(
                    "saveField",
                    {
                      id: current?.id,
                      name: form.get("name"),
                      type,
                      options:
                        type === "select"
                          ? String(form.get("options") || "")
                              .split(/[,،\n]/)
                              .map((o) => o.trim())
                              .filter(Boolean)
                          : [],
                    },
                    project.id,
                  ),
                )
              )
                setEditing(null);
            }}
          >
            <Field label={t("Field name")}>
              <input
                name="name"
                required
                maxLength={80}
                autoFocus
                defaultValue={current?.name}
              />
            </Field>
            <Field label={t("Type")}>
              <select
                value={type}
                disabled={!!current}
                onChange={(e) =>
                  setType(e.target.value as CustomField["type"])
                }
              >
                {Object.entries(typeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </Field>
            {current && (
              <p className="helper">
                {t("A field’s type cannot be changed after it is created.")}
              </p>
            )}
            {type === "select" && (
              <Field label={t("Options")}>
                <textarea
                  name="options"
                  rows={3}
                  required
                  defaultValue={current?.options.join("\n")}
                  placeholder={t("One option per line, or separated by commas")}
                />
              </Field>
            )}
            {type === "select" && current && (
              <p className="helper">
                {t("Tasks using a removed option are cleared.")}
              </p>
            )}
            {error && <ErrorBox error={t(error)} />}
            <div className="form-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setError("");
                  setEditing(null);
                }}
              >
                {t("Cancel")}
              </button>
              <button className="button primary" disabled={busy}>
                {t(busy ? "Saving" : "Save field")}
              </button>
            </div>
          </form>
        ) : (
          <>
            {error && <ErrorBox error={t(error)} />}
            <div className="form-footer">
              <button
                className="button primary"
                disabled={project.fields.length >= 30}
                onClick={() => {
                  setType("text");
                  setError("");
                  setEditing("new");
                }}
              >
                {t("Add field")}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
