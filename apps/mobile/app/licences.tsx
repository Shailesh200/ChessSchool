import { useMemo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { GPL_3_TEXT } from "@/gpl-3.0-text";
import { licenceScreenModel } from "@/licences";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, shadowCard, space } from "@/theme";
import { useType } from "@/typography";

export default function LicencesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const type = useType();
  const styles = useMemo(() => makeStyles(type, colors), [type, colors]);
  const extra = Constants.expoConfig?.extra as { gitCommit?: unknown; gitTag?: unknown } | undefined;
  const model = licenceScreenModel({
    gitCommit: extra?.gitCommit,
    gitTag: extra?.gitTag,
    envCommit: process.env.EXPO_PUBLIC_GIT_COMMIT,
    version: Constants.expoConfig?.version,
  });

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.h1} accessibilityRole="header">
          {model.title}
        </Text>
        <Text style={styles.notice}>{model.notice}</Text>
        <Text style={styles.body}>{model.credit}</Text>

        <Text style={styles.section}>Source</Text>
        <View style={styles.card}>
          <LinkRow
            label="Stockfish source"
            url={model.stockfishSourceUrl}
            hint={model.stockfishSourceHint}
          />
          <View style={styles.divider} />
          <LinkRow label="This app's source" url={model.appSourceUrl} hint={model.appSourceUrl} />
          {!model.appSourceKnown ? (
            <Text style={styles.fallback}>
              This build has no commit or tag, so the link opens the repository root.
            </Text>
          ) : null}
        </View>

        <Text style={styles.section}>GNU GPL-3.0</Text>
        <Text selectable style={styles.licence}>
          {GPL_3_TEXT}
        </Text>
        <Text style={styles.version}>{model.versionLabel}</Text>
      </ScrollView>
    </AppShell>
  );
}

function LinkRow({ label, url, hint }: { label: string; url: string; hint: string }) {
  const type = useType();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(type, colors), [type, colors]);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}. ${hint}`}
      onPress={() => {
        void Linking.openURL(url);
      }}
      style={styles.row}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(type: ReturnType<typeof useType>, colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    content: { padding: space[5], paddingBottom: 100 },
    h1: {
      ...type.xl,
      fontFamily: font.bold,
      color: colors.ink,
      marginTop: space[3],
      marginBottom: space[2],
    },
    notice: { ...type.base, fontFamily: font.bold, color: colors.ink },
    body: {
      ...type.sm,
      fontFamily: font.medium,
      color: colors.ink500,
      marginTop: space[2],
      lineHeight: type.sm.lineHeight,
    },
    section: {
      ...type.xs,
      fontFamily: font.bold,
      color: colors.ink500,
      textTransform: "uppercase",
      marginTop: space[5],
      marginBottom: space[2],
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: radius.card,
      paddingHorizontal: space[4],
      paddingVertical: space[2],
      ...shadowCard,
    },
    row: { paddingVertical: space[3] },
    rowLabel: { ...type.sm, fontFamily: font.bold, color: colors.brand },
    rowHint: { ...type.xs, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
    divider: { height: 1, backgroundColor: colors.hairline },
    fallback: {
      ...type.xs,
      fontFamily: font.medium,
      color: colors.ink500,
      paddingBottom: space[3],
    },
    licence: {
      ...type.xs,
      fontFamily: font.medium,
      color: colors.ink,
      lineHeight: 18,
    },
    version: {
      ...type.xs,
      fontFamily: font.medium,
      color: colors.ink300,
      textAlign: "center",
      marginTop: space[6],
    },
  });
}
