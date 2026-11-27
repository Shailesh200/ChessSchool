"use client";

import { THINK_PATH, copy } from "@chessschool/design";
import { Icon } from "./Icon";
import { Button, Card } from "./ui";
import { useApp } from "@/lib/state";

/** Entry to the "Think like a player" track (Learn and Gym). */
export function ThinkCard() {
  const { state } = useApp();
  const done = THINK_PATH.filter((n) => state.progress.completed[n.id]).length;
  return (
    <Card className="think-card">
      <h2>
        <Icon name="bulb" /> {copy.think.title}
      </h2>
      <p className="muted">
        {copy.think.sub} · {copy.think.progress(done, THINK_PATH.length)}
      </p>
      <Button variant="secondary" icon="arrowRight" href="/think">
        {copy.think.open}
      </Button>
    </Card>
  );
}
