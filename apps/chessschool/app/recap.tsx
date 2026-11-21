import { closeRecap, copy, dayKey } from "@chessschool/design";
import { useEffect } from "react";
import { RecapSummary, useRecap } from "@/components/Daily";
import { Cody } from "@/components/Lottie";
import { Card, Page, T } from "@/components/ui";
import { useApp } from "@/lib/state";

/** Last week's recap in full. Opening it counts as having seen this week's card. */
export default function Recap() {
  const { update } = useApp();
  const recap = useRecap(dayKey(new Date()));
  const week = recap?.week;
  useEffect(() => {
    if (week) update((s) => closeRecap(s, week));
  }, [week, update]);
  return (
    <Page title={copy.recap.title}>
      <Card style={{ alignItems: "center", gap: 12 }}>
        <Cody animation={recap ? "happy" : "reading"} size={120} label={copy.a11y.mascot} />
        {recap ? (
          <RecapSummary recap={recap} />
        ) : (
          <T role="bodyLg" color="textMuted" center>
            {copy.recap.empty}
          </T>
        )}
      </Card>
    </Page>
  );
}
