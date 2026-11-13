"use client";

import { copy, dayKey, greetingFor, minutesToday, rankFor, visibleStreak, type Placement } from "@chessschool/design";
import { ArrivalCeremony, SavedCeremony } from "@/components/Ceremony";
import { DailyCountdown, useDailyPuzzle } from "@/components/DailyCountdown";
import { Cody } from "@/components/Lottie";
import { FirstRunNotificationSheet } from "@/components/NotificationSheet";
import { PathList } from "@/components/PathList";
import { Icon } from "@/components/Icon";
import { Button, Card, Chip, GoalRing, RankCurve, SaveBanner } from "@/components/ui";
import { useApp } from "@/lib/state";

export default function TodayPage() {
  const { state, ready, place, cue } = useApp();
  const { puzzle: dailyPick, done: dailyIsDone } = useDailyPuzzle(ready);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;

  const now = new Date();
  const today = dayKey(now);
  const { progress, profile } = state;
  const name = profile.name.trim() || copy.today.friend;
  const rank = rankFor(progress.xp);
  const streak = visibleStreak(progress.streak, today);
  const minutes = minutesToday(progress, today);
  const done = Boolean(progress.completed.meet);

  return (
    <div className="today">
      <SavedCeremony />
      <ArrivalCeremony streak={streak} />
      <header className="today-head">
        <Cody animation={done ? "happy" : "idle"} size={72} className="today-cody" />
        <div className="today-hello">
          <h1>
            {greetingFor(now)}, {name}
          </h1>
          <p className="muted">{copy.today.level(copy.ranks[rank.rank], rank.level)}</p>
        </div>
        <div className="today-chips">
          <Chip icon="spark" tone={streak ? "accent" : "neutral"} label={copy.a11y.streak(streak)}>
            {streak ? copy.today.streak(streak) : copy.today.streakZero}
          </Chip>
          <Chip icon="bolt" tone="gold" label={copy.a11y.xp(progress.xp)}>
            {copy.today.xp(progress.xp)}
          </Chip>
        </div>
      </header>

      <div className="today-grid">
        <div className="today-main">
          {!state.placementDone && !progress.completed.board ? (
            <Card className="placement" aria-labelledby="place-title">
              <h2 id="place-title" className="card-title">
                {copy.placement.title}
              </h2>
              <p className="muted">{copy.placement.body}</p>
              <div className="choices">
                {(["new", "moves", "player"] as Placement[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="choice"
                    onClick={() => {
                      cue("tap");
                      place(p);
                    }}
                  >
                    {copy.placement.options[p]}
                    <Icon name="chevron" />
                  </button>
                ))}
              </div>
            </Card>
          ) : null}

          <Card aria-labelledby="path-title">
            <h2 id="path-title" className="card-title">
              {copy.today.pathTitle}
            </h2>
            <PathList progress={progress} />
          </Card>
        </div>

        <aside className="today-side">
          <Card className="daily-mini" aria-labelledby="daily-title">
            <h2 id="daily-title" className="card-title">
              <Icon name="puzzle" /> {copy.puzzles.daily}
            </h2>
            <p className="muted">{dailyIsDone ? copy.puzzles.dailyDone : `${copy.puzzles.dailyBody} · ${dailyPick.rating}`}</p>
            {dailyIsDone ? <DailyCountdown /> : (
              <Button href="/puzzles/solve?daily=1" variant="secondary" icon="puzzle" block>
                {copy.puzzles.daily}
              </Button>
            )}
          </Card>

          <Card aria-labelledby="rank-title">
            <h2 id="rank-title" className="card-title">
              {copy.today.rankTitle}
            </h2>
            <RankCurve xp={progress.xp} />
          </Card>

          <Card className="goal" aria-labelledby="goal-title">
            <div>
              <h2 id="goal-title" className="card-title">
                {copy.today.goalTitle}
              </h2>
              <p className="goal-value">{copy.today.goalValue(minutes, profile.dailyMinutes)}</p>
              {minutes >= profile.dailyMinutes ? <p className="muted">{copy.today.goalDone}</p> : null}
            </div>
            <GoalRing done={minutes} goal={profile.dailyMinutes} />
          </Card>

          {!state.account && done ? (
            <SaveBanner title={copy.today.saveCard.title} body={copy.today.saveCard.body} />
          ) : null}
        </aside>
      </div>
      <FirstRunNotificationSheet />
    </div>
  );
}
