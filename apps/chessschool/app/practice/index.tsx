import { copy, PATH, type IconName } from "@chessschool/design";
import { router } from "expo-router";
import { View } from "react-native";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, Card, Page, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

export default function Practice() {
  const { state } = useApp();
  const { c } = useTheme();
  const learned = PATH.some((n) => n.id !== "meet" && state.progress.completed[n.id]);
  return (
    <Page
      title={copy.practice.title}
      banner={false}
      footer={
        learned ? (
          <Button title={copy.practice.start} icon="practice" onPress={() => router.push("/practice/session")} />
        ) : (
          <Button title={copy.practice.emptyCta} icon="learn" onPress={() => router.replace("/today")} />
        )
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 24, backgroundColor: c.dangerSoft }}>
        <Cody animation={learned ? "proud" : "reading"} size={104} label={copy.a11y.mascot} />
        <View style={{ flex: 1, gap: 6 }}>
          <T role="title" header>
            {learned ? copy.practice.title : copy.practice.emptyTitle}
          </T>
          <T role="body" color="textMuted">
            {learned ? copy.practice.body : copy.practice.emptyBody}
          </T>
          {learned ? (
            <T role="small" color="textMuted">
              {copy.practice.count(state.progress.drills)}
            </T>
          ) : null}
        </View>
      </View>
      {learned ? (
        <Card style={{ gap: 4, paddingVertical: 10 }}>
          {copy.practice.how.map((h) => (
            <View key={h.text} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.sunken }}>
                <Icon name={h.icon as IconName} size={20} color={c.brandText} />
              </View>
              <T role="body" style={{ flex: 1 }}>
                {h.text}
              </T>
            </View>
          ))}
        </Card>
      ) : null}
    </Page>
  );
}
