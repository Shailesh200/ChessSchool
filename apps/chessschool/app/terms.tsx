import { copy, PRIVACY_URL } from "@chessschool/design";
import * as WebBrowser from "expo-web-browser";
import { Button, Screen, T, TopBar } from "@/components/ui";

export default function Terms() {
  return (
    <Screen banner={false}>
      <TopBar title={copy.terms.title} />
      {copy.terms.body.map((p) => (
        <T key={p} role="bodyLg">
          {p}
        </T>
      ))}
      <Button title={copy.settings.privacy} variant="secondary" icon="shield" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} />
    </Screen>
  );
}
