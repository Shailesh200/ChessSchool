"use client";

import { defaultSetup, playReduce, startGame, type Color, type PlayAction, type PlayState } from "@chessschool/chess";
import { ApiError, copy, errorMessage, type ClassGame } from "@chessschool/design";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { gameStatus, MemberFace } from "@/components/ClassPlay";
import { CapturedTray, MoveStrip, MovesSheet, SoundToggle } from "@/components/GameParts";
import { Button, Sheet, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

const POLL_MS = 8000;

/** A turn-based game with a classmate. The server checks every move; this page polls while waiting. */
function ClassGamePlay() {
  const params = useSearchParams();
  const classId = params.get("class") ?? "";
  const id = params.get("id") ?? "";
  const { state, cue } = useApp();
  const toast = useToast();
  const t = copy.classroom.games;
  const [game, setGame] = useState<ClassGame | null>(null);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [busy, setBusy] = useState(false);
  const [movesOpen, setMovesOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [missing, setMissing] = useState(false);
  const ask = state.prefs.promotion === "ask";

  const show = useCallback(
    (g: ClassGame) => {
      setGame(g);
      setPlay(startGame({ ...defaultSetup(), opponent: { kind: "friend" }, you: g.you ?? "w", takebacks: false, askPromotion: ask }, Date.now(), g.moves));
    },
    [ask],
  );
  const load = useCallback(() => {
    api
      .classGame(classId, id)
      .then((r) => show(r.game))
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) setMissing(true);
      });
  }, [classId, id, show]);
  useEffect(load, [load]);

  const waiting = Boolean(game && game.status === "active" && !game.yourTurn);
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  const send = async (next: PlayState) => {
    const san = next.history.at(-1) ?? "";
    if (!next.lastMove) return;
    setBusy(true);
    try {
      const r = await api.playMove(classId, id, { from: next.lastMove.from, to: next.lastMove.to, promotion: /=([QRBN])/.exec(san)?.[1]?.toLowerCase() });
      cue(r.game.status === "over" ? "success" : "tap");
      show(r.game);
    } catch (err) {
      cue("gentle-no");
      toast(err instanceof ApiError && err.status === 409 ? t.notYourTurn : errorMessage(err));
      load();
    } finally {
      setBusy(false);
    }
  };

  const act = (a: PlayAction) => {
    if (!play || !game?.yourTurn || busy) return;
    const next = playReduce(play, a);
    if (next === play) return;
    setPlay(next);
    if (next.history.length > play.history.length) void send(next);
  };

  const resign = async () => {
    setBusy(true);
    try {
      show((await api.resignGame(classId, id)).game);
      setConfirm(false);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (missing || !game || !play) {
    return (
      <div className="page page-narrow">
        <TopBar title={t.title} backHref="/class" />
        {missing ? <p className="muted">{copy.classroom.invalid}</p> : <div className="page-skeleton" aria-busy="true" />}
      </div>
    );
  }

  const bottom: Color = game.you ?? "w";
  const top: Color = bottom === "w" ? "b" : "w";
  const turn: Color = play.history.length % 2 ? "b" : "w";
  const bar = (color: Color) => {
    const p = color === "w" ? game.white : game.black;
    return (
      <div className="player">
        <MemberFace id={p.avatar} photo={p.photo} size={40} />
        <div className="player-text">
          <div className="player-name">
            {p.id === state.account?.id ? `${p.name} (${copy.classroom.you})` : p.name}
            {game.status === "active" && turn === color ? <i className="turn-pip" aria-label={color === game.you ? t.yourTurn : t.theirTurn(p.name)} /> : null}
          </div>
          <CapturedTray startFen={play.setup.startFen} fen={play.fen} color={color} />
        </div>
        {game.status === "active" && turn === color && color === game.you ? <span className="badge badge-brand">{t.yourTurn}</span> : null}
      </div>
    );
  };

  return (
    <div className="page play-page">
      <TopBar backHref="/class" title={t.vs((game.you === "b" ? game.white : game.black).name)} action={<SoundToggle />} />
      <div className="play">
        <BoardStage top={bar(top)} bottom={bar(bottom)} className="play-stage">
          <Board
            fen={play.fen}
            orientation={bottom}
            selected={play.selected}
            targets={play.targets}
            lastMove={play.lastMove}
            check={play.check}
            mate={play.over?.kind === "checkmate" ? play.check : null}
            onTap={(sq) => act({ type: "tap", square: sq, now: Date.now() })}
            disabled={!game.yourTurn || busy}
            promotion={play.promotion}
            onPromote={(p) => act(p ? { type: "promote", piece: p, now: Date.now() } : { type: "cancelPromotion" })}
          />
        </BoardStage>
        <div className="play-panel">
          <MoveStrip history={play.history} onOpen={() => setMovesOpen(true)} />
          <p className="play-status" role="status" aria-live="polite">
            <strong>{waiting ? t.waiting : gameStatus(game)}</strong>
          </p>
          {game.you && game.status === "active" ? (
            <Button variant="ghost" icon="flag" disabled={busy} onClick={() => setConfirm(true)}>
              {t.resign}
            </Button>
          ) : null}
        </div>
      </div>
      <MovesSheet open={movesOpen} onClose={() => setMovesOpen(false)} history={play.history} />
      <Sheet open={confirm} onClose={() => setConfirm(false)} labelledBy="resign-title">
        <h2 id="resign-title">{t.resignTitle}</h2>
        <p>{t.resignBody}</p>
        <Button block variant="danger" loading={busy} onClick={() => void resign()}>
          {t.resign}
        </Button>
        <Button block variant="ghost" onClick={() => setConfirm(false)}>
          {copy.classroom.cancel}
        </Button>
      </Sheet>
    </div>
  );
}

export default function ClassGamePage() {
  return (
    <Suspense fallback={<div className="page-skeleton" aria-busy="true" />}>
      <ClassGamePlay />
    </Suspense>
  );
}
