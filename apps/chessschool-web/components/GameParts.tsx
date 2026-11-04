"use client";

import { capturedPieces, evalShare, materialEdge, type Color, type MoveNote, type MoveVerdict, type ReviewPly } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { PieceArt } from "./Board";
import { Icon } from "./Icon";
import { Button, Sheet, Switch, useToast } from "./ui";
import { useApp } from "@/lib/state";

/** Pieces `color` has taken, and how far ahead on material that leaves them. Always the same height. */
export function CapturedTray({ startFen, fen, color }: { startFen: string; fen: string; color: Color }) {
  const taken = capturedPieces(startFen, fen)[color === "w" ? "b" : "w"];
  const edge = (materialEdge(fen) - materialEdge(startFen)) * (color === "w" ? 1 : -1);
  return (
    <div className="tray" aria-label={copy.analysis.capturedLabel(taken.length, edge)}>
      {taken.length ? (
        <span className="tray-chip">
          {taken.map((t, i) => (
            <PieceArt key={i} piece={{ type: t, color: color === "w" ? "b" : "w" }} size={20} />
          ))}
        </span>
      ) : null}
      {edge > 0 ? <span className="tray-edge">{copy.analysis.ahead(edge)}</span> : null}
    </div>
  );
}

export function SoundToggle() {
  const { state, setPrefs } = useApp();
  const on = state.prefs.sound;
  return (
    <button type="button" className="icon-btn" aria-pressed={on} aria-label={on ? copy.analysis.mute : copy.analysis.unmute} onClick={() => setPrefs({ sound: !on })}>
      <Icon name={on ? "sound" : "mute"} />
    </button>
  );
}

const plyLabel = (i: number) => (i % 2 === 0 ? `${i / 2 + 1}.` : "");

/** One fixed-height line of moves; the newest stays in view and older ones fade off to the left. */
export function MoveStrip({ history, onOpen }: { history: string[]; onOpen: () => void }) {
  return (
    <button type="button" className="move-strip" onClick={onOpen} aria-label={`${copy.analysis.allMoves}. ${history.slice(-2).join(" ")}`} disabled={!history.length}>
      <span className="move-strip-line" aria-hidden>
        {history.length ? (
          history.map((san, i) => (
            <span key={i} className="move-strip-ply">
              {plyLabel(i) ? <span className="move-strip-n">{plyLabel(i)}</span> : null}
              <span className={i === history.length - 1 ? "is-last" : undefined}>{san}</span>
            </span>
          ))
        ) : (
          <span className="move-strip-empty">{copy.analysis.noMoves}</span>
        )}
      </span>
      <span className="move-strip-btn" aria-hidden>
        <Icon name="history" size={20} />
      </span>
    </button>
  );
}

export const movePairs = (history: string[]) => {
  const out: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) out.push({ n: i / 2 + 1, w: history[i], b: history[i + 1] });
  return out;
};

export function MovesSheet({ open, onClose, history }: { open: boolean; onClose: () => void; history: string[] }) {
  const { state, setPrefs } = useApp();
  const toast = useToast();
  const pairs = movePairs(history);
  return (
    <Sheet open={open} onClose={onClose} labelledBy="moves-title">
      <div className="moves-head">
        <h2 id="moves-title">{copy.analysis.movesTitle}</h2>
        <span className="muted">{copy.gym.moveCount(pairs.length)}</span>
      </div>
      <ol className="moves-table">
        {pairs.map((p, i) => (
          <li key={p.n}>
            <span className="moves-n">{p.n}.</span>
            <span className={i === pairs.length - 1 && !p.b ? "is-last" : undefined}>{p.w}</span>
            <span className={i === pairs.length - 1 && p.b ? "is-last" : undefined}>{p.b ?? ""}</span>
          </li>
        ))}
      </ol>
      <div className="sheet-wide">
        <Switch icon="sound" label={copy.analysis.sounds} hint={copy.analysis.soundsHint} checked={state.prefs.sound} onChange={(v) => setPrefs({ sound: v })} />
      </div>
      <div className="sheet-actions">
        <Button
          variant="secondary"
          icon="doc"
          onClick={() => {
            const text = pairs.map((p) => `${p.n}. ${p.w}${p.b ? ` ${p.b}` : ""}`).join(" ");
            void navigator.clipboard?.writeText(text).then(() => toast(copy.analysis.copied), () => {});
          }}
        >
          {copy.analysis.copyMoves}
        </Button>
        <Button icon="close" onClick={onClose}>
          {copy.analysis.close}
        </Button>
      </div>
    </Sheet>
  );
}

