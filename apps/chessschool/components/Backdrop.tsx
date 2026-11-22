import { ART_FADES, artStrength, MOTIFS, type ArtMotif, type Backdrop as Art } from "@chessschool/design";
import { memo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/lib/theme";

/**
 * Decorative background art behind a screen or inside a card (data in @chessschool/design backdrops.ts).
 * Absolutely positioned and non-interactive, so it never moves layout; hidden from screen readers.
 * `under` is the colour the art sits on (the screen or card background), used to fade the pattern out.
 */
export const Backdrop = memo(function Backdrop({ art, under, radius }: { art: Art; under?: string; radius?: number }) {
  const { c, scheme } = useTheme();
  const k = artStrength(scheme === "dark");
  const bg = under ?? c.bg;
  const tone = c[art.tone];
  const fid = `${art.id}-f`;
  const pid = `${art.id}-p`;
  const stops = ART_FADES[art.fade].map(([offset, show]) => <Stop key={offset} offset={offset} stopColor={bg} stopOpacity={1 - show} />);
  const clip: ViewStyle = radius ? { borderRadius: radius, overflow: "hidden" } : {};
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, clip]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={pid} patternUnits="userSpaceOnUse" width={art.tile.size} height={art.tile.size}>
            <G opacity={Math.min(1, art.o * k)}>
              {art.tile.ops.map((op, i) => (op.stroke ? <Path key={i} d={op.d} fill="none" stroke={tone} strokeWidth={op.stroke} opacity={op.o ?? 1} /> : <Path key={i} d={op.d} fill={tone} opacity={op.o ?? 1} />))}
            </G>
          </Pattern>
          {art.fade === "corner" ? (
            <RadialGradient id={fid} cx="1" cy="0" r="1" fx="1" fy="0">
              {stops}
            </RadialGradient>
          ) : (
            <LinearGradient id={fid} x1="0" y1="0" x2="0" y2="1">
              {stops}
            </LinearGradient>
          )}
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${pid})`} />
        <Rect width="100%" height="100%" fill={`url(#${fid})`} />
      </Svg>
      {art.motifs.map((m, i) => (
        <Motif key={i} m={m} color={c[m.tone]} k={k} />
      ))}
    </View>
  );
});

function Motif({ m, color, k }: { m: ArtMotif; color: string; k: number }) {
  return (
    <Svg width={m.size} height={m.size} viewBox="0 0 100 100" style={{ position: "absolute", left: `${m.x * 100}%`, top: `${m.y * 100}%`, marginLeft: -m.size / 2, marginTop: -m.size / 2, transform: [{ rotate: `${m.rotate}deg` }] }}>
      <G opacity={Math.min(1, m.o * k)}>
        {MOTIFS[m.shape].map((d, i) => (
          <Path key={i} d={d} fill={color} />
        ))}
      </G>
    </Svg>
  );
}
