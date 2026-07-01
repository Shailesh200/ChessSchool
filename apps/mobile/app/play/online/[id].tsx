import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { GameOverOverlay } from "@/GameOverOverlay";
import { ReflectSheet } from "@/ReflectSheet";
import { Icon } from "@/Icon";
import { API_URL, api } from "@/api";
import { mutateProgress } from "@/progressStore";
import { prependRecentGame } from "@/progression";
import { buildSyncGame, winnerFromPlayerResult } from "@/gameHistory";
import { clock, onlineOutcome } from "@/chess-utils";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type Session = {
  id: string;
  fen: string;
  pgn: string;
  turn: "w" | "b";
  status: "waiting" | "active" | "over";
  result: string | null;
  blackJoined: number;
  lastFrom: string | null;
  lastTo: string | null;
  whiteMs: number;
  blackMs: number;
  updatedAt?: number;
  error?: string;
};

function liveClocks(s: Session): { w: number; b: number } {
  if (s.status !== "active" || !s.updatedAt) return { w: s.whiteMs, b: s.blackMs };
  const elapsed = Math.max(0, Date.now() - s.updatedAt);
  if (s.turn === "w") return { w: Math.max(0, s.whiteMs - elapsed), b: s.blackMs };
  return { w: s.whiteMs, b: Math.max(0, s.blackMs - elapsed) };
}

