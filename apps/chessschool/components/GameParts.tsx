import { capturedPieces, evalShare, materialEdge, type Color, type MoveNote, type MoveVerdict, type ReviewPly } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Share, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, ClipPath, Defs, Line, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { PieceArt } from "./Board";
import { Icon } from "./Icon";
import { Button, Sheet, SwitchRow, T } from "./ui";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

/** Pieces `color` has taken, and how far ahead on material that leaves them. Always the same height. */
export function CapturedTray({ startFen, fen, color }: { startFen: string; fen: string; color: Color }) {
  const { c } = useTheme();
  const taken = capturedPieces(startFen, fen)[color === "w" ? "b" : "w"];
  const edge = (materialEdge(fen) - materialEdge(startFen)) * (color === "w" ? 1 : -1);
  return (
    <View accessible accessibilityLabel={copy.analysis.capturedLabel(taken.length, edge)} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 24 }}>
      {taken.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", height: 24, paddingLeft: 4, paddingRight: 6, borderRadius: 999, backgroundColor: c.boardLight, overflow: "hidden", flexShrink: 1 }}>
          {taken.map((t, i) => (
            <View key={i} style={{ marginLeft: i ? -6 : 0 }}>
              <PieceArt piece={{ type: t, color: color === "w" ? "b" : "w" }} size={20} />
            </View>
          ))}
        </View>
      ) : null}
      {edge > 0 ? (
        <T role="micro" style={{ fontFamily: fonts.bold, color: c.successText }}>
          {copy.analysis.ahead(edge)}
        </T>
      ) : null}
    </View>
  );
}

export function SoundToggle() {
  const { state, setPrefs } = useApp();
  const { c } = useTheme();
  const on = state.prefs.sound;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={copy.analysis.sounds}
      onPress={() => setPrefs({ sound: !on })}
      hitSlop={8}
      style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.sunken : undefined })}
    >
      <Icon name={on ? "sound" : "mute"} color={c.brandText} />
    </Pressable>
  );
}

