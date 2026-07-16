import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/auth";
import { useProgress } from "@/progressStore";
import { useSettings } from "@/settings";
import { fetchProfile, type StudentProfile } from "@/profile";
import { rankForClasses } from "@/progress-utils";
import { Icon } from "@/Icon";
import { FlatAvatar } from "@/flatAvatars/FlatAvatar";
import { Button } from "@/Button";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { ScreenLoader } from "@/ScreenLoader";
import { RatingBadge } from "@/RatingBadge";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, space, type } from "@/theme";

import { PRIVACY_URL } from "@/constants";

export default function AccountScreen() {
  const router = useRouter();
  const { user, guest, loading: authLoading, logout, deleteAccount, exitGuest } = useAuth();
  const { colors } = useAppTheme();
  const p = useProgress();
  const { avatar } = useSettings();
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const graduated = ((p?.graduatedClasses as string[]) ?? []).length;
  const rank = rankForClasses(graduated);
  const studentNo = profile?.studentNo ?? "—";
  const house = profile?.house ?? "Pawns";
  const enrolled = profile
    ? new Date(profile.enrolledAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "—";
  const displayAvatar = profile?.avatarUrl ?? avatar;

  useEffect(() => {
    if (authLoading || guest || !user) return;
    void fetchProfile().then(setProfile).catch(() => setProfile(null));
  }, [authLoading, guest, user]);

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
        statRow: { flexDirection: "row", gap: space[2] },
        stat: { flex: 1, alignItems: "center", backgroundColor: colors.surfaceSunken, borderRadius: radius.card, paddingVertical: space[3] },
        statValue: { ...type.lg, fontFamily: font.bold, color: colors.ink },
        statLabel: { ...type.caption, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
      }),
    [colors],
  );

  const xp = (p?.xp as number | undefined) ?? 0;
  const streak = (p?.streak as number | undefined) ?? 0;

  async function shareStudentId() {
    const lines = [
      "CHESSSCHOOL · STUDENT ID",
      user?.name ?? "",
      user?.email ?? "",
      studentNo,
      `Rank · ${rank}`,
      `House · ${house}`,
      `Since · ${enrolled}`,
    ].join("\n");
    await Share.share({ message: lines, title: `ChessSchool ID ${studentNo}` });
  }

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
    if (authLoading) return;
    if (guest || !user) {
      exitGuest();
      router.replace("/login");
    }
  }, [authLoading, guest, user, router, exitGuest]);

  if (authLoading || guest || !user) {
    return (
      <AppShell showBottomNav={false}>
        <ScreenLoader variant="fullscreen" label={authLoading ? "Loading your Student ID…" : "Opening login…"} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <BackButton />
          <Text testID="account-title" style={styles.h1}>
            Account
          </Text>
        </View>

        <LinearGradient colors={[colors.brand, colors.brand700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.idCard}>
          <View style={styles.idTop}>
            <Text style={styles.idBrand}>CHESSSCHOOL · STUDENT ID</Text>
            <Icon name="cap" size={22} color="#fff" />
          </View>
          <View style={styles.idMain}>
            <View style={styles.avatar}>
              {displayAvatar ? (
                <FlatAvatar id={displayAvatar} size={56} />
              ) : (
                <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? "?"}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.idName} numberOfLines={1}>{user?.name}</Text>
              <Text style={styles.idEmail} numberOfLines={1}>{user?.email}</Text>
              <Text style={styles.idNo}>{studentNo}</Text>
            </View>
          </View>
          <View style={styles.idMeta}>
            <Text style={styles.idMetaText}>Rank · {rank}</Text>
            <Text style={styles.idMetaText}>House · {house}</Text>
            <Text style={styles.idMetaText}>Since · {enrolled}</Text>
          </View>
        </LinearGradient>

        <RatingBadge />

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{xp}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{graduated}</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
        </View>

        <Button label="Save / Share Student ID" variant="outline" onPress={() => void shareStudentId()} />

        <View style={{ gap: space[3], marginTop: space[2] }}>
          {user?.role === "admin" && <Button label="Browse the lesson library" variant="outline" onPress={() => router.push("/library")} />}
          <Button label="Log out" variant="outline" onPress={logout} />
          <Text style={styles.legalLink} onPress={() => void Linking.openURL(PRIVACY_URL)}>
            Privacy policy
          </Text>
          <Text style={styles.dangerHint}>Deleting your account removes all synced progress permanently.</Text>
          <Button label={deleting ? "Deleting…" : "Delete account"} variant="outline" onPress={confirmDelete} />
        </View>
      </ScrollView>
    </AppShell>
  );
}
