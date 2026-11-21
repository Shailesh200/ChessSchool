"use client";

import { closeRecap, copy, dayKey } from "@chessschool/design";
import { useEffect } from "react";
import { RecapSummary, useRecap } from "@/components/Daily";
import { Cody } from "@/components/Lottie";
import { Card, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

/** Last week's recap in full. Opening it counts as having seen this week's card. */
export default function RecapPage() {
  const { ready, update } = useApp();
  const recap = useRecap(dayKey(new Date()));
  const week = recap?.week;
  useEffect(() => {
    if (week) update((s) => closeRecap(s, week));
  }, [week, update]);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  return (
    <div className="page page-narrow">
      <TopBar backHref="/today" title={copy.recap.title} />
      <Card className="recap-card">
        <Cody animation={recap ? "happy" : "reading"} size={120} label={copy.a11y.mascot} />
        {recap ? <RecapSummary recap={recap} /> : <p className="lead">{copy.recap.empty}</p>}
      </Card>
    </div>
  );
}
