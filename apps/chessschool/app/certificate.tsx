import { copy, errorMessage } from "@chessschool/design";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Button, Page, T } from "@/components/ui";
import { api } from "@/lib/api";
import { shareLink } from "@/lib/share";
import { fonts, useTheme } from "@/lib/theme";

/**
 * The print SVG as react-native-svg can draw it: no XML prolog, no millimetre page size (the viewBox scales it),
 * and the app's own loaded font instead of web font lists, which native can't resolve (the preview came out blank).
 */
function forNativeSvg(svg: string, font: string): string {
  return svg
    .replace(/<\?xml[^>]*>\s*/, "")
    .replace(/(<svg[^>]*?) width="[^"]*" height="[^"]*"/, "$1")
    .replace(/font-family="[^"]*"/g, `font-family="${font}"`)
    .replace(/ font-(?:weight|style)="[^"]*"/g, "");
}

/** One unit's certificate, shown in full first; Download and Share come after the learner has seen it. */
export default function CertificatePreview() {
  const { unit } = useLocalSearchParams<{ unit?: string }>();
  const { c } = useTheme();
  const t = copy.certificate;
  const [link, setLink] = useState<{ url: string; unit: string } | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!unit) return;
    let live = true;
    api
      .certificateLink(unit)
      .then(async (r) => {
        if (!live) return;
        setLink({ url: r.url, unit: r.unit });
        const res = await fetch(r.url);
        if (!res.ok) throw Object.assign(new Error("certificate"), { status: res.status });
        if (live) setSvg(forNativeSvg(await res.text(), fonts.bold));
      })
      .catch((err) => live && setError((err as { status?: number }).status === 403 ? t.notFinished : errorMessage(err)));
    return () => {
      live = false;
    };
  }, [unit, t.notFinished]);
  return (
    <Page title={t.action} banner={false}>
      <View accessible accessibilityRole="image" accessibilityLabel={link ? `${t.title}: ${link.unit}` : t.loading} style={{ width: "100%", aspectRatio: 1188 / 840, borderRadius: 8, backgroundColor: "#FFFDF7", overflow: "hidden", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 6 }}>
        {svg ? <SvgXml xml={svg} width="100%" height="100%" /> : error ? null : <ActivityIndicator color={c.brand} />}
      </View>
      {error ? (
        <T role="small" color="dangerText" center>
          {error}
        </T>
      ) : (
        <T role="small" color="textMuted" center>
          {t.preview}
        </T>
      )}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title={t.download} icon="doc" variant="secondary" disabled={!link} onPress={() => link && void WebBrowser.openBrowserAsync(link.url)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t.shareAction} icon="arrowRight" variant="gold" disabled={!link} onPress={() => link && void shareLink(t.share(link.unit), link.url)} />
        </View>
      </View>
    </Page>
  );
}
