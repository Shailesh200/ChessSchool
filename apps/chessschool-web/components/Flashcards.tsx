"use client";

import { copy, dayKey, dueIdeas } from "@chessschool/design";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useCoachVoice } from "@/lib/voice";
import { Icon } from "./Icon";
import { Button, Card } from "./ui";

type Idea = { id: string; title: string; idea: string };

/** The one-minute daily review: due key ideas from finished lessons, one card at a time. */
export function Flashcards() {
  const { state, answerIdea, cue } = useApp();
  const due = dueIdeas(state.ideas, dayKey(new Date()));
  const key = due.join(",");
  const [items, setItems] = useState<Idea[] | null>(null);
  const [shown, setShown] = useState(false);
  const [answered, setAnswered] = useState(0);
  useEffect(() => {
    if (!key || items) return;
    let live = true;
    api
      .ideas(key.split(","))
      .then((r) => live && setItems(r.items))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, items]);
  const deck = (items ?? []).filter((i) => due.includes(i.id));
  const card = deck[0];
  const say = useCoachVoice(card?.id ?? null);
  const t = copy.flashcards;
  if (!card && !answered) return null;

  const answer = (remembered: boolean) => {
    cue(remembered ? "success" : "tap");
    answerIdea(card.id, remembered);
    setAnswered((n) => n + 1);
    setShown(false);
  };

  return (
    <Card className="daily-mini" aria-labelledby="cards-title">
      <h2 id="cards-title" className="card-title">
        <Icon name="bulb" /> {t.title}
      </h2>
      {!card ? (
        <p className="muted">{t.done}</p>
      ) : (
        <>
          <p className="muted">{answered ? t.count(answered + 1, answered + deck.length) : t.body(deck.length)}</p>
          <p className="row-label">{card.title}</p>
          <p aria-live="polite">{shown ? card.idea : t.prompt}</p>
          {shown ? (
            <div className="flash-actions">
              <Button variant="secondary" icon="check" onClick={() => answer(true)}>
                {t.remembered}
              </Button>
              <Button variant="ghost" icon="refresh" onClick={() => answer(false)}>
                {t.again}
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              icon="eye"
              block
              onClick={() => {
                setShown(true);
                say(card.idea);
              }}
            >
              {t.reveal}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
