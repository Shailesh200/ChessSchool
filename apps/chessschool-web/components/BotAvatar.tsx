"use client";

import type { BotId, PieceType } from "@chessschool/chess";
import { Cody } from "./Lottie";
import { PieceArt } from "./Board";

const PIECE: Record<BotId, PieceType | null> = { pip: "p", cody: null, rooky: "r", bishop: "b", ivy: "q", atlas: "k" };
const TINT: Record<BotId, string> = { pip: "tint-success", cody: "tint-brand", rooky: "tint-accent", bishop: "tint-gold", ivy: "tint-brand", atlas: "tint-accent" };

/** Each bot is a Toy piece; Cody is Cody. */
export function BotAvatar({ bot, size = 44 }: { bot: BotId; size?: number }) {
  const piece = PIECE[bot];
  return (
    <span className={`player-avatar bot-avatar ${TINT[bot]}`} style={{ width: size, height: size }} aria-hidden>
      {piece ? <PieceArt piece={{ type: piece, color: "b" }} size={size * 0.82} set="toy" /> : <Cody animation="idle" size={size} />}
    </span>
  );
}
