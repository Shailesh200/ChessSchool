import { artStrength, copy, courseTrail, MOTIFS, type Course, type MotifId, type Progress, type TrailStop } from "@chessschool/design";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Badge, T } from "./ui";

const ROW = 104;
const NODE = 56;
const NOW = 80;
/** Node centre as a share of the width; follows the absolute unit index so the trail keeps its shape when the window moves. */
const xAt = (i: number) => 0.5 + 0.26 * Math.sin(i * 1.1);
const short = (t: string) => t.replace(/^(Unit|यूनिट) \d+ · /, "");
/** Scenery at the screen edge beside each stop (its label is on the other side); follows the unit index like the trail. */
const SCENERY: MotifId[] = ["lotus", "pawn", "rosette", "rook", "knight", "bishop", "queen", "king"];
const SCENE = 36;
const stateText = (s: TrailStop) => (s.state === "done" ? copy.today.done : s.state === "current" ? copy.today.focus.current : copy.lesson.locked);

/** The course as a winding trail, one stop per unit. Shows a window around the current unit until "View all". */
export function CourseMap({ course, progress, onOpen }: { course: Course; progress: Progress; onOpen: (lessonId: string) => void }) {
  const { c, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const [all, setAll] = useState(false);
  const trail = courseTrail(course, progress.completed);
  const at = trail.findIndex((s) => s.state === "current");
  const from = all ? 0 : Math.max(0, (at < 0 ? trail.length : at) - 2);
  const stops = all ? trail : trail.slice(from, from + 8);
  const pts = stops.map((_, k) => [xAt(from + k) * width, k * ROW + ROW / 2] as const);
  const path = (n: number) => pts.slice(0, n).map(([x, y], k) => (k ? `C ${pts[k - 1][0]} ${y - ROW / 2} ${x} ${pts[k - 1][1] + ROW / 2} ${x} ${y}` : `M ${x} ${y}`)).join(" ");
  const reached = stops.filter((s) => s.state !== "locked").length;
  const height = stops.length * ROW;
  return (
    <View style={{ gap: 8 }}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width ? (
          <>
            <Svg width={width} height={height} style={{ position: "absolute" }} pointerEvents="none">
              {pts.map(([x, y], k) => {
                const i = from + k;
                const sx = x >= width / 2 ? width - SCENE / 2 - 2 : SCENE / 2 + 2;
                return (
                  <G key={i} opacity={0.1 * artStrength(scheme === "dark")} transform={`translate(${sx - SCENE / 2} ${y - SCENE / 2}) rotate(${i % 2 ? 8 : -8} ${SCENE / 2} ${SCENE / 2}) scale(${SCENE / 100})`}>
                    {MOTIFS[SCENERY[i % SCENERY.length]].map((d, j) => (
                      <Path key={j} d={d} fill={i % 3 === 0 ? c.accent : i % 3 === 1 ? c.brand : c.gold} />
                    ))}
                  </G>
                );
              })}
              <Path d={path(stops.length)} stroke={c.line} strokeWidth={12} strokeLinecap="round" fill="none" />
              {reached > 1 ? <Path d={path(reached)} stroke={c.brand} strokeWidth={12} strokeLinecap="round" fill="none" /> : null}
            </Svg>
            {stops.map((s, k) => {
              const [x, y] = pts[k];
              const size = s.state === "current" ? NOW : NODE;
              const left = x >= width / 2;
              const lesson = s.lesson;
              return (
                <View key={s.unit.id} style={{ position: "absolute", top: y - size / 2, left: 0, right: 0, height: size }}>
                  <Pressable
                    disabled={!lesson}
                    accessibilityRole={lesson ? "button" : "image"}
                    accessibilityLabel={copy.today.focus.map.stop(short(s.unit.title), s.done, s.total, stateText(s))}
                    onPress={() => lesson && onOpen(lesson.id)}
                    style={({ pressed }) => ({
                      position: "absolute",
                      left: x - size / 2,
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      opacity: pressed ? 0.85 : 1,
                      backgroundColor: s.state === "done" ? c.success : s.state === "current" ? c.gold : c.card,
                      borderWidth: s.state === "locked" ? 4 : 0,
                      borderColor: c.line,
                    })}
                  >
                    {s.state === "current" ? <Cody size={64} /> : <Icon name={s.state === "done" ? "check" : "lock"} size={s.state === "done" ? 22 : 18} color={s.state === "done" ? "#fff" : c.textMuted} />}
                  </Pressable>
                  <View
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      justifyContent: "center",
                      alignItems: left ? "flex-end" : "flex-start",
                      ...(left ? { left: 0, width: Math.max(0, x - size / 2 - 12) } : { left: x + size / 2 + 12, right: 0 }),
                    }}
                  >
                    {s.state === "current" ? <Badge tone="brand">{copy.today.focus.current}</Badge> : null}
                    <T role="label" numberOfLines={2} style={{ textAlign: left ? "right" : "left" }}>
                      {short(s.unit.title)}
                    </T>
                    <T role="small" color="textMuted" numberOfLines={1} style={{ textAlign: left ? "right" : "left" }}>
                      {s.state === "current" && lesson ? lesson.title : stateText(s)}
                    </T>
                  </View>
                </View>
              );
            })}
          </>
        ) : null}
      </View>
      {trail.length > 8 ? (
        <Pressable accessibilityRole="button" onPress={() => setAll((v) => !v)} style={{ alignSelf: "center", minHeight: 44, justifyContent: "center" }}>
          <T role="small" style={{ color: c.brandText }}>
            {all ? copy.today.focus.showLess : copy.today.focus.viewAll}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}
