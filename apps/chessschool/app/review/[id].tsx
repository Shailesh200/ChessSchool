import { formatEval, moveFacts, moveNoAt, opponentName, parseSetup, playerHues, plyName, reviewPlies, showTry, startTry, summarise, tryReduce, type BoardArrow, type Color, type KeyMoment, type Square, type TryState } from "@chessschool/chess";
import { copy, moveStory, playerHueColors } from "@chessschool/design";
import { useConnectivity, useReducedMotion } from "@/lib/hooks";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, Easing, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { EvalBar, EvalGraph, momentTone } from "@/components/GameParts";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, T, TopBar } from "@/components/ui";
import { AiCoachButton } from "@/components/AiCoach";
import { useCoachNotes, useReviewedSkills } from "@/lib/coach";
import { useGameAnalysis } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

export default function ReviewGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, cue } = useApp();
  const { c, scheme } = useTheme();
  const reduced = useReducedMotion();
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
  // "Try it" grows the board to fill the screen (and shrinks it back), like a map opening from a card.
  const expanded = trying !== null;
  const grow = useRef(new Animated.Value(0)).current;
  const [panelH, setPanelH] = useState(0);
  useEffect(() => {
    Animated.timing(grow, { toValue: expanded ? 1 : 0, duration: reduced ? 0 : 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [expanded, grow, reduced]);
  useEffect(() => {
    if (!expanded) return;
    // Hardware back shrinks the board back instead of leaving the screen.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setTrying(null);
      return true;
    });
    return () => sub.remove();
  }, [expanded]);
  const friend = setup?.opponent.kind === "friend";
  const side = !setup || friend ? null : setup.you;
  const coach = useCoachNotes(game?.history, setup?.startFen ?? "", side);
  useReviewedSkills(game, plies, notes, done, side);
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
  const other = setup.opponent.kind === "bot" ? opponentName(setup) : copy.myGames.friend;
  const playerName = (by: Color) => (friend ? copy.play.sides[by] : by === setup.you ? copy.myGames.you : other);
  // Each player's colour, kept on the game so it is the same every time the game is opened.
  const hues = playerHues(setup.whiteHue, game.id);
  const hue = (by: Color) => playerHueColors[hues[by]][scheme === "dark" ? "dark" : "light"];
  const sum = summarise(plies, notes, side);
  const cur = ply ? plies[ply - 1] : null;
  const note = cur ? notes[cur.ply] : null;
  const mine = cur ? !side || cur.by === side : false;
  const moment: KeyMoment | undefined = cur ? sum.moments.find((m) => m.ply === cur.ply) : undefined;
  const kind = moment?.kind ?? note?.verdict ?? "good";
  const tone = mine ? momentTone(kind) : "neutral";
  const toneColors = { danger: [c.dangerSoft, c.dangerText, c.danger], gold: [c.goldSoft, c.goldText, c.gold], success: [c.successSoft, c.successText, c.success], neutral: [c.card, c.text, c.line] } as const;
  // The engine's board facts for this move: they word the explanation, and their better move is the one to try.
  const facts = cur && note ? moveFacts(cur, note) : null;
  const better = facts?.better ?? note?.better ?? null;
  const betterMove = facts?.betterMove ?? note?.betterMove ?? null;
  const canTry = Boolean(mine && betterMove && better && note?.verdict !== "good");
  const nextMoment = sum.moments.find((m) => m.ply > ply);
  const evalNow = trying ? (ply > 1 ? (notes[ply - 1]?.evalAfter ?? 0) : 0) : (note?.evalAfter ?? 0);

  const arrows: BoardArrow[] =
    cur && betterMove && canTry && (!trying || trying.status !== "trying")
      ? [...(trying ? [] : [{ from: cur.lastMove.from, to: cur.lastMove.to, tone: "played" as const }]), { from: betterMove.from, to: betterMove.to, tone: "better" as const }]
      : [];

  let explain: string;
  if (!cur) explain = copy.analysis.start;
  else if (trying)
    explain =
      trying.status === "right"
        ? copy.analysis.tryRight
        : trying.status === "shown"
          ? copy.analysis.tryShown(better ?? "")
          : trying.status === "wrong"
            ? copy.analysis.tryWrong
            : copy.analysis.tryPrompt(copy.play.sides[cur.by]);
  else if (mine && (kind === "great" || kind === "mate")) explain = copy.analysis.explain[kind];
  else if (facts) explain = moveStory(facts, mine);
  else explain = mine ? copy.analysis.looking : copy.analysis.explain.opponent;

  // Chaukor AI floats over the review: tap to ask, then each key move's note shows in its bubble.
  const aiOn = coach.signedIn && coach.allowed && (connectivity === "online" || coach.status === "done") && !expanded;
  const askAi = () => {
    if (coach.status === "idle" || coach.status === "error") return void (done && coach.ask());
    const next = coach.nextNote(ply);
    if (next) go(next);
  };

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
  // The panels under the board fold away while the board is big.
  const fold = { maxHeight: panelH ? grow.interpolate({ inputRange: [0, 1], outputRange: [panelH, 0] }) : undefined, opacity: grow.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: "clamp" }), overflow: "hidden" as const };
  const playerChip = (by: Color) => (
    <View key={by} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: hue(by).soft }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hue(by).ink }} />
      <T role="micro" numberOfLines={1} style={{ fontFamily: fonts.semibold, color: hue(by).ink }}>
        {`${playerName(by)} · ${copy.play.sides[by]}`}
      </T>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={copy.analysis.title} onBack={expanded ? () => setTrying(null) : undefined} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 12, gap: 10, maxWidth: expanded ? 900 : 640, width: "100%", alignSelf: "center" }}>
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
              {expanded ? (
                <Pressable accessibilityRole="button" accessibilityLabel={copy.analysis.minimise} onPress={() => setTrying(null)} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.sunken }}>
                  <Icon name="close" size={20} color={c.text} />
                </Pressable>
              ) : null}
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
                label={arrows.length === 2 && cur && better ? copy.analysis.arrowsLabel(cur.san, better) : undefined}
              />
            </View>
          )}
        </BoardStage>

        <Animated.View style={fold} pointerEvents={expanded ? "none" : "auto"} importantForAccessibility={expanded ? "no-hide-descendants" : "auto"} accessibilityElementsHidden={expanded}>
          <View onLayout={(e) => !expanded && setPanelH(Math.ceil(e.nativeEvent.layout.height))} style={{ gap: 10 }}>
            <View style={{ gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <T role="micro" color="textSubtle">
                  {copy.analysis.advantage}
                </T>
                <T role="micro" color="textSubtle">
                  {done ? copy.analysis.moveOf(moveNoAt(plies, ply), plies.at(-1)?.moveNo ?? 0) : copy.analysis.looking}
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
                        {`${moveNoAt(plies, m.ply)} · ${copy.analysis.kinds[m.kind]}`}
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
              <>
                <View accessibilityLabel={copy.analysis.players} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {(orientation === "w" ? (["w", "b"] as const) : (["b", "w"] as const)).map(playerChip)}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={copy.myGames.moves} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 4 }}>
                  {plies.map((p) => {
                    const on = p.ply === ply && !trying;
                    const m = sum.moments.find((x) => x.ply === p.ply);
                    const [, , medge] = toneColors[m ? momentTone(m.kind) : "neutral"];
                    const h = hue(p.by);
                    return (
                      <Pressable
                        key={p.ply}
                        accessibilityRole="button"
                        accessibilityLabel={`${copy.myGames.goTo(plyName(p))}, ${playerName(p.by)}`}
                        accessibilityState={{ selected: on }}
                        onPress={() => go(p.ply)}
                        style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 2, borderColor: on ? h.ink : m ? medge : "transparent", backgroundColor: on ? h.ink : h.soft }}
                      >
                        <T role="micro" style={{ fontFamily: fonts.semibold, color: on ? c.card : h.ink }}>
                          {plyName(p)}
                        </T>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}
          </View>
        </Animated.View>

        <View accessibilityLiveRegion="polite" style={{ gap: 4, minHeight: expanded ? 0 : 88, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: tone === "neutral" ? c.line : edge, backgroundColor: bg }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            {cur ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hue(cur.by).ink }} /> : null}
            <T role="label" style={{ flex: 1, color: fg }} numberOfLines={1}>
              {cur ? `${plyName(cur)} · ${mine ? copy.analysis.kinds[kind] : copy.analysis.opponentMove}` : copy.gym.first}
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
            ) : canTry && cur && betterMove ? (
              <Button title={copy.analysis.tryBetter} icon="bulb" onPress={() => setTrying(startTry(cur.fenBefore, betterMove))} />
            ) : (
              <Button title={copy.analysis.nextMoment} icon="spark" variant="secondary" disabled={!nextMoment} onPress={() => nextMoment && go(nextMoment.ply)} />
            )}
          </View>
          <View style={{ width: 64 }}>
            <Button title="" icon="chevron" variant="secondary" disabled={ply >= plies.length} label={copy.gym.next} onPress={() => go(ply + 1)} />
          </View>
        </View>
        {expanded ? null : (
          <Button
            title={copy.myGames.analyse}
            icon="bulb"
            variant="ghost"
            onPress={() => router.push(`/analysis?start=${encodeURIComponent(setup.startFen)}&moves=${encodeURIComponent(plies.map((p) => p.san).join(" "))}&at=${ply}&side=${orientation}`)}
          />
        )}
      </View>
      {aiOn ? <AiCoachButton text={coach.lineAt(ply)} asking={coach.status === "loading" || (!done && coach.status === "idle")} onAsk={askAi} /> : null}
    </SafeAreaView>
  );
}