/** One fixed-height line of moves; the newest stays in view. */
export function MoveStrip({ history, onOpen }: { history: string[]; onOpen: () => void }) {
  const { c } = useTheme();
  const scroll = useRef<ScrollView>(null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.analysis.allMoves}. ${history.slice(-2).join(" ")}`}
      onPress={onOpen}
      disabled={!history.length}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 48, paddingRight: 6, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, overflow: "hidden" }}
    >
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: "center", gap: 4, paddingLeft: 12, flexGrow: 1, justifyContent: "flex-end" }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        pointerEvents="none"
      >
        {history.length ? (
          history.map((san, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              {i % 2 === 0 ? (
                <T role="small" color="textSubtle" style={{ marginLeft: 4 }}>
                  {`${i / 2 + 1}.`}
                </T>
              ) : null}
              <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 9, backgroundColor: i === history.length - 1 ? c.brandSoft : undefined }}>
                <T role="label" style={{ color: i === history.length - 1 ? c.brandText : c.textMuted }}>
                  {san}
                </T>
              </View>
            </View>
          ))
        ) : (
          <T role="small" color="textSubtle" style={{ flex: 1 }}>
            {copy.analysis.noMoves}
          </T>
        )}
      </ScrollView>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.sunken }}>
        <Icon name="history" size={20} color={c.brandText} />
      </View>
    </Pressable>
  );
}

export const movePairs = (history: string[]) => {
  const out: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) out.push({ n: i / 2 + 1, w: history[i], b: history[i + 1] });
  return out;
};

export function MovesSheet({ visible, onClose, history }: { visible: boolean; onClose: () => void; history: string[] }) {
  const { state, setPrefs } = useApp();
  const { c } = useTheme();
  const pairs = movePairs(history);
  const last = (i: number, black: boolean) => i === pairs.length - 1 && (black ? Boolean(pairs[i].b) : !pairs[i].b);
  const cell = (text: string, on: boolean) => (
    <View style={{ flex: 1, alignItems: "flex-start" }}>
      <View style={{ paddingHorizontal: on ? 9 : 0, paddingVertical: 3, borderRadius: 9, backgroundColor: on ? c.brandSoft : undefined }}>
        <T role="label" style={{ color: on ? c.brandText : c.text }}>
          {text}
        </T>
      </View>
    </View>
  );
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", alignSelf: "stretch" }}>
        <T role="heading" header>
          {copy.analysis.movesTitle}
        </T>
        <T role="small" color="textMuted">
          {copy.gym.moveCount(pairs.length)}
        </T>
      </View>
      <ScrollView style={{ alignSelf: "stretch", maxHeight: 360 }} ref={(r) => r?.scrollToEnd({ animated: false })}>
        {pairs.map((p, i) => (
          <View key={p.n} style={{ flexDirection: "row", alignItems: "center", minHeight: 40, borderRadius: 12, backgroundColor: i % 2 ? c.sunken : undefined }}>
            <T role="body" color="textSubtle" style={{ width: 48, paddingLeft: 10 }}>
              {`${p.n}.`}
            </T>
            {cell(p.w, last(i, false))}
            {cell(p.b ?? "", last(i, true))}
          </View>
        ))}
      </ScrollView>
      <View style={{ alignSelf: "stretch" }}>
        <SwitchRow icon="sound" label={copy.analysis.sounds} hint={copy.analysis.soundsHint} value={state.prefs.sound} onChange={(v) => setPrefs({ sound: v })} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch" }}>
        <View style={{ flex: 1 }}>
          <Button
            title={copy.analysis.shareMoves}
            icon="doc"
            variant="secondary"
            onPress={() => void Share.share({ message: pairs.map((p) => `${p.n}. ${p.w}${p.b ? ` ${p.b}` : ""}`).join(" ") }).catch(() => {})}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={copy.analysis.close} icon="close" onPress={onClose} />
        </View>
      </View>
    </Sheet>
  );
}

export function AccuracyRing({ value, size = 92, pending }: { value: number; size?: number; pending?: boolean }) {
  const { c } = useTheme();
  const r = size / 2 - 8;
  const len = 2 * Math.PI * r;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={pending ? copy.analysis.looking : copy.analysis.accuracyLabel(value)}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.sunken} strokeWidth={9} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.success}
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${pending ? 0 : (len * value) / 100} ${len}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <SvgText x={size / 2} y={size / 2 + 3} textAnchor="middle" fill={c.text} fontFamily={fonts.bold} fontSize={22}>
          {pending ? "…" : `${value}%`}
        </SvgText>
        <SvgText x={size / 2} y={size / 2 + 20} textAnchor="middle" fill={c.textMuted} fontFamily={fonts.regular} fontSize={11}>
          {copy.analysis.accuracy}
        </SvgText>
      </Svg>
    </View>
  );
}

export function VerdictCounts({ counts }: { counts: Record<MoveVerdict, number> }) {
  const { c } = useTheme();
  const tone: Record<MoveVerdict, [string, string]> = {
    good: [c.successSoft, c.successText],
    inaccuracy: [c.goldSoft, c.goldText],
    mistake: [c.dangerSoft, c.dangerText],
    blunder: [c.dangerSoft, c.dangerText],
  };
  return (
    <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {(["good", "inaccuracy", "mistake", "blunder"] as const).map((v) => (
        <View key={v} style={{ flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: tone[v][0] }}>
          <T role="heading" style={{ color: tone[v][1] }}>
            {String(counts[v])}
          </T>
          <T role="micro" color="textMuted" style={{ flex: 1 }}>
            {copy.analysis.counts[v](counts[v])}
          </T>
        </View>
      ))}
    </View>
  );
}

const MOMENT_TONE: Record<string, "danger" | "gold" | "success" | "neutral"> = { inaccuracy: "gold", mistake: "danger", blunder: "danger", great: "success", mate: "success" };
export const momentTone = (kind: string) => MOMENT_TONE[kind] ?? "neutral";

/** The advantage through the game: White above the line, Black below. Tap to jump to a move. */
export function EvalGraph({ plies, notes, current, marks, onPick }: { plies: ReviewPly[]; notes: Record<number, MoveNote>; current: number; marks: { ply: number; kind: string }[]; onPick: (ply: number) => void }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const H = 56;
  const n = Math.max(1, plies.length);
  const x = (i: number) => (i / n) * w;
  const y = (cp: number) => H / 2 - (evalShare(cp) - 0.5) * (H - 8);
  const pts = [`0,${H / 2}`];
  for (const p of plies) {
    const note = notes[p.ply];
    if (!note) break;
    pts.push(`${x(p.ply)},${y(note.evalAfter)}`);
  }
  const area = `0,${H / 2} ${pts.join(" ")} ${x(pts.length - 1)},${H / 2}`;
  const tone = { danger: c.danger, gold: c.gold, success: c.success, neutral: c.textMuted };
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={copy.analysis.graphLabel}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => onPick(current + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
      onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))}
      onPress={(e) => w && onPick(Math.round((e.nativeEvent.locationX / w) * n))}
      style={{ height: H }}
    >
      {w ? (
        <Svg width={w} height={H}>
          <Defs>
            <ClipPath id="top">
              <Rect width={w} height={H / 2} />
            </ClipPath>
            <ClipPath id="bottom">
              <Rect y={H / 2} width={w} height={H / 2} />
            </ClipPath>
          </Defs>
          <Polygon points={area} fill={c.boardLight} clipPath="url(#top)" />
          <Polygon points={area} fill={c.boardDark} clipPath="url(#bottom)" />
          <Line x1={0} x2={w} y1={H / 2} y2={H / 2} stroke={c.line} />
          <Line x1={x(current)} x2={x(current)} y1={0} y2={H} stroke={c.brandText} strokeWidth={1.5} strokeDasharray="3 3" />
          {marks.map((m) => (notes[m.ply] ? <Circle key={`${m.ply}${m.kind}`} cx={x(m.ply)} cy={y(notes[m.ply].evalAfter)} r={5} fill={tone[momentTone(m.kind)]} stroke={c.card} strokeWidth={2} /> : null))}
        </Svg>
      ) : null}
    </Pressable>
  );
}

export function EvalBar({ cp, orientation, height }: { cp: number; orientation: Color; height: number }) {
  const { c } = useTheme();
  const white = evalShare(cp) * 100;
  return (
    <View style={{ width: 12, height, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: c.line, backgroundColor: c.boardDark, justifyContent: orientation === "b" ? "flex-start" : "flex-end" }}>
      <View style={{ height: `${white}%`, backgroundColor: c.boardLight }} />
    </View>
  );
}
