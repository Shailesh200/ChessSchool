import { copy, PATH, pathStates, UNITS, type Progress } from "@chessschool/design";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { T } from "./ui";

export function PathList({ progress }: { progress: Progress }) {
  const { c } = useTheme();
  const tints = [c.brandSoft, c.dangerSoft, c.goldSoft, c.successSoft];
  const states = pathStates(progress);
  return (
    <View style={{ gap: 16 }}>
      {UNITS.map((unit) => {
        const nodes = PATH.map((n, i) => ({ n, i, st: states[i].state })).filter((x) => x.n.unit === unit);
        const done = nodes.filter((x) => x.st === "done").length;
        return (
          <View key={unit} accessibilityRole="list" accessibilityLabel={copy.units[unit].title}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <T role="label" color="brandText" header>
                {copy.units[unit].title}
              </T>
              <T role="small" color="textMuted">
                {`${done}/${nodes.length}`}
              </T>
            </View>
            {nodes.map(({ n, i, st }, k) => {
              const p = copy.path[n.id];
              const locked = st === "locked";
              const placed = progress.placed.includes(n.id);
              const badgeBg = st === "done" ? c.success : st === "current" ? c.brand : tints[i % tints.length];
              const sub = locked ? p.reason : st === "done" ? (placed ? copy.placement.skipped : copy.today.done) : copy.today.open(n.minutes);
              const row = (pressed: boolean) => (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 68, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 14, backgroundColor: pressed ? c.sunken : "transparent", borderTopWidth: k ? 1 : 0, borderTopColor: c.line }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: badgeBg, alignItems: "center", justifyContent: "center" }}>
                    {st === "done" ? (
                      <Icon name="check" color="#FFFFFF" size={20} />
                    ) : locked ? (
                      <Icon name="lock" color={c.textMuted} size={18} />
                    ) : (
                      <T role="label" style={{ color: c.onBrand, fontFamily: fonts.bold }}>
                        {String(i)}
                      </T>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T role="label" color={locked ? "textMuted" : "text"}>
                      {p.title}
                    </T>
                    <T role="small" color="textMuted">
                      {sub}
                    </T>
                  </View>
                  {locked ? null : <Icon name="chevron" color={c.textMuted} />}
                </View>
              );
              return locked ? (
                <View key={n.id} accessible accessibilityLabel={copy.a11y.locked(p.title, p.reason)}>
                  {row(false)}
                </View>
              ) : (
                <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={st === "done" ? copy.a11y.done(p.title) : `${p.title}. ${sub}`} onPress={() => router.push(n.id === "meet" ? "/orientation" : `/lesson/${n.id}`)}>
                  {({ pressed }) => row(pressed)}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
