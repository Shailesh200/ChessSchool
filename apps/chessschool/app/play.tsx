import {
  bestMove,
  botInfo,
  botOptions,
  BOTS,
  chooseMove,
  ENDGAME_IDS,
  defaultSetup,
  isBotId,
  moveCue,
  opponentName,
  parseSetup,
  playReduce,
  plyName,
  randomHue,
  playResult,
  reviewPlies,
  shuffleFen,
  START_POSITIONS,
  summarise,
  startGame,
  TIME_CONTROLS,
  timeLeft,
  turnOf,
  materialEdge,
  winnerOf,
  type BotId,
  type Color,
  type Piece,
  type PlayAction,
  type PlaySetup,
  type PlayState,
  type Square,
  type TimeControlId,
  setupProblem,
} from "@chessschool/chess";
import { botBackdrop, botRatingOf, canUseGym, copy, gameMood, ENDGAME_MASTERY, radius, space, START_FEN, type CodyAnimation, type GameRecord, type StoredSetup } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Backdrop } from "@/components/Backdrop";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board, PieceArt } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { GymGuestCard } from "@/components/GymGuestCard";
import { BotAvatar } from "@/components/BotAvatar";
import { AccuracyRing, CapturedTray, MoveStrip, MovesSheet, SoundToggle, VerdictCounts } from "@/components/GameParts";
import { Icon } from "@/components/Icon";
import { ShareCardButton } from "@/components/Growth";
import { KeyMomentCard } from "@/components/KeyMoment";
import { Cody } from "@/components/Lottie";
import { Options } from "@/components/Options";
import { Button, Card, CoachCard, Page, Sheet, SwitchRow, T, TopBar } from "@/components/ui";
import { AiCoachButton } from "@/components/AiCoach";
import { useCoachNotes, usePlayAi } from "@/lib/coach";
import { useGameAnalysis } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

type Side = Color | "random";
type Mode = "bot" | "friend" | "shuffle" | "position" | "endgame";

