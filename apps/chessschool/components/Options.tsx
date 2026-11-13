import { useState } from "react";
import { Pressable, View } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { T } from "./ui";

/** Two-column lesson checks. Cell height stays put so the board above does not jump. */
const GRID_CELL = 62;
const GRID_GAP = 8;

/** A labelled group of selectable cards (one choice). `row` lays short options side by side. `columns={2}` is a 2×2 grid. */
export function Options<V extends string>({
  label,
  value,
  onChange,
  options,
  row,
  columns = 1,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: { value: V; title: string; body?: string }[];
  row?: boolean;
  columns?: 1 | 2;
}) {
  const { c } = useTheme();
  const grid = columns === 2;
  const [width, setWidth] = useState(0);
  const cellW = grid && width > 0 ? Math.floor((width - GRID_GAP) / 2) : undefined;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: grid ? 0 : 8 }} onLayout={grid ? (e) => setWidth(Math.floor(e.nativeEvent.layout.width)) : undefined}>
      {grid ? null : <T role="heading">{label}</T>}
      <View style={{ flexDirection: row || grid ? "row" : "column", flexWrap: row || grid ? "wrap" : "nowrap", gap: grid ? GRID_GAP : 8 }}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.body ? `${o.title}. ${o.body}` : o.title}
              onPress={() => onChange(o.value)}
              style={({ pressed }) => ({
                minHeight: grid ? GRID_CELL : row ? 52 : 64,
                height: grid ? GRID_CELL : undefined,
                width: grid ? (cellW ?? "47%") : undefined,
                flexGrow: !grid && row ? 1 : 0,
                flexBasis: grid ? undefined : row ? "22%" : "auto",
                justifyContent: "center",
                alignItems: row || grid ? "center" : "flex-start",
                paddingHorizontal: row || grid ? 10 : 18,
                paddingVertical: grid ? 6 : 10,
                borderRadius: grid ? 16 : 18,
                borderWidth: 2,
                borderColor: on ? c.brand : c.line,
                backgroundColor: c.card,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <T role={grid ? "small" : "label"} center={grid} numberOfLines={grid ? 3 : undefined} style={{ fontFamily: fonts.semibold, textAlign: grid ? "center" : undefined }}>
                {o.title}
              </T>
              {!grid && o.body ? (
                <T role="small" color="textMuted">
                  {o.body}
                </T>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
