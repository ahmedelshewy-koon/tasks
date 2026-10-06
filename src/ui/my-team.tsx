"use client";
import { reportIds } from "../modules/hr/hierarchy";
import type { Actor, Employee } from "@/modules/shared/types";
import { Building2, Layers3, Mail, MapPin, Users } from "lucide-react";
import { Avatar, Empty, type Translate } from "./primitives";

export function MyTeam({
  actor,
  employees,
  t,
}: {
  actor: Actor;
  employees: Employee[];
  t: Translate;
}) {
  const reports = new Set(reportIds(actor));
  const team = employees.filter(
    (person) => reports.has(person.userId) && person.userId !== actor.userId,
  );
  if (!team.length)
    return (
      <Empty
        title={t("No team members")}
        description={t(
          "Employees below you in the organization will appear here when linked in HR.",
        )}
      />
    );
  return (
    <>
      <p className="team-directory-summary">
        <Users size={16} aria-hidden="true" />
        {t("Team members")}
        <span>{team.length}</span>
      </p>
      <ul className="team-directory">
        {team.map((person) => (
          <li className="panel team-person" key={person.userId}>
            <div className="team-person-heading">
              <Avatar name={person.name} />
              <div>
                <h3 dir="auto">{person.name}</h3>
                <p dir="auto">{person.jobTitle || t("Not specified")}</p>
              </div>
            </div>
            <dl>
              {[
                {
                  label: "Department",
                  value: person.department,
                  Icon: Layers3,
                },
                { label: "Company", value: person.company, Icon: Building2 },
                { label: "Branch", value: person.branch, Icon: MapPin },
              ].map(({ label, value, Icon }) => (
                <div key={label}>
                  <dt>
                    <Icon size={15} aria-hidden="true" />
                    {t(label)}
                  </dt>
                  <dd>
                    <bdi>{value || t("Not specified")}</bdi>
                  </dd>
                </div>
              ))}
              <div className="team-person-email">
                <dt>
                  <Mail size={15} aria-hidden="true" />
                  {t("Work email")}
                </dt>
                <dd>
                  <a href={`mailto:${person.email}`} dir="ltr">
                    {person.email}
                  </a>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
