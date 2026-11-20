import { copy, errorMessage, SUPPORT_TOPICS, validEmail, type InviteInfo, type MyDetails, type SupportTopic } from "@chessschool/design";
import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";
import { Platform, Share, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { Button, Card, Segmented, Sheet, T, TextField, useToast } from "./ui";

export const appVersion = () => Constants.expoConfig?.version ?? "0.0.0";

/** The signed-in account's profile details and photo; null while loading or signed out. */
export function useMyDetails() {
  const { state } = useApp();
  const [mine, setMine] = useState<MyDetails | null>(null);
  const reload = useCallback(() => {
    if (state.account) api.myDetails().then(setMine, () => {});
  }, [state.account]);
  useEffect(reload, [reload]);
  return { mine: state.account ? mine : null, setMine, reload };
}

/**
 * Takes or picks a square photo and returns it downscaled to 512px JPEG (base64), so uploads stay small.
 * Loads the native modules lazily like the board scanner, so an older binary shows "missing" instead of crashing.
 */
export async function pickPhoto(source: "camera" | "library"): Promise<string | "denied" | "missing" | null> {
  let Picker: typeof import("expo-image-picker");
  let Manip: typeof import("expo-image-manipulator");
  try {
    Picker = require("expo-image-picker");
    Manip = require("expo-image-manipulator");
  } catch {
    return "missing";
  }
  try {
    if (source === "camera" && !(await Picker.requestCameraPermissionsAsync()).granted) return "denied";
    const opts = { mediaTypes: ["images" as const], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 1 };
    const r = source === "camera" ? await Picker.launchCameraAsync(opts) : await Picker.launchImageLibraryAsync(opts);
    const a = r.canceled ? null : r.assets[0];
    if (!a) return null;
    const ctx = Manip.ImageManipulator.manipulate(a.uri);
    const side = Math.min(a.width, a.height);
    // allowsEditing already crops on iOS; Android galleries may not, so crop the centre square here too.
    if (a.width !== a.height) ctx.crop({ originX: (a.width - side) / 2, originY: (a.height - side) / 2, width: side, height: side });
    if (side > 512) ctx.resize({ width: 512, height: 512 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ base64: true, compress: 0.8, format: Manip.SaveFormat.JPEG });
    return out.base64 ?? null;
  } catch {
    return "missing";
  }
}

/** Profile: your friend code and link, and a field to add a friend by theirs. Friends made this way are friends both ways. */
export function FriendCodeCard() {
  const { state, track, cue } = useApp();
  const toast = useToast();
  const t = copy.social;
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const on = Boolean(state.account) && !state.activeChild;
  useEffect(() => {
    if (on) api.myInvite().then(setInfo, () => {});
  }, [on]);
  if (!on) return null;
  const add = async () => {
    const clean = code.trim().toLowerCase();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.addFriendByCode(clean);
      cue("success");
      toast(t.friendCodeAdded(r.friend.name));
      setCode("");
    } catch (err) {
      cue("gentle-no");
      const status = (err as { status?: number }).status;
      setError(status === 409 ? t.friendCodeOwn : status === 404 ? t.friendCodeBad : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ gap: 10 }}>
      <T role="heading" header>
        {t.yourCode}
      </T>
      {info ? (
        <>
          <T role="title" style={{ fontFamily: fonts.bold, letterSpacing: 2 }}>
            {info.code}
          </T>
          <T role="small" color="textMuted">
            {t.yourCodeHint}
          </T>
          <Button title={t.shareCode} variant="secondary" onPress={async () => (await shareLink(t.shareCodeText, info.url)) && track("share")} />
        </>
      ) : null}
      <TextField label={t.friendCode} hint={t.friendCodeHint} placeholder={t.friendCodePlaceholder} value={code} onChangeText={(v) => (setCode(v), setError(null))} error={error} autoCapitalize="none" autoCorrect={false} maxLength={12} returnKeyType="done" onSubmitEditing={add} />
      <Button title={t.friendCodeAdd} disabled={!code.trim()} loading={busy} onPress={add} />
    </Card>
  );
}

/** "Contact us / Report a problem": goes to the API with the app version and platform, and on to the team by email. */
export function SupportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, cue } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const t = copy.support;
  const [topic, setTopic] = useState<SupportTopic>("problem");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const platform = Platform.OS;
  const send = async () => {
    if (message.trim().length < 10) return setError(t.tooShort);
    if (!state.account && !validEmail(email)) return setError(t.emailBad);
    setBusy(true);
    try {
      await api.support({ topic, message: message.trim(), email: state.account ? undefined : email.trim(), platform, version: appVersion(), guestId: state.guestId });
      cue("success");
      toast(t.sent);
      setMessage("");
      onClose();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <T role="heading" header center>
        {t.title}
      </T>
      <T role="body" color="textMuted" center>
        {t.body}
      </T>
      <View style={{ alignSelf: "stretch", gap: 12 }}>
        <Segmented<SupportTopic> label={t.topic} value={topic} onChange={setTopic} options={SUPPORT_TOPICS.map((id) => ({ value: id, label: t.topics[id] }))} />
        <TextInput
          accessibilityLabel={t.message}
          multiline
          maxLength={4000}
          value={message}
          placeholder={t.placeholder}
          placeholderTextColor={c.textSubtle}
          onChangeText={(v) => (setMessage(v), setError(null))}
          style={{ minHeight: 120, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: error ? c.danger : c.line, backgroundColor: c.card, color: c.text, fontFamily: fonts.regular, fontSize: 16, textAlignVertical: "top" }}
        />
        {state.account ? null : <TextField label={t.email} placeholder={t.emailPlaceholder} value={email} onChangeText={(v) => (setEmail(v), setError(null))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />}
        <T role="small" color="textMuted">
          {t.includes(appVersion(), platform)}
        </T>
        {error ? (
          <T role="small" color="dangerText">
            {error}
          </T>
        ) : null}
        <Button title={t.send} icon="mail" loading={busy} onPress={send} />
      </View>
    </Sheet>
  );
}

/**
 * "Download my data": fetches everything stored for the account and opens the share sheet with it, so it can be saved to Files or sent.
 * shortcut: shares the JSON as text; attaching a .json file needs expo-file-system and expo-sharing in a store build.
 */
export async function shareMyData(): Promise<boolean> {
  const data = await api.exportData();
  const text = JSON.stringify(data, null, 2);
  const r = await Share.share({ title: copy.dataExport.shareTitle, message: text });
  return r.action !== Share.dismissedAction;
}
