import { copy, isOfflineError, type FriendRow } from "@chessschool/design";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AvatarFace } from "@/components/AvatarFace";
import { Icon } from "@/components/Icon";
import { FriendsCard } from "@/components/Social";
import { Button, Page, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

/** Your @username, adding friends by username, and everyone you've added. */
export default function Friends() {
  const { state } = useApp();
  const { c } = useTheme();
  const t = copy.social;
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [failed, setFailed] = useState<false | "offline" | "error">(false);
  const load = useCallback(() => {
    setFailed(false);
    api
      .friends()
      .then((r) => setFriends(r.friends))
      .catch((err) => setFailed(isOfflineError(err) ? "offline" : "error"));
  }, []);
  useEffect(() => {
    if (state.account) load();
  }, [load, state.account]);

  if (!state.account) {
    return (
      <Page title={t.friendsTitle} banner={false}>
        <T role="bodyLg">{copy.board.signIn}</T>
      </Page>
    );
  }
  return (
    <Page title={t.friendsTitle} banner={false}>
      <T role="small" color="textMuted">
        {t.friendsHint}
      </T>
      <FriendsCard onAdded={load} />
      <T role="heading" header>
        {t.friendsList}
      </T>
      {failed ? (
        <View style={{ gap: 10 }}>
          <T role="small" color="dangerText">
            {failed === "offline" ? copy.offlineMode.needsConnection : copy.auth.errors.generic}
          </T>
          <Button title={copy.puzzles.retry} variant="secondary" onPress={load} />
        </View>
      ) : !friends ? (
        <ActivityIndicator color={c.brand} />
      ) : !friends.length ? (
        <T role="small" color="textMuted">
          {t.friendsEmpty}
        </T>
      ) : (
        <View accessibilityRole="list" style={{ gap: 8 }}>
          {friends.map((f) => (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityLabel={t.viewProfile(f.name)}
              onPress={() => router.push({ pathname: "/player", params: { id: f.id } })}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, opacity: pressed ? 0.75 : 1 })}
            >
              <AvatarFace id={f.avatar as never} photo={f.photo} size={44} country={f.country} />
              <View style={{ flex: 1, gap: 2 }}>
                <T role="label" numberOfLines={1}>
                  {f.name}
                </T>
                {f.username ? (
                  <T role="micro" color="textMuted" numberOfLines={1}>
                    {t.at(f.username)}
                  </T>
                ) : null}
              </View>
              <Icon name="chevron" size={18} color={c.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </Page>
  );
}
