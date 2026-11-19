import { copy, nextRatingMilestone, ratingChart, type RatingPoint } from "@chessschool/design";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";
import { Card, T } from "./ui";

const W = 320;
const H = 140;
/** Room on the left for the rating labels, so the line never runs over them. */
const GUTTER = 38;
/** The screen reader hears the latest results as rows; the picture itself is hidden from it. */
const ROWS = 10;

/** Profile: the playing rating after each counted result, from the server's history. */
export function RatingChart() {
  const { state } = useApp();
  const { c } = useTheme();
  const signedIn = Boolean(state.account);
  const child = state.activeChild;
  const games = state.ratings.player.games;
  const [points, setPoints] = useState<RatingPoint[] | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api
      .ratingHistory(child)
      .then((r) => live && setPoints(r.points))
      .catch(() => live && setPoints([]));
    return () => {
      live = false;
    };
  }, [signedIn, child, games]);

  const rating = state.ratings.player.rating;
  const best = state.ratings.best ?? rating;
  const chart = points?.length ? ratingChart(points, W - GUTTER, H, 12) : null;
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <T role="heading" header>
          {copy.ratingChart.title}
        </T>
        <T role="heading">{String(rating)}</T>
      </View>
      {chart && points ? (
        <>
          <View accessible accessibilityRole="image" accessibilityLabel={copy.ratingChart.label(points[0].rating, points[points.length - 1].rating, points.length)}>
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
              {chart.lines.map((l) => (
                <Line key={l.value} x1={GUTTER} x2={W} y1={l.y} y2={l.y} stroke={c.line} strokeWidth={1} strokeDasharray="4 4" />
              ))}
              {chart.lines.map((l) => (
                <SvgText key={`t${l.value}`} x={GUTTER - 6} y={l.y + 3} fontSize={10} fill={c.textMuted} textAnchor="end">
                  {l.value}
                </SvgText>
              ))}
              <G x={GUTTER}>
                <Path d={chart.path} stroke={c.brand} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <Circle cx={chart.dots[chart.dots.length - 1].x} cy={chart.dots[chart.dots.length - 1].y} r={5} fill={c.brand} />
              </G>
            </Svg>
          </View>
          {/* The same numbers as a table for screen readers (latest results). */}
          <View accessibilityLabel={copy.ratingChart.caption} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}>
            {points.slice(-ROWS).map((p, i) => (
              <T key={`${p.at}-${i}`} role="micro">
                {`${copy.ratingChart.colDate}: ${new Date(p.at).toLocaleDateString()}. ${copy.ratingChart.colRating}: ${p.rating}`}
              </T>
            ))}
          </View>
        </>
      ) : (
        <T role="small" color="textMuted">
          {signedIn ? copy.ratingChart.empty : copy.ratingChart.signIn}
        </T>
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <T role="small" color="textMuted">
          {copy.ratingChart.best(best)}
        </T>
        <T role="small" color="textMuted">
          {copy.ratingChart.next(nextRatingMilestone(rating))}
        </T>
      </View>
    </Card>
  );
}
