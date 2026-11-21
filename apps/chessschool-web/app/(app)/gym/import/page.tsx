"use client";

import { copy, importedRecord, importGame, queueGameSave, type ImportedGame } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Segmented, TextField, TopBar } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

type Source = "lichess" | "chesscom" | "pgn";

/** Lichess / Chess.com / PGN import. The username lives only in this page's state. */
export default function ImportGames() {
  const { state, ready, update } = useApp();
  const router = useRouter();
  const t = copy.importGames;
  const [source, setSource] = useState<Source>("lichess");
  const [text, setText] = useState("");
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const find = () => {
    setBusy(true);
    setError(null);
    setGames(null);
    (source === "pgn" ? api.importPgn(text) : api.importGames(source, text.trim()))
      .then((r) => (r.games.length ? setGames(r.games) : setError(t.empty)))
      .catch((err: { status?: number }) => setError(source === "pgn" ? t.badPgn : err?.status === 404 ? t.notFound : t.failed))
      .finally(() => setBusy(false));
  };
  const open = (g: ImportedGame) => {
    update((s) => {
      const rec = importedRecord(g);
      const next = importGame(s, rec);
      return s.account ? queueGameSave(next, rec) : next;
    });
    router.push(`/gym/review/${encodeURIComponent(g.id)}`);
  };

  return (
    <div className="page page-narrow">
      <TopBar backHref="/gym/review" title={t.title} />
      {!state.account ? (
        <p className="lead">{t.signIn}</p>
      ) : (
        <>
          <p className="muted">{t.body}</p>
          <Segmented<Source>
            label={t.title}
            value={source}
            onChange={(v) => {
              setSource(v);
              setText("");
              setGames(null);
              setError(null);
            }}
            options={(["lichess", "chesscom", "pgn"] as const).map((v) => ({ value: v, label: t.sources[v] }))}
          />
          <form
            className="import-form"
            onSubmit={(e) => {
              e.preventDefault();
              find();
            }}
          >
            {source === "pgn" ? (
              <div className="field">
                <label htmlFor="import-pgn">{t.pgnLabel}</label>
                <div className="field-box">
                  <textarea id="import-pgn" rows={8} maxLength={100_000} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
                </div>
              </div>
            ) : (
              <TextField label={t.username} value={text} onChange={(e) => setText(e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30))} autoCapitalize="none" autoComplete="off" spellCheck={false} />
            )}
            <Button block type="submit" icon="history" loading={busy} disabled={busy || text.trim().length < 2}>
              {source === "pgn" ? t.open : t.find}
            </Button>
          </form>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="muted small">{t.privacy}</p>
          {games ? (
              <ul className="game-list">
                {games.map((g) => (
                  <li key={g.id}>
                    <button type="button" className="game-row" onClick={() => open(g)}>
                      <span className="player-avatar">@</span>
                      <span className="game-row-text">
                        <strong>{t.vs(g.white || "?", g.black || "?")}</strong>
                        <span className="muted">
                          {g.result} · {t.moves(g.moves.length)}
                          {g.endedAt ? ` · ${new Date(g.endedAt).toLocaleDateString()}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
