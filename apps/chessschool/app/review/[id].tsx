import { formatEval, keyMomentCard, opponentName, parseSetup, reviewPlies, showTry, startTry, summarise, tryReduce, type BoardArrow, type KeyMoment, type Square, type TryState } from "@chessschool/chess";
import { copy, gameKind, gamePgn } from "@chessschool/design";
import { useConnectivity } from "@/lib/hooks";
import { botName } from "@/components/Daily";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { EvalBar, EvalGraph, momentTone } from "@/components/GameParts";
import { KeyMomentCard } from "@/components/KeyMoment";
import { Cody } from "@/components/Lottie";
import { Button, Sheet, T, TopBar } from "@/components/ui";
import { useCoachNotes, useReviewedSkills } from "@/lib/coach";
import { useGameAnalysis } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

export default function ReviewGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, cue } = useApp();
  const { c } = useTheme();
  const game = state.gameLog.find((g) => g.id === decodeURIComponent(id));
  // Keyed on the setup and moves, not the record: marking a game reviewed must not restart the analysis.
  const gameSetup = game?.setup;
  const history = game?.history;
  const setup = useMemo(() => (gameSetup ? parseSetup(gameSetup) : null), [gameSetup]);
  const plies = useMemo(() => (history && setup ? reviewPlies(setup.startFen, history) : []), [history, setup]);
  const { notes, done } = useGameAnalysis(plies);
  const connectivity = useConnectivity().status;
  const [ply, setPly] = useState(0);
  const [trying, setTrying] = useState<TryState | null>(null);
  const [shake, setShake] = useState(0);
  const [keyOpen, setKeyOpen] = useState(true);
  const friend = setup?.opponent.kind === "friend";
  const side = !setup || friend ? null : setup.you;
  const coach = useCoachNotes(game?.history, setup?.startFen ?? "", side);
  useReviewedSkills(game, plies, notes, done, side);
  // Imported games land here, so their card opens here; bot and friend games showed it on the result sheet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hasKey = useMemo(() => game?.reason === "imported" && done && keyMomentCard(plies, notes, side) !== null, [game?.reason, done, plies, side]);
  const firstNote = coach.notes[0]?.ply;
  useEffect(() => {
    if (firstNote) {
      setTrying(null);
      setPly(firstNote);
    }
  }, [firstNote]);

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
  const orientation = friend ? "w" : setup.you;
  const other = gameKind(game) === "challenge" ? copy.myGames.friend : setup.opponent.kind === "bot" ? botName(setup.opponent.bot) : friend ? copy.myGames.friend : copy.gym.vsOnline;
  const pgn = gamePgn(game, friend ? { white: copy.play.sides.w, black: copy.play.sides.b } : setup.you === "w" ? { white: copy.myGames.you, black: other } : { white: other, black: copy.myGames.you }, copy.myGames.pgnEvent);
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

  const coachNote = cur && !trying ? coach.noteFor(cur.ply) : null;
  const offline = connectivity !== "online";
  const coachLine = offline && coach.status !== "done"
    ? copy.myGames.offlineNotes
    : !coach.signedIn
    ? copy.coachAi.signIn
    : !coach.allowed
      ? copy.myGames.engineOnly
      : coach.status === "loading"
        ? copy.coachAi.loading
        : coach.status === "error"
          ? copy.coachAi.failed
          : coach.status === "limit"
            ? copy.coachAi.limit
            : coach.status === "done" && !coach.notes.length
              ? copy.coachAi.none
              : null;

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
                {friend ? copy.gym.vsFriend : setup.opponent.kind === "online" ? copy.gym.vsOnline : copy.play.vs(opponentName(setup))}
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

        {plies.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={copy.myGames.moves} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 4 }}>
            {plies.map((p) => {
              const on = p.ply === ply && !trying;
              const m = sum.moments.find((x) => x.ply === p.ply);
              const [, mfg, medge] = toneColors[m ? momentTone(m.kind) : "neutral"];
              return (
                <Pressable key={p.ply} accessibilityRole="button" accessibilityLabel={copy.myGames.goTo(moveName(p))} accessibilityState={{ selected: on }} onPress={() => go(p.ply)} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: m ? medge : "transparent", backgroundColor: on ? c.brandSoft : c.card }}>
                  <T role="micro" style={{ fontFamily: fonts.semibold, color: on ? c.brandText : m ? mfg : c.textMuted }}>
                    {moveName(p)}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
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
          {coachNote ? (
            <>
              <T role="small" style={{ fontFamily: fonts.semibold }}>
                {coachNote.text}
              </T>
              <T role="micro" color="textSubtle">
                {copy.coachAi.note}
              </T>
            </>
          ) : null}
        </View>

        {coachLine ? (
          <T role="small" color="textMuted" center>
            {coachLine}
          </T>
        ) : coach.status === "idle" ? (
          <Button title={copy.coachAi.button} icon="spark" variant="secondary" disabled={!done} onPress={coach.ask} />
        ) : null}
        <Sheet visible={keyOpen && hasKey} onClose={() => setKeyOpen(false)}>
          <KeyMomentCard
            plies={plies}
            notes={notes}
            done={done}
            side={side}
            orientation={orientation}
            coachNoteFor={(p) => coach.noteFor(p)?.text ?? null}
            onShow={(p) => {
              setKeyOpen(false);
              go(p);
            }}
          />
          <Button title={copy.analysis.close} variant="ghost" onPress={() => setKeyOpen(false)} />
        </Sheet>

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
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title={copy.myGames.sharePgn} icon="arrowRight" variant="ghost" onPress={() => void Share.share({ message: pgn }).catch(() => {})} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={copy.myGames.shareFen} icon="doc" variant="ghost" onPress={() => void Share.share({ message: trying ? trying.fen : cur ? cur.fen : setup.startFen }).catch(() => {})} />
          </View>
        </View>
        <Button
          title={copy.myGames.analyse}
          icon="bulb"
          variant="secondary"
          onPress={() => router.push(`/analysis?start=${encodeURIComponent(setup.startFen)}&moves=${encodeURIComponent(plies.map((p) => p.san).join(" "))}&at=${ply}&side=${orientation}`)}
        />
      </View>
    </SafeAreaView>
  );
}
