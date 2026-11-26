"use client";

import type { BotId } from "@chessschool/chess";
import { botArt, botMotion, isCharacterBot, type BotMood, type BotMotion } from "@chessschool/design";
import { useMemo } from "react";
import { Cody } from "./Lottie";

/** CSS keyframes for one motion; distances are in character units (--u = 1/240 of the avatar's width). */
function keyframes({ name, frames }: BotMotion): string {
  const steps = frames.map((f) => `${Math.round(f.at * 100)}%{transform:translate(calc(var(--u) * ${f.x}px),calc(var(--u) * ${f.y}px)) rotate(${f.r}deg) scale(${f.sx},${f.sy})}`).join("");
  return `@keyframes bot-${name}{${steps}}`;
}

/**
 * A bot as its own chess-piece character (Pip the pawn … King Atlas the king), moving in its own rhythm for
 * the moment of the game (`mood`). Chaukor is the mascot and keeps its Lottie. Below 40px the speech bubble
 * and sparkles are left out so the face stays readable. Reduce Motion stops it (globals.css).
 */
export function BotAvatar({ bot, size = 44, mood = "wait" }: { bot: BotId; size?: number; mood?: BotMood }) {
  const cb = isCharacterBot(bot) ? bot : null;
  const art = useMemo(() => (cb ? botArt(cb, mood) : null), [cb, mood]);
  if (!cb || !art) {
    return (
      <span className="player-avatar bot-avatar tint-brand" style={{ width: size, height: size }} aria-hidden>
        <Cody animation="idle" size={size} />
      </span>
    );
  }
  const m = botMotion(cb, mood);
  return (
    <span className="bot-figure" style={{ width: size, height: size, ["--u" as string]: size / 240 }} aria-hidden>
      <style>{keyframes(m)}</style>
      <span className="bot-figure-body" style={{ animation: `bot-${m.name} ${m.ms}ms ease-in-out infinite` }} dangerouslySetInnerHTML={{ __html: art.body }} />
      {art.fx && size >= 40 ? <span className="bot-figure-fx" dangerouslySetInnerHTML={{ __html: art.fx }} /> : null}
    </span>
  );
}
