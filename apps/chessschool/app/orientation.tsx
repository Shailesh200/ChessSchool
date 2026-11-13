import { copy, PATH, type CodyAnimation } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Icon } from "@/components/Icon";
import { Cody, Fx } from "@/components/Lottie";
import { Button, Flow, IconButton, Steps, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const POSES: CodyAnimation[] = ["wave", "thinking", "proud"];
const BEAT_ICONS = ["learn", "sparkles", "profile"] as const;

export default function Orientation() {
  const { state, completeOrientation, cue } = useApp();
  const { c } = useTheme();
  const [beat, setBeat] = useState(0);
  const [done, setDone] = useState(false);
  const beats = copy.orientation.beats;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/today"));

  const advance = () => {
    if (beat < beats.length - 1) {
      cue("tap");
      return setBeat(beat + 1);
    }
    completeOrientation();
    cue("level-up");
    setDone(true);
  };

  return (
    <Flow
      top={
        <>
          <IconButton icon="close" label={copy.orientation.close} onPress={close} />
          <Steps count={beats.length} current={done ? beats.length - 1 : beat} label={copy.orientation.progress(Math.min(beat + 1, beats.length), beats.length)} />
          <View style={{ width: 48 }} />
        </>
      }
      footer={
        done ? (
          <>
            <Button title={copy.orientation.back} onPress={() => router.replace("/today")} />
            {!state.account ? <Button title={copy.orientation.save} variant="ghost" onPress={() => router.replace("/signup")} /> : null}
          </>
        ) : (
          <Button title={beat < beats.length - 1 ? copy.orientation.next : copy.orientation.finish} onPress={advance} />
        )
      }
    >
      {done ? (
        <>
          <View style={{ width: 260, height: 220, alignItems: "center", justifyContent: "center", borderRadius: 130, backgroundColor: c.brandSoft }}>
            <Fx name="stamp" size={170} style={{ position: "absolute", left: 0, top: 0 }} />
            <Cody animation="celebrate" size={150} label={copy.a11y.mascot} style={{ position: "absolute", right: 0, bottom: 0 }} />
          </View>
          <View accessible accessibilityLabel={copy.a11y.xp(PATH[0].xp)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 6, paddingRight: 16, paddingVertical: 4, borderRadius: 999, backgroundColor: c.goldSoft }}>
            <Fx name="xp-pop" size={40} />
            <T role="heading" style={{ color: c.goldText, fontFamily: fonts.bold }}>
              {copy.orientation.xp(PATH[0].xp)}
            </T>
          </View>
          <T role="title" header center>
            {copy.orientation.doneTitle}
          </T>
          <T role="bodyLg" color="textMuted" center style={{ maxWidth: 340 }}>
            {copy.orientation.doneBody}
          </T>
        </>
      ) : (
        <>
          <Cody key={beat} animation={POSES[beat]} size={180} label={copy.a11y.mascot} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: c.brandSoft }}>
            <Icon name={BEAT_ICONS[beat]} color={c.brandText} size={18} />
            <T role="small" color="brandText" style={{ fontFamily: fonts.semibold }}>
              {copy.orientation.progress(beat + 1, beats.length)}
            </T>
          </View>
          <T role="title" header center>
            {beats[beat].title}
          </T>
          <T role="bodyLg" color="textMuted" center style={{ maxWidth: 340 }}>
            {beats[beat].body}
          </T>
        </>
      )}
    </Flow>
  );
}
