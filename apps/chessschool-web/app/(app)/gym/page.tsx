"use client";

import { BOTS } from "@chessschool/chess";
import { copy, type IconName } from "@chessschool/design";
import Link from "next/link";
import { BotAvatar } from "@/components/BotAvatar";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
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
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const bots = state.progress.bots;
  return (
    <div className="page">
      <TopBar title={copy.gym.title} large back={false} />
      <p className="page-lead">{copy.gym.body}</p>

      <Card className="gym-hero">
        <div>
          <h2 className="card-title">{state.activeGame ? copy.play.resume : copy.gym.quick}</h2>
          <p className="muted">{state.activeGame ? copy.play.resumeBody(Math.ceil(state.activeGame.history.length / 2)) : copy.gym.quickBody}</p>
          <Button href={state.activeGame ? "/play?resume=1" : "/play?bot=cody&quick=1"} icon="play">
            {state.activeGame ? copy.play.resume : copy.play.start}
          </Button>
        </div>
        <Cody animation="wave" size={120} className="gym-hero-cody" />
      </Card>

      <section aria-labelledby="bots-title" className="gym-section">
        <h2 id="bots-title" className="card-title">
          {copy.gym.bots}
        </h2>
        <ul className="bots">
          {BOTS.map((b) => (
            <li key={b.id}>
              <Link href={`/play?bot=${b.id}`} className="bot-card" aria-label={`${b.name}. ${b.strength}. ${b.blurb}`}>
                <BotAvatar bot={b.id} size={56} />
                <span className="bot-name">{b.name}</span>
                <span className="bot-level">
                  {"★".repeat(b.level)}
                  <span className="sr-only">{b.level}</span>
                </span>
                <span className="bot-strength">{b.strength}</span>
                <span className="bot-record">{copy.gym.record(bots[b.id]?.played ?? 0, bots[b.id]?.won ?? 0)}</span>
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
        </ul>
      </section>
    </div>
  );
}
