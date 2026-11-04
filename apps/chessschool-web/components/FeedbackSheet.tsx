"use client";

import { copy } from "@chessschool/design";
import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { Button, Sheet, useToast } from "./ui";

type Mood = "love" | "ok" | "stuck";

export function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, cue } = useApp();
  const toast = useToast();
  const [mood, setMood] = useState<Mood>("love");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (message.trim().length < 3) return setError(copy.feedback.tooShort);
    setSending(true);
    try {
      await api.feedback({
        mood,
        message,
        guestId: state.guestId,
        context: { platform: "web", ua: navigator.userAgent.slice(0, 200), path: location.pathname, theme: state.prefs.theme, pieces: state.prefs.pieceSet, version: "0.4.0" },
      });
      cue("success");
      toast(copy.feedback.sent);
      setMessage("");
      onClose();
    } catch {
      setError(copy.feedback.offline);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} labelledBy="fb-title">
      <h2 id="fb-title">{copy.feedback.title}</h2>
      <p>{copy.feedback.body}</p>
      <div className="seg" role="radiogroup" aria-label={copy.feedback.title}>
        {(Object.keys(copy.feedback.moods) as Mood[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mood === m} onClick={() => setMood(m)}>
            {copy.feedback.moods[m]}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="sr-only">{copy.feedback.title}</span>
        <textarea
          className="textarea"
          rows={4}
          maxLength={2000}
          value={message}
          placeholder={copy.feedback.placeholder}
          onChange={(e) => {
            setMessage(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "fb-error" : undefined}
        />
      </label>
      {error ? (
        <p id="fb-error" className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button block icon="chat" loading={sending} onClick={send}>
        {copy.feedback.send}
      </Button>
    </Sheet>
  );
}
