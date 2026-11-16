"use client";

import { copy, indiaDay, language, monthlyStatus, REPAIR_LESSONS, repairOffer, type LocalState } from "@chessschool/design";
import { useApp } from "@/lib/state";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button, Card, ProgressBar } from "./ui";

/** A streak broken by one missed day: two lessons by tomorrow bring it back. */
export function StreakRepairCard({ today, lessonHref }: { today: string; lessonHref: string | null }) {
  const { state } = useApp();
  const offer = repairOffer(state, today);
  if (!offer) return null;
  return (
    <Card className="habit-card is-repair" aria-labelledby="repair-title">
      <h2 id="repair-title" className="card-title">
        <Cody animation="streak-danger" size={40} /> {copy.streaks.repairTitle}
      </h2>
      <p className="muted">{copy.streaks.repairBody(offer.prev, REPAIR_LESSONS - offer.lessons)}</p>
      <ProgressBar value={offer.lessons / REPAIR_LESSONS} label={copy.quests.a11y(copy.streaks.repairTitle, offer.lessons, REPAIR_LESSONS)} />
      {lessonHref ? (
        <Button block href={lessonHref} icon="play">
          {copy.streaks.repairCta}
        </Button>
      ) : null}
    </Card>
  );
}

export function LeagueCard({ state }: { state: LocalState }) {
  if (state.activeChild) return null;
  return (
    <Card className="habit-card" aria-labelledby="league-title">
      <h2 id="league-title" className="card-title">
        <Icon name="trophy" /> {state.account ? copy.leagues.title : copy.leagues.guestTitle}
      </h2>
      <p className="muted">{state.account ? copy.leagues.cardBody : copy.leagues.guestBody}</p>
      <Button block variant="secondary" href={state.account ? "/league" : "/signup"} icon={state.account ? "arrowRight" : "shield"}>
        {state.account ? copy.leagues.open : copy.leagues.signup}
      </Button>
    </Card>
  );
}

export function MateCard({ state }: { state: LocalState }) {
  const day = indiaDay(Date.now());
  const mine = state.habit.mate?.day === day ? state.habit.mate : null;
  return (
    <Card className="habit-card" aria-labelledby="mate-title">
      <h2 id="mate-title" className="card-title">
        <Icon name="star" /> {copy.mate.title}
      </h2>
      <p className="muted">{mine?.done ? (mine.solved ? copy.mate.solvedIn(mine.tries.length) : copy.mate.failed) : copy.mate.cardBody}</p>
      <Button block variant="secondary" href={`/mate/${day}`} icon="puzzle">
        {mine?.done ? copy.mate.share : copy.mate.play}
      </Button>
    </Card>
  );
}

/** This month's challenge, under the daily quests. */
export function MonthlyRow({ state, today }: { state: LocalState; today: string }) {
  const m = monthlyStatus(state, today);
  const label = copy.quests.monthly[m.id](m.target);
  return (
    <div className="quest-month">
      <span className="quest-row">
        <span>
          <strong>{copy.quests.monthTitle(new Date(`${m.month}-01T12:00:00`).toLocaleDateString(language() === "hi" ? "hi-IN" : "en-IN", { month: "long" }))}</strong> {label}
        </span>
        <span className={m.done ? "is-done" : "muted"}>{m.done ? copy.quests.monthDone : copy.quests.count(m.value, m.target)}</span>
      </span>
      <ProgressBar value={m.value / m.target} tone={m.done ? "success" : "brand"} label={copy.quests.a11y(label, m.value, m.target)} />
    </div>
  );
}
