"use client";

import { badgeKind, BADGES, copy, earnedBadges, focusCourse, isUnitBadge, unitFinishDay, type BadgeId, type BadgeKind, type IconName } from "@chessschool/design";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Sheet, TopBar } from "@/components/ui";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";

type Filter = "all" | "certs" | "badges";
const ICON: Record<BadgeKind, IconName> = { streak: "spark", win: "trophy", puzzle: "star", practice: "practice", learn: "learn" };

/** Achievements and certificates together: finished units are certificates, every other achievement a badge. */
export default function TrophiesPage() {
  const { state, ready } = useApp();
  const course = useCourse();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<BadgeId | null>(null);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const t = copy.trophies;
  const earned = earnedBadges(state.progress, state.ratings);
  const badges = BADGES.filter((b) => !isUnitBadge(b.id)).sort((a, b) => Number(earned.includes(b.id)) - Number(earned.includes(a.id)));
  const certs = state.account && course ? [...focusCourse(course, state.progress.completed).unitsDone].reverse() : [];
  const chips: [Filter, string][] = [
    ["all", t.all],
    ["certs", t.certificates],
    ["badges", t.badges],
  ];
  const opened = open ? copy.badges.list[open] : null;
  return (
    <div className="page page-narrow trophies">
      <TopBar title={t.title} />
      <p className="muted">{t.summary(earned.filter((id) => !isUnitBadge(id)).length, badges.length, certs.length)}</p>
      <div className="trophy-filters" role="tablist" aria-label={t.title}>
        {chips.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? "is-on" : ""} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {filter !== "badges" ? (
        certs.length ? (
          <ul className="trophy-certs">
            {certs.map((u) => {
              const day = course ? unitFinishDay(course, state.progress.completed, u.id) : null;
              return (
                <li key={u.id}>
                  <Link href={`/certificate/${encodeURIComponent(u.id)}`} className="trophy-cert">
                    <span className="trophy-cert-art" aria-hidden>
                      <Icon name="trophy" size={26} />
                      <span />
                    </span>
                    <span className="trophy-cert-text">
                      <span className="eyebrow trophy-kicker">{t.certKicker}</span>
                      <strong>{u.title.replace(/^Unit \d+ · /, "")}</strong>
                      {day ? <span className="muted small">{new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span> : null}
                    </span>
                    <Icon name="chevron" size={20} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted small">{state.account ? t.noCerts : t.signIn}</p>
        )
      ) : null}

      {filter !== "certs" ? (
        <ul className="trophy-badges">
          {badges.map((b) => {
            const on = earned.includes(b.id);
            const bc = copy.badges.list[b.id];
            return (
              <li key={b.id}>
                <button type="button" className={`trophy-badge${on ? " is-on" : ""}`} data-kind={badgeKind(b.id)} onClick={() => setOpen(b.id)} aria-label={`${bc.name}. ${bc.body}${on ? "" : ` (${copy.you.badgeLocked})`}`}>
                  <span className="trophy-badge-tile" aria-hidden>
                    <Icon name={on ? ICON[badgeKind(b.id)] : "lock"} size={24} />
                  </span>
                  <strong>{bc.name}</strong>
                  <span>{bc.body}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="muted small trophy-hint">{t.hint}</p>

      <Sheet open={open !== null} onClose={() => setOpen(null)} labelledBy="trophy-title">
        {open && opened ? (
          <div className="trophy-sheet">
            <span className={`trophy-badge-tile is-big${earned.includes(open) ? " is-on" : ""}`} data-kind={badgeKind(open)} aria-hidden>
              <Icon name={earned.includes(open) ? ICON[badgeKind(open)] : "lock"} size={44} />
            </span>
            <h2 id="trophy-title">{opened.name}</h2>
            <p className="muted">{opened.body}</p>
            <Button block variant="secondary" onClick={() => setOpen(null)}>
              {copy.analysis.close}
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
