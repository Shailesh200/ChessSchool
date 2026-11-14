"use client";

import { startVision, VISION_GAMES, VISION_SECONDS, visionAnswer, visionFen, type MoveRef, type Square, type VisionGame, type VisionPlay } from "@chessschool/chess";
import { copy, type IconName } from "@chessschool/design";
import { useEffect, useState } from "react";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, Card, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

const ICONS: Record<VisionGame, IconName> = { name: "eye", attack: "bolt", knight: "spark" };

export default function VisionPage() {
  const { ready } = useApp();
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  return <Vision />;
}

/** Board vision: three 30-second games. Bests stay on the device; signed in, each run counts toward today's class best. */
function Vision() {
  const { state, finishVision, cue } = useApp();
  const [game, setGame] = useState<VisionGame | null>(null);
  const [play, setPlay] = useState<VisionPlay | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ score: number; best: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [reveal, setReveal] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<MoveRef | null>(null);
  const t = copy.vision;
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [play]);

  useEffect(() => {
    if (!play || !game || left > 0) return;
    setResult({ score: play.score, best: state.vision[game] ?? 0 });
    finishVision(game, play.score);
    cue(play.score > (state.vision[game] ?? 0) ? "level-up" : "success");
    setPlay(null);
    setReveal([]);
    // Only the clock reaching zero matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const start = (g: VisionGame) => {
    const at = Date.now();
    setGame(g);
    setResult(null);
    setLastMove(null);
    setEndsAt(at + VISION_SECONDS * 1000);
    setNow(at);
    setPlay(startVision(g));
  };

  const answer = (sq: Square) => {
    if (!play || reveal.length) return;
    const r = visionAnswer(play, sq);
    if (r.result === "none") {
      if (play.round.game === "knight") setShake((n) => n + 1);
      return;
    }
    if (r.result === "miss") {
      setShake((n) => n + 1);
      cue("gentle-no");
      if (play.round.game === "attack") {
        // Show the squares that were left, then the next piece.
        setReveal(r.missed);
        setTimeout(() => {
          setReveal([]);
          setPlay((p) => (p ? r.play : p));
        }, 800);
        return;
      }
    } else cue(r.play.score > play.score && play.round.game !== "attack" ? "success" : "tap");
    if (play.round.game === "knight") setLastMove({ from: play.round.from, to: sq });
    setPlay(r.play);
  };

  if (!game) {
    return (
      <div className="page">
        <TopBar backHref="/gym" title={t.title} />
        <p className="page-lead">{t.body}</p>
        <ul className="modes">
          {VISION_GAMES.map((g) => (
            <li key={g}>
              <button type="button" className="mode-tile" onClick={() => setGame(g)}>
                <span className="mode-icon">
                  <Icon name={ICONS[g]} />
                </span>
                <span className="mode-name">{t.games[g].name}</span>
                <span className="mode-body">{t.games[g].body}</span>
                <span className="mode-body">{t.best(state.vision[g] ?? 0)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const info = t.games[game];
  if (!play) {
    const beat = result && result.score > result.best;
    return (
      <div className="page page-narrow">
        <TopBar title={t.title} backHref="/gym" />
        <Card className="room-detail tint-gold">
          <Cody animation={result ? "celebrate" : "wow"} size={150} label={copy.a11y.mascot} />
          <h1>{result ? t.over : info.name}</h1>
          <p className="lead">{result ? t.score(result.score) : info.body}</p>
          {beat ? <p className="beat-tag">{copy.puzzles.newBest}</p> : null}
          <p className="muted">{t.best(state.vision[game] ?? 0)}</p>
          <Button icon="bolt" onClick={() => start(game)}>
            {result ? t.again : t.start}
          </Button>
          <Button variant="ghost" onClick={() => setGame(null)}>
            {t.other}
          </Button>
        </Card>
      </div>
    );
  }

  const r = play.round;
  const prompt = r.game === "attack" ? `${t.games.attack.prompt(t.pieces[r.piece])} ${t.found(r.found.length, r.targets.length)}` : t.games[r.game].prompt;
  return (
    <div className="page play-page">
      <TopBar backHref="/gym" title={info.name} />
      <div className="play puzzle-play">
        <BoardStage
          className="play-stage"
          top={
            <div className="player">
              <span className={`clock is-running${left <= 5 ? " is-low" : ""}`} role="timer">
                {copy.puzzles.timeLeft(left)}
              </span>
              <p className="stage-status">{t.score(play.score)}</p>
            </div>
          }
          bottom={
            <div className="player">
              <p className="stage-status" role="status" aria-live="polite">
                {prompt}
              </p>
            </div>
          }
        >
          <Board
            fen={visionFen(r)}
            label={t.title}
            hideCoords={r.game === "name"}
            highlight={r.game === "name" ? [r.square] : r.game === "attack" ? r.found : []}
            stars={r.game === "knight" ? [r.target] : []}
            hints={reveal}
            lastMove={r.game === "knight" ? lastMove : null}
            shake={shake}
            disabled={r.game === "name" || reveal.length > 0}
            onTap={r.game === "name" ? undefined : answer}
          />
        </BoardStage>
        {r.game === "name" ? (
          <div className="play-panel vision-choices">
            {r.choices.map((sq) => (
              <Button key={sq} variant="secondary" block onClick={() => answer(sq)}>
                {sq}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
