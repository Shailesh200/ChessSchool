import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChessEngine } from "@chess-school/core";
import { KitButton, KitCard, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { BotAvatar } from "@/BotAvatar";
import { FlatAvatar } from "@/flatAvatars/FlatAvatar";
import { resolveAvatar } from "@/iconMaps";
import { clock as fmtClock } from "@/chess-utils";
import { CoachHead } from "@/nov2/CoachRow";
import { COACH_MATCH_PILL, coachDisplayName, type CoachSlug } from "@/nov2/coachArt";

export function PremiumMatchHeader({
  coachSlug,
  bubbleText,
  thinking,
  dark,
  onResign,
  onReplayLine,
}: {
  coachSlug: CoachSlug;
  bubbleText: string | null;
  thinking: boolean;
  dark?: boolean;
  onResign: () => void;
  onReplayLine?: () => void;
}) {
  const { colors, space, font, type } = usePremiumKitTheme();
  const mood = thinking ? "thinking" : "happy";
  const ink = dark ? "#f4f7f5" : colors.ink;
  const muted = dark ? "#9aa8a0" : colors.ink500;
  const bubbleBg = dark ? "#1a2220" : colors.surfaceCard;
  const line = dark ? "#2a3530" : colors.hairline;

  return (
    <View style={{ paddingHorizontal: space["4"], paddingTop: space["2"], gap: space["3"], backgroundColor: dark ? "#0f1419" : colors.surface }}>
      <View style={styles.headRow}>
        <CoachHead slug={coachSlug} mood={mood} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.displayBold, fontSize: 17, color: ink }}>{coachDisplayName(coachSlug)}</Text>
          <Text style={{ fontFamily: font.uiRegular, fontSize: 13, color: muted }}>
            {COACH_MATCH_PILL[coachSlug]} · plays Black
          </Text>
        </View>
        <KitButton label="Resign" variant="outline" size="sm" block={false} onPress={onResign} />
      </View>
      {bubbleText ? (
        <View style={[styles.coachRow, { gap: space["3"] }]}>
          <CoachHead slug={coachSlug} mood={mood} size={56} />
          <View style={[styles.bubble, { backgroundColor: bubbleBg, borderColor: line, flex: 1 }]}>
            <Text style={{ fontFamily: font.uiRegular, fontSize: type.base.fontSize, color: ink, flex: 1 }}>{bubbleText}</Text>
            {onReplayLine ? (
              <Pressable onPress={onReplayLine} accessibilityLabel="Play coach line again" hitSlop={8} style={styles.replay}>
                <KitIcon name="volume2" size={18} color={ink} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function PremiumPlayerBar({
  name,
  botElo,
  avatarId,
  advantage,
  active,
  clockMs,
  dark,
}: {
  name: string;
  botElo?: number;
  avatarId?: string;
  advantage: number;
  active?: boolean;
  clockMs?: number;
  dark?: boolean;
}) {
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  const bg = dark ? "#1a2220" : active ? colors.surfacePaper : "transparent";
  const border = active ? colors.brand100 : dark ? "#2a3530" : "transparent";
  const ink = dark ? "#f4f7f5" : colors.ink;

  return (
    <View
      style={[
        styles.playerBar,
        {
          marginHorizontal: space["4"],
          paddingHorizontal: space["3"],
          paddingVertical: space["2"],
          borderRadius: radius.md,
          backgroundColor: bg,
          borderWidth: active ? 1.5 : 0,
          borderColor: border,
        },
      ]}
    >
      {botElo !== undefined ? (
        <BotAvatar elo={botElo} size={32} />
      ) : (
        <View style={[styles.userAvatar, { backgroundColor: colors.brand50, borderColor: colors.brand100 }]}>
          <FlatAvatar id={resolveAvatar(avatarId)} size={32} />
        </View>
      )}
      <Text style={{ flex: 1, fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: ink }} numberOfLines={1}>
        {name}
      </Text>
      {active ? <View style={[styles.turnDot, { backgroundColor: colors.success }]} /> : null}
      {advantage > 0 ? (
        <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.ink500 }}>+{advantage}</Text>
      ) : null}
      {clockMs !== undefined ? (
        <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: active ? colors.brand : colors.ink500, fontVariant: ["tabular-nums"] }}>
          {fmtClock(clockMs)}
        </Text>
      ) : null}
    </View>
  );
}

export function PremiumBoardCaption({ turnLabel, moveNum, dark }: { turnLabel: string; moveNum: number; dark?: boolean }) {
  const { colors, space, font, type } = usePremiumKitTheme();
  const ink = dark ? "#9aa8a0" : colors.ink500;
  return (
    <View style={[styles.caption, { paddingHorizontal: space["4"], marginTop: space["2"] }]}>
      <Text style={{ fontFamily: font.uiRegular, fontSize: type.sm.fontSize, color: ink }}>{turnLabel}</Text>
      <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: ink }}>Move {moveNum}</Text>
    </View>
  );
}

export type MoveRow = { num: number; white: string; black?: string; current?: "w" | "b" };

