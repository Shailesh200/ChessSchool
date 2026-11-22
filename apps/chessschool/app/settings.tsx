import { coachOf, copy, isChildProfile, LANG_NAMES, LANGS, language, nextLessonIds, PRIVACY_URL, REMINDER_HOURS, usualHour, VOICE_SPEEDS, type Appearance } from "@chessschool/design";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { CoachPicker } from "@/components/CoachPicker";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { shareMyData, SupportSheet } from "@/components/Social";
import { Cody } from "@/components/Lottie";
import { Button, Card, Page, Row, SaveBanner, Segmented, Sheet, SwitchRow, T, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { saveLessonsOffline, useCourse } from "@/lib/course";
import { openSystemSettings, pushToken, requestNotifications } from "@/lib/notifications";
import { useApp } from "@/lib/state";

export default function Settings() {
  const { state, setPrefs, signOut, resetThisDevice, deleteAccount, cue, update } = useApp();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "reset" | "delete" | "feedback" | "news" | "coach" | "support">(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weekly, setWeekly] = useState<boolean | null>(null);
  const [winback, setWinback] = useState<boolean | null>(null);
  useEffect(() => {
    if (state.account) api.weekly().then((w) => setWeekly(w.email || w.push)).catch(() => {});
    if (state.account) api.emailPrefs().then((e) => setWinback(e.eligible ? e.winback : null)).catch(() => {});
  }, [state.account]);
  const course = useCourse();
  const { prefs, account } = state;
  const s = copy.settings;


  return (
    <Page title={s.title} banner={false}>

      <Card style={{ padding: 8 }}>
        <SwitchRow
          icon={prefs.sound ? "sound" : "mute"}
          label={s.sound}
          hint={s.soundHint}
          value={prefs.sound}
          onChange={(v) => {
            setPrefs({ sound: v });
            if (account) api.updateMe({ sound: v }).catch(() => {});
          }}
        />
        <SwitchRow icon="phone" label={s.haptics} hint={s.hapticsHint} value={prefs.haptics} onChange={(v) => setPrefs({ haptics: v })} />
        <SwitchRow
          icon="bell"
          label={s.notifications}
          hint={prefs.notifications === "denied" ? s.notificationsDenied : s.notificationsHint}
          value={prefs.notifications === "granted"}
          onChange={async (v) => {
            if (!v) return setPrefs({ notifications: "dismissed" });
            if (prefs.notifications === "denied") return openSystemSettings();
            setPrefs({ notifications: await requestNotifications() });
          }}
        />
        {prefs.notifications === "granted" ? (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            <T role="label">{s.reminderTime}</T>
            <Segmented label={s.reminderTime} value={prefs.reminderHour} onChange={(h) => setPrefs({ reminderHour: h })} options={REMINDER_HOURS.map((h) => ({ value: h, label: s.reminderHour(h) }))} />
            {usualHour(state) != null ? (
              <T role="small" color="textMuted">
                {copy.streaks.reminderUsual(s.reminderHour(usualHour(state)!))}
              </T>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card style={{ padding: 8, gap: 8 }}>
        <T role="heading" header style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          {s.language}
        </T>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <Segmented label={s.language} value={language()} onChange={(lang) => setPrefs({ lang })} options={LANGS.map((l) => ({ value: l, label: LANG_NAMES[l] }))} />
        </View>
      </Card>

      <Card style={{ padding: 8 }}>
        <T role="heading" header style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          {s.accessibility}
        </T>
        <SwitchRow icon="eye" label={s.easyFont} hint={s.easyFontHint} value={prefs.easyFont} onChange={(v) => setPrefs({ easyFont: v })} />
        <SwitchRow icon="snow" label={s.reduceMotion} hint={s.reduceMotionHint} value={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} />
        <T role="small" color="textMuted" style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          {s.textSizeHint}
        </T>
      </Card>

      <Card style={{ padding: 8 }}>
        <T role="heading" header style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          {copy.coach.title}
        </T>
        <Row icon="profile" label={coachOf(prefs.coach ?? "meera").name} hint={copy.coach.hint} chevron onPress={() => setSheet("coach")} />
        <SwitchRow icon={prefs.voice ? "sound" : "mute"} label={copy.coach.voice} hint={copy.coach.voiceHint} value={prefs.voice} onChange={(v) => setPrefs({ voice: v })} />
        {prefs.voice ? (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            <T role="label">{copy.coach.speed}</T>
            <Segmented label={copy.coach.speed} value={prefs.voiceSpeed} onChange={(v) => setPrefs({ voiceSpeed: v })} options={VOICE_SPEEDS.map((v) => ({ value: v, label: copy.coach.speeds[v] }))} />
          </View>
        ) : null}
      </Card>

      <Card style={{ padding: 8 }}>
        <T role="heading" header style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          {s.account}
        </T>
        {account ? (
          <>
            <Row icon="mail" label={account.email} />
            {weekly !== null ? (
              <SwitchRow
                icon="doc"
                label={s.weekly}
                hint={s.weeklyHintApp}
                value={weekly}
                onChange={async (on) => {
                  setWeekly(on);
                  try {
                    await api.setWeekly({ email: on, pushToken: on ? await pushToken() : null, lang: language() });
                  } catch {
                    setWeekly(!on);
                    toast(copy.auth.errors.offline);
                  }
                }}
              />
            ) : null}
            {winback !== null && !isChildProfile(state) ? (
              <SwitchRow
                icon="mail"
                label={copy.platform.emailSettings.winback}
                hint={copy.platform.emailSettings.winbackHint}
                value={winback}
                onChange={async (on) => {
                  setWinback(on);
                  try {
                    await api.setEmailPrefs({ winback: on, lang: language() });
                  } catch {
                    setWinback(!on);
                    toast(copy.platform.emailSettings.error);
                  }
                }}
              />
            ) : null}
            <Row
              icon="logout"
              label={s.signOut}
              danger
              onPress={async () => {
                await signOut();
                toast(s.signedOut);
                router.replace("/today");
              }}
            />
            <Row icon="block" label={copy.social.blockedTitle} hint={copy.social.blockedHint} chevron onPress={() => router.push("/blocked")} />
            <Row
              icon="doc"
              label={exporting ? copy.dataExport.working : copy.dataExport.open}
              hint={copy.dataExport.hint}
              onPress={
                exporting
                  ? undefined
                  : async () => {
                      setExporting(true);
                      try {
                        await shareMyData();
                      } catch {
                        toast(copy.dataExport.failed);
                      } finally {
                        setExporting(false);
                      }
                    }
              }
            />
            <Row icon="trash" label={s.deleteAccount} danger chevron onPress={() => setSheet("delete")} />
          </>
        ) : (
          <View style={{ padding: 6 }}>
            <SaveBanner title={copy.you.saveCard.title} />
          </View>
        )}
      </Card>

      <Card style={{ padding: 8 }}>
        <T role="heading" header style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          {s.about}
        </T>
        <Row icon="chat" label={s.feedback} chevron onPress={() => setSheet("feedback")} />
        <Row icon="mail" label={copy.support.open} chevron onPress={() => setSheet("support")} />
        <Row icon="sparkles" label={s.whatsNew} chevron onPress={() => setSheet("news")} />
        <Row
          icon="wifiOff"
          label={saving ? s.offlineWorking : s.offline}
          hint={s.offlineHint}
          onPress={
            saving || !course
              ? undefined
              : async () => {
                  setSaving(true);
                  const n = await saveLessonsOffline(nextLessonIds(course, state.progress.completed));
                  setSaving(false);
                  toast(n ? s.offlineDone(n) : s.offlineNone);
                }
          }
        />
      </Card>

      <Card style={{ padding: 8 }}>
        <T role="heading" header style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          {s.legal}
        </T>
        <SwitchRow icon="eye" label={s.shareUsage} hint={s.shareUsageHint} value={prefs.shareUsage} onChange={(v) => setPrefs({ shareUsage: v })} />
        <Row icon="shield" label={s.privacy} chevron onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => Linking.openURL(PRIVACY_URL))} />
        <Row icon="doc" label={s.terms} chevron onPress={() => router.push("/terms")} />
      </Card>

      <Card style={{ padding: 8 }}>
        <Row
          icon="refresh"
          label={s.reset}
          danger
          onPress={() => {
            cue("gentle-no");
            setSheet("reset");
          }}
        />
      </Card>

      <T role="small" color="textMuted" center>
        {s.version(Constants.expoConfig?.version ?? "0.4.0")}
      </T>

      <Sheet visible={sheet === "coach"} onClose={() => setSheet(null)}>
        <T role="heading" center>
          {copy.coach.title}
        </T>
        <CoachPicker value={prefs.coach ?? "meera"} onChange={(id) => setPrefs({ coach: id })} />
      </Sheet>

      <Sheet visible={sheet === "reset"} onClose={() => setSheet(null)}>
        <Cody animation="sad-soft" size={110} />
        <T role="heading" header center>
          {s.resetTitle}
        </T>
        <T role="body" color="textMuted" center>
          {s.resetBody}
        </T>
        <Button
          title={s.resetConfirm}
          variant="danger"
          onPress={async () => {
            if (account) await signOut();
            await resetThisDevice();
            setSheet(null);
            router.replace("/");
          }}
        />
        <Button title={s.resetCancel} variant="ghost" onPress={() => setSheet(null)} />
      </Sheet>

      <Sheet visible={sheet === "delete"} onClose={() => setSheet(null)}>
        <Cody animation="thinking" size={110} />
        <T role="heading" header center>
          {s.deleteTitle}
        </T>
        <T role="body" color="textMuted" center>
          {s.deleteBody}
        </T>
        <Button
          title={s.deleteConfirm}
          icon="trash"
          variant="danger"
          loading={deleting}
          onPress={async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              setSheet(null);
              toast(s.deleted);
              router.replace("/today");
            } catch {
              toast(copy.auth.errors.offline);
            } finally {
              setDeleting(false);
            }
          }}
        />
        <Button title={s.deleteCancel} variant="ghost" onPress={() => setSheet(null)} />
      </Sheet>

      <Sheet visible={sheet === "news"} onClose={() => setSheet(null)}>
        <Cody animation="celebrate" size={110} />
        <T role="heading" header center>
          {s.whatsNew}
        </T>
        <View style={{ alignSelf: "stretch", gap: 6 }}>
          {s.whatsNewBody.map((line) => (
            <T key={line} role="body">
              {`•  ${line}`}
            </T>
          ))}
        </View>
        <Button title={copy.lesson.next} onPress={() => setSheet(null)} />
      </Sheet>
      <FeedbackSheet visible={sheet === "feedback"} onClose={() => setSheet(null)} />
      <SupportSheet visible={sheet === "support"} onClose={() => setSheet(null)} />
    </Page>
  );
}
