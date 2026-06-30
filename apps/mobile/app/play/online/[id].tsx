import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Button } from "@/Button";
import { Icon } from "@/Icon";
import { api } from "@/api";
import { clock, onlineOutcome } from "@/chess-utils";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type Session = {
  id: string; fen: string; pgn: string; turn: "w" | "b"; status: "waiting" | "active" | "over";
  result: string | null; blackJoined: number; lastFrom: string | null; lastTo: string | null;
  whiteMs: number; blackMs: number; error?: string;
};

export default function OnlineGameScreen() {
  const { id, color } = useLocalSearchParams<{ id: string; color?: string }>();
  const sid = String(id);
  const myColor: "w" | "b" = color === "b" ? "b" : "w";
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 16, 460);

  const [state, setState] = useState<Session | null>(null);
  const joinedRef = useRef(false);
  const overRef = useRef(false);
  const prevStatus = useRef<string>("");

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const join = myColor === "b" && !joinedRef.current ? "?join=1" : "";
        const s = await api<Session>(`/api/session/${sid}${join}`);
        joinedRef.current = true;
        if (!alive || s.error) return;
        setState(s);
        overRef.current = s.status === "over";
        if (prevStatus.current && prevStatus.current !== "active" && s.status === "active") sfx.play("success");
        if (prevStatus.current !== "over" && s.status === "over") { sfx.play("win"); haptics.success(); }
        prevStatus.current = s.status;
      } catch {
        /* keep last state */
      }
    };
    tick();
    const iv = setInterval(() => { if (!overRef.current) tick(); }, 1600);
    return () => { alive = false; clearInterval(iv); };
  }, [sid, myColor]);

  function handleMove(from: string, to: string): boolean {
    if (!state || state.status !== "active" || state.turn !== myColor) return false;
    const e = new ChessEngine(state.fen);
    const mv = e.move({ from, to, promotion: "q" });
    if (!mv) return false;
    haptics.tap();
    sfx.play(mv.captured ? "capture" : "move");
    setState({ ...state, fen: e.fen(), turn: e.turn(), lastFrom: from, lastTo: to }); // optimistic
    void postMove(from, to);
    return true;
  }

  async function postMove(from: string, to: string) {
    try {
      const s = await api<Session>(`/api/session/${sid}`, { method: "POST", body: { action: "move", color: myColor, from, to, promotion: "q" } });
      if (!s.error) { setState(s); overRef.current = s.status === "over"; }
    } catch {
      /* poll reconciles */
    }
  }

  async function resign() {
    try {
      const s = await api<Session>(`/api/session/${sid}`, { method: "POST", body: { action: "resign", color: myColor } });
      if (!s.error) setState(s);
    } catch { /* ignore */ }
  }

  if (!state) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.muted}>Connecting…</Text></View></SafeAreaView>;
  }

  const myTurn = state.status === "active" && state.turn === myColor;
  const oppMs = myColor === "w" ? state.blackMs : state.whiteMs;
  const myMs = myColor === "w" ? state.whiteMs : state.blackMs;
  const oppName = myColor === "w" ? "Black" : "White";

  let banner: string;
  let bannerTone: string = colors.ink500;
  if (state.status === "waiting") banner = `Share code “${sid}” — waiting for opponent…`;
  else if (state.status === "over") {
    const outcome = onlineOutcome(state.result, myColor);
    banner = outcome === "draw" ? "Draw" : outcome === "win" ? "You won! 🏆" : "You lost";
    bannerTone = outcome === "win" ? colors.success600 : colors.ink500;
  } else banner = myTurn ? "Your move" : "Opponent's move…";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
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

      {/* Opponent */}
      <View style={styles.playerBar}>
        <Text style={styles.pName}>{oppName} {state.turn !== myColor && state.status === "active" ? "•" : ""}</Text>
        <Text style={styles.pClock}>{clock(oppMs)}</Text>
      </View>

      <View style={styles.boardWrap}>
        <ChessBoard
          fen={state.fen}
          size={boardSize}
          orientation={myColor === "b" ? "black" : "white"}
          onMove={handleMove}
          interactive={myTurn}
          lastMove={state.lastFrom && state.lastTo ? { from: state.lastFrom, to: state.lastTo } : null}
        />
      </View>

      {/* Me */}
      <View style={styles.playerBar}>
        <Text style={styles.pName}>You ({myColor === "w" ? "White" : "Black"}) {myTurn ? "•" : ""}</Text>
        <Text style={styles.pClock}>{clock(myMs)}</Text>
      </View>

      {state.status === "over" && (
        <View style={{ width: 220, alignSelf: "center", marginTop: space[4] }}>
          <Button label="Back to play" onPress={() => router.replace("/(tabs)/play")} />
        </View>
      )}
    </SafeAreaView>
  );
}

const CIRCLE = 40;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { ...type.base, fontFamily: font.bold, color: colors.ink500 },
  header: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingTop: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  title: { flex: 1, ...type.lg, fontFamily: font.bold, color: colors.ink },
  resign: { ...type.sm, fontFamily: font.bold, color: colors.danger },
  bannerBox: { marginHorizontal: space[4], marginTop: space[3], borderRadius: radius.pill, borderWidth: 1.5, paddingVertical: space[2], alignItems: "center" },
  banner: { ...type.base, fontFamily: font.bold },
  playerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: space[4], marginTop: space[2], backgroundColor: colors.surfaceCard, borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[2], ...shadowCard },
  pName: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  pClock: { ...type.base, fontFamily: font.bold, color: colors.ink, fontVariant: ["tabular-nums"] },
  boardWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
});
