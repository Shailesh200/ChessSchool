"use client";

import {
  bestMove,
  botInfo,
  botOptions,
  BOTS,
  chooseMove,
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
  ENDGAME_IDS,
  START_POSITIONS,
  summarise,
  startGame,
  TIME_CONTROLS,
  timeLeft,
  setupProblem,
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
} from "@chessschool/chess";
import { botBackdrop, botRatingOf, canUseGym, copy, gameMood, ENDGAME_MASTERY, START_FEN, type CodyAnimation, type GameRecord, type StoredSetup } from "@chessschool/design";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { GymGuestCard } from "@/components/GymGuestCard";
import { BoardStage } from "@/components/BoardStage";
import { AiCoachCard } from "@/components/AiCoach";
import { BotAvatar } from "@/components/BotAvatar";
import { AccuracyRing, CapturedTray, MoveStrip, MovesSheet, SoundToggle, VerdictCounts } from "@/components/GameParts";
import { Icon } from "@/components/Icon";
import { KeyMomentCard } from "@/components/KeyMoment";
import { ShareCardButton } from "@/components/ShareCard";
import { Cody } from "@/components/Lottie";
import { ActionDock, Button, Card, Sheet, Switch, TopBar } from "@/components/ui";
import { useCoachNotes, usePlayAi } from "@/lib/coach";
import { useGameAnalysis } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { Backdrop } from "@/components/Backdrop";

type Side = Color | "random";
type Mode = "bot" | "friend" | "shuffle" | "position" | "endgame";

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="page-skeleton" aria-busy="true" />}>
      <PlayRoute />
    </Suspense>
  );
}

