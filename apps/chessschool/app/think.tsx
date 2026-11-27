import { thinkTrack } from "@chessschool/chess";
import { copy, language } from "@chessschool/design";
import { router } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import { Icon } from "@/components/Icon";
import { Card, Page, Row, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

/** "Think like a player": the five parts of the track, every lesson open. */
export default function Think() {
  const { state } = useApp();
  const { c } = useTheme();
  const units = useMemo(() => thinkTrack(language()), []);
  const done = state.progress.completed;
  const all = units.flatMap((u) => u.lessons);
  return (
    <Page title={copy.think.title} banner={false}>
      <T role="small" color="textMuted" style={{ marginTop: -8 }}>
        {copy.think.sub} · {copy.think.progress(all.filter((l) => done[l.id]).length, all.length)}
      </T>
      {units.map((u) => (
        <Card key={u.id}>
          <T role="heading" header>
            {u.title}
          </T>
          <T role="small" color="textMuted">
            {u.sub}
          </T>
          <View>
            {u.lessons.map((l) => (
              <Row key={l.id} label={l.title} hint={`${l.sub} · ${l.minutes} min`} chevron right={done[l.id] ? <Icon name="check" color={c.success} /> : null} onPress={() => router.push(`/lesson/${l.id}`)} />
            ))}
          </View>
        </Card>
      ))}
    </Page>
  );
}
