"use client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  X,
  Check,
  Circle,
  Clock3,
  Flag,
  Inbox,
  LoaderCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { priorityLabels, statusLabels } from "./i18n";
import type { Status, Priority } from "@/modules/shared/types";
export type Translate = (text: string) => string;
export function Modal({
  title,
  description,
  children,
  onClose,
  drawer = false,
  page = false,
  t,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
  page?: boolean;
  t: Translate;
}) {
  if (page)
    return (
      <section className="detail-page" aria-label={title}>
        <div className="detail-page-title">
          <button
            type="button"
            className="back-arrow"
            onClick={onClose}
            aria-label={t("Back")}
          >
            <ArrowRight size={20} />
          </button>
          <h1>{title}</h1>
        </div>
        {drawer ? children : <div className="detail-page-card">{children}</div>}
      </section>
    );
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={drawer ? "dialog drawer" : "dialog modal"}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description className={description ? "muted" : "sr-only"}>
                {description || title}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label={t("Close")}>
              <X size={19} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function StatusBadge({ status, t }: { status: Status; t: Translate }) {
  const Icon =
    status === "done" ? Check : status === "in_progress" ? Clock3 : Circle;
  return (
    <span className={`badge status-${status}`}>
      <Icon size={12} />
      {t(statusLabels[status])}
    </span>
  );
}
export function PriorityBadge({
  priority,
  t,
}: {
  priority: Priority;
  t: Translate;
}) {
  return (
    <span className={`priority priority-${priority}`}>
      <Flag size={12} />
      {t(priorityLabels[priority])}
    </span>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span className={`avatar ${small ? "small" : ""}`} title={name}>
      {name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function Loading({ t }: { t: Translate }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{t("Loading workspace…")}</span>
    </div>
  );
}
export function ErrorBox({ error }: { error: string }) {
  return (
    <div role="alert" className="error-box">
      {error}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
