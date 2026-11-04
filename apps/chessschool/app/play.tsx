import {
  botInfo,
  BOTS,
  chooseMove,
  defaultSetup,
  isBotId,
  moveCue,
  opponentName,
  parseSetup,
  playReduce,
  playResult,
  reviewPlies,
  shuffleFen,
  START_POSITIONS,
  summarise,
  startGame,
  TIME_CONTROLS,
  timeLeft,
  turnOf,
  winnerOf,
  type BotId,
  type Color,
  type PlayAction,
  type PlaySetup,
  type PlayState,
  type Square,
  type TimeControlId,
} from "@chessschool/chess";
import { copy, START_FEN, type CodyAnimation, type GameRecord, type StoredSetup } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board, PieceArt } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { BotAvatar } from "@/components/BotAvatar";
import { AccuracyRing, CapturedTray, MoveStrip, MovesSheet, SoundToggle, VerdictCounts } from "@/components/GameParts";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Options } from "@/components/Options";
import { Button, Card, Page, Sheet, SwitchRow, T, TopBar } from "@/components/ui";
import { useGameAnalysis } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

type Side = Color | "random";
type Mode = "bot" | "friend" | "shuffle" | "position";

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Play() {
  const params = useLocalSearchParams<{ bot?: string; mode?: string; quick?: string; resume?: string }>();
  const { state, saveGame, finishGame, cue } = useApp();
  const { c } = useTheme();
  const saved = state.activeGame;
  const mode: Mode = params.mode === "friend" || params.mode === "shuffle" || params.mode === "position" ? params.mode : "bot";
  const [bot, setBot] = useState<BotId>(isBotId(params.bot) ? params.bot : "cody");
  const [side, setSide] = useState<Side>("w");
  const [time, setTime] = useState<TimeControlId>("none");
  const [takebacks, setTakebacks] = useState(botInfo(isBotId(params.bot) ? params.bot : "cody").takebacks || mode === "friend");
  const [position, setPosition] = useState(START_POSITIONS[0].id);
  const [game, setGame] = useState<PlayState | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [movesOpen, setMovesOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const ref = useRef<PlayState | null>(null);
  const lowWarned = useRef<Record<Color, boolean>>({ w: false, b: false });

  const begin = (g: PlayState, at: number) => {
    ref.current = g;
    lowWarned.current = { w: false, b: false };
    setRecord(null);
    setGame(g);
    setStartedAt(at);
    setNow(Date.now());
  };

  const buildSetup = (): PlaySetup => {
    const you: Color = side === "random" ? (Math.random() < 0.5 ? "w" : "b") : side;
    const pos = START_POSITIONS.find((p) => p.id === position)!;
    return {
      ...defaultSetup(bot),
      opponent: mode === "friend" ? { kind: "friend" } : { kind: "bot", bot },
      you: mode === "friend" ? "w" : you,
      time,
      takebacks,
      askPromotion: state.prefs.promotion === "ask",
      startFen: mode === "shuffle" ? shuffleFen() : mode === "position" ? pos.fen : START_FEN,
      startName: mode === "shuffle" ? copy.gym.shuffle.name : mode === "position" ? pos.name : undefined,
    };
  };

  const start = () => {
    const at = Date.now();
    const g = startGame(buildSetup(), at);
    saveGame({ setup: g.setup as StoredSetup, history: [], startedAt: at, clock: null });
    cue("tap");
    begin(g, at);
  };

  const resume = () => {
    if (!saved) return;
    const setup = parseSetup(saved.setup);
    if (!setup) return saveGame(null);
    begin(startGame(setup, Date.now(), saved.history, saved.clock ? { ...saved.clock, turnStartedAt: null } : null), saved.startedAt);
  };

  const auto = useRef(false);
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    if (params.resume && saved) resume();
    else if (params.quick) start();
    // Runs once with the link's intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = (a: PlayAction) => {
    const prev = ref.current;
    if (!prev) return;
    const next = playReduce(prev, a);
    if (next === prev) return;
    ref.current = next;
    setGame(next);
    const result = playResult(next);
    if (next.over && !prev.over) {
      const rec: GameRecord = { id: `${startedAt}-${next.history.length}`, endedAt: Date.now(), setup: next.setup as StoredSetup, history: next.history, winner: winnerOf(next) ?? null, reason: next.over.kind };
      setRecord(rec);
      finishGame(rec, (Date.now() - startedAt) / 60_000);
      setTimeout(() => setResultOpen(true), 700);
      cue(next.setup.opponent.kind === "friend" || result !== "loss" ? (result === "win" ? "level-up" : "success") : "tap");
    } else if (!next.over) {
      saveGame({ setup: next.setup as StoredSetup, history: next.history, startedAt, clock: next.clock ? { w: timeLeft(next, "w", Date.now()), b: timeLeft(next, "b", Date.now()) } : null });
      if (next.history.length > prev.history.length) {
        cue(moveCue(next.history.at(-1)!));
        if (prev.botThinking) AccessibilityInfo.announceForAccessibility(`${copy.a11y.lastMove}: ${next.history.at(-1)}`);
      } else if (next.history.length < prev.history.length) cue("tap");
      const side = turnOf(next.fen);
      const human = next.setup.opponent.kind === "friend" || side === next.setup.you;
      if (a.type === "tick" && next.clock && human && !lowWarned.current[side] && timeLeft(next, side, a.now) < 10_000) {
        lowWarned.current[side] = true;
        cue("low-time");
      }
    }
  };

  useEffect(() => {
    if (!game?.botThinking || game.setup.opponent.kind !== "bot") return;
    const botId = game.setup.opponent.bot;
    const t = setTimeout(() => {
      const m = chooseMove(ref.current!.fen, botId);
      if (m) act({ type: "bot", move: { from: m.from as Square, to: m.to as Square, promotion: m.promotion }, now: Date.now() });
    }, 450);
    return () => clearTimeout(t);
    // act reads the latest game through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.botThinking, game?.fen]);

  const ticking = Boolean(game?.clock && !game.over);
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      act({ type: "tick", now: t });
    }, 250);
    return () => clearInterval(id);
    // act reads the latest game through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticking]);

  /* ---------------- setup ---------------- */
  if (!game) {
    const info = botInfo(bot);
    return (
      <Page title={copy.gym.setupTitle} banner={false} footer={<Button title={copy.gym.start} icon="play" onPress={start} />}>
        {saved && saved.history.length ? (
          <Card style={{ gap: 8, borderColor: c.brand }}>
            <T role="heading">{copy.play.resume}</T>
            <T role="body" color="textMuted">
              {copy.play.resumeBody(Math.ceil(saved.history.length / 2))}
            </T>
            <Button title={copy.play.resume} icon="play" onPress={resume} />
          </Card>
        ) : null}
        {mode === "friend" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Cody animation="happy" size={88} label={copy.a11y.mascot} />
            <View style={{ flex: 1, gap: 4 }}>
              <T role="title" header>
                {copy.gym.friend.name}
              </T>
              <T role="body" color="textMuted">
                {copy.gym.friend.body}
              </T>
            </View>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <BotAvatar bot={bot} size={72} />
              <View style={{ flex: 1, gap: 4 }}>
                <T role="title" header>
                  {info.name}
                </T>
                <T role="body" color="textMuted">
                  {info.blurb}
                </T>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={copy.gym.bots}>
              {BOTS.map((b) => (
                <Pressable
                  key={b.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: bot === b.id }}
                  accessibilityLabel={`${b.name}, ${b.strength}`}
                  onPress={() => {
                    setBot(b.id);
                    setTakebacks(b.takebacks);
                  }}
                  style={{ alignItems: "center", gap: 4, width: 80, padding: 8, borderRadius: 16, borderWidth: 2, borderColor: bot === b.id ? c.brand : c.line, backgroundColor: c.card }}
                >
                  <BotAvatar bot={b.id} size={40} />
                  <T role="micro" style={{ fontFamily: fonts.semibold }} numberOfLines={1}>
                    {b.name.split(" ").at(-1)}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        {mode === "position" ? <Options label={copy.gym.positions} value={position} onChange={setPosition} options={START_POSITIONS.map((p) => ({ value: p.id, title: p.name, body: p.blurb }))} /> : null}
        {mode !== "friend" ? <Options label={copy.play.side} value={side} onChange={setSide} options={(["w", "b", "random"] as const).map((v) => ({ value: v, title: copy.play.sides[v] }))} row /> : null}
        <Options label={copy.gym.clock} value={time} onChange={setTime} options={TIME_CONTROLS.map((t) => ({ value: t.id, title: t.label }))} row />
        <Card style={{ padding: 8 }}>
          <SwitchRow icon="undo" label={copy.gym.takebacks} hint={copy.gym.takebacksHint} value={takebacks} onChange={setTakebacks} />
        </Card>
      </Page>
    );
  }

  /* ---------------- game ---------------- */
  const friend = game.setup.opponent.kind === "friend";
  const result = playResult(game);
  const turn = turnOf(game.fen);
  const bottomSide: Color = friend ? (game.over ? "w" : turn) : game.setup.you;
  const topSide: Color = bottomSide === "w" ? "b" : "w";
  const canMove = !game.botThinking && !game.over && !game.promotion;
  const pose: CodyAnimation = game.botThinking ? "thinking" : game.check ? "wow" : "idle";
  const winner = winnerOf(game);
  const resultCopy = game.over
    ? friend
      ? winner
        ? {
            title: copy.gym.friendWin(copy.play.sides[winner]),
            body:
              game.over.kind === "timeout"
                ? copy.gym.timeout.body
                : game.over.kind === "resigned"
                  ? copy.gym.friendResigned(copy.play.sides[game.over.by])
                  : copy.play.results.win.body,
          }
        : copy.play.results.draw
      : game.over.kind === "timeout"
        ? { title: result === "win" ? copy.play.results.win.title : copy.gym.timeout.title, body: copy.gym.timeout.body }
        : copy.play.results[game.over.kind === "resigned" ? "resigned" : result!]
    : null;
  const name = opponentName(game.setup);
  const lastSan = game.history.at(-1);
  const statusTitle = friend ? copy.gym.yourTurn(copy.play.sides[turn]) : game.botThinking ? copy.analysis.thinking(name) : game.check ? copy.play.check : copy.play.yourMove;
  const statusSub = !friend && !game.botThinking && lastSan && turn === game.setup.you ? copy.analysis.played(name, lastSan) : " ";
  const codyEnd: CodyAnimation = friend || result === "win" ? "celebrate" : result === "draw" ? "thinking" : "happy";
  const reviewPath = record ? `/review/${encodeURIComponent(record.id)}` : null;

  const again = () => {
    const at = Date.now();
    const setup = { ...game.setup, startFen: game.setup.startName === copy.gym.shuffle.name ? shuffleFen() : game.setup.startFen };
    saveGame({ setup: setup as StoredSetup, history: [], startedAt: at, clock: null });
    setResultOpen(false);
    begin(startGame(setup, at), at);
  };

  const bar = (color: Color) => {
    const isBot = !friend && color !== game.setup.you;
    const left = game.clock ? timeLeft(game, color, now) : 0;
    const running = turn === color && !game.over;
    return (
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
        {isBot && game.setup.opponent.kind === "bot" ? (
          <BotAvatar bot={game.setup.opponent.bot} />
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.brandSoft }}>
            {friend ? <T role="label" color="brandText">{copy.play.sides[color][0]}</T> : <Icon name="profile" color={c.brandText} size={22} />}
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <T role="label" numberOfLines={1}>
            {isBot ? name : friend ? copy.play.sides[color] : "You"}
          </T>
          <CapturedTray startFen={game.setup.startFen} fen={game.fen} color={color} />
        </View>
        {game.clock ? (
          <View accessibilityRole="timer" accessibilityLabel={`${copy.play.sides[color]} ${fmt(left)}`} style={{ minWidth: 76, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: "center", backgroundColor: running ? (left < 20_000 ? c.danger : c.brand) : c.sunken }}>
            <T role="label" style={{ fontFamily: fonts.bold, color: running ? c.onBrand : c.text, fontVariant: ["tabular-nums"] }}>
              {fmt(left)}
            </T>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={friend ? copy.gym.vsFriend : copy.play.vs(name)} action={<SoundToggle />} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, gap: 10, paddingBottom: 12, maxWidth: 640, width: "100%", alignSelf: "center" }}>
        <BoardStage top={bar(topSide)} bottom={bar(bottomSide)}>
          {(size) => (
            <Board size={size} fen={game.fen} orientation={bottomSide} selected={game.selected} targets={game.targets} lastMove={game.lastMove} check={game.check} onTap={(sq) => act({ type: "tap", square: sq, now: Date.now() })} disabled={!canMove} />
          )}
        </BoardStage>
        <MoveStrip history={game.history} onOpen={() => setMovesOpen(true)} />
        {resultCopy ? (
          <View accessibilityLiveRegion="polite" style={{ gap: 10, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Cody animation={codyEnd} size={52} label={copy.a11y.mascot} />
              <View style={{ flex: 1 }}>
                <T role="label">{resultCopy.title}</T>
                <T role="small" color="textMuted" numberOfLines={1}>
                  {resultCopy.body}
                </T>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {reviewPath ? (
                <View style={{ flex: 1 }}>
                  <Button title={copy.analysis.see} icon="eye" onPress={() => router.push(reviewPath as never)} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button title={copy.play.again} icon="refresh" variant="secondary" onPress={again} />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 48 }}>
              <Cody animation={pose} size={40} />
              <View style={{ flex: 1 }}>
                <T role="label" numberOfLines={1}>
                  {statusTitle}
                </T>
                <T role="small" color="textMuted" numberOfLines={1}>
                  {statusSub}
                </T>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                {game.setup.takebacks ? <Button title={copy.play.takeback} icon="undo" variant="secondary" disabled={!canMove || !game.history.length} onPress={() => act({ type: "takeback", now: Date.now() })} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Button title={copy.play.resign} icon="flag" variant="ghost" onPress={() => setConfirm(true)} />
              </View>
            </View>
          </View>
        )}
      </View>

      <MovesSheet visible={movesOpen} onClose={() => setMovesOpen(false)} history={game.history} />

      {resultCopy ? (
        <ResultSheet
          visible={resultOpen}
          onClose={() => setResultOpen(false)}
          title={resultCopy.title}
          body={resultCopy.body}
          cody={codyEnd}
          startFen={game.setup.startFen}
          history={game.history}
          side={friend ? null : game.setup.you}
          onAnalysis={
            reviewPath
              ? () => {
                  setResultOpen(false);
                  router.push(reviewPath as never);
                }
              : null
          }
          onAgain={again}
          onBack={() => {
            setResultOpen(false);
            router.back();
          }}
        />
      ) : null}

      <Sheet visible={Boolean(game.promotion)} onClose={() => act({ type: "cancelPromotion" })}>
        <T role="heading" header center>
          {copy.gym.promoteTitle}
        </T>
        <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch" }}>
          {(["q", "r", "b", "n"] as const).map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={copy.gym.promotePieces[p]}
              onPress={() => act({ type: "promote", piece: p, now: Date.now() })}
              style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: 16, borderWidth: 2, borderColor: c.line, backgroundColor: c.card }}
            >
              <PieceArt piece={{ type: p, color: turn }} size={52} />
              <T role="micro">{copy.gym.promotePieces[p]}</T>
            </Pressable>
          ))}
        </View>
        <Button title={copy.gym.cancel} variant="ghost" onPress={() => act({ type: "cancelPromotion" })} />
      </Sheet>

      <Sheet visible={confirm} onClose={() => setConfirm(false)}>
        <Icon name="flag" color={c.text} size={40} />
        <T role="heading" header center>
          {copy.play.resignTitle}
        </T>
        <T role="body" color="textMuted" center>
          {copy.play.resignBody}
        </T>
        <Button
          title={copy.play.resignConfirm}
          variant="danger"
          onPress={() => {
            setConfirm(false);
            act({ type: "resign", now: Date.now() });
          }}
        />
        <Button title={copy.play.resignCancel} variant="ghost" onPress={() => setConfirm(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

/** Shown once when a game ends: Cody, the result, and a quick look at how you played. */
function ResultSheet(props: {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  cody: CodyAnimation;
  startFen: string;
  history: string[];
  side: Color | null;
  onAnalysis: (() => void) | null;
  onAgain: () => void;
  onBack: () => void;
}) {
  const { c } = useTheme();
  const plies = useMemo(() => reviewPlies(props.startFen, props.history), [props.startFen, props.history]);
  const { notes, done } = useGameAnalysis(plies);
  const sum = summarise(plies, notes, props.side);
  const best = sum.best ? plies[sum.best - 1] : null;
  return (
    <Sheet visible={props.visible} onClose={props.onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" }}>
        <Cody animation={props.cody} size={84} label={copy.a11y.mascot} />
        <View style={{ flex: 1 }}>
          <T role="title" header>
            {props.title}
          </T>
          <T role="small" color="textMuted">
            {props.body}
          </T>
        </View>
      </View>
      {plies.length >= 2 ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" }}>
            <AccuracyRing value={sum.accuracy} pending={!done} />
            <VerdictCounts counts={sum.counts} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch", padding: 12, borderRadius: 16, backgroundColor: c.sunken }}>
            <Icon name="sparkles" size={20} color={c.gold} />
            <T role="small" style={{ flex: 1 }}>
              {!done ? copy.analysis.looking : best ? copy.analysis.bestMoment(`${Math.ceil(best.ply / 2)}${best.by === "w" ? "." : "…"} ${best.san}`) : copy.analysis.cody(sum.accuracy)}
            </T>
          </View>
        </>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch" }}>
        {props.onAnalysis ? (
          <View style={{ flex: 1 }}>
            <Button title={copy.analysis.see} icon="eye" onPress={props.onAnalysis} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button title={copy.play.again} icon="refresh" variant="secondary" onPress={props.onAgain} />
        </View>
      </View>
      <Button title={copy.play.back} variant="ghost" onPress={props.onBack} />
    </Sheet>
  );
}
