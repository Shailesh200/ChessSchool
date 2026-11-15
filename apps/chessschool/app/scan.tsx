import { editPlacement, setupFen, setupProblem, type Color, type PieceType } from "@chessschool/chess";
import { agreeAi, aiAgreed, aiExplainOn, copy, importGame, scannedRecord } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Board, PieceArt } from "@/components/Board";
import { Button, Page, Segmented, Sheet, T, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

/** Longest side sent to the server; the scanner trial measured accuracy at this size. */
const MAX_SIDE = 1024;
const PALETTE = ["K", "Q", "R", "B", "N", "P", "k", "q", "r", "b", "n", "p"];

type Source = "camera" | "library";
type Scanned = { placement: string; side: Color; confidence: number };

/**
 * Takes or picks a photo and returns a downscaled JPEG as base64. The native modules load lazily so a build
 * without them (an older binary on an over-the-air update) shows "no camera" instead of crashing.
 */
async function photo(source: Source): Promise<string | "denied" | "missing" | null> {
  let Picker: typeof import("expo-image-picker");
  let Manip: typeof import("expo-image-manipulator");
  try {
    Picker = require("expo-image-picker");
    Manip = require("expo-image-manipulator");
  } catch {
    return "missing";
  }
  try {
    if (source === "camera" && !(await Picker.requestCameraPermissionsAsync()).granted) return "denied";
    const opts = { mediaTypes: ["images" as const], quality: 1 };
    const r = source === "camera" ? await Picker.launchCameraAsync(opts) : await Picker.launchImageLibraryAsync(opts);
    const a = r.canceled ? null : r.assets[0];
    if (!a) return null;
    const ctx = Manip.ImageManipulator.manipulate(a.uri);
    if (Math.max(a.width, a.height) > MAX_SIDE) ctx.resize(a.width >= a.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ base64: true, compress: 0.85, format: Manip.SaveFormat.JPEG });
    return out.base64 ?? null;
  } catch {
    return "missing";
  }
}

/** Board scanner: a photo becomes an editable position to play, save or analyse. The photo is never kept. */
export default function ScanBoard() {
  const { state, update } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const t = copy.scan;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<Source | null>(null);
  const [board, setBoard] = useState<Scanned | null>(null);
  const [tool, setTool] = useState<string | null>("P");

  const read = async (source: Source) => {
    setError(null);
    const image = await photo(source);
    if (image === "missing") return setError(t.noCamera);
    if (image === "denied") return setError(t.noPermission);
    if (!image) return;
    setBusy(true);
    try {
      const r = await api.scanBoard({ image, mediaType: "image/jpeg", consent: true });
      setBoard({ placement: r.placement, side: r.side ?? "w", confidence: r.confidence });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(status === 429 ? t.limit : status === 422 ? t.failed : t.error);
    } finally {
      setBusy(false);
    }
  };
  const ask = (source: Source) => (aiAgreed(state) ? void read(source) : setConsent(source));

  if (!state.account || !aiExplainOn(state)) {
    return (
      <Page title={t.title} banner={false}>
        <T role="bodyLg">{state.account ? t.off : t.signIn}</T>
      </Page>
    );
  }

  if (!board) {
    return (
      <Page title={t.title} banner={false}>
        <T role="body" color="textMuted">
          {t.body}
        </T>
        <Button title={t.takePhoto} icon="eye" loading={busy} disabled={busy} onPress={() => ask("camera")} />
        <Button title={t.choosePhoto} icon="doc" variant="secondary" disabled={busy} onPress={() => ask("library")} />
        <View accessibilityLiveRegion="polite">
          <T role="small" color={busy ? "brandText" : "textMuted"}>
            {busy ? t.reading : t.tips}
          </T>
        </View>
        {error ? (
          <T role="small" color="dangerText">
            {error}
          </T>
        ) : null}
        <T role="micro" color="textSubtle">
          {t.privacy}
        </T>
        <Sheet visible={consent !== null} onClose={() => setConsent(null)}>
          <View style={{ gap: 12, alignSelf: "stretch" }}>
            <T role="heading">{t.consentTitle}</T>
            <T role="body">{t.consentBody}</T>
            <Button
              title={t.consentAgree}
              icon="spark"
              onPress={() => {
                const source = consent!;
                update(agreeAi);
                setConsent(null);
                void read(source);
              }}
            />
            <Button title={copy.coachAi.consentCancel} variant="secondary" onPress={() => setConsent(null)} />
          </View>
        </Sheet>
      </Page>
    );
  }

  const fen = setupFen(board.placement, board.side);
  const problem = setupProblem(fen);
  const keep = () => {
    const rec = scannedRecord(fen, Date.now());
    update((s) => importGame(s, rec));
    return rec.id;
  };
  return (
    <Page title={t.checkTitle} banner={false}>
      <T role="body" color="textMuted">
        {t.checkBody}
      </T>
      {board.confidence < 0.6 ? (
        <T role="small" color="dangerText">
          {t.lowConfidence}
        </T>
      ) : null}
      <Board fen={fen} label={t.checkTitle} onTap={(sq) => setBoard({ ...board, placement: editPlacement(board.placement, sq, tool) })} />
      <View accessibilityRole="radiogroup" accessibilityLabel={t.checkTitle} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {[...PALETTE, null].map((p) => {
          const on = tool === p;
          const color = p && p === p.toUpperCase() ? "w" : "b";
          return (
            <Pressable
              key={p ?? "empty"}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p ? copy.a11y.piece(color, p.toLowerCase() as PieceType) : t.clear}
              onPress={() => setTool(p)}
              style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: on ? c.brand : c.line, backgroundColor: on ? c.brandSoft : c.card, alignItems: "center", justifyContent: "center" }}
            >
              {p ? <PieceArt piece={{ type: p.toLowerCase() as PieceType, color }} size={32} /> : <T role="micro">{t.clear}</T>}
            </Pressable>
          );
        })}
      </View>
      <Segmented<Color> label={t.toMove} value={board.side} onChange={(side) => setBoard({ ...board, side })} options={(["w", "b"] as const).map((v) => ({ value: v, label: copy.play.sides[v] }))} />
      {problem ? (
        <View accessibilityLiveRegion="polite">
          <T role="small" color="dangerText">
            {t.problems[problem]}
          </T>
        </View>
      ) : null}
      <Button title={t.play} icon="play" disabled={Boolean(problem)} onPress={() => router.push({ pathname: "/play", params: { mode: "position", fen } })} />
      <Button title={t.analyse} icon="eye" variant="secondary" disabled={Boolean(problem)} onPress={() => router.push(`/review/${encodeURIComponent(keep())}`)} />
      <Button
        title={t.save}
        icon="history"
        variant="secondary"
        disabled={Boolean(problem)}
        onPress={() => {
          keep();
          toast(t.saved);
        }}
      />
      <Button title={t.again} icon="refresh" variant="ghost" onPress={() => setBoard(null)} />
    </Page>
  );
}
