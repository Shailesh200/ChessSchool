"use client";

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
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Board, PieceArt } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { BotAvatar } from "@/components/BotAvatar";
import { AccuracyRing, CapturedTray, MoveStrip, MovesSheet, SoundToggle, VerdictCounts } from "@/components/GameParts";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { ActionDock, Button, Card, Sheet, Switch, TopBar } from "@/components/ui";
import { useGameAnalysis } from "@/lib/hooks";
import { useApp } from "@/lib/state";

type Side = Color | "random";
type Mode = "bot" | "friend" | "shuffle" | "position";

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
  const mode: Mode = params.get("mode") === "friend" ? "friend" : params.get("mode") === "shuffle" ? "shuffle" : params.get("mode") === "position" ? "position" : "bot";
  const firstBot = params.get("bot");
  const [bot, setBot] = useState<BotId>(isBotId(firstBot) ? firstBot : "cody");
  const [side, setSide] = useState<Side>("w");
  const [time, setTime] = useState<TimeControlId>("none");
  const [takebacks, setTakebacks] = useState(botInfo(bot).takebacks || mode === "friend");
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

  // Quick game and "continue" links start straight away.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
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
      if (next.history.length > prev.history.length) cue(moveCue(next.history.at(-1)!));
      else if (next.history.length < prev.history.length) cue("tap");
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
    const t = setTimeout(() => {
      const m = chooseMove(ref.current!.fen, botId);
      if (m) act({ type: "bot", move: { from: m.from as Square, to: m.to as Square, promotion: m.promotion }, now: Date.now() });
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
                    aria-label={`${b.name}, ${b.strength}`}
                    className="bot-chip"
                    onClick={() => {
                      setBot(b.id);
                      setTakebacks(b.takebacks);
                    }}
                  >
                    <BotAvatar bot={b.id} size={40} />
                    <span>{b.name.split(" ").at(-1)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === "position" ? (
            <Options label={copy.gym.positions} value={position} onChange={setPosition} options={START_POSITIONS.map((p) => ({ value: p.id, title: p.name, body: p.blurb }))} />
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
          <BotAvatar bot={game.setup.opponent.bot} />
        ) : (
          <span className="player-avatar" aria-hidden>
            {friend ? copy.play.sides[color][0] : <Icon name="profile" size={22} />}
          </span>
        )}
        <div className="player-text">
          <div className="player-name">{isBot ? name : friend ? copy.play.sides[color] : "You"}</div>
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
      <TopBar backHref="/gym" title={friend ? copy.gym.vsFriend : copy.play.vs(name)} action={<SoundToggle />} />
      <div className="play">
        <BoardStage top={bar(topSide)} bottom={bar(bottomSide)} className="play-stage">
          <Board
            fen={game.fen}
            orientation={bottomSide}
            selected={game.selected}
            targets={game.targets}
            lastMove={game.lastMove}
            check={game.check}
            onTap={(sq) => act({ type: "tap", square: sq, now: Date.now() })}
            disabled={!canMove}
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
              <div className="play-status" role="status" aria-live="polite">
                <Cody animation={pose} size={48} />
                <div className="play-status-text">
                  <strong>{statusTitle}</strong>
                  <span className="muted">{statusSub ?? "\u00a0"}</span>
                </div>
              </div>
              <div className="play-tools">
                {game.setup.takebacks ? (
                  <Button variant="secondary" icon="undo" onClick={() => act({ type: "takeback", now: Date.now() })} disabled={!canMove || !game.history.length}>
                    {copy.play.takeback}
                  </Button>
                ) : (
                  <span />
                )}
                <Button variant="ghost" icon="flag" onClick={() => setConfirm(true)}>
                  {copy.play.resign}
                </Button>
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
          reviewHref={reviewHref}
          onAgain={again}
          onBack={() => router.push("/gym")}
        />
      ) : null}

      <Sheet open={Boolean(game.promotion)} onClose={() => act({ type: "cancelPromotion" })} labelledBy="promo-title">
        <h2 id="promo-title">{copy.gym.promoteTitle}</h2>
        <div className="promo-row">
          {(["q", "r", "b", "n"] as const).map((p) => (
            <button key={p} type="button" className="promo-btn" aria-label={copy.gym.promotePieces[p]} onClick={() => act({ type: "promote", piece: p, now: Date.now() })}>
              <PieceArt piece={{ type: p, color: turn }} size={56} />
              <span>{copy.gym.promotePieces[p]}</span>
            </button>
          ))}
        </div>
        <Button block variant="ghost" onClick={() => act({ type: "cancelPromotion" })}>
          {copy.gym.cancel}
        </Button>
      </Sheet>

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
  reviewHref: string | null;
  onAgain: () => void;
  onBack: () => void;
}) {
  const plies = useMemo(() => reviewPlies(props.startFen, props.history), [props.startFen, props.history]);
  const { notes, done } = useGameAnalysis(plies);
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
            <span>{!done ? copy.analysis.looking : best ? copy.analysis.bestMoment(`${Math.ceil(best.ply / 2)}${best.by === "w" ? "." : "…"} ${best.san}`) : copy.analysis.cody(sum.accuracy)}</span>
          </p>
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
