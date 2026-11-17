import { agreeTerms, copy, PRIVACY_URL, startRoute } from "@chessschool/design";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { Cody } from "@/components/Lottie";
import { Button, Flow, T } from "@/components/ui";
import { useApp } from "@/lib/state";

/** Once per device, before anything else: the terms in short. Agreeing covers the AI features, so nothing asks again later. */
export default function Start() {
  const { state, update, cue } = useApp();
  const s = copy.start;
  const agree = () => {
    const at = new Date().toISOString();
    update((st) => agreeTerms(st, at));
    cue("success");
    router.replace(startRoute(agreeTerms(state, at)) as "/today");
  };
  return (
    <Flow
      scroll
      footer={
        <>
          <Button title={s.agree} onPress={agree} />
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
            <Button title={copy.terms.title} variant="ghost" block={false} onPress={() => router.push("/terms")} />
            <Button title={copy.settings.privacy} variant="ghost" block={false} onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} />
          </View>
        </>
      }
    >
      <Cody animation="wave" size={130} label={copy.a11y.mascot} />
      <T role="title" header center>
        {s.title}
      </T>
      <View style={{ gap: 12, alignSelf: "stretch" }}>
        {s.points.map((p) => (
          <View key={p} style={{ flexDirection: "row", gap: 10 }}>
            <T role="body" color="brandText">
              •
            </T>
            <T role="body" style={{ flex: 1 }}>
              {p}
            </T>
          </View>
        ))}
      </View>
      <T role="small" color="textMuted" center>
        {s.note}
      </T>
    </Flow>
  );
}
