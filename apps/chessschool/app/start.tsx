import { agreeTerms, copy, LANG_NAMES, LANGS, language, PRIVACY_URL, startRoute } from "@chessschool/design";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { Cody } from "@/components/Lottie";
import { Button, Choice, Flow, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { track as pulse } from "@/lib/analytics";

/**
 * Once per device, before anything else: the app language, the terms in short, then new or returning. Agreeing covers the
 * AI features, so nothing asks again later. Changing the language re-renders everything in it, lessons included.
 */
export default function Start() {
  const { state, update, setPrefs, cue } = useApp();
  const s = copy.start;
  // Asked before the first lesson starts, so someone logging in never has a lesson (and its coach voice) running behind.
  const agree = (hasAccount: boolean) => {
    pulse("terms_accept", { lang: language() });
    const at = new Date().toISOString();
    update((st) => agreeTerms(st, at));
    cue("success");
    if (hasAccount) router.push("/login");
    else router.replace(startRoute(agreeTerms(state, at)) as "/today");
  };
  return (
    <Flow
      scroll
      footer={
        <>
          <Button title={s.agree} onPress={() => agree(false)} />
          <Button title={s.haveAccount} variant="secondary" onPress={() => agree(true)} />
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
            <Button title={copy.terms.title} variant="ghost" block={false} onPress={() => router.push("/terms")} />
            <Button title={copy.settings.privacy} variant="ghost" block={false} onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} />
          </View>
        </>
      }
    >
      <Cody animation="wave" size={130} label={copy.a11y.mascot} />
      <View accessibilityRole="radiogroup" accessibilityLabel={copy.welcome.steps.lang.title} style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
        {LANGS.map((l) => (
          <View key={l} style={{ flex: 1 }}>
            <Choice label={LANG_NAMES[l]} selected={language() === l} onPress={() => (setPrefs({ lang: l }), pulse("language_pick", { lang: l }), cue("tap"))} />
          </View>
        ))}
      </View>
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
