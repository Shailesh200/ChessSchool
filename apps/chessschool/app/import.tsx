import { copy, importedRecord, importGame, queueGameSave, type ImportedGame } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Page, Row, Segmented, T, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

type Source = "lichess" | "chesscom" | "pgn";

/** Lichess / Chess.com / PGN import. The username lives only in this screen's state. */
export default function ImportGames() {
  const { state, update } = useApp();
  const t = copy.importGames;
  const [source, setSource] = useState<Source>("lichess");
  const [text, setText] = useState("");
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.push(`/review/${encodeURIComponent(g.id)}`);
  };

  if (!state.account) {
    return (
      <Page title={t.title} banner={false}>
        <T role="bodyLg">{t.signIn}</T>
      </Page>
    );
  }
  return (
    <Page title={t.title} banner={false}>
      <T role="body" color="textMuted">
        {t.body}
      </T>
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
      {source === "pgn" ? (
        <TextField label={t.pgnLabel} value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} style={{ minHeight: 120 }} />
      ) : (
        <TextField label={t.username} value={text} onChangeText={(v) => setText(v.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30))} autoCapitalize="none" autoCorrect={false} />
      )}
      <Button title={source === "pgn" ? t.open : t.find} icon="history" loading={busy} disabled={busy || text.trim().length < 2} onPress={find} />
      {error ? <T role="small" color="dangerText">{error}</T> : null}
      <T role="micro" color="textSubtle">
        {t.privacy}
      </T>
      {games ? (
        <Card style={{ padding: 8 }}>
          {games.map((g) => (
            <Row key={g.id} icon="play" label={t.vs(g.white || "?", g.black || "?")} hint={`${g.result} · ${t.moves(g.moves.length)}${g.endedAt ? ` · ${new Date(g.endedAt).toLocaleDateString()}` : ""}`} chevron onPress={() => open(g)} />
          ))}
        </Card>
      ) : null}
      <View style={{ height: 8 }} />
    </Page>
  );
}
