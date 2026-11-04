"use client";

import { BADGES, cleanName, copy, dayKey, earnedBadges, ideasLearned, rankFor, visibleStreak, type DailyMinutes, type IconName } from "@chessschool/design";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, Card, SaveBanner, Segmented, Sheet, TextField, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

export default function YouPage() {
  const { state, ready, setProfile, cue } = useApp();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "name" | "goal" | "badges">(null);
  const [draft, setDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;

  const { profile, progress, account } = state;
  const rank = rankFor(progress.xp);
  const display = profile.name.trim() || copy.you.noName;
  const initial = (profile.name.trim()[0] ?? "").toUpperCase();
  const earned = earnedBadges(progress);
  const ordered = [...BADGES].sort((a, b) => Number(earned.includes(b.id)) - Number(earned.includes(a.id)));
  const toNext = rank.next ? copy.you.toNext(rank.toNext, copy.ranks[rank.next]) : copy.you.topRank;

  const openName = () => {
    setDraft(profile.name);
    setNameError(null);
    setSheet("name");
  };
  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanName(draft);
    if (!clean) {
      setNameError(copy.auth.errors.nameRequired);
      cue("gentle-no");
      return;
    }
    setProfile({ name: clean });
    setSheet(null);
    cue("success");
    toast(copy.you.nameSaved(clean));
    if (account) api.updateMe({ name: clean }).catch(() => {});
  };
  const setGoal = (m: DailyMinutes) => {
    setProfile({ dailyMinutes: m });
    cue("tap");
    if (account) api.updateMe({ dailyMinutes: m }).catch(() => {});
  };

  const stats: { value: number; label: string; icon: IconName }[] = [
    { value: visibleStreak(progress.streak, dayKey(new Date())), label: copy.you.stats.streak, icon: "spark" },
    { value: progress.xp, label: copy.you.stats.xp, icon: "bolt" },
    { value: progress.puzzles.rating, label: copy.you.stats.rating, icon: "puzzle" },
    { value: ideasLearned(progress), label: copy.you.stats.ideas, icon: "learn" },
    { value: progress.games.played, label: copy.you.stats.games, icon: "gym" },
    { value: progress.games.won, label: copy.you.stats.won, icon: "trophy" },
  ];

  const badge = (id: (typeof BADGES)[number]["id"], full?: boolean) => {
    const on = earned.includes(id);
    const c = copy.badges.list[id];
    return (
      <li key={id} className={`badge${on ? " is-on" : ""}`} aria-label={`${c.name}. ${c.body}${on ? "" : ` (${copy.you.badgeLocked})`}`}>
        <span className="badge-icon" aria-hidden>
          <Icon name={on ? "trophy" : "lock"} />
        </span>
        <strong>{c.name}</strong>
        {full ? <span>{c.body}</span> : null}
      </li>
    );
  };

  return (
    <div className="page page-narrow">
      <TopBar
        title={copy.you.title}
        large
        back={false}
        action={
          <Link href="/settings" className="icon-btn" aria-label={copy.you.settings}>
            <Icon name="settings" />
          </Link>
        }
      />

      <Card className="me-card hero">
        <div className="me-row">
          <div className="me-avatar" aria-hidden>
            {initial ? initial : <Cody animation="idle" size={60} />}
          </div>
          <div className="me-id">
            <button type="button" className="me-name" onClick={openName} aria-label={`${display}. ${copy.you.editName}`}>
              <span>{display}</span>
              <Icon name="edit" size={18} />
            </button>
            <span className="muted">{copy.today.level(copy.ranks[rank.rank], rank.level)}</span>
            <span className={`me-chip${account ? " is-member" : ""}`}>{account ? copy.you.member : copy.you.guest}</span>
            {account ? <span className="muted small">{account.email}</span> : null}
          </div>
        </div>
        <div className="rank-bar" role="progressbar" aria-label={toNext} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.fraction * 100)}>
          <span style={{ width: `${Math.round(rank.fraction * 100)}%` }} />
        </div>
        <p className="rank-note">{toNext}</p>
      </Card>

      {!account ? <SaveBanner title={copy.you.saveCard.title} /> : null}

      <Card as="div">
        <ul className="stat-grid">
          {stats.map((s) => (
            <li key={s.label} aria-label={`${s.label}: ${s.value}`}>
              <Icon name={s.icon} size={18} />
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="section-head">
        <h2>{copy.badges.title}</h2>
        <button type="button" className="link-more" onClick={() => setSheet("badges")}>
          {copy.badges.count(earned.length, BADGES.length)} · {copy.you.seeAll}
          <Icon name="chevron" size={18} />
        </button>
      </div>
      <ul className="badge-strip">{ordered.slice(0, 8).map((b) => badge(b.id))}</ul>

      <div className="section-head">
        <h2>{copy.you.prefs}</h2>
      </div>
      <Card className="list">
        <button className="row" onClick={openName}>
          <Icon name="profile" />
          <span className="row-text">
            <span className="row-label">{copy.you.name}</span>
            <span className="row-hint">{display}</span>
          </span>
          <Icon name="chevron" />
        </button>
        <button className="row" onClick={() => setSheet("goal")}>
          <Icon name="clock" />
          <span className="row-text">
            <span className="row-label">{copy.you.goal}</span>
            <span className="row-hint">{copy.you.goalOption(profile.dailyMinutes)}</span>
          </span>
          <Icon name="chevron" />
        </button>
        <Link href="/settings/looks" className="row row-link">
          <Icon name="palette" />
          <span className="row-text">
            <span className="row-label">{copy.settings.looks}</span>
            <span className="row-hint">{copy.you.looksHint}</span>
          </span>
          <Icon name="chevron" />
        </Link>
        <Link href="/settings" className="row row-link">
          <Icon name="settings" />
          <span className="row-text">
            <span className="row-label">{copy.you.settings}</span>
          </span>
          <Icon name="chevron" />
        </Link>
      </Card>

      <Sheet open={sheet === "name"} onClose={() => setSheet(null)} labelledBy="name-title">
        <h2 id="name-title">{copy.you.editName}</h2>
        <p>{copy.you.nameHint}</p>
        <form onSubmit={saveName} className="sheet-wide-field sheet-form">
          <TextField label={copy.you.name} placeholder={copy.auth.namePlaceholder} value={draft} maxLength={40} autoComplete="given-name" onChange={(e) => (setDraft(e.target.value), setNameError(null))} error={nameError} />
          <Button type="submit" block>
            {copy.you.nameSave}
          </Button>
        </form>
      </Sheet>

      <Sheet open={sheet === "goal"} onClose={() => setSheet(null)} labelledBy="goal-title">
        <h2 id="goal-title">{copy.you.goal}</h2>
        <p>{copy.you.goalHint}</p>
        <div className="sheet-wide-field">
          <Segmented<DailyMinutes> label={copy.you.goal} value={profile.dailyMinutes} onChange={setGoal} options={[5, 10, 15].map((m) => ({ value: m as DailyMinutes, label: copy.you.goalOption(m) }))} />
        </div>
        <Button block variant="secondary" onClick={() => setSheet(null)}>
          {copy.analysis.close}
        </Button>
      </Sheet>

      <Sheet open={sheet === "badges"} onClose={() => setSheet(null)} labelledBy="badges-title">
        <h2 id="badges-title">
          {copy.badges.title} · {copy.badges.count(earned.length, BADGES.length)}
        </h2>
        <ul className="badge-grid">{ordered.map((b) => badge(b.id, true))}</ul>
      </Sheet>
    </div>
  );
}
