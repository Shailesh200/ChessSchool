import { copy, indiaDay, language, monthlyStatus, REPAIR_LESSONS, repairOffer, type LocalState } from "@chessschool/design";
import { router } from "expo-router";
import { View } from "react-native";
import { useApp } from "@/lib/state";
import { Cody } from "./Lottie";
import { Button, Card, ProgressBar, T } from "./ui";

/** A streak broken by one missed day: two lessons by tomorrow bring it back. */
export function StreakRepairCard({ today, onStart }: { today: string; onStart: (() => void) | null }) {
  const { state } = useApp();
  const offer = repairOffer(state, today);
  if (!offer) return null;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Cody animation="streak-danger" size={48} />
        <T role="heading" header style={{ flex: 1 }}>
          {copy.streaks.repairTitle}
        </T>
      </View>
      <T role="body" color="textMuted">
        {copy.streaks.repairBody(offer.prev, REPAIR_LESSONS - offer.lessons)}
      </T>
      <ProgressBar value={offer.lessons / REPAIR_LESSONS} label={copy.quests.a11y(copy.streaks.repairTitle, offer.lessons, REPAIR_LESSONS)} />
      {onStart ? <Button title={copy.streaks.repairCta} icon="play" onPress={onStart} /> : null}
    </Card>
  );
}

export function LeagueCard({ state }: { state: LocalState }) {
  if (state.activeChild) return null;
  const member = Boolean(state.account);
  return (
    <Card style={{ gap: 8 }}>
      <T role="heading" header>
        {member ? copy.leagues.title : copy.leagues.guestTitle}
      </T>
      <T role="body" color="textMuted">
        {member ? copy.leagues.cardBody : copy.leagues.guestBody}
      </T>
      <Button title={member ? copy.leagues.open : copy.leagues.signup} icon={member ? "arrowRight" : "shield"} variant="secondary" onPress={() => router.push(member ? "/league" : "/signup")} />
    </Card>
  );
}

export function MateCard({ state }: { state: LocalState }) {
  const day = indiaDay(Date.now());
  const mine = state.habit.mate?.day === day ? state.habit.mate : null;
  return (
    <Card style={{ gap: 8 }}>
      <T role="heading" header>
        {copy.mate.title}
      </T>
      <T role="body" color="textMuted">
        {mine?.done ? (mine.solved ? copy.mate.solvedIn(mine.tries.length) : copy.mate.failed) : copy.mate.cardBody}
      </T>
      <Button title={mine?.done ? copy.mate.share : copy.mate.play} icon="puzzle" variant="secondary" onPress={() => router.push("/mate")} />
    </Card>
  );
}

/** This month's challenge, under the daily quests. */
export function MonthlyRow({ state, today }: { state: LocalState; today: string }) {
  const m = monthlyStatus(state, today);
  const label = copy.quests.monthly[m.id](m.target);
  const month = new Date(`${m.month}-01T12:00:00`).toLocaleDateString(language() === "hi" ? "hi-IN" : "en-IN", { month: "long" });
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <T role="body" style={{ flex: 1 }}>
          {`${copy.quests.monthTitle(month)}: ${label}`}
        </T>
        <T role="small" color={m.done ? "successText" : "textMuted"}>
          {m.done ? copy.quests.monthDone : copy.quests.count(m.value, m.target)}
        </T>
      </View>
      <ProgressBar value={m.value / m.target} tone={m.done ? "success" : "brand"} label={copy.quests.a11y(label, m.value, m.target)} />
    </View>
  );
}
