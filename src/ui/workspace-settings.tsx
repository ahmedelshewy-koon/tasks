"use client";

import { ShieldCheck, UserRound } from "lucide-react";
import type { Employee } from "@/modules/shared/types";
import { Avatar, type Translate } from "./primitives";
import styles from "./workspace-settings.module.css";

export function WorkspaceSettings({ me, t }: { me: Employee; t: Translate }) {
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <span className={styles.eyebrow}>{t("Your workspace")}</span>
        <h1>{t("Your profile")}</h1>
      </header>

      <div className={styles.grid}>
        <section
          className={styles.card}
          aria-labelledby="settings-profile-title"
        >
          <div className={styles.cardHeading}>
            <span className={styles.icon}>
              <UserRound size={21} />
            </span>
            <div>
              <h2 id="settings-profile-title">{t("Your profile")}</h2>
              <p>{t("Your account and work details")}</p>
            </div>
          </div>
          <div className={styles.identity}>
            <Avatar name={me.name} />
            <div>
              <h3>
                <bdi>{me.name}</bdi>
              </h3>
              <p>
                <bdi>{me.jobTitle || t("Not specified")}</bdi>
              </p>
            </div>
          </div>
          <dl className={styles.details}>
            {[
              ["Email", me.email],
              ["Company", me.company],
              ["Department", me.department],
              ["Branch", me.branch],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{t(label)}</dt>
                <dd>
                  <bdi dir={label === "Email" ? "ltr" : "auto"}>
                    {value || t("Not specified")}
                  </bdi>
                </dd>
              </div>
            ))}
          </dl>
          <div className={styles.hrNote}>
            <ShieldCheck size={19} />
            <div>
              <strong>{t("Managed by Sanaa HR")}</strong>
              <p>{t("To update these details, contact your HR team.")}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
