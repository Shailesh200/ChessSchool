import { defaultSetup, playReduce, startGame, type Color, type PlayAction, type PlayState, type Square } from "@chessschool/chess";
import { ApiError, copy, type ClassGame } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AvatarFace } from "@/components/AvatarFace";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { gameStatus } from "@/components/ClassPlay";
import { CapturedTray, MoveStrip, MovesSheet, SoundToggle } from "@/components/GameParts";
import { Badge, Button, Sheet, T, TopBar, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

const POLL_MS = 8000;

/** A turn-based game with a classmate. The server checks every move; this screen polls while waiting. */
export default function ClassGameScreen() {
  const { classId = "", id = "" } = useLocalSearchParams<{ classId: string; id: string }>();
  const { state, cue } = useApp();
  const { c } = useTheme();
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
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 12 }}>
        <TopBar title={t.title} />
        {missing ? (
          <T role="body" color="textMuted" center>
            {copy.classroom.invalid}
          </T>
        ) : null}
      </SafeAreaView>
    );
  }

  const bottom: Color = game.you ?? "w";
  const top: Color = bottom === "w" ? "b" : "w";
  const turn: Color = play.history.length % 2 ? "b" : "w";
  const bar = (color: Color) => {
    const p = color === "w" ? game.white : game.black;
    return (
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <AvatarFace id={p.avatar} photo={p.photo} size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <T role="label" numberOfLines={1}>
            {p.id === state.account?.id ? `${p.name} (${copy.classroom.you})` : p.name}
          </T>
          <CapturedTray startFen={play.setup.startFen} fen={play.fen} color={color} />
        </View>
        {game.status === "active" && turn === color ? <Badge tone={color === game.you ? "brand" : "neutral"}>{color === game.you ? t.yourTurn : copy.play.sides[color]}</Badge> : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, overflow: "hidden" }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={t.vs((game.you === "b" ? game.white : game.black).name)} action={<SoundToggle />} onBack={() => (router.canGoBack() ? router.back() : router.replace("/class"))} />
      </View>
      <View style={{ flex: 1, gap: 6, paddingBottom: 8, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <BoardStage top={bar(top)} bottom={bar(bottom)} topSize={52} bottomSize={52}>
          {(size, radius) => (
            <Board
              size={size}
              radius={radius}
              fen={play.fen}
              orientation={bottom}
              selected={play.selected}
              targets={play.targets}
              lastMove={play.lastMove}
              check={play.check}
              mate={play.over?.kind === "checkmate" ? play.check : null}
              onTap={(sq: Square) => act({ type: "tap", square: sq, now: Date.now() })}
              disabled={!game.yourTurn || busy}
              promotion={play.promotion}
              onPromote={(p) => act(p ? { type: "promote", piece: p, now: Date.now() } : { type: "cancelPromotion" })}
            />
          )}
        </BoardStage>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <View accessibilityLiveRegion="polite">
            <T role="small" color="brandText" center>
              {waiting ? t.waiting : gameStatus(game)}
            </T>
          </View>
          <MoveStrip history={play.history} onOpen={() => setMovesOpen(true)} />
          {game.you && game.status === "active" ? <Button title={t.resign} icon="flag" variant="ghost" disabled={busy} onPress={() => setConfirm(true)} /> : null}
        </View>
      </View>
      <MovesSheet visible={movesOpen} onClose={() => setMovesOpen(false)} history={play.history} />
      <Sheet visible={confirm} onClose={() => setConfirm(false)}>
        <View style={{ gap: 12, alignSelf: "stretch" }}>
          <T role="heading">{t.resignTitle}</T>
          <T role="body" color="textMuted">
            {t.resignBody}
          </T>
          <Button title={t.resign} variant="danger" loading={busy} onPress={() => void resign()} />
          <Button title={copy.classroom.cancel} variant="ghost" onPress={() => setConfirm(false)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
