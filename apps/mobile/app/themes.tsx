import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { settings, useSettings, BOARD_THEMES, SELECTABLE_BOARD_THEMES, BOARD_THEME_NAMES } from "@/settings";
import { APP_THEMES } from "@/appThemes";
import { SCHOOL_THEMES } from "@/schoolThemes";
import { ChessBoard } from "@/ChessBoard";
import { PIECE_THEMES, PiecePreview } from "@/Piece";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { Icon } from "@/Icon";
import { emojiToIcon } from "@/iconMaps";
import { useAppTheme } from "@/ThemeProvider";
import { haptics } from "@/haptics";
import { font, radius, shadowCard, space, type } from "@/theme";

const PREVIEW_FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1";

export default function ThemesScreen() {
  const { boardTheme, pieceTheme, appTheme, schoolTheme } = useSettings();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const preview = Math.min(width - 96, 300);
  const [previewOpen, setPreviewOpen] = useState(false);

  const boardName = BOARD_THEME_NAMES[boardTheme] ?? boardTheme;
  const pieceName = PIECE_THEMES.find((p) => p.id === pieceTheme)?.name ?? pieceTheme;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], gap: space[3], paddingBottom: 40 },
        header: { gap: space[2] },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: -space[1] },
        live: {
          alignSelf: "flex-start",
          backgroundColor: colors.brand,
          borderRadius: radius.pill,
          paddingHorizontal: space[3],
          paddingVertical: 4,
        },
        liveText: { ...type.xs, fontFamily: font.bold, color: "#fff" },
        liveDetail: { ...type.sm, fontFamily: font.bold, color: colors.ink, marginTop: space[1] },
        previewWrap: { alignItems: "center", marginVertical: space[2] },
        section: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginTop: space[3] },
        sectionNote: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: -space[1], marginBottom: space[1] },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
        card: {
          width: "30%",
          flexGrow: 1,
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.card,
          padding: space[3],
          alignItems: "center",
          gap: space[2],
          borderWidth: 1,
          borderColor: colors.hairline,
          ...shadowCard,
        },
        cardWide: { width: "47%" },
        cardOn: { borderWidth: 2, borderColor: colors.brand },
        swatch: { flexDirection: "row", width: "100%", height: 44, borderRadius: radius.sm, overflow: "hidden" },
        appSwatch: { width: "100%", height: 44, borderRadius: radius.sm, overflow: "hidden", flexDirection: "row" },
        pieceWrap: {
          width: "100%",
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceSunken,
          paddingVertical: space[2],
          alignItems: "center",
        },
        cardLabel: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textAlign: "center" },
        cardFamily: { ...type.caption, fontFamily: font.semibold, color: colors.ink300, textAlign: "center" },
        cardLabelOn: { color: colors.brand },
        themeLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
        modalBackdrop: {
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.55)",
          justifyContent: "center",
          padding: space[5],
        },
        modalCard: {
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.card,
          padding: space[5],
          ...shadowCard,
        },
        modalTitle: { ...type.lg, fontFamily: font.bold, color: colors.ink },
        modalSub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: space[1] },
      }),
    [colors],
  );

  return (
    <AppShell>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 }]}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.h1}>Theme Studio</Text>
          <Text style={styles.sub}>Preview and switch instantly — same sets as the website.</Text>
          <Pressable style={styles.live} onPress={() => setPreviewOpen(true)}>
            <Text style={styles.liveText}>Full preview</Text>
          </Pressable>
          <Text style={styles.liveDetail}>
            {boardName} board · {pieceName} pieces
          </Text>
        </View>

        <View style={styles.previewWrap}>
          <ChessBoard fen={PREVIEW_FEN} size={preview} interactive={false} showNotation lastMove={{ from: "c4", to: "c5" }} />
        </View>

        <Text style={styles.section}>App theme</Text>
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
                <View style={styles.themeLabelRow}>
                  <Icon name={emojiToIcon(t.emoji)} size={14} color={on ? colors.brand : colors.ink500} duotone />
                  <Text style={[styles.cardLabel, on && styles.cardLabelOn]} numberOfLines={1}>
                    {t.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Board themes</Text>
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

        <Text style={styles.section}>Piece sets</Text>
        <Text style={styles.sectionNote}>Fairytale uses flat storybook silhouettes — mice, castles, princesses, and more.</Text>
        <View style={styles.grid}>
          {PIECE_THEMES.map((pt) => {
            const on = pieceTheme === pt.id;
            return (
              <Pressable key={pt.id} style={[styles.card, styles.cardWide, on && styles.cardOn]} onPress={() => { haptics.tap(); settings.set("pieceTheme", pt.id); }}>
                <View style={styles.pieceWrap}>
                  <PiecePreview themeId={pt.id} size={28} />
                </View>
                <Text style={[styles.cardLabel, on && styles.cardLabelOn]} numberOfLines={1}>{pt.name}</Text>
                <Text style={styles.cardFamily} numberOfLines={1}>{pt.family}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>School theme</Text>
        <Text style={styles.sectionNote}>Brand colors and campus styling — works together with your app theme above.</Text>
        <View style={styles.grid}>
          {SCHOOL_THEMES.map((t) => {
            const on = schoolTheme === t.id;
            return (
              <Pressable
                key={t.id}
                style={[styles.card, styles.cardWide, on && styles.cardOn]}
                onPress={() => {
                  haptics.tap();
                  settings.set("schoolTheme", t.id);
                }}
              >
                <View style={[styles.appSwatch, { backgroundColor: t.brand50 }]}>
                  <View style={{ flex: 1, backgroundColor: t.brand }} />
                  <View style={{ flex: 1, backgroundColor: t.accent }} />
                </View>
                <View style={styles.themeLabelRow}>
                  <Icon name={emojiToIcon(t.emoji)} size={14} color={on ? colors.brand : colors.ink500} duotone />
                  <Text style={[styles.cardLabel, on && styles.cardLabelOn]} numberOfLines={1}>
                    {t.name}
                  </Text>
                </View>
                <Text style={styles.cardFamily} numberOfLines={2}>{t.chrome}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPreviewOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Theme preview</Text>
            <Text style={styles.modalSub}>
              {boardName} board · {pieceName} pieces
            </Text>
            <View style={{ alignItems: "center", marginVertical: space[3] }}>
              <ChessBoard fen={PREVIEW_FEN} size={preview} interactive={false} showNotation lastMove={{ from: "c4", to: "c5" }} />
            </View>
            <Button label="Close" variant="outline" onPress={() => setPreviewOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </AppShell>
  );
}
