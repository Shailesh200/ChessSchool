import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useMemo } from "react";
import { settings, useSettings, BOARD_THEMES, SELECTABLE_BOARD_THEMES, BOARD_THEME_NAMES } from "@/settings";
import { APP_THEMES } from "@/appThemes";
import { ChessBoard } from "@/ChessBoard";
import { Piece, PIECE_THEMES } from "@/Piece";
import { TopBar } from "@/TopBar";
import { BackButton } from "@/BackButton";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { useAppTheme } from "@/ThemeProvider";
import { haptics } from "@/haptics";
import { font, radius, shadowCard, space, type } from "@/theme";

const PREVIEW_FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1";

export default function ThemesScreen() {
  const { boardTheme, pieceTheme, appTheme } = useSettings();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const preview = Math.min(width - 96, 300);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], gap: space[3], paddingBottom: 40 },
        header: { gap: space[2] },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: -space[1] },
        previewWrap: { alignItems: "center", marginVertical: space[2] },
        section: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginTop: space[3] },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
        card: {
          width: "30%",
          flexGrow: 1,
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.md,
          padding: space[2],
          alignItems: "center",
          gap: space[2],
          borderWidth: 2,
          borderColor: "transparent",
          ...shadowCard,
        },
        cardOn: { borderColor: colors.brand },
        swatch: { flexDirection: "row", width: "100%", height: 44, borderRadius: radius.sm, overflow: "hidden" },
        appSwatch: { width: "100%", height: 44, borderRadius: radius.sm, overflow: "hidden", flexDirection: "row" },
        pieceRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 44 },
        cardLabel: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
        cardLabelOn: { color: colors.brand },
      }),
    [colors],
  );

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.h1}>Themes</Text>
          <Text style={styles.sub}>Live preview — tap a theme to apply instantly.</Text>
        </View>

        <View style={styles.previewWrap}>
          <ChessBoard fen={PREVIEW_FEN} size={preview} interactive={false} lastMove={{ from: "c4", to: "c5" }} />
        </View>

        <Text style={styles.section}>App</Text>
        <View style={styles.grid}>
          {APP_THEMES.map((t) => {
            const on = appTheme === t.id;
            return (
              <Pressable
                key={t.id}
                style={[styles.card, on && styles.cardOn]}
                onPress={() => {
                  haptics.tap();
                  settings.set("appTheme", t.id);
                }}
              >
                <View style={styles.appSwatch}>
                  <View style={{ flex: 1, backgroundColor: t.colors.surface }} />
                  <View style={{ flex: 1, backgroundColor: t.colors.brand }} />
                </View>
                <Text style={[styles.cardLabel, on && styles.cardLabelOn]} numberOfLines={1}>
                  {t.emoji} {t.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Board</Text>
        <View style={styles.grid}>
          {SELECTABLE_BOARD_THEMES.map((id) => {
            const t = BOARD_THEMES[id];
            const on = boardTheme === id;
            return (
              <Pressable key={id} style={[styles.card, on && styles.cardOn]} onPress={() => { haptics.tap(); settings.set("boardTheme", id); }}>
                <View style={styles.swatch}>
                  <View style={{ flex: 1, backgroundColor: t.light }} />
                  <View style={{ flex: 1, backgroundColor: t.dark }} />
                </View>
                <Text style={[styles.cardLabel, on && styles.cardLabelOn]} numberOfLines={1}>{BOARD_THEME_NAMES[id]}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Pieces</Text>
        <View style={styles.grid}>
          {PIECE_THEMES.map((pt) => {
            const on = pieceTheme === pt.id;
            return (
              <Pressable key={pt.id} style={[styles.card, on && styles.cardOn]} onPress={() => { haptics.tap(); settings.set("pieceTheme", pt.id); }}>
                <View style={styles.pieceRow}>
                  <Piece type="n" color="w" size={34} gid={`pv-${pt.id}-n`} themeId={pt.id} />
                  <Piece type="q" color="b" size={34} gid={`pv-${pt.id}-q`} themeId={pt.id} />
                </View>
                <Text style={[styles.cardLabel, on && styles.cardLabelOn]} numberOfLines={1}>{pt.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ThemedSafeArea>
  );
}
