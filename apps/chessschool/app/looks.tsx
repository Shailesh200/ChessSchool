import { PIECE_SETS } from "@chessschool/chess";
import { APP_ICONS, copy, palettes, resolveTheme, THEMES, type Appearance } from "@chessschool/design";
import { Image, Pressable, View } from "react-native";
import { PieceArt } from "@/components/Board";
import { Card, Page, Segmented, SwitchRow, T, useToast } from "@/components/ui";
import { appIconsSupported, setAppIcon } from "@/lib/appIcon";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const ICON_PREVIEWS: Record<string, number> = {
  classroom: require("../assets/app-icons/classroom-preview.png"),
  night: require("../assets/app-icons/night-preview.png"),
  garden: require("../assets/app-icons/garden-preview.png"),
  sunset: require("../assets/app-icons/sunset-preview.png"),
  ocean: require("../assets/app-icons/ocean-preview.png"),
  midnight: require("../assets/app-icons/midnight-preview.png"),
  library: require("../assets/app-icons/library-preview.png"),
  pixel: require("../assets/app-icons/pixel-preview.png"),
};

export default function Looks() {
  const { state, setPrefs, cue } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const { prefs } = state;
  const iconsOk = appIconsSupported();
  const pick = (p: Partial<typeof prefs>) => {
    cue("tap");
    setPrefs(p);
  };
  const card = (on: boolean) => ({ borderWidth: 2, borderColor: on ? c.brand : c.line, borderRadius: 18, backgroundColor: c.card, padding: 10, gap: 4 });

  return (
    <Page title={copy.looks.title} banner={false}>

      <Card style={{ gap: 10 }}>
        <T role="heading" header>
          {copy.looks.theme}
        </T>
        <View accessibilityRole="radiogroup" accessibilityLabel={copy.looks.theme} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {THEMES.map((t) => {
            const p = t.id === "classroom" ? palettes.light : resolveTheme(t.id, "light", false).palette;
            const on = prefs.theme === t.id;
            return (
              <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${t.name}. ${t.blurb}`} onPress={() => pick({ theme: t.id })} style={[card(on), { flexGrow: 1, flexBasis: "45%" }]}>
                <View style={{ flexDirection: "row", gap: 4, height: 40, padding: 6, borderRadius: 12, backgroundColor: p.bg, borderWidth: 1, borderColor: p.line }}>
                  {[p.brand, p.boardLight, p.boardDark, p.accent].map((col, i) => (
                    <View key={i} style={{ flex: 1, borderRadius: 6, backgroundColor: col }} />
                  ))}
                </View>
                <T role="label">{t.name}</T>
                <T role="micro" color="textMuted">
                  {t.blurb}
                </T>
              </Pressable>
            );
          })}
        </View>
        {prefs.theme === "classroom" ? (
          <Segmented<Appearance>
            label={copy.settings.appearance}
            value={prefs.appearance}
            onChange={(a) => pick({ appearance: a })}
            options={(["system", "light", "dark"] as const).map((v) => ({ value: v, label: copy.settings.appearanceOptions[v] }))}
          />
        ) : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <T role="heading" header>
          {copy.looks.pieces}
        </T>
        <View accessibilityRole="radiogroup" accessibilityLabel={copy.looks.pieces} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {PIECE_SETS.map((set) => {
            const on = prefs.pieceSet === set.id;
            return (
              <Pressable key={set.id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${set.name}. ${set.blurb}`} onPress={() => pick({ pieceSet: set.id })} style={[card(on), { flexGrow: 1, flexBasis: "45%" }]}>
                <View style={{ flexDirection: "row", borderRadius: 12, overflow: "hidden" }}>
                  <View style={{ flex: 1, aspectRatio: 1, backgroundColor: c.boardLight, alignItems: "center", justifyContent: "center" }}>
                    <PieceArt piece={{ type: "n", color: "w" }} size={52} set={set.id} />
                  </View>
                  <View style={{ flex: 1, aspectRatio: 1, backgroundColor: c.boardDark, alignItems: "center", justifyContent: "center" }}>
                    <PieceArt piece={{ type: "q", color: "b" }} size={52} set={set.id} />
                  </View>
                </View>
                <T role="label">{set.name}</T>
                <T role="micro" color="textMuted">
                  {set.blurb}
                </T>
              </Pressable>
            );
          })}
        </View>
        <T role="micro" color="textMuted">
          {copy.looks.credit}
        </T>
      </Card>

      <Card style={{ padding: 8 }}>
        <T role="heading" header style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          {copy.looks.board}
        </T>
        <SwitchRow icon="doc" label={copy.looks.coords} value={prefs.coords} onChange={(v) => setPrefs({ coords: v })} />
        <SwitchRow icon="eye" label={copy.looks.legalDots} value={prefs.legalDots} onChange={(v) => setPrefs({ legalDots: v })} />
        <SwitchRow icon="star" label={copy.gym.promotion} hint={copy.gym.promotionHint} value={prefs.promotion === "ask"} onChange={(v) => setPrefs({ promotion: v ? "ask" : "queen" })} />
      </Card>

      <Card style={{ gap: 10 }}>
        <T role="heading" header>
          {copy.looks.icon}
        </T>
        <T role="small" color="textMuted">
          {iconsOk ? copy.looks.iconHint : copy.looks.iconUnavailable}
        </T>
        <View accessibilityRole="radiogroup" accessibilityLabel={copy.looks.icon} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {APP_ICONS.map((i) => {
            const on = prefs.appIcon === i.id;
            return (
              <Pressable
                key={i.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: !iconsOk }}
                accessibilityLabel={i.name}
                onPress={async () => {
                  if (!(await setAppIcon(i.id))) return toast(copy.looks.iconUnavailable);
                  pick({ appIcon: i.id });
                }}
                style={[card(on), { width: "22%", minWidth: 76, alignItems: "center", opacity: iconsOk ? 1 : 0.6 }]}
              >
                <Image source={ICON_PREVIEWS[i.id]} style={{ width: 56, height: 56, borderRadius: 14 }} />
                <T role="micro" style={{ fontFamily: fonts.semibold }} numberOfLines={1}>
                  {i.name}
                </T>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Page>
  );
}