export default function OnlineGameScreen() {
  const { id, color, seatToken } = useLocalSearchParams<{ id: string; color?: string; seatToken?: string }>();
  const sid = String(id);
  const myColor: "w" | "b" = color === "b" ? "b" : "w";
  const token = typeof seatToken === "string" ? seatToken : "";
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 16, 460);

  const [state, setState] = useState<Session | null>(null);
  const [clocks, setClocks] = useState({ w: 0, b: 0 });
  const [reflectOpen, setReflectOpen] = useState(false);
  const overRef = useRef(false);
  const prevStatus = useRef<string>("");
  const movesRef = useRef<string[]>([]);
  const sessionStartRef = useRef(Date.now());
  const lastMoveKeyRef = useRef("");
  const savedRef = useRef(false);
  const ablyRef = useRef(false);
  const stateRef = useRef<Session | null>(null);
  stateRef.current = state;

  function rememberMove(s: Session) {
    if (!s.lastFrom || !s.lastTo) return;
    const key = `${s.pgn}|${s.lastFrom}:${s.lastTo}`;
    if (key === lastMoveKeyRef.current) return;
    lastMoveKeyRef.current = key;
    movesRef.current = [...movesRef.current, `${s.lastFrom}:${s.lastTo}`];
  }

  function applyState(s: Session) {
    rememberMove(s);
    setState(s);
    setClocks(liveClocks(s));
    overRef.current = s.status === "over";
    if (prevStatus.current && prevStatus.current !== "active" && s.status === "active") sfx.play("success");
    if (prevStatus.current !== "over" && s.status === "over") { sfx.play("win"); haptics.success(); }
    prevStatus.current = s.status;
  }

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await api<Session>(`/api/session/${sid}`);
        if (!alive || s.error) {
          t = setTimeout(tick, 2000);
          return;
        }
        applyState(s);
        const waiting = s.status === "active" && s.turn !== myColor;
        const delay = ablyRef.current ? 5000 : waiting ? 650 : 1600;
        t = setTimeout(tick, delay);
      } catch {
        if (alive) t = setTimeout(tick, 2000);
      }
    };
    tick();
    return () => { alive = false; clearTimeout(t); };
  }, [sid, myColor]);

  useEffect(() => {
    let client: { close: () => void } | null = null;
    let cancelled = false;
    void fetch(`${API_URL}/api/ably-token`)
      .then((r) => (r.ok ? import("ably") : null))
      .then((mod) => {
        if (!mod || cancelled) return;
        const { Realtime } = mod;
        const rt = new Realtime({ authUrl: `${API_URL}/api/ably-token`, autoConnect: true });
        client = rt;
        rt.connection.on("connected", () => { ablyRef.current = true; });
        rt.connection.on("failed", () => { ablyRef.current = false; });
        rt.connection.on("disconnected", () => { ablyRef.current = false; });
        rt.channels.get(`game:${sid}`).subscribe("state", (msg) => {
          if (msg?.data) applyState(msg.data as Session);
        });
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
      try { client?.close(); } catch { /* ignore */ }
    };
  }, [sid]);

  useEffect(() => {
    if (!state || state.status !== "active") return;
    const iv = setInterval(() => {
      const s = stateRef.current;
      if (s) setClocks(liveClocks(s));
    }, 250);
    return () => clearInterval(iv);
  }, [state?.status, state?.updatedAt, state?.turn]);

  useEffect(() => {
    if (!state || state.status !== "active") return;
    const { w, b } = liveClocks(state);
    if (state.turn === "w" && w <= 0) void flagTimeout();
    if (state.turn === "b" && b <= 0) void flagTimeout();
  }, [clocks, state]);

  async function flagTimeout() {
    try {
      const s = await api<Session>(`/api/session/${sid}`, { method: "POST", body: { action: "timeout", color: myColor, seatToken: token } });
      if (!s.error) applyState(s);
    } catch { /* ignore */ }
  }

  function handleMove(from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    if (!state || state.status !== "active" || state.turn !== myColor) return false;
    const e = new ChessEngine(state.fen);
    const mv = e.move({ from, to, promotion });
    if (!mv) return false;
    haptics.tap();
    sfx.play(mv.captured ? "capture" : "move");
    setState({ ...state, fen: e.fen(), turn: e.turn(), lastFrom: from, lastTo: to });
    void postMove(from, to, promotion);
    return true;
  }

  async function postMove(from: string, to: string, promotion: "q" | "r" | "b" | "n") {
    try {
      const s = await api<Session>(`/api/session/${sid}`, { method: "POST", body: { action: "move", color: myColor, seatToken: token, from, to, promotion } });
      if (!s.error) applyState(s);
    } catch { /* poll/ably reconciles */ }
  }

  async function resign() {
    Alert.alert("Resign?", "Your opponent will win.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Resign",
        style: "destructive",
        onPress: async () => {
          try {
            const s = await api<Session>(`/api/session/${sid}`, { method: "POST", body: { action: "resign", color: myColor, seatToken: token } });
            if (!s.error) applyState(s);
          } catch { /* ignore */ }
        },
      },
    ]);
  }

  useEffect(() => {
    if (!state || state.status !== "over" || savedRef.current) return;
    savedRef.current = true;
    const playerRes = onlineOutcome(state.result, myColor);
    if (playerRes === "pending") return;
    const engine = state.pgn ? ChessEngine.fromPgn(state.pgn) : new ChessEngine(state.fen);
    const winner = winnerFromPlayerResult(playerRes, myColor);
    const game = buildSyncGame({
      engine,
      id: sid,
      mode: "online",
      createdAt: sessionStartRef.current,
      whiteName: "White",
      blackName: "Black",
      elo: null,
      endReason: state.result?.includes("timeout") ? "timeout" : playerRes === "draw" ? "draw" : "checkmate",
      winner,
      playerResult: playerRes,
    });
    void mutateProgress((snap) => ({
      ...snap,
      recentGames: prependRecentGame((snap.recentGames as unknown[]) ?? [], game),
    }));
  }, [myColor, state, sid]);

  if (!state) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.muted}>Connecting…</Text></View></SafeAreaView>;
  }

  const myTurn = state.status === "active" && state.turn === myColor;
  const view = new ChessEngine(state.fen);
  const checkSquare = view.inCheck() ? view.kingSquare(view.turn()) : null;
  const oppMs = myColor === "w" ? clocks.b : clocks.w;
  const myMs = myColor === "w" ? clocks.w : clocks.b;
  const oppName = myColor === "w" ? "Black" : "White";
  const outcome = state.status === "over" ? onlineOutcome(state.result, myColor) : null;

  let banner: string;
  let bannerTone: string = colors.ink500;
  if (state.status === "waiting") banner = `Share code “${sid}” — waiting for opponent…`;
  else if (state.status === "over") {
    banner = outcome === "draw" ? "Draw" : outcome === "win" ? "You won! 🏆" : "You lost";
    bannerTone = outcome === "win" ? colors.success600 : colors.ink500;
  } else banner = myTurn ? "Your move" : "Opponent's move…";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.circle} onPress={() => router.replace("/(tabs)/play")} hitSlop={8}>
          <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chevronRight" size={20} color={colors.ink} /></View>
        </Pressable>
        <Text style={styles.title}>Online · {sid}</Text>
        {state.status === "active" && (
          <Pressable onPress={resign} hitSlop={8}><Text style={styles.resign}>Resign</Text></Pressable>
        )}
      </View>

      <View style={[styles.bannerBox, { borderColor: bannerTone }]}>
        <Text style={[styles.banner, { color: bannerTone }]}>{banner}</Text>
      </View>

      <View style={[styles.playerBar, state.status === "active" && state.turn !== myColor && styles.playerBarActive]}>
        <Text style={styles.pName}>{oppName}</Text>
        <Text style={[styles.pClock, state.status === "active" && state.turn !== myColor && styles.pClockActive]}>{clock(oppMs)}</Text>
      </View>

      <View style={styles.boardWrap}>
        <ChessBoard
          fen={state.fen}
          size={boardSize}
          orientation={myColor === "b" ? "black" : "white"}
          onMove={handleMove}
          interactive={myTurn}
          lastMove={state.lastFrom && state.lastTo ? { from: state.lastFrom, to: state.lastTo } : null}
          checkSquare={checkSquare}
        />
      </View>

      <View style={[styles.playerBar, myTurn && styles.playerBarActive]}>
        <Text style={styles.pName}>You ({myColor === "w" ? "White" : "Black"})</Text>
        <Text style={[styles.pClock, myTurn && styles.pClockActive]}>{clock(myMs)}</Text>
      </View>

      <GameOverOverlay
        visible={state.status === "over"}
        title={banner}
        win={outcome === "win"}
        onReflect={() => setReflectOpen(true)}
        onReview={() => router.push({ pathname: "/replay/[index]", params: { index: "0" } })}
        onNewGame={() => router.replace("/(tabs)/play")}
        onExit={() => router.replace("/(tabs)/play")}
      />

      <ReflectSheet
        visible={reflectOpen}
        onClose={() => setReflectOpen(false)}
        kind="match"
        title={`Online game ${sid}`}
        summary={banner}
        refId={sid}
      />
    </SafeAreaView>
  );
}

const CIRCLE = 40;
const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { ...type.base, fontFamily: font.bold, color: colors.ink500 },
  header: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingTop: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  title: { flex: 1, ...type.lg, fontFamily: font.bold, color: colors.ink },
  resign: { ...type.sm, fontFamily: font.bold, color: colors.danger },
  bannerBox: { marginHorizontal: space[4], marginTop: space[3], borderRadius: radius.pill, borderWidth: 1.5, paddingVertical: space[2], alignItems: "center" },
  banner: { ...type.base, fontFamily: font.bold },
  playerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: space[4], marginTop: space[2], backgroundColor: colors.surfaceCard, borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[2], borderWidth: 1, borderColor: "transparent" },
  playerBarActive: { borderColor: colors.brand100, backgroundColor: colors.brand50, ...shadowCard },
  pName: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  pClock: { ...type.base, fontFamily: font.bold, color: colors.ink, fontVariant: ["tabular-nums"] },
  pClockActive: { color: colors.brand },
  boardWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
});
