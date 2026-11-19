import { copy, COUNTRIES, flagOf } from "@chessschool/design";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Page, T, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

/** Picks the country shown as a flag on leaderboards; saved on the profile (and the account when signed in). */
export default function CountryPicker() {
  const { state, setProfile, cue } = useApp();
  const { c } = useTheme();
  const t = copy.country;
  const [q, setQ] = useState("");
  const current = state.profile.country ?? null;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hits = needle ? COUNTRIES.filter(([code, name]) => name.toLowerCase().includes(needle) || code.toLowerCase() === needle) : COUNTRIES;
    // India first when nothing is typed: most learners are there.
    return needle ? hits : [...hits.filter(([code]) => code === "IN"), ...hits.filter(([code]) => code !== "IN")];
  }, [q]);
  const pick = (code: string) => {
    setProfile({ country: code });
    cue("tap");
    if (state.account) api.updateMe({ country: code }).catch(() => {});
    router.back();
  };
  return (
    <Page title={t.title} banner={false}>
      <T role="small" color="textMuted">
        {t.body}
      </T>
      <TextField label={t.search} placeholder={t.placeholder} value={q} onChangeText={setQ} autoCorrect={false} autoCapitalize="words" returnKeyType="search" />
      <View accessibilityRole="radiogroup" style={{ gap: 6 }}>
        {list.map(([code, name]) => {
          const on = code === current;
          return (
            <Pressable key={code} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={name} onPress={() => pick(code)} style={{ minHeight: 52, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, backgroundColor: on ? c.brandSoft : c.card, borderWidth: on ? 2 : 1, borderColor: on ? c.brand : c.line }}>
              <T role="heading">{flagOf(code)}</T>
              <T role="body" style={{ flex: 1, fontFamily: on ? fonts.bold : undefined }}>
                {name}
              </T>
              {on ? (
                <View>
                  <Icon name="check" size={18} color={c.brand} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Page>
  );
}
