import {
  bestMove,
  botInfo,
  BOTS,
  chooseMove,
  ENDGAME_IDS,
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
  type Piece,
  type PlayAction,
  type PlaySetup,
  type PlayState,
  type Square,
  type TimeControlId,
} from "@chessschool/chess";
import { canUseGym, copy, START_FEN, type CodyAnimation, type GameRecord, type StoredSetup } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board, PieceArt } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { GymGuestCard } from "@/components/GymGuestCard";
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
type Mode = "bot" | "friend" | "shuffle" | "position" | "endgame";

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Play() {
  const params = useLocalSearchParams<{ bot?: string; mode?: string; quick?: string; resume?: string }>();
  const { state, saveGame, finishGame, cue } = useApp();
  const { c } = useTheme();
  const saved = state.activeGame;
  const mode: Mode = params.mode === "friend" || params.mode === "shuffle" || params.mode === "position" || params.mode === "endgame" ? params.mode : "bot";
  const [bot, setBot] = useState<BotId>(isBotId(params.bot) ? params.bot : "cody");
  const [side, setSide] = useState<Side>("w");
  const [time, setTime] = useState<TimeControlId>("none");
  const [takebacks, setTakebacks] = useState(botInfo(isBotId(params.bot) ? params.bot : "cody").takebacks || mode === "friend");
  const [position, setPosition] = useState(START_POSITIONS[0].id);
  const [watch, setWatch] = useState<number | null>(null);
  const [guide, setGuide] = useState<{ from: Square; to: Square; piece: Piece } | null>(null);
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
      startFen: mode === "shuffle" ? shuffleFen() : mode === "position" || mode === "endgame" ? pos.fen : START_FEN,
      startName: mode === "shuffle" ? copy.gym.shuffle.name : mode === "position" || mode === "endgame" ? pos.name : undefined,
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
    if (!canUseGym(state.account)) return;
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
      setTimeout(() => setResultOpen(true), next.over.kind === "checkmate" ? 1600 : 700);
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

  useEffect(() => {
    setWatch(null);
  }, [game?.history.length]);

  useEffect(() => {
    setGuide(null);
  }, [game?.fen, watch]);

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
  if (!canUseGym(state.account)) return <GymGuestCard back />;
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
            <View accessibilityRole="radiogroup" accessibilityLabel={copy.gym.bots} style={{ gap: 8 }}>
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
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2, borderColor: bot === b.id ? c.brand : c.line, backgroundColor: c.card }}
                >
                  <BotAvatar bot={b.id} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T role="label" numberOfLines={1}>
                      {b.name}
                    </T>
                    <T role="micro" color="textMuted" numberOfLines={1}>
                      {b.strength}
                    </T>
                  </View>
                  <T role="micro" style={{ color: c.goldText, fontFamily: fonts.bold }}>
                    {"★".repeat(b.level)}
                  </T>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {mode === "position" || mode === "endgame" ? <Options label={copy.gym.positions} value={position} onChange={setPosition} options={(mode === "endgame" ? START_POSITIONS.filter((p) => (ENDGAME_IDS as readonly string[]).includes(p.id)) : START_POSITIONS).map((p) => ({ value: p.id, title: p.name, body: p.blurb }))} /> : null}
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
  const plies = reviewPlies(game.setup.startFen, game.history);
  const at = watch == null ? game.history.length : Math.max(0, Math.min(watch, game.history.length));
  const live = at === game.history.length;
  const ply = at === 0 ? null : plies[at - 1];
  const shownFen = live ? game.fen : (ply?.fen ?? game.setup.startFen);
  const shownLast = live ? game.lastMove : (ply?.lastMove ?? null);
  const shownCheck = live ? game.check : (ply?.check ?? null);
  const canMove = live && !game.botThinking && !game.over && !game.promotion && (friend || turn === game.setup.you);
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
      <View
        style={[
          { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
          isBot ? { alignSelf: "stretch", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 22, backgroundColor: c.brandSoft, borderWidth: 1, borderColor: c.line } : null,
        ]}
      >
        {isBot && game.setup.opponent.kind === "bot" ? (
          <BotAvatar bot={game.setup.opponent.bot} size={60} />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.brandSoft }}>
            {friend ? <T role="label" color="brandText">{copy.play.sides[color][0]}</T> : <Icon name="profile" color={c.brandText} size={22} />}
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <T role="heading" numberOfLines={1}>
              {isBot ? name : friend ? copy.play.sides[color] : "You"}
            </T>
            {live && turn === color && !game.over ? <View accessibilityLabel={copy.gym.yourTurn(copy.play.sides[color])} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.brand }} /> : null}
          </View>
          {isBot && !game.over ? (
            <T role="bodyLg" numberOfLines={1} style={{ color: c.brandText, fontFamily: fonts.semibold }}>
              {statusTitle}
            </T>
          ) : null}
          <CapturedTray startFen={game.setup.startFen} fen={shownFen} color={color} />
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

  const showHint = () => {
    if (!live || game.over || game.botThinking) return;
    if (!friend && turn !== game.setup.you) return;
    const m = bestMove(game.fen, { depth: 2, quiescence: 1, timeMs: 40, noise: 0 }, () => 0);
    if (!m) return;
    setGuide({ from: m.from as Square, to: m.to as Square, piece: { type: m.piece as Piece["type"], color: m.color } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, overflow: "hidden" }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={friend ? copy.gym.vsFriend : copy.play.vs(name)} action={<SoundToggle />} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.play.resign}
          disabled={Boolean(game.over)}
          onPress={() => setConfirm(true)}
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.danger, alignItems: "center", justifyContent: "center", opacity: game.over ? 0.6 : 1 }}
        >
          <Icon name="flag" color={c.onDanger} size={24} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Button title="" label={copy.analysis.movesTitle} icon="history" variant="secondary" block={false} onPress={() => setMovesOpen(true)} />
        <Button title="" label={copy.gym.hints} icon="bulb" variant="secondary" block={false} onPress={showHint} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 0, gap: 6, paddingBottom: 8, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <BoardStage top={bar(topSide)} bottom={bar(bottomSide)} topSize={friend ? 52 : 96} bottomSize={52}>
          {(size, radius) => (
            <Board
              size={size}
              radius={radius}
              fen={shownFen}
              orientation={bottomSide}
              selected={live ? game.selected : null}
              targets={live ? game.targets : []}
              lastMove={shownLast}
              check={(shownCheck ?? null) as Square | null}
              mate={game.over?.kind === "checkmate" ? game.check : null}
              guide={live ? guide : null}
              onTap={(sq) => act({ type: "tap", square: sq, now: Date.now() })}
              disabled={!canMove}
              promotion={live ? game.promotion : null}
              onPromote={(p) => act(p ? { type: "promote", piece: p, now: Date.now() } : { type: "cancelPromotion" })}
            />
          )}
        </BoardStage>
        <View style={{ paddingHorizontal: 16, gap: 6 }}>
        {!live ? (
          <T role="small" color="brandText" center style={{ fontFamily: fonts.semibold }}>
            {copy.gym.watching(at, game.history.length)}
          </T>
        ) : null}
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
          <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Cody animation={pose} size={40} />
            <View style={{ flex: 1 }}>
              {friend ? (
                <T role="label" numberOfLines={1}>
                  {statusTitle}
                </T>
              ) : null}
              <T role={friend ? "small" : "label"} color="textMuted" numberOfLines={1}>
                {statusSub}
              </T>
            </View>
            <Button title="" label={game.setup.takebacks ? copy.gym.undo : copy.gym.prev} icon="undo" variant="secondary" block={false} disabled={game.setup.takebacks ? Boolean(game.over) || game.botThinking || !game.history.length : at === 0} onPress={() => (game.setup.takebacks ? act({ type: "takeback", now: Date.now() }) : setWatch(at - 1))} />
            <Button title="" label={game.setup.takebacks ? copy.gym.redo : copy.gym.next} icon="redo" variant="secondary" block={false} disabled={game.setup.takebacks ? Boolean(game.over) || game.botThinking || !game.undone.length : live} onPress={() => (game.setup.takebacks ? act({ type: "redo", now: Date.now() }) : setWatch(at + 1 >= game.history.length ? null : at + 1))} />
          </View>
        )}
        </View>
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
