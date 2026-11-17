"use client";

import { editPlacement, setupFen, setupProblem, type Color, type PieceType } from "@chessschool/chess";
import { aiExplainOn, copy, importGame, scannedRecord } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Board, PieceArt } from "@/components/Board";
import { Button, Segmented, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

/** Longest side sent to the server; the scanner trial measured accuracy at this size. */
const MAX_SIDE = 1024;
const PALETTE = ["K", "Q", "R", "B", "N", "P", "k", "q", "r", "b", "n", "p"];

/** Downscales a picked photo to a JPEG and returns its base64 (no data: prefix). */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

type Scanned = { placement: string; side: Color; confidence: number };

/** Board scanner: a photo becomes an editable position to play, save or analyse. The photo is never kept. */
export default function ScanBoard() {
  const { state, ready, update } = useApp();
  const router = useRouter();
  const toast = useToast();
  const t = copy.scan;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<Scanned | null>(null);
  const [tool, setTool] = useState<string | null>("P");

  if (!ready) return <div className="page-skeleton" aria-busy="true" />;

  const read = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.scanBoard({ image: await shrink(file), mediaType: "image/jpeg", consent: true });
      setBoard({ placement: r.placement, side: r.side ?? "w", confidence: r.confidence });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(status === 429 ? t.limit : status === 422 ? t.failed : t.error);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const pick = () => input.current?.click();

  const fen = board ? setupFen(board.placement, board.side) : "";
  const problem = board ? setupProblem(fen) : null;
  const keep = () => {
    const rec = scannedRecord(fen, Date.now());
    update((s) => importGame(s, rec));
    return rec.id;
  };

  return (
    <div className="page page-narrow">
      <TopBar backHref="/gym/review" title={t.title} />
      {!state.account ? (
        <p className="lead">{t.signIn}</p>
      ) : !aiExplainOn(state) ? (
        <p className="lead">{t.off}</p>
      ) : !board ? (
        <>
          <p className="muted">{t.body}</p>
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void read(e.target.files?.[0])} />
          <Button icon="eye" loading={busy} disabled={busy} onClick={pick}>
            {t.choosePhoto}
          </Button>
          {busy ? <p aria-live="polite">{t.reading}</p> : <p className="muted">{t.tips}</p>}
          {error ? <p className="form-error">{error}</p> : null}
          <p className="small muted">{t.privacy}</p>
        </>
      ) : (
        <>
          <h2>{t.checkTitle}</h2>
          <p className="muted">{t.checkBody}</p>
          {board.confidence < 0.6 ? <p className="form-error">{t.lowConfidence}</p> : null}
          <Board fen={fen} label={t.checkTitle} onTap={(sq) => setBoard({ ...board, placement: editPlacement(board.placement, sq, tool) })} />
          <div className="scan-palette" role="radiogroup" aria-label={t.checkTitle}>
            {PALETTE.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={tool === p} aria-label={copy.a11y.piece(p === p.toUpperCase() ? "w" : "b", p.toLowerCase() as PieceType)} className={tool === p ? "on" : ""} onClick={() => setTool(p)}>
                <PieceArt piece={{ type: p.toLowerCase() as PieceType, color: p === p.toUpperCase() ? "w" : "b" }} size={32} />
              </button>
            ))}
            <button type="button" role="radio" aria-checked={tool === null} className={tool === null ? "on" : ""} onClick={() => setTool(null)}>
              {t.clear}
            </button>
          </div>
          <Segmented<Color> label={t.toMove} value={board.side} onChange={(side) => setBoard({ ...board, side })} options={(["w", "b"] as const).map((v) => ({ value: v, label: copy.play.sides[v] }))} />
          {problem ? (
            <p className="form-error" aria-live="polite">
              {t.problems[problem]}
            </p>
          ) : null}
          <Button icon="play" disabled={Boolean(problem)} onClick={() => router.push(`/play?mode=position&fen=${encodeURIComponent(fen)}`)}>
            {t.play}
          </Button>
          <Button variant="secondary" icon="eye" disabled={Boolean(problem)} onClick={() => router.push(`/gym/review/${encodeURIComponent(keep())}`)}>
            {t.analyse}
          </Button>
          <Button
            variant="secondary"
            icon="history"
            disabled={Boolean(problem)}
            onClick={() => {
              keep();
              toast(t.saved);
            }}
          >
            {t.save}
          </Button>
          <Button variant="ghost" icon="refresh" onClick={() => setBoard(null)}>
            {t.again}
          </Button>
        </>
      )}
    </div>
  );
}
