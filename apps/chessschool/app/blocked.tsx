import { copy, type BlockedPlayer } from "@chessschool/design";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AvatarFace } from "@/components/AvatarFace";
import { Button, Card, Page, T, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

/** Settings → Blocked players: everyone you blocked (from a class, a board, a profile or a challenge), with Unblock. */
export default function Blocked() {
  const { state } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const t = copy.social;
  const [list, setList] = useState<BlockedPlayer[] | null>(null);
  useEffect(() => {
    if (state.account) api.blocks().then((r) => setList(r.blocked), () => setList([]));
  }, [state.account]);
  const unblock = (p: BlockedPlayer) =>
    api
      .unblockPlayer(p.id)
      .then(() => {
        setList((l) => l?.filter((x) => x.id !== p.id) ?? l);
        toast(t.unblocked(p.name));
      })
      .catch(() => toast(copy.auth.errors.offline));

  return (
    <Page title={t.blockedTitle} banner={false}>
      <T role="small" color="textMuted">
        {t.blockedHint}
      </T>
      {!list ? (
        <ActivityIndicator color={c.brand} />
      ) : list.length === 0 ? (
        <T role="body" color="textMuted">
          {t.blockedNone}
        </T>
      ) : (
        <Card style={{ gap: 4, paddingVertical: 8 }}>
          {list.map((p) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
              <AvatarFace id={p.avatar} size={40} />
              <T role="label" style={{ flex: 1 }} numberOfLines={1}>
                {p.name}
              </T>
              <Button title={t.unblock} variant="secondary" block={false} onPress={() => void unblock(p)} />
            </View>
          ))}
        </Card>
      )}
    </Page>
  );
}
