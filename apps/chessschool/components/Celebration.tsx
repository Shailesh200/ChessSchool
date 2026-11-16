import { celebrationShare, celebrationText, copy, type FxAnimation } from "@chessschool/design";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Modal, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCourse } from "@/lib/course";
import { useReducedMotion } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";
import { Cody, Fx } from "./Lottie";
import { Button, T } from "./ui";

const FX: Record<string, FxAnimation> = { unit: "stamp", streak: "streak-spark", rank: "xp-pop", rating: "xp-pop", league: "xp-pop" };

/**
 * Shows the first queued celebration full screen, once. `active` is false while a lesson or game
 * covers the tabs, so it waits for the learner to come back. Lottie holds a still frame with
 * Reduce motion, and the screen then fades instead of sliding.
 */
export function CelebrationHost({ active }: { active: boolean }) {
  const { state, dismissCelebration, cue } = useApp();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const course = useCourse();
  const next = state.pendingCelebrations[0];
  const nextId = next?.id ?? null;
  const [shown, setShown] = useState<string | null>(null);
  const unitTitle = next?.kind === "unit" ? course?.units.find((u) => u.id === next.unit)?.title : undefined;
  const text = next ? celebrationText(next, unitTitle) : null;
  const title = text?.title ?? "";

  useEffect(() => {
    if (!active || !nextId) return;
    const t = setTimeout(() => {
      setShown(nextId);
      cue("level-up");
      AccessibilityInfo.announceForAccessibility(copy.celebrate.label(title));
    }, 700);
    return () => clearTimeout(t);
  }, [active, nextId, title, cue]);

  if (!next || !text || shown !== next.id) return null;
  const close = () => dismissCelebration(next.id);
  return (
    <Modal visible animationType={reduced ? "fade" : "slide"} onRequestClose={close} statusBarTranslucent>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <View style={{ width: 260, height: 230, alignItems: "center", justifyContent: "center", borderRadius: 130, backgroundColor: c.goldSoft }}>
            <Fx name={FX[next.kind]} size={170} style={{ position: "absolute", left: 0, top: 0 }} />
            <Cody animation="celebrate" size={170} label={copy.a11y.mascot} style={{ position: "absolute", right: 0, bottom: 0 }} />
          </View>
          <View accessibilityLiveRegion="polite" style={{ gap: 8, alignItems: "center" }}>
            <T role="title" header center>
              {text.title}
            </T>
            <T role="bodyLg" color="textMuted" center style={{ maxWidth: 340 }}>
              {text.body}
            </T>
          </View>
        </View>
        <View style={{ gap: 8, maxWidth: 520, width: "100%", alignSelf: "center" }}>
          <Button title={copy.celebrate.continue} onPress={close} />
          <Button title={copy.celebrate.share} variant="secondary" onPress={() => void Share.share({ message: celebrationShare(next, unitTitle) }).catch(() => {})} />
        </View>
      </View>
    </Modal>
  );
}
