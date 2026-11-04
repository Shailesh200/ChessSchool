"use client";

import { copy, PATH, type IconName } from "@chessschool/design";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { ActionDock, Button, Card, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

export default function PracticePage() {
  const { state, ready } = useApp();
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const learned = PATH.some((n) => n.id !== "meet" && state.progress.completed[n.id]);
  return (
    <div className="page page-narrow">
      <TopBar backHref="/gym" title={copy.practice.title} />
      <div className="hero-strip tint-accent">
        <Cody animation={learned ? "proud" : "reading"} size={104} label={copy.a11y.mascot} />
        <div>
          <h2>{learned ? copy.practice.body : copy.practice.emptyTitle}</h2>
          <p className="muted">{learned ? copy.practice.count(state.progress.drills) : copy.practice.emptyBody}</p>
        </div>
      </div>
      {learned ? (
        <Card className="how-list">
          {copy.practice.how.map((h) => (
            <div key={h.text} className="how-row">
              <span className="how-icon" aria-hidden>
                <Icon name={h.icon as IconName} size={20} />
              </span>
              <span>{h.text}</span>
            </div>
          ))}
        </Card>
      ) : null}
      <ActionDock>
        {learned ? (
          <Button block href="/practice/session" icon="practice">
            {copy.practice.start}
          </Button>
        ) : (
          <Button block href="/today" icon="learn">
            {copy.practice.emptyCta}
          </Button>
        )}
      </ActionDock>
    </div>
  );
}
