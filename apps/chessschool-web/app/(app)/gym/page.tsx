"use client";

import { BOTS } from "@chessschool/chess";
import { aiExplainOn, botRatingOf, canUseGym, copy, type IconName } from "@chessschool/design";
import Link from "next/link";
import { AiBadge } from "@/components/AiCoach";
import { BotAvatar } from "@/components/BotAvatar";
import { GymGuestCard } from "@/components/GymGuestCard";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { ChallengeButton } from "@/components/Growth";
import { Button, Card, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

const MODES: { key: keyof typeof copy.gym; href: string; icon: IconName; locked?: boolean }[] = [
  { key: "friend", href: "/play?mode=friend", icon: "club" },
  { key: "shuffle", href: "/play?mode=shuffle", icon: "shuffle" },
  { key: "position", href: "/play?mode=position", icon: "pawn" },
  { key: "endgames", href: "/play?mode=endgame", icon: "trophy" },
  { key: "club", href: "/rooms/club", icon: "lock", locked: true },
];

export default function GymPage() {
  const { state, ready } = useApp();
  // Bots play with AI for signed-in learners while AI is on (same rule as the game page).
  const aiOn = Boolean(state.account) && aiExplainOn(state);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  if (!canUseGym(state.account)) return <GymGuestCard />;
  const bots = state.progress.bots;
  return (
    <div className="page">
      <TopBar title={copy.gym.title} large back={false} />
      <p className="page-lead">{copy.gym.body}</p>

      <Card className="gym-hero">
        <div>
          <h2 className="card-title">{state.activeGame ? copy.play.resume : copy.gym.quick}</h2>
          <p className="muted">{state.activeGame ? copy.play.resumeBody(Math.ceil(state.activeGame.history.length / 2)) : copy.gym.quickBody}</p>
          <Button href={state.activeGame ? "/play?resume=1" : "/play?bot=pip&quick=1"} icon="play">
            {state.activeGame ? copy.play.resume : copy.play.start}
          </Button>
        </div>
        <Cody animation="wave" size={120} className="gym-hero-cody" />
      </Card>
      <ChallengeButton block />

      <section aria-labelledby="bots-title" className="gym-section">
        <h2 id="bots-title" className="card-title">
          {copy.gym.bots}
        </h2>
        {aiOn ? (
          <p className="ai-banner">
            <span aria-hidden>
              <Icon name="sparkles" size={18} />
            </span>
            <span>
              <strong>{copy.ai.onTitle}</strong> {copy.ai.onBody}
            </span>
          </p>
        ) : null}
        <ul className="bots">
          {BOTS.map((b) => (
            <li key={b.id}>
              <Link href={`/play?bot=${b.id}`} className="bot-card" aria-label={`${b.name}. ${b.label}. ${copy.gym.botRating(botRatingOf(state.ratings, b.id, b.rating))}. ${b.blurb}`}>
                <span className="ai-avatar">
                  <BotAvatar bot={b.id} size={56} />
                  {aiOn ? <AiBadge className="ai-badge-corner" /> : null}
                </span>
                <span className="bot-name">{b.name}</span>
                <span className="bot-level">
                  {"★".repeat(b.level)}
                  <span className="sr-only">{b.level}</span>
                </span>
                <span className="bot-strength">{b.label}</span>
                <span className="bot-record">{copy.gym.record(bots[b.id]?.played ?? 0, bots[b.id]?.won ?? 0)}</span>
                <span className="bot-record">{copy.gym.botRating(botRatingOf(state.ratings, b.id, b.rating))}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="modes-title" className="gym-section">
        <h2 id="modes-title" className="card-title">
          {copy.gym.modes}
        </h2>
        <ul className="modes">
          {MODES.map((m) => {
            const c = copy.gym[m.key] as { name: string; body: string };
            return (
              <li key={m.key}>
                <Link href={m.href} className={`mode-tile${m.locked ? " is-locked" : ""}`}>
                  <span className="mode-icon">
                    <Icon name={m.icon} />
                  </span>
                  <span className="mode-name">{c.name}</span>
                  <span className="mode-body">{c.body}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/practice" className="mode-tile">
              <span className="mode-icon">
                <Icon name="practice" />
              </span>
              <span className="mode-name">{copy.practice.title}</span>
              <span className="mode-body">{copy.rooms.list.practice.promise}</span>
            </Link>
          </li>
          <li>
            <Link href="/gym/vision" className="mode-tile">
              <span className="mode-icon">
                <Icon name="eye" />
              </span>
              <span className="mode-name">{copy.vision.title}</span>
              <span className="mode-body">{copy.vision.tile}</span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
