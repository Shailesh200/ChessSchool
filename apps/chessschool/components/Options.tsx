import { Pressable, View } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { T } from "./ui";

/** A labelled group of selectable cards (one choice). `row` lays short options side by side. */
export function Options<V extends string>({ label, value, onChange, options, row }: { label: string; value: V; onChange: (v: V) => void; options: { value: V; title: string; body?: string }[]; row?: boolean }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8 }}>
      <T role="heading">{label}</T>
      <View style={{ flexDirection: row ? "row" : "column", flexWrap: row ? "wrap" : "nowrap", gap: 8 }}>
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
                minHeight: row ? 52 : 64,
                flexGrow: row ? 1 : 0,
                flexBasis: row ? "22%" : "auto",
                justifyContent: "center",
                alignItems: row ? "center" : "flex-start",
                paddingHorizontal: row ? 10 : 18,
                paddingVertical: 10,
                borderRadius: 18,
                borderWidth: 2,
                borderColor: on ? c.brand : c.line,
                backgroundColor: c.card,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <T role="label" style={{ fontFamily: fonts.semibold }}>
                {o.title}
              </T>
              {o.body ? (
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
