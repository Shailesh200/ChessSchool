import { keyMomentCard, type Color, type MoveNote, type ReviewPly } from "@chessschool/chess";
import { copy, keyMomentText } from "@chessschool/design";
import { useMemo } from "react";
import { Share, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Board } from "./Board";
import { Button, T } from "./ui";

/**
 * One card for the game's decisive move: the board, the move played against the better one, and
 * why. `coachNote` is the Phase 2 coach note for that move when the learner already asked for it;
 * otherwise the detector's tag text. Renders nothing until the analysis is done or when no move stands out.
 */
export function KeyMomentCard({ plies, notes, done, side, orientation, coachNoteFor, onShow, shareable = true }: { plies: ReviewPly[]; notes: Record<number, MoveNote>; done: boolean; side: Color | null; orientation: Color; coachNoteFor?: (ply: number) => string | null; onShow?: (ply: number) => void; shareable?: boolean }) {
  const { c } = useTheme();
  // The analysis fills `notes` a move at a time; the card is built once, when it is complete.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => (done ? keyMomentCard(plies, notes, side) : null), [done, plies, side]);
  if (!m) return null;
  const mistake = m.kind === "mistake";
  return (
    <View accessible={false} style={{ alignSelf: "stretch", gap: 10, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: mistake ? c.line : c.gold, backgroundColor: mistake ? c.card : c.goldSoft }}>
      <T role="label" header>
        {mistake ? copy.keyMoment.title : copy.keyMoment.great}
      </T>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Board
          size={132}
          radius={8}
          hideCoords
          disabled
          fen={mistake ? m.fenBefore : m.fen}
          orientation={orientation}
          lastMove={mistake ? null : m.lastMove}
          arrows={mistake ? [{ from: m.lastMove.from, to: m.lastMove.to, tone: "played" }, ...(m.betterMove ? [{ from: m.betterMove.from, to: m.betterMove.to, tone: "better" as const }] : [])] : []}
          label={copy.keyMoment.boardLabel(m.move, m.better)}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <T role="label">{copy.keyMoment.played(m.move)}</T>
          {m.better ? (
            <T role="label" color="successText">
              {copy.keyMoment.better(m.better)}
            </T>
          ) : null}
          <T role="small" color="textMuted">
            {keyMomentText(m, coachNoteFor?.(m.ply))}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {onShow ? (
          <View style={{ flex: 1 }}>
            <Button title={copy.keyMoment.show} icon="eye" variant="secondary" onPress={() => onShow(m.ply)} />
          </View>
        ) : null}
        {shareable ? (
          <View style={{ flex: 1 }}>
            <Button title={copy.keyMoment.share} variant="secondary" onPress={() => void Share.share({ message: copy.keyMoment.shareText(m.move, m.better) }).catch(() => {})} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