const BOT_AVATAR = 56;
const BOT_BAR = 96;
/** How long the learner may think before the AI coach explains the position by itself. */
const STUCK_MS = 10_000;
/** The one fixed row under the board (status and steps, or the result). */
const PANEL = 60;
const PLAYER_AVATAR = 48;
const PLAYER_BAR = 52;

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Play() {
  const params = useLocalSearchParams<{ bot?: string; mode?: string; quick?: string; resume?: string; fen?: string }>();
  const { state, saveGame, finishGame, cue } = useApp();
  const { c } = useTheme();
  const saved = state.activeGame;
  const mode: Mode = params.mode === "friend" || params.mode === "shuffle" || params.mode === "position" || params.mode === "endgame" ? params.mode : "bot";
  // A scanned position (from the board scanner) replaces the position list.
  const scanFen = mode === "position" && params.fen && !setupProblem(params.fen) ? params.fen : null;
  const [bot, setBot] = useState<BotId>(isBotId(params.bot) ? params.bot : "pip");
  const [side, setSide] = useState<Side>(scanFen ? turnOf(scanFen) : "w");
  const [time, setTime] = useState<TimeControlId>("none");
  const [takebacks, setTakebacks] = useState(botInfo(isBotId(params.bot) ? params.bot : "pip").takebacks || mode === "friend");
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
  const ai = usePlayAi(game?.setup.opponent.kind === "bot");
  const winW = useWindowDimensions().width;
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
      startFen: scanFen ?? (mode === "shuffle" ? shuffleFen() : mode === "position" || mode === "endgame" ? pos.fen : START_FEN),
      startName: scanFen ? copy.scan.savedTitle : mode === "shuffle" ? copy.gym.shuffle.name : mode === "position" || mode === "endgame" ? pos.name : undefined,
      startId: scanFen ? undefined : mode === "position" || mode === "endgame" ? pos.id : undefined,
      whiteHue: randomHue(),
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
    const fen = ref.current!.fen;
    const strength = botRatingOf(state.ratings, botId, botInfo(botId).rating);
    const play = (m: { from: string; to: string; promotion?: string } | null) => {
      if (m && ref.current?.fen === fen) act({ type: "bot", move: { from: m.from as Square, to: m.to as Square, promotion: m.promotion as never }, now: Date.now() });
    };
    // The endgame trainer defends perfectly from the tablebase; anything else (or no connection) uses the bot.
    const trainer = (ENDGAME_IDS as readonly string[]).includes(game.setup.startId ?? "");
    const t = setTimeout(() => {
      if (!trainer) return void ai.botMove(fen, botId, botOptions(fen, botId, Math.random, strength)).then(play);
      api
        .tablebase(fen)
        .then((r) => play(r.move ? { from: r.move.slice(0, 2), to: r.move.slice(2, 4), promotion: r.move[4] } : chooseMove(fen, botId, Math.random, strength)))
        .catch(() => play(chooseMove(fen, botId, Math.random, strength)));
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

  // Stuck on a move against a bot: the AI coach explains the position after a while, unasked.
  const stuckFen = game && !game.over && !game.botThinking && watch === null && game.setup.opponent.kind === "bot" && turnOf(game.fen) === game.setup.you ? game.fen : null;
  useEffect(() => {
    if (!stuckFen || !ai.active) return;
    const t = setTimeout(() => explain(stuckFen, false), STUCK_MS);
    return () => clearTimeout(t);
    // explain reads the latest game; the timer restarts only when the position changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stuckFen, ai.active]);

  /** The engine's best move here: shown as an arrow when asked for a hint, and explained by the AI coach. */
  const explain = (fen: string, arrow: boolean) => {
    const m = bestMove(fen, { depth: 2, quiescence: 1, timeMs: 40, noise: 0 }, () => 0);
    if (!m) return;
    if (arrow) setGuide({ from: m.from as Square, to: m.to as Square, piece: { type: m.piece as Piece["type"], color: m.color } });
    if (ref.current?.setup.opponent.kind === "bot") ai.explain(fen, m.san);
  };

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
            {/* The chosen bot, and one row of faces to switch: the Gym list already showed them all. */}
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <BotAvatar bot={bot} size={72} />
              <View style={{ flex: 1, gap: 2 }}>
                <T role="title" header>
                  {info.name}
                </T>
                <T role="small" style={{ fontFamily: fonts.semibold, color: c.goldText }}>
                  {`${"★".repeat(info.level)}  ${info.label} · ${copy.gym.botRating(botRatingOf(state.ratings, bot, info.rating))}`}
                </T>
                <T role="small" color="textMuted">
                  {info.blurb}
                </T>
              </View>
            </Card>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              // Opened from a strong bot in the Gym, its face starts in view.
              contentOffset={{ x: Math.max(0, BOTS.findIndex((b) => b.id === bot) * 84 - (winW - 120) / 2), y: 0 }}
              accessibilityRole="radiogroup" accessibilityLabel={copy.gym.bots} style={{ flexGrow: 0, marginHorizontal: -4 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              {BOTS.map((b) => {
                const on = bot === b.id;
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${b.name}, ${b.label}`}
                    onPress={() => {
                      setBot(b.id);
                      setTakebacks(b.takebacks);
                    }}
                    style={{ width: 76, alignItems: "center", gap: 4, paddingVertical: 8, borderRadius: 16, borderWidth: 2, borderColor: on ? c.brand : "transparent", backgroundColor: on ? c.brandSoft : c.card }}
                  >
                    <BotAvatar bot={b.id} size={44} />
                    <T role="micro" numberOfLines={1} style={{ fontFamily: on ? fonts.bold : fonts.semibold, paddingHorizontal: 4 }}>
                      {b.name.split(" ").at(-1)}
                    </T>
                    <T role="micro" style={{ color: c.goldText, fontSize: 10 }}>
                      {"★".repeat(b.level)}
                    </T>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
        {!scanFen && (mode === "position" || mode === "endgame") ? <Options label={copy.gym.positions} value={position} onChange={setPosition} options={(mode === "endgame" ? START_POSITIONS.filter((p) => (ENDGAME_IDS as readonly string[]).includes(p.id)) : START_POSITIONS).map((p) => ({ value: p.id, title: p.name, body: mode === "endgame" ? `${p.blurb} · ${(state.endgames[p.id] ?? 0) >= ENDGAME_MASTERY ? copy.gym.endgameMastered : copy.gym.endgameWins(state.endgames[p.id] ?? 0, ENDGAME_MASTERY)}` : p.blurb }))} /> : null}
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

  const clock = (color: Color) => {
    if (!game.clock) return null;
    const left = timeLeft(game, color, now);
    const running = turn === color && !game.over;
    return (
      <View accessibilityRole="timer" accessibilityLabel={`${copy.play.sides[color]} ${fmt(left)}`} style={{ minWidth: 76, paddingHorizontal: space[3], paddingVertical: 6, borderRadius: radius.md, alignItems: "center", backgroundColor: running ? (left < 20_000 ? c.danger : c.brand) : c.sunken }}>
        <T role="label" style={{ fontFamily: fonts.bold, color: running ? c.onBrand : c.text, fontVariant: ["tabular-nums"] }}>
          {fmt(left)}
        </T>
      </View>
    );
  };

  const bar = (color: Color) => {
    const isBot = !friend && color !== game.setup.you && game.setup.opponent.kind === "bot";
    if (isBot && game.setup.opponent.kind === "bot") {
      return (
        <CoachCard
          avatar={<BotAvatar bot={game.setup.opponent.bot} size={BOT_AVATAR} mood={gameMood({ result, thinking: game.botThinking, edge: materialEdge(game.fen) * (game.setup.you === "w" ? -1 : 1) })} />}
          title={name}
          trailing={clock(color)}
        >
          {/* One line either way, so the bot's chat never changes the bar's height. */}
          {game.over ? null : !game.botThinking && ai.botSay ? (
            <T role="small" numberOfLines={1} style={{ fontStyle: "italic" }}>
              “{ai.botSay}”
            </T>
          ) : (
            <T role="bodyLg" numberOfLines={1}>
              {statusTitle}
            </T>
          )}
          <CapturedTray startFen={game.setup.startFen} fen={shownFen} color={color} />
        </CoachCard>
      );
    }
    return (
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ width: PLAYER_AVATAR, height: PLAYER_AVATAR, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: c.brandSoft }}>
          {friend ? <T role="label" color="brandText">{copy.play.sides[color][0]}</T> : <Icon name="profile" color={c.brandText} size={22} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <T role="heading" numberOfLines={1}>
              {friend ? copy.play.sides[color] : "You"}
            </T>
            {live && turn === color && !game.over ? <View accessibilityLabel={copy.gym.yourTurn(copy.play.sides[color])} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.brand }} /> : null}
          </View>
          <CapturedTray startFen={game.setup.startFen} fen={shownFen} color={color} />
        </View>
        {clock(color)}
      </View>
    );
  };

  const showHint = () => {
    if (!live || game.over || game.botThinking) return;
    if (!friend && turn !== game.setup.you) return;
    explain(game.fen, true);
  };
  const yourTurn = live && !game.over && !game.botThinking && !friend && turn === game.setup.you;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, overflow: "hidden" }}>
      <Backdrop art={botBackdrop(game.setup.opponent.kind === "bot" ? game.setup.opponent.bot : "friend")} />
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={friend ? copy.gym.vsFriend : copy.play.vs(name)} action={<SoundToggle />} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingBottom: 4 }}>
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
      {/* Nothing below the board grows: bars are fixed height and the panel is one fixed row, so the board never shifts. */}
      <View style={{ flex: 1, gap: 6, paddingBottom: 8, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <BoardStage fixed top={bar(topSide)} bottom={bar(bottomSide)} topSize={friend ? PLAYER_BAR : BOT_BAR} bottomSize={PLAYER_BAR}>
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
        <View accessibilityLiveRegion="polite" style={{ height: PANEL, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {resultCopy ? (
            <>
              <Cody animation={codyEnd} size={44} label={copy.a11y.mascot} />
              <View style={{ flex: 1 }}>
                <T role="label" numberOfLines={1}>{resultCopy.title}</T>
                <T role="small" color="textMuted" numberOfLines={1}>
                  {resultCopy.body}
                </T>
              </View>
              {reviewPath ? <Button title="" label={copy.analysis.see} icon="eye" block={false} onPress={() => router.push(reviewPath as never)} /> : null}
              <Button title="" label={copy.play.again} icon="refresh" variant="secondary" block={false} onPress={again} />
            </>
          ) : (
            <>
              {friend ? <Cody animation={pose} size={40} /> : null}
              <View style={{ flex: 1 }}>
                {friend && live ? (
                  <T role="label" numberOfLines={1}>
                    {statusTitle}
                  </T>
                ) : null}
                <T role={friend && live ? "small" : "label"} color={live ? "textMuted" : "brandText"} numberOfLines={1}>
                  {live ? statusSub : copy.gym.watching(at, game.history.length)}
                </T>
              </View>
              <Button title="" label={game.setup.takebacks ? copy.gym.undo : copy.gym.prev} icon="undo" variant="secondary" block={false} disabled={game.setup.takebacks ? Boolean(game.over) || game.botThinking || !game.history.length : at === 0} onPress={() => (game.setup.takebacks ? act({ type: "takeback", now: Date.now() }) : setWatch(at - 1))} />
              <Button title="" label={game.setup.takebacks ? copy.gym.redo : copy.gym.next} icon="redo" variant="secondary" block={false} disabled={game.setup.takebacks ? Boolean(game.over) || game.botThinking || !game.undone.length : live} onPress={() => (game.setup.takebacks ? act({ type: "redo", now: Date.now() }) : setWatch(at + 1 >= game.history.length ? null : at + 1))} />
            </>
          )}
        </View>
      </View>

      {ai.active ? <AiCoachButton text={ai.lineFor(game.fen)} asking={ai.askingFor(game.fen)} onAsk={() => yourTurn && explain(game.fen, false)} /> : null}

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
          share={!friend && winnerOf(game) === game.setup.you ? { fen: game.fen, moves: Math.ceil(game.history.length / 2) } : null}
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
  /** The learner won: what the "game won" share card shows. */
  share: { fen: string; moves: number } | null;
  onAnalysis: (() => void) | null;
  onAgain: () => void;
  onBack: () => void;
}) {
  const { c } = useTheme();
  const plies = useMemo(() => reviewPlies(props.startFen, props.history), [props.startFen, props.history]);
  const { notes, done } = useGameAnalysis(plies);
  // Against a bot, the coach's AI note for the key moment arrives on its own (no extra tap).
  const coach = useCoachNotes(props.history, props.startFen, props.side);
  useEffect(() => {
    if (props.visible && done && props.side && plies.length >= 2 && coach.signedIn && coach.allowed && coach.status === "idle") coach.ask();
    // Asked once per game, when the sheet opens with the analysis done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible, done]);
  const sum = summarise(plies, notes, props.side);
  const best = sum.best ? plies[sum.best - 1] : null;
  return (
    <Sheet visible={props.visible} onClose={props.onClose} scroll>
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
              {!done ? copy.analysis.looking : best ? copy.analysis.bestMoment(plyName(best)) : copy.analysis.cody(sum.accuracy)}
            </T>
          </View>
          <KeyMomentCard plies={plies} notes={notes} done={done} side={props.side} orientation={props.side ?? "w"} shareable={!props.share} coachNoteFor={(p) => coach.noteFor(p)?.text ?? null} />
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
      {props.share ? <ShareCardButton kind="game_won" data={props.share} /> : null}
      <Button title={copy.play.back} variant="ghost" onPress={props.onBack} />
    </Sheet>
  );
}
