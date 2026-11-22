import { copy, errorMessage, normalizeUsername, SUPPORT_TOPICS, USERNAME_MAX, usernameProblem, validEmail, type InviteInfo, type MyDetails, type SupportTopic, type UsernameProblem } from "@chessschool/design";
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

/** Why a username can't be used, in the app language (null while it is fine or still being checked). */
export const usernameError = (problem: UsernameProblem | null) => (problem ? copy.social.usernameProblems[problem] : null);

/**
 * A username box with a live availability check (a pause after typing, then the server). `onState` reports whether
 * the value can be saved: "ok" (free, or already yours), "checking", or a problem.
 */
export function UsernameField({ value, onChange, current, label = copy.social.username, hint }: { value: string; onChange: (v: string) => void; current: string | null; label?: string; hint?: string }) {
  const status = useUsernameStatus(value, current);
  const t = copy.social;
  return (
    <TextField
      label={label}
      hint={status === "checking" ? t.usernameChecking : status === "ok" && normalizeUsername(value) !== current ? t.usernameFree : (hint ?? t.usernameRules)}
      error={status !== "ok" && status !== "checking" ? usernameError(status) : null}
      placeholder={t.usernamePlaceholder}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\s/g, "").slice(0, USERNAME_MAX + 1))}
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={USERNAME_MAX + 1}
    />
  );
}

/** "ok", "checking" or the problem with `value` as this account's username. */
export function useUsernameStatus(value: string, current: string | null): "ok" | "checking" | UsernameProblem {
  const clean = normalizeUsername(value);
  const local = clean === current ? null : usernameProblem(clean);
  const [remote, setRemote] = useState<{ u: string; problem: UsernameProblem | null } | null>(null);
  useEffect(() => {
    if (local || clean === current) return;
    const timer = setTimeout(() => {
      api.checkUsername(clean).then((r) => setRemote({ u: clean, problem: r.problem }), () => setRemote({ u: clean, problem: null }));
    }, 400);
    return () => clearTimeout(timer);
  }, [clean, current, local]);
  if (clean === current) return "ok";
  if (local) return local;
  if (remote?.u !== clean) return "checking";
  return remote.problem ?? "ok";
}

/** Saves a new username for the signed-in account; returns the problem instead when the server refuses it. */
export async function saveUsername(raw: string): Promise<{ username: string } | { problem: UsernameProblem | null }> {
  try {
    return await api.setUsername(normalizeUsername(raw));
  } catch (err) {
    const e = err as { message?: string };
    return { problem: e.message && e.message in copy.social.usernameProblems ? (e.message as UsernameProblem) : null };
  }
}

/**
 * Profile: your @username and invite link, and a field to add a friend by theirs (friends both ways).
 * The first time it opens on a device, it offers to change the username we made at sign-up (skippable).
 */
export function FriendsCard() {
  const { state, track, cue, update } = useApp();
  const toast = useToast();
  const t = copy.social;
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = state.account?.username ?? null;
  const [pick, setPick] = useState(mine ?? "");
  const pickStatus = useUsernameStatus(pick, mine);
  const on = Boolean(state.account) && !state.activeChild;
  useEffect(() => {
    if (on) api.myInvite().then(setInfo, () => {});
  }, [on]);
  useEffect(() => setPick(mine ?? ""), [mine]);
  if (!on) return null;
  const setMine = (username: string) => update((s) => (s.account ? { ...s, account: { ...s.account, username }, usernameAsked: true } : s));
  const asking = !state.usernameAsked && Boolean(mine);

  const savePick = async () => {
    if (normalizeUsername(pick) === mine) return update((s) => ({ ...s, usernameAsked: true }));
    setBusy(true);
    const r = await saveUsername(pick);
    setBusy(false);
    if ("username" in r) {
      setMine(r.username);
      cue("success");
      toast(t.usernameSaved(r.username));
    } else {
      cue("gentle-no");
      setError(usernameError(r.problem) ?? copy.auth.errors.offline);
    }
  };

  const add = async () => {
    const clean = normalizeUsername(name);
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.addFriendByUsername(clean);
      cue("success");
      toast(t.usernameAdded(r.friend.name));
      setName("");
    } catch (err) {
      cue("gentle-no");
      const status = (err as { status?: number }).status;
      setError(status === 409 ? t.usernameOwn : status === 404 ? t.usernameBad : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (asking) {
    return (
      <Card style={{ gap: 10 }}>
        <T role="heading" header>
          {t.pickTitle}
        </T>
        <T role="small" color="textMuted">
          {t.pickBody}
        </T>
        <UsernameField value={pick} onChange={(v) => (setPick(v), setError(null))} current={mine} />
        {error ? (
          <T role="small" color="dangerText">
            {error}
          </T>
        ) : null}
        <Button title={t.pickSave} loading={busy} disabled={pickStatus !== "ok"} onPress={() => void savePick()} />
        <Button title={t.pickSkip} variant="ghost" disabled={busy} onPress={() => update((s) => ({ ...s, usernameAsked: true }))} />
      </Card>
    );
  }

  return (
    <Card style={{ gap: 10 }}>
      <T role="heading" header>
        {t.yourUsername}
      </T>
      {mine ? (
        <T role="title" style={{ fontFamily: fonts.bold }}>
          {t.at(mine)}
        </T>
      ) : null}
      <T role="small" color="textMuted">
        {t.yourUsernameHint}
      </T>
      {info ? <Button title={t.shareCode} variant="secondary" onPress={async () => (await shareLink(t.shareCodeText, info.url)) && track("share")} /> : null}
      <TextField label={t.addByUsername} hint={t.addByUsernameHint} placeholder={t.usernamePlaceholder} value={name} onChangeText={(v) => (setName(v.replace(/\s/g, "")), setError(null))} error={error} autoCapitalize="none" autoCorrect={false} maxLength={USERNAME_MAX + 1} returnKeyType="done" onSubmitEditing={add} />
      <Button title={t.usernameAdd} disabled={!name.trim()} loading={busy} onPress={add} />
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

