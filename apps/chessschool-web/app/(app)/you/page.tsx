"use client";

import { AVATARS, BADGES, FLAIRS, countryName, flagOf, isUnitBadge, cleanName, copy, dayKey, earnedBadges, focusCourse, ideasLearned, rankFor, visibleStreak, type AvatarId, type DailyMinutes, type FlairId, type IconName } from "@chessschool/design";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { InviteCard } from "@/components/Growth";
import { RatingChart } from "@/components/RatingChart";
import { SkillsCard } from "@/components/SkillsCard";
import { Cody } from "@/components/Lottie";
import { Button, Card, SaveBanner, Segmented, Sheet, TextField, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";

export default function YouPage() {
  const { state, ready, setProfile, cue } = useApp();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "name" | "goal" | "picture">(null);
  const [draft, setDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const nameForm = useRef<HTMLFormElement>(null);
  const course = useCourse();
  useEffect(() => {
    if (sheet !== "name") return;
    const t = setTimeout(() => nameForm.current?.querySelector("input")?.focus(), 320);
    return () => clearTimeout(t);
  }, [sheet]);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;

  const { profile, progress, account } = state;
  const rank = rankFor(progress.xp);
  const display = profile.name.trim() || copy.you.noName;
  const earned = earnedBadges(progress, state.ratings);
  // Certificates come from the server, so only signed-in learners have them.
  const finishedUnits = account && course ? focusCourse(course, progress.completed).unitsDone : [];
  const toNext = rank.next ? copy.you.toNext(rank.toNext, copy.ranks[rank.next]) : copy.you.topRank;

  const saveLook = (patch: { avatar?: AvatarId; flair?: FlairId | null }) => {
    setProfile(patch);
    cue("tap");
    if (account) api.updateMe(patch).catch(() => {});
  };
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
          <button type="button" className="me-avatar" aria-label={copy.you.avatar} onClick={() => setSheet("picture")}>
            {profile.avatar === "cody" ? <Cody animation="idle" size={60} /> : <img src={`/coaches/${profile.avatar}.png`} alt="" width={72} height={72} />}
          </button>
          <div className="me-id">
            <button type="button" className="me-name" onClick={openName} aria-label={`${display}. ${copy.you.editName}`}>
              <span>{display}</span>
              <Icon name="edit" size={18} />
            </button>
            <span className="muted">{profile.flair ? copy.you.flairs[profile.flair] : copy.today.level(copy.ranks[rank.rank], rank.level)}</span>
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

      <RatingChart />

      <SkillsCard skills={progress.skills} />

      <InviteCard />

      <Link href="/trophies" className="card trophy-link" aria-label={copy.trophies.open}>
        <span className="trophy-link-top">
          <span className="eyebrow">{copy.trophies.title}</span>
          <Icon name="chevron" size={20} />
        </span>
        <span className="muted small">{copy.trophies.summary(earned.filter((id) => !isUnitBadge(id)).length, BADGES.filter((b) => !isUnitBadge(b.id)).length, finishedUnits.length)}</span>
        <span className="trophy-link-row">
          {earned
            .filter((id) => !isUnitBadge(id))
            .slice(-5)
            .reverse()
            .map((id) => (
              <span key={id} aria-hidden>
                <Icon name="trophy" size={20} />
              </span>
            ))}
          {finishedUnits.length ? (
            <span aria-hidden>
              <Icon name="doc" size={18} /> {finishedUnits.length}
            </span>
          ) : null}
        </span>
      </Link>

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
        <button className="row" onClick={() => setSheet("picture")}>
          <Icon name="profile" />
          <span className="row-text">
            <span className="row-label">{copy.you.avatar}</span>
            <span className="row-hint">{copy.you.avatarHint}</span>
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
        <Link href="/country" className="row row-link">
          <Icon name="flag" />
          <span className="row-text">
            <span className="row-label">{copy.country.title}</span>
            <span className="row-hint">{profile.country ? `${flagOf(profile.country)} ${countryName(profile.country)}` : copy.country.none}</span>
          </span>
          <Icon name="chevron" />
        </Link>
        <Link href="/leaderboard" className="row row-link">
          <Icon name="trophy" />
          <span className="row-text">
            <span className="row-label">{copy.board.open}</span>
            <span className="row-hint">{copy.board.global}</span>
          </span>
          <Icon name="chevron" />
        </Link>
        <Link href="/gym/review" className="row row-link">
          <Icon name="history" />
          <span className="row-text">
            <span className="row-label">{copy.you.review}</span>
            <span className="row-hint">{copy.gym.review.body}</span>
          </span>
          <Icon name="chevron" />
        </Link>
        <Link href="/class" className="row row-link">
          <Icon name="club" />
          <span className="row-text">
            <span className="row-label">{copy.you.class}</span>
            <span className="row-hint">{copy.you.classHint}</span>
          </span>
          <Icon name="chevron" />
        </Link>
        <Link href="/learners" className="row row-link">
          <Icon name="profile" />
          <span className="row-text">
            <span className="row-label">{copy.learners.title}</span>
            <span className="row-hint">{copy.learners.hint}</span>
          </span>
          <Icon name="chevron" />
        </Link>
      </Card>

      <Sheet open={sheet === "name"} onClose={() => setSheet(null)} labelledBy="name-title">
        <h2 id="name-title">{copy.you.editName}</h2>
        <p>{copy.you.nameHint}</p>
        <form ref={nameForm} onSubmit={saveName} className="sheet-wide-field sheet-form">
          <TextField label={copy.you.name} placeholder={copy.auth.namePlaceholder} value={draft} maxLength={40} autoComplete="given-name" onChange={(e) => (setDraft(e.target.value), setNameError(null))} error={nameError} />
          <Button type="submit" block>
            {copy.you.nameSave}
          </Button>
        </form>
      </Sheet>

      <Sheet open={sheet === "picture"} onClose={() => setSheet(null)} labelledBy="picture-title">
        <h2 id="picture-title">{copy.you.avatar}</h2>
        <p>{copy.you.avatarHint}</p>
        <div className="avatar-grid" role="radiogroup" aria-label={copy.you.avatar}>
          {AVATARS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={profile.avatar === id} className={`avatar-pick${profile.avatar === id ? " is-on" : ""}`} onClick={() => saveLook({ avatar: id })}>
              {id === "cody" ? <Cody animation="idle" size={64} /> : <img src={`/coaches/${id}.png`} alt="" width={72} height={72} />}
              <span>{id === "cody" ? "Chaukor" : id[0].toUpperCase() + id.slice(1)}</span>
            </button>
          ))}
        </div>
        <h3>{copy.you.flair}</h3>
        <div className="flair-list" role="radiogroup" aria-label={copy.you.flair}>
          {FLAIRS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={profile.flair === id} className={`choice${profile.flair === id ? " is-on" : ""}`} onClick={() => saveLook({ flair: profile.flair === id ? null : id })}>
              {copy.you.flairs[id]}
            </button>
          ))}
        </div>
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

    </div>
  );
}
