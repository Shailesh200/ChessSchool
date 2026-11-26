import { botInfo, PIECE_SETS } from "@chessschool/chess";
import { APP_ICONS, type Appearance, BOARD_COLORS, copy, iconGoalText, iconUnlock, lockedUntil, palettes, resolveTheme, type RewardKind, THEMES, withBoardColors } from "@chessschool/design";
import { Image, Pressable, View } from "react-native";
import { PieceArt } from "@/components/Board";
import { Icon } from "@/components/Icon";
import { Card, Page, ProgressBar, Segmented, SwitchRow, T, useToast } from "@/components/ui";
import { appIconsSupported, setAppIcon } from "@/lib/appIcon";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

const ICON_PREVIEWS: Record<string, number> = {
  classroom: require("../assets/app-icons/classroom-preview.png"),
  sunset: require("../assets/app-icons/sunset-preview.png"),
  garden: require("../assets/app-icons/garden-preview.png"),
  ocean: require("../assets/app-icons/ocean-preview.png"),
  library: require("../assets/app-icons/library-preview.png"),
  night: require("../assets/app-icons/night-preview.png"),
  pixel: require("../assets/app-icons/pixel-preview.png"),
  midnight: require("../assets/app-icons/midnight-preview.png"),
};
const ICON = 56;