export function AccuracyRing({ value, size = 96, pending }: { value: number; size?: number; pending?: boolean }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <svg className="accuracy-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={pending ? copy.analysis.looking : copy.analysis.accuracyLabel(value)}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ring-fill"
        strokeDasharray={`${pending ? 0 : (c * value) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="47%" className="ring-value">
        {pending ? "…" : `${value}%`}
      </text>
      <text x="50%" y="70%" className="ring-label">
        {copy.analysis.accuracy}
      </text>
    </svg>
  );
}

export function VerdictCounts({ counts }: { counts: Record<MoveVerdict, number> }) {
  return (
    <ul className="verdict-counts">
      {(["good", "inaccuracy", "mistake", "blunder"] as const).map((v) => (
        <li key={v} className={`vc vc-${v}`}>
          <strong>{counts[v]}</strong>
          <span>{copy.analysis.counts[v](counts[v])}</span>
        </li>
      ))}
    </ul>
  );
}

const MOMENT_TONE: Record<string, string> = { inaccuracy: "gold", mistake: "danger", blunder: "danger", great: "success", mate: "success", good: "neutral" };
export const momentTone = (kind: string) => MOMENT_TONE[kind] ?? "neutral";

/** The advantage through the game: White above the line, Black below. Tap to jump to a move. */
export function EvalGraph({ plies, notes, current, marks, onPick }: { plies: ReviewPly[]; notes: Record<number, MoveNote>; current: number; marks: { ply: number; kind: string }[]; onPick: (ply: number) => void }) {
  const W = 300;
  const H = 56;
  const n = Math.max(1, plies.length);
  const x = (i: number) => (i / n) * W;
  const y = (cp: number) => H / 2 - (evalShare(cp) - 0.5) * (H - 8);
  const pts = [`0,${H / 2}`];
  for (const p of plies) {
    const note = notes[p.ply];
    if (!note) break;
    pts.push(`${x(p.ply)},${y(note.evalAfter)}`);
  }
  const lastX = x(pts.length - 1);
  const area = `0,${H / 2} ${pts.join(" ")} ${lastX},${H / 2}`;
  return (
    <div
      className="eval-graph"
      role="img"
      aria-label={copy.analysis.graphLabel}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        onPick(Math.round(((e.clientX - box.left) / box.width) * n));
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <clipPath id="eval-top">
            <rect width={W} height={H / 2} />
          </clipPath>
          <clipPath id="eval-bottom">
            <rect y={H / 2} width={W} height={H / 2} />
          </clipPath>
        </defs>
        <polygon points={area} className="eval-white" clipPath="url(#eval-top)" />
        <polygon points={area} className="eval-black" clipPath="url(#eval-bottom)" />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="eval-mid" vectorEffect="non-scaling-stroke" />
        <line x1={x(current)} x2={x(current)} y1={0} y2={H} className="eval-cursor" vectorEffect="non-scaling-stroke" />
      </svg>
      {marks.map((m) =>
        notes[m.ply] ? (
          <span key={`${m.ply}${m.kind}`} className={`eval-mark tone-${momentTone(m.kind)}`} style={{ left: `${(x(m.ply) / W) * 100}%`, top: `${(y(notes[m.ply].evalAfter) / H) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
}

export function EvalBar({ cp, orientation }: { cp: number; orientation: Color }) {
  const white = evalShare(cp) * 100;
  return (
    <div className={`eval-bar${orientation === "b" ? " is-flipped" : ""}`} aria-hidden>
      <span style={{ height: `${white}%` }} />
    </div>
  );
}
