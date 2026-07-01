import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/auth";
import { useProgress } from "@/progressStore";
import { useSettings } from "@/settings";
import { rankForClasses } from "@/progress-utils";
import { Icon } from "@/Icon";
import { Button } from "@/Button";
import { TopBar } from "@/TopBar";
import { BackButton } from "@/BackButton";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, space, type } from "@/theme";

import { PRIVACY_URL } from "@/constants";

export default function AccountScreen() {
  const router = useRouter();
  const { user, guest, exitGuest, logout, deleteAccount } = useAuth();
  const { colors } = useAppTheme();
  const p = useProgress();
  const { avatar } = useSettings();
  const [deleting, setDeleting] = useState(false);
  const graduated = ((p?.graduatedClasses as string[]) ?? []).length;
  const rank = rankForClasses(graduated);
  const studentNo = `CS-${(user?.id ?? "00000000").replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], gap: space[4], paddingBottom: 40 },
        center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[5], gap: space[2] },
        headerRow: { gap: space[2] },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        muted: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, textAlign: "center" },
        idCard: { borderRadius: radius.card, padding: space[5], shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
        idTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        idBrand: { ...type.caption, fontFamily: font.bold, color: "#fff", opacity: 0.8, letterSpacing: 1.5 },
        idMain: { flexDirection: "row", alignItems: "center", gap: space[4], marginTop: space[4] },
        avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
        avatarText: { fontSize: 30, fontFamily: font.bold, color: "#fff" },
        idName: { ...type.xl, fontFamily: font.bold, color: "#fff" },
        idEmail: { ...type.sm, fontFamily: font.semibold, color: "#fff", opacity: 0.8 },
        idNo: { ...type.sm, fontFamily: font.bold, color: "#fff", marginTop: space[1], letterSpacing: 2 },
        idMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: space[4] },
        idMetaText: { ...type.xs, fontFamily: font.bold, color: "#fff", opacity: 0.9 },
        legalLink: { ...type.sm, fontFamily: font.bold, color: colors.brand, textAlign: "center" as const },
        dangerHint: { ...type.xs, fontFamily: font.medium, color: colors.ink500, textAlign: "center" as const, lineHeight: 18 },
      }),
    [colors],
  );

  const confirmDelete = () => {
    Alert.alert(
      "Delete account?",
      "This permanently removes your profile, progress, and settings from ChessSchool. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            void deleteAccount()
              .then(() => router.replace("/login"))
              .catch((e: unknown) => {
                setDeleting(false);
                Alert.alert("Could not delete", e instanceof Error ? e.message : "Please try again.");
              });
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (!guest) return;
    exitGuest();
    router.replace("/login");
  }, [exitGuest, guest, router]);

  if (guest) {
    return (
      <ThemedSafeArea edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.h1}>Account required</Text>
          <Text style={styles.muted}>Log in or enroll to view your Student ID.</Text>
        </View>
      </ThemedSafeArea>
    );
  }

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <BackButton />
          <Text style={styles.h1}>Account</Text>
        </View>

        <LinearGradient colors={[colors.brand, colors.brand700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.idCard}>
          <View style={styles.idTop}>
            <Text style={styles.idBrand}>CHESSSCHOOL · STUDENT ID</Text>
            <Icon name="cap" size={22} color="#fff" />
          </View>
          <View style={styles.idMain}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{avatar || (user?.name?.[0]?.toUpperCase() ?? "?")}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.idName} numberOfLines={1}>{user?.name}</Text>
              <Text style={styles.idEmail} numberOfLines={1}>{user?.email}</Text>
              <Text style={styles.idNo}>{studentNo}</Text>
            </View>
          </View>
          <View style={styles.idMeta}>
            <Text style={styles.idMetaText}>Rank · {rank}</Text>
            <Text style={styles.idMetaText}>House · Scholars</Text>
            <Text style={styles.idMetaText}>Since · 2026</Text>
          </View>
        </LinearGradient>

        <View style={{ gap: space[3], marginTop: space[2] }}>
          {user?.role === "admin" && <Button label="📚 Browse the lesson library" variant="outline" onPress={() => router.push("/library")} />}
          <Button label="Log out" variant="outline" onPress={logout} />
          <Text style={styles.legalLink} onPress={() => void Linking.openURL(PRIVACY_URL)}>
            Privacy policy
          </Text>
          <Text style={styles.dangerHint}>Deleting your account removes all synced progress permanently.</Text>
          <Button label={deleting ? "Deleting…" : "Delete account"} variant="outline" onPress={confirmDelete} />
        </View>
      </ScrollView>
    </ThemedSafeArea>
  );
}
