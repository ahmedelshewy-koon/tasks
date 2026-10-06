"use client";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronUp,
  CircleHelp,
  Eye,
  EyeOff,
  Globe2,
  House,
  Layers3,
  List,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { request } from "./api";
import { ErrorBox, type Translate } from "./primitives";
import type { Language } from "./i18n";
import { SanaaBrand } from "./sanaa-brand";
import "./login.css";

const columns = [
  { label: "Planning", tone: "plan", done: false },
  { label: "In progress", tone: "progress", done: false },
  { label: "Ready to go", tone: "ready", done: true },
] as const;

export function Login({
  development,
  lang,
  t,
  onLanguage,
}: {
  development: boolean;
  lang: Language;
  t: Translate;
  onLanguage: (lang: Language) => void;
}) {
  const [identity, setIdentity] = useState("local-admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="signin">
      <section className="signin-panel">
        <div className="signin-blob blob-a" aria-hidden="true" />
        <div className="signin-blob blob-b" aria-hidden="true" />
        <div
          className="signin-lang"
          role="group"
          aria-label={t("Language")}
        >
          <Globe2 size={17} aria-hidden="true" />
          {(["en", "ar"] as const).map((code) => (
            <button
              key={code}
              type="button"
              lang={code}
              className={lang === code ? "active" : ""}
              aria-pressed={lang === code}
              onClick={() => lang !== code && onLanguage(code)}
            >
              {code === "en" ? "English" : "العربية"}
            </button>
          ))}
        </div>
        <div className="signin-card">
          <h2>{t("Welcome to TASK")}</h2>
          <p className="signin-lead">
            {t(
              development
                ? "Choose a development identity"
                : "Sign in with your HR account to reach your workspace.",
            )}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                await request("/api/auth", {
                  method: "POST",
                  body: JSON.stringify(
                    development
                      ? { token: identity, remember }
                      : { email, password, remember },
                  ),
                });
                window.location.reload();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {development ? (
              <>
                <div className="signin-dev">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <div>
                    <strong>{t("Local development")}</strong>
                    <p>
                      {t(
                        "These local identities are for testing permissions. No HR connection or sample work is included.",
                      )}
                    </p>
                  </div>
                </div>
                <div className="signin-field">
                  <label htmlFor="login-identity">
                    {t("Choose a development identity")}
                  </label>
                  <div className="signin-input">
                    <select
                      id="login-identity"
                      value={identity}
                      onChange={(e) => setIdentity(e.target.value)}
                    >
                      <option value="local-admin">Local admin</option>
                      <option value="local-manager">Local manager</option>
                      <option value="local-employee">Local employee</option>
                      <option value="local-colleague">Local colleague</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="signin-field">
                  <label htmlFor="login-email">{t("Work email")}</label>
                  <div className="signin-input">
                    <input
                      id="login-email"
                      dir="ltr"
                      placeholder="name@company.com"
                      disabled={busy}
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Mail size={19} className="signin-icon" aria-hidden="true" />
                  </div>
                </div>
                <div className="signin-field">
                  <label htmlFor="login-password">{t("Password")}</label>
                  <div className="signin-input">
                    <input
                      id="login-password"
                      dir="ltr"
                      disabled={busy}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <LockKeyhole
                      size={19}
                      className="signin-icon"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className="signin-eye"
                      aria-label={t(
                        showPassword ? "Hide password" : "Show password",
                      )}
                      aria-controls="login-password"
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            )}
            <div className="signin-options">
              {!development && (
                <button
                  type="button"
                  className="signin-link"
                  aria-expanded={help}
                  aria-controls="login-help"
                  onClick={() => setHelp(!help)}
                >
                  {t("Forgot password?")}
                </button>
              )}
              <label className="signin-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>{t("Remember me on this device")}</span>
              </label>
            </div>
            {help && (
              <p className="signin-help" id="login-help" role="status">
                <CircleHelp size={16} aria-hidden="true" />
                {t("To reset your password, contact your HR administrator.")}
              </p>
            )}
            {error && <ErrorBox error={t(error)} />}
            <button
              className="signin-submit"
              disabled={busy}
              aria-busy={busy}
            >
              <span>
                {t(
                  busy
                    ? "Signing in"
                    : development
                      ? "Open local workspace"
                      : "Continue with HR",
                )}
              </span>
              {busy ? (
                <LoaderCircle size={19} className="login-spinner" />
              ) : (
                <ArrowRight size={19} className="signin-arrow" />
              )}
            </button>
          </form>
          <div className="signin-divider">
            <span>{t("One account for TASK and HR")}</span>
          </div>
          <p className="signin-secure">
            <ShieldCheck size={15} aria-hidden="true" />
            {t("Secure sign-in through Sanaa HR")}
          </p>
        </div>
      </section>

      <section className="signin-story">
        <div className="story-shape shape-a" aria-hidden="true" />
        <div className="story-shape shape-b" aria-hidden="true" />
        <div className="story-dots dots-a" aria-hidden="true" />
        <div className="story-dots dots-b" aria-hidden="true" />
        <div className="signin-brand">
          <SanaaBrand />
        </div>
        <div className="story-copy">
          <span className="story-eyebrow">SANAA WORKSPACE</span>
          <h1>
            {t("One place for work")} <em>{t("that matters.")}</em>
          </h1>
          <p>
            {t(
              "Manage projects, tasks, people and progress in one place, and achieve more with your team.",
            )}
          </p>
        </div>
        <div className="story-art" aria-hidden="true">
          <div className="art-window">
            <span className="art-window-dots">
              <i />
              <i />
              <i />
            </span>
            <div className="art-main">
              <div className="art-head">
                <span className="art-head-icon">
                  <Layers3 size={20} />
                </span>
                <div>
                  <strong>{t("Project workspace")}</strong>
                  <small>{t("A little more clarity. Every day.")}</small>
                </div>
                <span className="art-head-line" />
              </div>
              <div className="art-board">
                {columns.map((column) => (
                  <div className={`art-col tone-${column.tone}`} key={column.label}>
                    <span className="art-col-label">
                      <i />
                      {t(column.label)}
                    </span>
                    <div className="art-card">
                      <span className="art-bar" />
                      <span className="art-line" />
                      <span className="art-card-foot">
                        {column.done ? (
                          <span className="art-done">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        ) : (
                          <CalendarDays size={15} />
                        )}
                        <Users size={15} />
                      </span>
                    </div>
                    <span className="art-skeleton" />
                  </div>
                ))}
              </div>
            </div>
            <nav className="art-rail">
              <span className="active">
                <House size={17} />
              </span>
              <span>
                <List size={17} />
              </span>
              <span>
                <Users size={17} />
              </span>
              <span>
                <CalendarDays size={17} />
              </span>
              <span>
                <BarChart3 size={17} />
              </span>
            </nav>
          </div>
          <div className="art-float">
            <span className="art-float-icon">
              <ChevronUp size={22} strokeWidth={2.4} />
            </span>
            <div>
              <strong>{t("Better together")}</strong>
              <small>{t("One team. A shared direction.")}</small>
            </div>
            <BarChart3 size={30} className="art-float-chart" />
          </div>
          <div className="art-note">
            <svg viewBox="0 0 60 70" className="art-arrow">
              <path d="M52 64 C 20 62, 6 40, 14 6" />
              <path d="M8 14 L14 5 L20 13" />
            </svg>
            <span>{t("From plans to progress")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
