"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CoachAvatar } from "@/components/ui/coachCharacters/CoachAvatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useProgression } from "@/core/store/progression.store";
import { listGames, type SavedGame } from "@/core/db/db";
import { KitIcon } from "./KitIcon";
import { PRACTICE_LINE, REVIEW_CATALOG, reviewDueCount, skillPercent } from "./catalog";

function SkillList({ fixture }: { fixture: boolean }) {
  const lessons = useProgression((s) => s.lessons);
  return (
    <div className="cs-list">
      {REVIEW_CATALOG.map((skill) => {
        const pct = skillPercent(lessons[skill.lessonId], fixture, skill.fixture);
        const low = pct < PRACTICE_LINE;
        return (
          <div key={skill.id} className="cs-row" style={{ alignItems: "flex-start" }}>
            <div className="cs-row__tile">
              <KitIcon name={skill.icon} />
            </div>
            <div className={low ? "mast low" : "mast"}>
              <div className="mt">
                <b>{skill.title}</b>
                {low && (
                  <span className="cs-tag">
                    <KitIcon name="triangle-alert" className="sm" />
                    Needs practice
                  </span>
                )}
              </div>
              <div className="mb">
                <ProgressBar
                  value={pct / 100}
                  tone={low ? "accent" : "brand"}
                  label={`${skill.title} mastery`}
                />
                <span className="pct">{pct}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Summary({ fixture }: { fixture: boolean }) {
  const lessons = useProgression((s) => s.lessons);
  const percents = REVIEW_CATALOG.map((s) =>
    skillPercent(lessons[s.lessonId], fixture, s.fixture),
  );
  const low = percents.filter((n) => n < PRACTICE_LINE).length;
  const onTrack = percents.length - low;
  return (
    <div className="card stack">
      <div className="over">Summary</div>
      <div className="cs-row__body">
        <b>On track · {onTrack}</b>
        <span>60% or more</span>
      </div>
      <div className="cs-row__body">
        <b>Needs practice · {low}</b>
        <span>Under 60%, review these first</span>
      </div>
    </div>
  );
}

export function ReviewTab({ fixture = false }: { fixture?: boolean }) {
  const lessons = useProgression((s) => s.lessons);
  const due = fixture ? REVIEW_CATALOG.length : reviewDueCount(lessons);
  const mistakes = useProgression((s) => s.mistakeLog.length);
  const [games, setGames] = useState<SavedGame[] | null>(null);

  useEffect(() => {
    listGames().then(setGames);
  }, []);

  return (
    <div className="chopper">
      <header className="stack">
        <span className="over">Review</span>
        <h1>
          {due} skill{due === 1 ? "" : "s"} {due === 1 ? "is" : "are"} due
        </h1>
        <p className="muted">A quick refresher keeps them fresh. 10 steps or fewer.</p>
        <div className="cs-coach">
          <CoachAvatar character="anxious_nerd" state="idle" size="md" alt="Otto" />
          <div className="cs-bubble">
            Ten minutes now saves hours later. Start with the two low ones.
          </div>
        </div>
      </header>
      <div className="twocol">
        <SkillList fixture={fixture} />
        <div className="stack">
          <Summary fixture={fixture} />
          <Link className="btn coral" href="/review/queue">
            Start review · 10 steps
          </Link>
          <Link className="cs-row" href="/practice/mistakes">
            <div className="cs-row__tile">
              <KitIcon name="rotate-ccw" />
            </div>
            <div className="cs-row__body">
              <b>Fix my mistakes</b>
              <span>
                {fixture ? 3 : mistakes} move{mistakes === 1 && !fixture ? "" : "s"} to
                replay
              </span>
            </div>
            <KitIcon name="chevron-right" />
          </Link>
          <Link className="cs-row" href="/gym">
            <div className="cs-row__tile">
              <KitIcon name="dumbbell" />
            </div>
            <div className="cs-row__body">
              <b>Gym</b>
              <span>Drills and puzzle practice</span>
            </div>
            <KitIcon name="chevron-right" />
          </Link>
        </div>
      </div>
      <section>
        <h2 className="text-ink mb-2 text-sm font-extrabold">Match history</h2>
        {games === null ? (
          <div className="skeleton rounded-card h-24" />
        ) : games.length === 0 ? (
          <p className="muted">
            Play a match and it will appear here with a full replay.
          </p>
        ) : (
          <div className="history">
            {games.map((g) => (
              <Link key={g.id} className="cs-row" href={`/review/${g.id}`}>
                <div className="cs-row__body">
                  <b>
                    {g.mode === "bot"
                      ? `vs Bot ${g.elo ?? ""}`
                      : g.mode === "online"
                        ? "vs Friend (online)"
                        : "vs Human"}
                  </b>
                  <span>
                    {g.moveCount} moves · {g.endReason}
                  </span>
                </div>
                <KitIcon name="chevron-right" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function ReviewQueue({ fixture = false }: { fixture?: boolean }) {
  const lessons = useProgression((s) => s.lessons);
  const due = fixture ? REVIEW_CATALOG.length : reviewDueCount(lessons);
  const mistakes = useProgression((s) => s.mistakeLog.length);
  return (
    <div className="chopper">
      <header className="stack">
        <span className="over">Review queue</span>
        <h1>
          {due} skill{due === 1 ? "" : "s"} {due === 1 ? "is" : "are"} due
        </h1>
        <p className="muted">A quick refresher keeps them fresh. 10 steps or fewer.</p>
      </header>
      <div className="twocol">
        <SkillList fixture={fixture} />
        <div className="stack">
          <Summary fixture={fixture} />
          <Link className="btn coral" href="/practice/mistakes">
            Start review · 10 steps
          </Link>
          <Link className="cs-row" href="/practice/mistakes">
            <div className="cs-row__tile">
              <KitIcon name="rotate-ccw" />
            </div>
            <div className="cs-row__body">
              <b>Fix my mistakes</b>
              <span>
                {fixture ? 3 : mistakes} move{mistakes === 1 && !fixture ? "" : "s"} to
                replay
              </span>
            </div>
            <KitIcon name="chevron-right" />
          </Link>
        </div>
      </div>
    </div>
  );
}
