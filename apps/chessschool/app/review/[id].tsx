import { formatEval, opponentName, parseSetup, reviewPlies, showTry, startTry, summarise, tryReduce, type BoardArrow, type KeyMoment, type Square, type TryState } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { EvalBar, EvalGraph, momentTone } from "@/components/GameParts";
import { Cody } from "@/components/Lottie";
import { Button, T, TopBar } from "@/components/ui";
import { useGameAnalysis } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

export default function ReviewGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, cue } = useApp();
  const { c } = useTheme();
  const game = state.gameLog.find((g) => g.id === decodeURIComponent(id));
  const setup = useMemo(() => (game ? parseSetup(game.setup) : null), [game]);
  const plies = useMemo(() => (game && setup ? reviewPlies(setup.startFen, game.history) : []), [game, setup]);
  const { notes, done } = useGameAnalysis(plies);
  const [ply, setPly] = useState(0);
  const [trying, setTrying] = useState<TryState | null>(null);
  const [shake, setShake] = useState(0);

  if (!game || !setup) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}>
        <TopBar />
        <T role="bodyLg">{copy.gym.reviewEmpty}</T>
      </SafeAreaView>
    );
  }

  const go = (n: number) => {
    setTrying(null);
    setPly(Math.max(0, Math.min(plies.length, n)));
  };
  const friend = setup.opponent.kind === "friend";
  const side = friend ? null : setup.you;
  const orientation = friend ? "w" : setup.you;
  const sum = summarise(plies, notes, side);
  const cur = ply ? plies[ply - 1] : null;
  const note = cur ? notes[cur.ply] : null;
  const mine = cur ? !side || cur.by === side : false;
  const moment: KeyMoment | undefined = cur ? sum.moments.find((m) => m.ply === cur.ply) : undefined;
  const kind = moment?.kind ?? note?.verdict ?? "good";
  const tone = mine ? momentTone(kind) : "neutral";
  const toneColors = { danger: [c.dangerSoft, c.dangerText, c.danger], gold: [c.goldSoft, c.goldText, c.gold], success: [c.successSoft, c.successText, c.success], neutral: [c.card, c.text, c.line] } as const;
  const canTry = Boolean(mine && note?.betterMove && note.better);
  const nextMoment = sum.moments.find((m) => m.ply > ply);
  const evalNow = trying ? (ply > 1 ? (notes[ply - 1]?.evalAfter ?? 0) : 0) : (note?.evalAfter ?? 0);
  const moveName = (p: (typeof plies)[number]) => `${Math.ceil(p.ply / 2)}${p.by === "w" ? "." : "…"} ${p.san}`;

  const arrows: BoardArrow[] =
    cur && note?.betterMove && mine && (!trying || trying.status !== "trying")
      ? [...(trying ? [] : [{ from: cur.lastMove.from, to: cur.lastMove.to, tone: "played" as const }]), { from: note.betterMove.from, to: note.betterMove.to, tone: "better" as const }]
      : [];

  let explain: string;
  if (!cur) explain = copy.analysis.start;
  else if (trying)
    explain =
      trying.status === "right"
        ? copy.analysis.tryRight
        : trying.status === "shown"
          ? copy.analysis.tryShown(note?.better ?? "")
          : trying.status === "wrong"
            ? copy.analysis.tryWrong
            : copy.analysis.tryPrompt(copy.play.sides[cur.by]);
  else if (!mine) explain = copy.analysis.explain.opponent;
  else if (kind === "great" || kind === "mate" || kind === "good") explain = copy.analysis.explain[kind];
  else explain = copy.analysis.explain[kind](note?.better ?? null);

  const tap = (sq: Square) => {
    if (!trying) return;
    const next = tryReduce(trying, sq);
    if (next.status === "right" && trying.status !== "right") cue("success");
    if (next.status === "wrong" && next.misses > trying.misses) {
      cue("gentle-no");
      setShake((n) => n + 1);
    }
    setTrying(next);
  };
  const [bg, fg, edge] = toneColors[tone];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={copy.analysis.title} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 12, gap: 10, maxWidth: 640, width: "100%", alignSelf: "center" }}>
        <BoardStage
          top={
            <>
              <Cody animation={tone === "danger" ? "thinking" : tone === "success" ? "happy" : "reading"} size={44} />
              <T role="label" style={{ flex: 1 }} numberOfLines={1}>
                {friend ? copy.gym.vsFriend : copy.play.vs(opponentName(setup))}
              </T>
              <View accessible accessibilityLabel={copy.analysis.evalLabel(formatEval(evalNow))} style={{ minWidth: 72, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: "center", backgroundColor: c.sunken }}>
                <T role="label" style={{ fontFamily: fonts.bold, fontVariant: ["tabular-nums"] }}>
                  {formatEval(evalNow)}
                </T>
              </View>
            </>
          }
        >
          {(size) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <EvalBar cp={evalNow} orientation={orientation} height={size - 28} />
              <Board
                size={size - 20}
                fen={trying ? trying.fen : cur ? cur.fen : setup.startFen}
                orientation={orientation}
                lastMove={trying ? trying.lastMove : cur?.lastMove}
                selected={trying?.selected ?? null}
                targets={trying?.targets ?? []}
                check={trying ? null : ((cur?.check as Square | null) ?? null)}
                arrows={arrows}
                onTap={tap}
                disabled={!trying || trying.status === "right" || trying.status === "shown"}
                shake={shake}
                label={arrows.length === 2 && cur && note?.better ? copy.analysis.arrowsLabel(cur.san, note.better) : undefined}
              />
            </View>
          )}
        </BoardStage>

        <View style={{ gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T role="micro" color="textSubtle">
              {copy.analysis.advantage}
            </T>
            <T role="micro" color="textSubtle">
              {done ? copy.analysis.moveOf(Math.ceil(ply / 2), Math.ceil(plies.length / 2)) : copy.analysis.looking}
            </T>
          </View>
          <EvalGraph plies={plies} notes={notes} current={ply} marks={sum.moments} onPick={go} />
        </View>

        {sum.moments.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
            {sum.moments.map((m) => {
              const on = m.ply === ply;
              const [mbg, mfg, medge] = toneColors[momentTone(m.kind)];
              return (
                <Pressable
                  key={`${m.ply}${m.kind}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => go(m.ply)}
                  style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: on ? medge : "transparent", backgroundColor: on ? mbg : c.sunken }}
                >
                  <T role="small" style={{ fontFamily: fonts.semibold, color: on ? mfg : c.textMuted }}>
                    {`${Math.ceil(m.ply / 2)} · ${copy.analysis.kinds[m.kind]}`}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : done ? (
          <T role="small" color="textMuted">
            {copy.analysis.noMoments}
          </T>
        ) : null}

        <View accessibilityLiveRegion="polite" style={{ gap: 4, minHeight: 88, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: tone === "neutral" ? c.line : edge, backgroundColor: bg }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <T role="label" style={{ flex: 1, color: fg }} numberOfLines={1}>
              {cur ? `${moveName(cur)} · ${mine ? copy.analysis.kinds[kind] : copy.analysis.opponentMove}` : copy.gym.first}
            </T>
            {note ? (
              <T role="small" color="textMuted">
                {formatEval(note.evalAfter)}
              </T>
            ) : null}
          </View>
          <T role="small">{explain}</T>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ width: 64 }}>
            <Button title="" icon="back" variant="secondary" disabled={!ply} label={copy.gym.prev} onPress={() => go(ply - 1)} />
          </View>
          <View style={{ flex: 1 }}>
            {trying ? (
              trying.status === "right" || trying.status === "shown" ? (
                <Button title={copy.analysis.backToGame} icon="back" onPress={() => setTrying(null)} />
              ) : (
                <Button title={copy.analysis.showMe} icon="eye" variant="secondary" onPress={() => setTrying(showTry(trying))} />
              )
            ) : canTry && cur && note?.betterMove ? (
              <Button title={copy.analysis.tryBetter} icon="bulb" onPress={() => setTrying(startTry(cur.fenBefore, note.betterMove!))} />
            ) : (
              <Button title={copy.analysis.nextMoment} icon="spark" variant="secondary" disabled={!nextMoment} onPress={() => nextMoment && go(nextMoment.ply)} />
            )}
          </View>
          <View style={{ width: 64 }}>
            <Button title="" icon="chevron" variant="secondary" disabled={ply >= plies.length} label={copy.gym.next} onPress={() => go(ply + 1)} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