function PlayRoute() {
  const { ready } = useApp();
  const params = useSearchParams();
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  return <PlayRoom key={params.toString()} params={params} />;
}

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function PlayRoom({ params }: { params: URLSearchParams }) {
  const { state, saveGame, finishGame, cue } = useApp();
  const router = useRouter();
  const saved = state.activeGame;
  const asked = params.get("mode");
  const mode: Mode = asked === "friend" || asked === "shuffle" || asked === "position" || asked === "endgame" ? asked : "bot";
  const firstBot = params.get("bot");
  // A scanned position (from /gym/scan) replaces the position list.
  const askedFen = params.get("fen");
  const scanFen = mode === "position" && askedFen && !setupProblem(askedFen) ? askedFen : null;
  const [bot, setBot] = useState<BotId>(isBotId(firstBot) ? firstBot : "pip");
  const [side, setSide] = useState<Side>(scanFen ? turnOf(scanFen) : "w");
  const [time, setTime] = useState<TimeControlId>("none");
  const [takebacks, setTakebacks] = useState(botInfo(bot).takebacks || mode === "friend");
  const [guide, setGuide] = useState<{ from: Square; to: Square; piece: Piece } | null>(null);
  const [position, setPosition] = useState(START_POSITIONS[0].id);
  const [game, setGame] = useState<PlayState | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [movesOpen, setMovesOpen] = useState(false);
  const [watch, setWatch] = useState<number | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const ai = usePlayAi(game?.setup.opponent.kind === "bot");
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
    const base = defaultSetup(bot);
    const you: Color = side === "random" ? (Math.random() < 0.5 ? "w" : "b") : side;
    const pos = START_POSITIONS.find((p) => p.id === position)!;
    return {
      ...base,
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

  // Quick game and "continue" links start straight away.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    if (!canUseGym(state.account)) return;
    if (params.get("resume") && saved) resume();
    else if (params.get("quick")) start();
    // Runs once on mount with the URL's intent.
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
      const rec: GameRecord = {
        id: `${startedAt}-${next.history.length}`,
        endedAt: Date.now(),
        setup: next.setup as StoredSetup,
        history: next.history,
        winner: winnerOf(next) ?? null,
        reason: next.over.kind,
      };
      setRecord(rec);
      finishGame(rec, (Date.now() - startedAt) / 60_000);
      setTimeout(() => setResultOpen(true), 700);
      cue(next.setup.opponent.kind === "friend" ? "success" : result === "win" ? "level-up" : result === "draw" ? "success" : "tap");
    } else if (!next.over) {
      saveGame({ setup: next.setup as StoredSetup, history: next.history, startedAt, clock: next.clock ? { w: timeLeft(next, "w", Date.now()), b: timeLeft(next, "b", Date.now()) } : null });
      if (next.history.length > prev.history.length) {
        cue(moveCue(next.history.at(-1)!));
        // The learner's own move against a bot: the coach may comment on a mistake.
        if (next.setup.opponent.kind === "bot" && turnOf(prev.fen) === next.setup.you) {
          ai.clearLine();
          ai.comment(prev.fen, next.history.at(-1)!);
        }
      } else if (next.history.length < prev.history.length) cue("tap");
      const side = turnOf(next.fen);
      const human = next.setup.opponent.kind === "friend" || side === next.setup.you;
      if (a.type === "tick" && next.clock && human && !lowWarned.current[side] && timeLeft(next, side, a.now) < 10_000) {
        lowWarned.current[side] = true;
        cue("low-time");
      }
    }
  };

  // Cody's reply, after a short human pause.
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

  // Clocks: redraw and check for a flag four times a second.
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
  useEffect(() => {
    setWatch(null);
  }, [game?.history.length]);

  useEffect(() => {
    setGuide(null);
  }, [game?.fen, watch]);

  if (!canUseGym(state.account)) return <GymGuestCard backHref="/today" />;
  if (!game) {
    const info = botInfo(bot);
    return (
      <div className="page page-narrow">
        <TopBar backHref="/gym" title={copy.gym.setupTitle} />
        <div className="setup">
          {saved && saved.history.length ? (
            <Card className="resume">
              <h2 className="card-title">{copy.play.resume}</h2>
              <p className="muted">{copy.play.resumeBody(Math.ceil(saved.history.length / 2))}</p>
              <Button block icon="play" onClick={resume}>
                {copy.play.resume}
              </Button>
            </Card>
          ) : null}

          {mode === "friend" ? (
            <div className="setup-head">
              <Cody animation="happy" size={88} label={copy.a11y.mascot} />
              <div>
                <h1>{copy.gym.friend.name}</h1>
                <p className="muted">{copy.gym.friend.body}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="setup-head">
                <BotAvatar bot={bot} size={72} />
                <div>
                  <h1>{info.name}</h1>
                  <p className="muted">{info.blurb}</p>
                </div>
              </div>
              <div className="bot-picker" role="radiogroup" aria-label={copy.gym.bots}>
                {BOTS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="radio"
                    aria-checked={bot === b.id}
                    aria-label={`${b.name}, ${b.label}`}
                    className="bot-chip"
                    onClick={() => {
                      setBot(b.id);
                      setTakebacks(b.takebacks);
                    }}
                  >
                    <BotAvatar bot={b.id} size={40} />
                    <span className="bot-chip-text">
                      <span>{b.name}</span>
                      <span className="muted">
                        {b.label} · {copy.gym.botRating(botRatingOf(state.ratings, b.id, b.rating))}
                      </span>
                    </span>
                    <span className="bot-level" aria-hidden>
                      {"★".repeat(b.level)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {!scanFen && (mode === "position" || mode === "endgame") ? (
            <Options label={copy.gym.positions} value={position} onChange={setPosition} options={(mode === "endgame" ? START_POSITIONS.filter((p) => (ENDGAME_IDS as readonly string[]).includes(p.id)) : START_POSITIONS).map((p) => ({ value: p.id, title: p.name, body: mode === "endgame" ? `${p.blurb} · ${(state.endgames[p.id] ?? 0) >= ENDGAME_MASTERY ? copy.gym.endgameMastered : copy.gym.endgameWins(state.endgames[p.id] ?? 0, ENDGAME_MASTERY)}` : p.blurb }))} />
          ) : null}
          {mode !== "friend" ? <Options label={copy.play.side} value={side} onChange={setSide} options={(["w", "b", "random"] as const).map((v) => ({ value: v, title: copy.play.sides[v] }))} row /> : null}
          <Options label={copy.gym.clock} value={time} onChange={setTime} options={TIME_CONTROLS.map((t) => ({ value: t.id, title: t.label }))} row />
          <Card className="setup-switches">
            <Switch icon="undo" label={copy.gym.takebacks} hint={copy.gym.takebacksHint} checked={takebacks} onChange={setTakebacks} />
          </Card>
        </div>
        <ActionDock>
          <Button block icon="play" onClick={start}>
            {copy.gym.start}
          </Button>
        </ActionDock>
      </div>
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
  const lowMs = 20_000;
  const name = opponentName(game.setup);
  const lastSan = game.history.at(-1);
  const statusTitle = friend ? copy.gym.yourTurn(copy.play.sides[turn]) : game.botThinking ? copy.analysis.thinking(name) : game.check ? copy.play.check : copy.play.yourMove;
  const statusSub = !friend && !game.botThinking && lastSan && turn === game.setup.you ? copy.analysis.played(name, lastSan) : null;

  const bar = (color: Color) => {
    const isBot = !friend && color !== game.setup.you;
    const left = game.clock ? timeLeft(game, color, now) : 0;
    return (
      <div className="player">
        {isBot && game.setup.opponent.kind === "bot" ? (
          <BotAvatar bot={game.setup.opponent.bot} size={48} mood={gameMood({ result: playResult(game), thinking: game.botThinking, edge: materialEdge(game.fen) * (game.setup.you === "w" ? -1 : 1) })} />
        ) : (
          <span className="player-avatar" aria-hidden>
            {friend ? copy.play.sides[color][0] : <Icon name="profile" size={22} />}
          </span>
        )}
        <div className="player-text">
          <div className="player-name">
            {isBot ? name : friend ? copy.play.sides[color] : "You"}
            {live && turn === color && !game.over ? <i className="turn-pip" aria-label={copy.gym.yourTurn(copy.play.sides[color])} /> : null}
          </div>
          {isBot && !game.over && !game.botThinking && ai.botSay ? <p className="bot-say">{ai.botSay}</p> : null}
          <CapturedTray startFen={game.setup.startFen} fen={game.fen} color={color} />
        </div>
        {game.clock ? (
          <span className={`clock${turn === color && !game.over ? " is-running" : ""}${left < lowMs && turn === color && !game.over ? " is-low" : ""}`} role="timer" aria-label={`${copy.play.sides[color]} ${fmt(left)}`}>
            {fmt(left)}
          </span>
        ) : null}
      </div>
    );
  };

  const again = () => {
    const at = Date.now();
    const setup = { ...game.setup, startFen: game.setup.startName === copy.gym.shuffle.name ? shuffleFen() : game.setup.startFen };
    saveGame({ setup: setup as StoredSetup, history: [], startedAt: at, clock: null });
    setResultOpen(false);
    begin(startGame(setup, at), at);
  };
  const reviewHref = record ? `/gym/review/${encodeURIComponent(record.id)}` : null;
  const codyEnd: CodyAnimation = friend || result === "win" ? "celebrate" : result === "draw" ? "thinking" : "happy";

  return (
    <div className="page play-page">
      <Backdrop art={botBackdrop(game.setup.opponent.kind === "bot" ? game.setup.opponent.bot : "friend")} fixed />
      <TopBar backHref="/gym" title={friend ? copy.gym.vsFriend : copy.play.vs(name)} action={<SoundToggle />} />
      <div className="play">
        <div className="play-chrome">
          <button type="button" className="icon-btn icon-btn-danger" aria-label={copy.play.resign} disabled={Boolean(game.over)} onClick={() => setConfirm(true)}>
            <Icon name="flag" />
          </button>
          <span className="play-chrome-right">
            <button type="button" className="icon-btn" aria-label={copy.analysis.movesTitle} onClick={() => setMovesOpen(true)}>
              <Icon name="history" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={copy.gym.hints}
              onClick={() => {
                if (!live || game.over || game.botThinking || (!friend && turn !== game.setup.you)) return;
                const m = bestMove(game.fen, { depth: 2, quiescence: 1, timeMs: 40, noise: 0 }, () => 0);
                if (!m) return;
                setGuide({ from: m.from as Square, to: m.to as Square, piece: { type: m.piece as Piece["type"], color: m.color } });
                if (!friend) ai.hint(game.fen, m.san);
              }}
            >
              <Icon name="bulb" />
            </button>
          </span>
        </div>
        <BoardStage top={bar(topSide)} bottom={bar(bottomSide)} className="play-stage">
          <Board
            fen={shownFen}
            orientation={bottomSide}
            selected={live ? game.selected : null}
            targets={live ? game.targets : []}
            lastMove={live ? game.lastMove : ((ply?.lastMove ?? null) as typeof game.lastMove)}
            check={live ? game.check : ((ply?.check ?? null) as typeof game.check)}
            mate={game.over?.kind === "checkmate" ? game.check : null}
            onTap={(sq) => act({ type: "tap", square: sq, now: Date.now() })}
            disabled={!canMove}
            guide={live ? guide : null}
            promotion={game.promotion}
            onPromote={(p) => act(p ? { type: "promote", piece: p, now: Date.now() } : { type: "cancelPromotion" })}
          />
        </BoardStage>
        <div className="play-panel">
          <MoveStrip history={game.history} onOpen={() => setMovesOpen(true)} />
          {resultCopy ? (
            <div className="result-bar" role="status">
              <Cody animation={codyEnd} size={56} label={copy.a11y.mascot} />
              <div className="result-bar-text">
                <strong>{resultCopy.title}</strong>
                <span className="muted">{resultCopy.body}</span>
              </div>
              <div className="result-bar-actions">
                {reviewHref ? (
                  <Button icon="eye" href={reviewHref}>
                    {copy.analysis.see}
                  </Button>
                ) : null}
                <Button variant="secondary" icon="refresh" onClick={again}>
                  {copy.play.again}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {ai.line ? <AiCoachCard kind={ai.line.kind} text={ai.line.text} /> : null}
              <div className="play-status" role="status" aria-live="polite">
                <Cody animation={pose} size={48} />
                <div className="play-status-text">
                  <strong>{statusTitle}</strong>
                  <span className="muted">{statusSub ?? "\u00a0"}</span>
                </div>
              </div>
              <div className="play-steps">
                <button type="button" className="icon-btn" aria-label={game.setup.takebacks ? copy.gym.undo : copy.gym.prev} disabled={game.setup.takebacks ? Boolean(game.over) || game.botThinking || !game.history.length : at === 0} onClick={() => (game.setup.takebacks ? act({ type: "takeback", now: Date.now() }) : setWatch(at - 1))}>
                  <Icon name="undo" />
                </button>
                <button type="button" className="icon-btn" aria-label={game.setup.takebacks ? copy.gym.redo : copy.gym.next} disabled={game.setup.takebacks ? Boolean(game.over) || game.botThinking || !game.undone.length : live} onClick={() => (game.setup.takebacks ? act({ type: "redo", now: Date.now() }) : setWatch(at + 1 >= game.history.length ? null : at + 1))}>
                  <Icon name="redo" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <MovesSheet open={movesOpen} onClose={() => setMovesOpen(false)} history={game.history} />

      {resultCopy ? (
        <ResultSheet
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          title={resultCopy.title}
          body={resultCopy.body}
          cody={codyEnd}
          startFen={game.setup.startFen}
          history={game.history}
          side={friend ? null : game.setup.you}
          share={!friend && winner === game.setup.you ? { fen: game.fen, moves: Math.ceil(game.history.length / 2) } : null}
          reviewHref={reviewHref}
          onAgain={again}
          onBack={() => router.push("/gym")}
        />
      ) : null}

      <Sheet open={confirm} onClose={() => setConfirm(false)} labelledBy="resign-title">
        <Icon name="flag" size={40} />
        <h2 id="resign-title">{copy.play.resignTitle}</h2>
        <p>{copy.play.resignBody}</p>
        <Button
          block
          variant="danger"
          onClick={() => {
            setConfirm(false);
            act({ type: "resign", now: Date.now() });
          }}
        >
          {copy.play.resignConfirm}
        </Button>
        <Button block variant="ghost" onClick={() => setConfirm(false)}>
          {copy.play.resignCancel}
        </Button>
      </Sheet>
    </div>
  );
}

/** Shown once when a game ends: Cody, the result, and a quick look at how you played. */
function ResultSheet(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  cody: CodyAnimation;
  startFen: string;
  history: string[];
  side: Color | null;
  /** The learner won: what the "game won" share card shows. */
  share: { fen: string; moves: number } | null;
  reviewHref: string | null;
  onAgain: () => void;
  onBack: () => void;
}) {
  const plies = useMemo(() => reviewPlies(props.startFen, props.history), [props.startFen, props.history]);
  const { notes, done } = useGameAnalysis(plies);
  // Against a bot, the coach's AI note for the key moment arrives on its own (no extra click).
  const coach = useCoachNotes(props.history, props.startFen, props.side);
  useEffect(() => {
    if (props.open && done && props.side && plies.length >= 2 && coach.signedIn && coach.allowed && coach.status === "idle") coach.ask();
    // Asked once per game, when the sheet opens with the analysis done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, done]);
  const sum = summarise(plies, notes, props.side);
  const best = sum.best ? plies[sum.best - 1] : null;
  return (
    <Sheet open={props.open} onClose={props.onClose} labelledBy="result-title">
      <div className="result-head">
        <Cody animation={props.cody} size={96} label={copy.a11y.mascot} />
        <div>
          <h2 id="result-title">{props.title}</h2>
          <p className="muted">{props.body}</p>
        </div>
      </div>
      {plies.length >= 2 ? (
        <>
          <div className="result-stats">
            <AccuracyRing value={sum.accuracy} pending={!done} />
            <VerdictCounts counts={sum.counts} />
          </div>
          <p className="result-note">
            <Icon name="sparkles" size={20} />
            <span>{!done ? copy.analysis.looking : best ? copy.analysis.bestMoment(plyName(best)) : copy.analysis.cody(sum.accuracy)}</span>
          </p>
          <KeyMomentCard plies={plies} notes={notes} done={done} side={props.side} orientation={props.side ?? "w"} shareable={!props.share} coachNoteFor={(p) => coach.noteFor(p)?.text ?? null} />
        </>
      ) : null}
      <div className="sheet-actions">
        {props.reviewHref ? (
          <Button icon="eye" href={props.reviewHref}>
            {copy.analysis.see}
          </Button>
        ) : null}
        <Button variant="secondary" icon="refresh" onClick={props.onAgain}>
          {copy.play.again}
        </Button>
      </div>
      {props.share ? <ShareCardButton block kind="game_won" data={props.share} /> : null}
      <Button block variant="ghost" onClick={props.onBack}>
        {copy.play.back}
      </Button>
    </Sheet>
  );
}

function Options<T extends string>({ label, value, onChange, options, row }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; title: string; body?: string }[]; row?: boolean }) {
  return (
    <fieldset className="option-group">
      <legend className="card-title">{label}</legend>
      <div className={`option-cards${row ? " is-row" : ""}`} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className="option-card" onClick={() => onChange(o.value)}>
            <strong>{o.title}</strong>
            {o.body ? <span>{o.body}</span> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
