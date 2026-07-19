import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { Icon } from "@/Icon";
import { useAppTheme } from "@/ThemeProvider";
import { useType } from "@/typography";
import { font, radius, shadowCard, space } from "@/theme";
import { trackEvent } from "@/productAnalytics/track";

type SearchResult = {
  id: string;
  type: "lesson" | "class" | "action";
  title: string;
  subtitle?: string;
  href: string;
  emoji?: string;
  tag?: string;
};

function hrefToRoute(href: string): string {
  if (href.startsWith("/practice/mistakes")) return "/practice/mistakes";
  if (href.startsWith("/academy")) return "/(tabs)/academy";
  if (href.startsWith("/play")) return "/(tabs)/play";
  if (href.startsWith("/journal")) return "/journal";
  if (href.startsWith("/class/")) return href;
  if (href.startsWith("/lesson/")) return href;
  return href;
}

export default function SearchScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const type = useType();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], gap: space[4], paddingBottom: 100, flexGrow: 1 },
        header: { gap: space[2] },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500 },
        field: {
          flexDirection: "row",
          alignItems: "center",
          gap: space[2],
          backgroundColor: colors.surfaceCard,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radius.card,
          paddingHorizontal: space[3],
          paddingVertical: space[2],
          ...shadowCard,
        },
        input: {
          flex: 1,
          ...type.sm,
          fontFamily: font.bold,
          color: colors.ink,
          paddingVertical: space[2],
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: space[3],
          marginBottom: space[2],
          ...shadowCard,
        },
        glyph: {
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceSunken,
          alignItems: "center",
          justifyContent: "center",
        },
        glyphText: { fontSize: 16 },
        rowBody: { flex: 1, minWidth: 0 },
        rowTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        rowSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
        typeLabel: {
          ...type.caption,
          fontFamily: font.bold,
          color: colors.ink300,
          textTransform: "uppercase",
        },
        empty: {
          ...type.sm,
          fontFamily: font.semibold,
          color: colors.ink500,
          textAlign: "center",
          marginTop: space[8],
        },
      }),
    [colors, type],
  );

  useEffect(() => {
    trackEvent("search_open");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = query.trim();
    const handle = setTimeout(() => {
      api<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`)
        .then((d) => {
          if (!cancelled) setResults(d.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, q ? 150 : 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return (
    <AppShell>
      <FlatList
        data={results}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <BackButton />
            <Text style={styles.h1}>Search</Text>
            <Text style={styles.sub}>Lessons, classes, and shortcuts</Text>
            <View style={styles.field}>
              <Icon name="search" size={18} color={colors.ink500} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search…"
                placeholderTextColor={colors.ink300}
                style={styles.input}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.empty}>No matches</Text>
          )
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.row}
            onPress={() => {
              trackEvent("search_result_open", {
                query: query.trim().slice(0, 64),
                resultType: item.type,
                href: item.href,
                rank: index,
              });
              router.push(hrefToRoute(item.href) as never);
            }}
          >
            <View style={styles.glyph}>
              <Text style={styles.glyphText}>{item.emoji ?? (item.type === "action" ? "→" : "♟")}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
            <Text style={styles.typeLabel}>{item.type}</Text>
          </Pressable>
        )}
      />
    </AppShell>
  );
}
