"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Hash, X } from "lucide-react";
import type { Field, Task, Workspace } from "./api";
import { Avatar, type Translate } from "./primitives";
import { commentParts } from "../modules/work/mentions";

export function TagEditor({
  task,
  data,
  t,
  busy,
  mutate,
}: {
  task: Task;
  data: Workspace;
  t: Translate;
  busy: boolean;
  mutate: (action: string, values?: unknown) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const names = task.tagIds
    .map((id) => data.tags.find((tag) => tag.id === id)?.name)
    .filter((name): name is string => !!name);
  const save = (next: string[]) => mutate("setTaskTags", { names: next });
  const add = async () => {
    const name = draft.trim().replace(/^#/, "");
    if (!name) return;
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    if (await save([...names, name])) setDraft("");
  };
  return (
    <section className="detail-section feature-stack" aria-busy={busy}>
      <h3>
        <Hash size={15} />
        {t("Tags")}
      </h3>
      <div className="tag-chips editable">
        {!names.length && <p className="helper">{t("No tags")}</p>}
        {names.map((name) => (
          <span className="tag-chip" key={name} dir="auto">
            #{name}
            {task.canEdit && (
              <button
                type="button"
                aria-label={`${t("Remove")}: ${name}`}
                disabled={busy}
                onClick={() => save(names.filter((n) => n !== name))}
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
      </div>
      {task.canEdit && (
        <form
          className="feature-row"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            aria-label={t("Add tag")}
            placeholder={t("Add or reuse a tag")}
            list={listId}
            maxLength={40}
            value={draft}
            disabled={busy || names.length >= 20}
            onChange={(e) => setDraft(e.target.value)}
          />
          <datalist id={listId}>
            {data.tags
              .filter((tag) => !names.includes(tag.name))
              .map((tag) => (
                <option key={tag.id} value={tag.name} />
              ))}
          </datalist>
          <button
            className="button secondary"
            disabled={busy || !draft.trim()}
          >
            {t("Add")}
          </button>
        </form>
      )}
    </section>
  );
}

export function FieldValues({
  task,
  fields,
  t,
  busy,
  mutate,
}: {
  task: Task;
  fields: Field[];
  t: Translate;
  busy: boolean;
  mutate: (action: string, values?: unknown) => Promise<boolean>;
}) {
  if (!fields.length) return null;
  const set = (fieldId: string, value: string) => {
    if ((task.fieldValues[fieldId] ?? "") === value) return;
    void mutate("setFieldValue", { fieldId, value: value || null });
  };
  return (
    <section className="detail-section feature-stack" aria-busy={busy}>
      <h3>{t("Custom fields")}</h3>
      <div className="form-grid custom-field-grid">
        {fields.map((field) => {
          const value = task.fieldValues[field.id] ?? "";
          const common = {
            "aria-label": field.name,
            disabled: busy || !task.canEdit,
          };
          return (
            <label className="field" key={`${field.id}-${value}`}>
              <span dir="auto">{field.name}</span>
              {field.type === "select" ? (
                <select
                  {...common}
                  value={value}
                  onChange={(e) => set(field.id, e.target.value)}
                >
                  <option value="">{t("Not set")}</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === "date" ? (
                <input
                  {...common}
                  type="date"
                  defaultValue={value}
                  onChange={(e) => set(field.id, e.target.value)}
                />
              ) : (
                <input
                  {...common}
                  type={field.type === "number" ? "number" : "text"}
                  step="any"
                  inputMode={field.type === "number" ? "decimal" : undefined}
                  maxLength={500}
                  defaultValue={value}
                  dir="auto"
                  onBlur={(e) => set(field.id, e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function CommentBody({
  body,
  data,
}: {
  body: string;
  data: Workspace;
}) {
  return (
    <p dir="auto">
      {commentParts(body).map((part, i) =>
        part.kind === "text" ? (
          <span key={i}>{part.text}</span>
        ) : (
          <span
            key={i}
            className={`mention ${part.userId === data.actor.userId ? "is-me" : ""}`}
          >
            @
            {data.employees.find((e) => e.userId === part.userId)?.name ??
              part.label}
          </span>
        ),
      )}
    </p>
  );
}

type Person = { userId: string; name: string };
// Shows "@Name" while typing; tokens with user IDs are produced on submit.
export function MentionTextarea({
  people,
  t,
  disabled,
  onSubmit,
}: {
  people: Person[];
  t: Translate;
  disabled: boolean;
  onSubmit: (body: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<Person[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const matches =
    query === null
      ? []
      : people
          .filter((p) =>
            p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
          )
          .slice(0, 6);
  // Names contain spaces, so keep the query open while it still matches someone.
  const detect = (value: string, caret: number) => {
    const match = /(^|\s)@([^@\n]{0,30})$/.exec(value.slice(0, caret));
    const q = match?.[2] ?? null;
    const open =
      q !== null &&
      (!/\s/.test(q) ||
        people.some((p) =>
          p.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()),
        ));
    setQuery(open ? q : null);
    setIndex(0);
  };
  const pick = (person: Person) => {
    const area = ref.current!;
    const caret = area.selectionStart;
    const before = text
      .slice(0, caret)
      .replace(/@([^@\n]{0,30})$/, `@${person.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setChosen((list) =>
      list.some((p) => p.userId === person.userId) ? list : [...list, person],
    );
    setQuery(null);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(before.length, before.length);
    });
  };
  const encode = () => {
    let body = text;
    // Longest names first so "Sara Ali" wins over "Sara".
    for (const person of [...chosen].sort(
      (a, b) => b.name.length - a.name.length,
    ))
      body = body.split(`@${person.name}`).join(
        `@[${person.name.replace(/[\]\n]/g, " ")}](${person.userId})`,
      );
    return body;
  };
  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!matches.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setIndex(
        (i) =>
          (i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) %
          matches.length,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(matches[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery(null);
    }
  };
  return (
    <form
      className="comment-form mention-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSubmit(encode())) {
          setText("");
          setChosen([]);
        }
      }}
    >
      <div className="mention-field">
        <textarea
          ref={ref}
          aria-label={t("Write a comment…")}
          placeholder={t("Write a comment… Type @ to mention a project member")}
          value={text}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            matches.length ? `${listId}-${index}` : undefined
          }
          onChange={(e) => {
            setText(e.target.value);
            detect(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={keyDown}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          required
          maxLength={4000}
          dir="auto"
        />
        {matches.length > 0 && (
          <ul className="mention-menu" role="listbox" id={listId}>
            {matches.map((person, i) => (
              <li
                key={person.userId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === index}
                className={i === index ? "active" : ""}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(person);
                }}
              >
                <Avatar small name={person.name} />
                <span>{person.name}</span>
              </li>
            ))}
          </ul>
        )}
        {query !== null && !matches.length && (
          <p className="helper mention-empty">
            {t("No project member matches this name.")}
          </p>
        )}
      </div>
      <button
        className="button secondary small-button"
        disabled={disabled || !text.trim()}
      >
        {t("Post comment")}
      </button>
    </form>
  );
}