export function PremiumMovesPanel({ rows, dark }: { rows: MoveRow[]; dark?: boolean }) {
  const { colors, space, font, type } = usePremiumKitTheme();
  const [open, setOpen] = useState(true);
  const ink = dark ? "#f4f7f5" : colors.ink;
  const muted = dark ? "#9aa8a0" : colors.ink500;

  return (
    <KitCard variant="card" style={{ marginHorizontal: space["4"], marginTop: space["3"], backgroundColor: dark ? "#1a2220" : undefined }}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.movesSummary} accessibilityRole="button">
        <Text style={{ fontFamily: font.displayBold, fontSize: type.base.fontSize, color: ink }}>Moves</Text>
        <KitIcon name={open ? "chevronDown" : "chevronRight"} size={18} color={muted} />
      </Pressable>
      {open ? (
        <View style={[styles.movesGrid, { marginTop: space["2"] }]}>
          {rows.map((r) => (
            <View key={r.num} style={styles.moveLine}>
              <Text style={[styles.moveNum, { color: muted }]}>{r.num}.</Text>
              <Text style={[styles.moveSan, r.current === "w" && styles.moveCur, { color: ink }]}>{r.white}</Text>
              <Text style={[styles.moveSan, r.current === "b" && styles.moveCur, { color: ink }]}>{r.black ?? ""}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </KitCard>
  );
}

export function PremiumScrubber({
  viewing,
  viewPly,
  frameCount,
  onBack,
  onForward,
  dark,
}: {
  viewing: boolean;
  viewPly: number | null;
  frameCount: number;
  onBack: () => void;
  onForward: () => void;
  dark?: boolean;
}) {
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  const card = dark ? "#1a2220" : colors.surfaceCard;
  const line = dark ? "#2a3530" : colors.hairline;
  const ink = dark ? "#f4f7f5" : colors.ink500;

  return (
    <View style={[styles.scrubber, { gap: space["3"], marginTop: space["3"], marginBottom: space["2"] }]}>
      <Pressable style={[styles.scrubBtn, { backgroundColor: card, borderColor: line, borderRadius: radius.md }]} onPress={onBack}>
        <Text style={{ fontSize: 16, color: ink }}>⏪</Text>
      </Pressable>
      <Text style={{ minWidth: 88, textAlign: "center", fontFamily: font.uiBold, fontSize: type.xs.fontSize, color: ink }}>
        {viewing ? `move ${viewPly}/${frameCount - 1}` : "● live"}
      </Text>
      <Pressable style={[styles.scrubBtn, { backgroundColor: card, borderColor: line, borderRadius: radius.md }]} onPress={onForward}>
        <Text style={{ fontSize: 16, color: ink }}>⏩</Text>
      </Pressable>
    </View>
  );
}

export function PremiumBoardFrame({ children, dark }: { children: ReactNode; dark?: boolean }) {
  const { colors, radius, space } = usePremiumKitTheme();
  return (
    <View
      style={{
        alignItems: "center",
        marginVertical: space["2"],
        padding: space["1"],
        borderRadius: radius.lg,
        backgroundColor: dark ? "#141a18" : colors.surfaceSunken,
        borderWidth: 1.5,
        borderColor: dark ? "#2a3530" : colors.hairline,
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  coachRow: { flexDirection: "row", alignItems: "flex-start" },
  bubble: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 16 },
  replay: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  playerBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  turnDot: { width: 8, height: 8, borderRadius: 4 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  caption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  movesSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  movesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" },
  moveLine: { flexDirection: "row", alignItems: "center", gap: 6, width: "100%" },
  moveNum: { width: 28, fontFamily: "Fredoka_600SemiBold", fontSize: 13 },
  moveSan: { minWidth: 36, fontFamily: "Fredoka_600SemiBold", fontSize: 14 },
  moveCur: { textDecorationLine: "underline" },
  scrubber: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  scrubBtn: { minWidth: 56, height: 40, justifyContent: "center", alignItems: "center", borderWidth: 1 },
});

/** Build SAN rows from verbose history strings "from:to". */
export function buildMoveRows(moves: string[], currentPly: number | null): MoveRow[] {
  const e = new ChessEngine();
  const rows: MoveRow[] = [];
  let num = 1;
  const highlightMoveIdx = currentPly !== null ? Math.max(0, currentPly - 1) : moves.length - 1;
  for (let i = 0; i < moves.length; i += 2) {
    const w = moves[i]!;
    const [wf, wt] = w.split(":");
    const wm = e.move({ from: wf!, to: wt!, promotion: "q" });
    const whiteSan = wm?.san ?? wf!;
    let blackSan: string | undefined;
    if (moves[i + 1]) {
      const b = moves[i + 1]!;
      const [bf, bt] = b.split(":");
      const bm = e.move({ from: bf!, to: bt!, promotion: "q" });
      blackSan = bm?.san ?? bf!;
    }
    const cur: MoveRow["current"] = highlightMoveIdx === i ? "w" : highlightMoveIdx === i + 1 ? "b" : undefined;
    rows.push({ num, white: whiteSan, black: blackSan, current: cur });
    num += 1;
  }
  return rows;
}
