import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { colors, font, radius, space, type } from "@/theme";

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const p = useProgress();
  const { avatar } = useSettings();
  const graduated = ((p?.graduatedClasses as string[]) ?? []).length;
  const rank = rankForClasses(graduated);
  const studentNo = `CS-${(user?.id ?? "00000000").replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <BackButton />
          <Text style={styles.h1}>Account</Text>
        </View>

        {/* Student ID card */}
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

        {/* Actions */}
        <View style={{ gap: space[3], marginTop: space[2] }}>
          <Button label="📚 Browse the lesson library" variant="outline" onPress={() => router.push("/library")} />
          <Button label="Log out" variant="outline" onPress={logout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5], gap: space[4], paddingBottom: 40 },
  headerRow: { gap: space[2] },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
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
});