export default function Looks() {
  const { state, setPrefs, cue } = useApp();
  const { c, scheme } = useTheme();
  const toast = useToast();
  const { prefs } = state;
  const iconsOk = appIconsSupported();
  const pick = (p: Partial<typeof prefs>) => {
    cue("tap");
    setPrefs(p);
  };
  /** Quest rewards stay locked until enough quest days; a tap explains how to unlock them. */
  const lock = (kind: RewardKind, id: string) => lockedUntil(state, kind, id);
  const choose = (need: number | null, p: Partial<typeof prefs>) => (need ? toast(copy.quests.locked(need)) : pick(p));
  const lockNote = (need: number | null) =>
    need ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon name="lock" size={12} color={c.textMuted} />
        <T role="micro" color="textMuted" style={{ flexShrink: 1 }}>
          {copy.quests.locked(need)}
        </T>
      </View>
    ) : null;
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
            const need = lock("theme", t.id);
            return (
              <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: Boolean(need) }} accessibilityLabel={`${t.name}. ${need ? copy.quests.locked(need) : t.blurb}`} onPress={() => choose(need, { theme: t.id })} style={[card(on), { flexGrow: 1, flexBasis: "45%", opacity: need ? 0.6 : 1 }]}>
                <View style={{ flexDirection: "row", gap: 4, height: 40, padding: 6, borderRadius: 12, backgroundColor: p.bg, borderWidth: 1, borderColor: p.line }}>
                  {[p.brand, p.boardLight, p.boardDark, p.accent].map((col, i) => (
                    <View key={i} style={{ flex: 1, borderRadius: 6, backgroundColor: col }} />
                  ))}
                </View>
                <T role="label">{t.name}</T>
                <T role="micro" color="textMuted">
                  {t.blurb}
                </T>
                {lockNote(need)}
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
            const need = lock("pieces", set.id);
            const name = copy.looks.sets[set.id] ?? set;
            return (
              <Pressable key={set.id} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: Boolean(need) }} accessibilityLabel={`${name.name}. ${need ? copy.quests.locked(need) : name.blurb}`} onPress={() => choose(need, { pieceSet: set.id })} style={[card(on), { flexGrow: 1, flexBasis: "45%", opacity: need ? 0.6 : 1 }]}>
                <View style={{ flexDirection: "row", borderRadius: 12, overflow: "hidden" }}>
                  <View style={{ flex: 1, aspectRatio: 1, backgroundColor: c.boardLight, alignItems: "center", justifyContent: "center" }}>
                    <PieceArt piece={{ type: "n", color: "w" }} size={52} set={set.id} />
                  </View>
                  <View style={{ flex: 1, aspectRatio: 1, backgroundColor: c.boardDark, alignItems: "center", justifyContent: "center" }}>
                    <PieceArt piece={{ type: "q", color: "b" }} size={52} set={set.id} />
                  </View>
                </View>
                <T role="label">{name.name}</T>
                <T role="micro" color="textMuted">
                  {name.blurb}
                </T>
                {lockNote(need)}
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
        <View accessibilityRole="radiogroup" accessibilityLabel={copy.looks.boardColors} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 6 }}>
          {BOARD_COLORS.map((id) => {
            const b = withBoardColors(resolveTheme(prefs.theme, prefs.appearance, scheme === "dark").palette, id);
            const o = copy.looks.boardColorOptions[id];
            const on = prefs.boardColors === id;
            return (
              <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${o.name}. ${o.blurb}`} onPress={() => pick({ boardColors: id })} style={[card(on), { flexGrow: 1, flexBasis: "30%" }]}>
                <View style={{ flexDirection: "row", height: 40, borderRadius: 10, overflow: "hidden" }}>
                  {[b.boardLight, b.boardDark, b.boardLight, b.boardDark].map((col, i) => (
                    <View key={i} style={{ flex: 1, backgroundColor: col }} />
                  ))}
                </View>
                <T role="label">{o.name}</T>
                <T role="micro" color="textMuted">
                  {o.blurb}
                </T>
              </Pressable>
            );
          })}
        </View>
        <SwitchRow icon="doc" label={copy.looks.coords} value={prefs.coords} onChange={(v) => setPrefs({ coords: v })} />
        <SwitchRow icon="eye" label={copy.looks.legalDots} value={prefs.legalDots} onChange={(v) => setPrefs({ legalDots: v })} />
        <SwitchRow icon="eye" label={copy.platform.marks.label} hint={copy.platform.marks.hint} value={prefs.markShapes} onChange={(v) => setPrefs({ markShapes: v })} />
        <SwitchRow icon="star" label={copy.gym.promotion} hint={copy.gym.promotionHint} value={prefs.promotion === "ask"} onChange={(v) => setPrefs({ promotion: v ? "ask" : "queen" })} />
      </Card>

      <Card style={{ gap: 10 }}>
        <T role="heading" header>
          {copy.looks.icon}
        </T>
        <T role="small" color="textMuted">
          {iconsOk ? copy.looks.iconHint : copy.looks.iconUnavailable}
        </T>
        <View accessibilityRole="radiogroup" accessibilityLabel={copy.looks.icon} style={{ gap: 10 }}>
          {APP_ICONS.map((i) => {
            const on = prefs.appIcon === i.id;
            const u = iconUnlock(state, i.id);
            const text = iconGoalText(u, botInfo("bishop").name);
            const name = copy.looks.icons[i.id] ?? i.id;
            return (
              <Pressable
                key={i.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: !iconsOk || !u.unlocked }}
                accessibilityLabel={u.unlocked ? `${name}. ${text.goal}` : `${name}. ${copy.looks.iconLocked(text.goal)} ${text.progress}`}
                onPress={async () => {
                  if (!u.unlocked) return toast(copy.looks.iconLocked(text.goal));
                  if (!(await setAppIcon(i.id))) return toast(copy.looks.iconUnavailable);
                  pick({ appIcon: i.id });
                }}
                style={[card(on), { flexDirection: "row", alignItems: "center", gap: 12, minHeight: ICON + 24 }]}
              >
                <View style={{ width: ICON, height: ICON }}>
                  <Image source={ICON_PREVIEWS[i.id]} style={{ width: ICON, height: ICON, borderRadius: 14, opacity: u.unlocked ? 1 : 0.45 }} />
                  {u.unlocked ? null : (
                    <View style={{ position: "absolute", right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
                      <Icon name="lock" size={13} color={c.textMuted} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <T role="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {name}
                    </T>
                    {on ? <Icon name="check" size={16} color={c.brandText} /> : null}
                  </View>
                  <T role="micro" color="textMuted" numberOfLines={2}>
                    {text.goal}
                  </T>
                  {u.goal && !u.unlocked ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <ProgressBar value={u.fraction} label={`${name}: ${text.progress}`} />
                      </View>
                      <T role="micro" color="textMuted" numberOfLines={1} style={{ flexShrink: 0 }}>
                        {text.progress}
                      </T>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Page>
  );
}
