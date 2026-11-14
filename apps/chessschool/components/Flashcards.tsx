import { copy, dayKey, dueIdeas } from "@chessschool/design";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useCoachVoice } from "@/lib/voice";
import { Button, Card, T } from "./ui";

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
    <Card style={{ gap: 8 }}>
      <T role="heading" header>
        {t.title}
      </T>
      {!card ? (
        <T role="body" color="textMuted">
          {t.done}
        </T>
      ) : (
        <>
          <T role="small" color="textMuted">
            {answered ? t.count(answered + 1, answered + deck.length) : t.body(deck.length)}
          </T>
          <T role="label">{card.title}</T>
          <T role="bodyLg">{shown ? card.idea : t.prompt}</T>
          {shown ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={t.remembered} icon="check" variant="secondary" block={false} style={{ flex: 1 }} onPress={() => answer(true)} />
              <Button title={t.again} icon="refresh" variant="ghost" block={false} style={{ flex: 1 }} onPress={() => answer(false)} />
            </View>
          ) : (
            <Button
              title={t.reveal}
              icon="eye"
              variant="secondary"
              onPress={() => {
                setShown(true);
                say(card.idea);
              }}
            />
          )}
        </>
      )}
    </Card>
  );
}
