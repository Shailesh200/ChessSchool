"use client";

import { REMINDER_HOURS, aiBlocked, aiExplainOn, coachOf, copy, isChildProfile, setAiExplain, LANG_NAMES, LANGS, language, nextLessonIds, PRIVACY_URL, usualHour, VOICE_SPEEDS, type Appearance } from "@chessschool/design";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CoachPicker } from "@/components/CoachPicker";
import { Icon } from "@/components/Icon";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { downloadMyData, SupportSheet } from "@/components/Social";
import { Cody } from "@/components/Lottie";
import { Button, Card, Segmented, Sheet, Switch, TextField, TopBar, useToast, SaveBanner } from "@/components/ui";
import { api } from "@/lib/api";
import { saveLessonsOffline, useCourse } from "@/lib/course";
import { notificationsSupported, requestNotifications } from "@/lib/notifications";
import { useApp } from "@/lib/state";

export default function SettingsPage() {
  const { state, ready, setPrefs, signOut, resetThisDevice, deleteAccount, cue, update } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [weekly, setWeekly] = useState<boolean | null>(null);
  const [winback, setWinback] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pinTry, setPinTry] = useState("");
  useEffect(() => {
    if (state.account) api.weekly().then((w) => setWeekly(w.email || w.push)).catch(() => {});
    if (state.account) api.emailPrefs().then((e) => setWinback(e.eligible ? e.winback : null)).catch(() => {});
  }, [state.account]);
  const course = useCourse();
  const [sheet, setSheet] = useState<null | "reset" | "delete" | "feedback" | "news" | "coach" | "support">(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;

  const { prefs, account } = state;
  const s = copy.settings;
  const notifOn = prefs.notifications === "granted";
  const notifHint = !notificationsSupported() ? s.notificationsUnsupported : prefs.notifications === "denied" ? s.notificationsDenied : s.notificationsHint;


  if (state.parentPin && !unlocked) {
    return (
      <div className="page page-narrow">
        <TopBar title={s.title} backHref="/you" />
        <h2>{copy.learners.pinAsk}</h2>
        <TextField
          label={copy.learners.pinLabel}
          value={pinTry}
          inputMode="numeric"
          type="password"
          maxLength={4}
          error={pinTry.length === 4 && pinTry !== state.parentPin ? copy.learners.pinWrong : null}
          onChange={(e) => setPinTry(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        <Button block disabled={pinTry !== state.parentPin} onClick={() => setUnlocked(true)}>
          {copy.learners.unlock}
        </Button>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <TopBar title={s.title} backHref="/you" />

      <Card className="list" aria-labelledby="lang-h">
        <h2 id="lang-h" className="card-title list-title">
          {s.language}
        </h2>
        <div className="row-block">
          <Segmented label={s.language} value={language()} onChange={(lang) => setPrefs({ lang })} options={LANGS.map((l) => ({ value: l, label: LANG_NAMES[l] }))} />
        </div>
      </Card>

      <Card className="list" aria-labelledby="a11y-h">
        <h2 id="a11y-h" className="card-title list-title">
          {s.accessibility}
        </h2>
        <Switch icon="eye" label={s.easyFont} hint={s.easyFontHint} checked={prefs.easyFont} onChange={(v) => setPrefs({ easyFont: v })} />
        <Switch icon="snow" label={s.reduceMotion} hint={s.reduceMotionHint} checked={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} />
        <p className="row-hint row-block">{s.textSizeHint}</p>
      </Card>

      <Card className="list" aria-labelledby="coach-h">
        <h2 id="coach-h" className="card-title list-title">
          {copy.coach.title}
        </h2>
        <button type="button" className="row" onClick={() => setSheet("coach")}>
          <Icon name="profile" />
          <span className="row-text">
            <span className="row-label">{coachOf(prefs.coach ?? "meera").name}</span>
            <span className="row-hint">{copy.coach.hint}</span>
          </span>
          <Icon name="chevron" />
        </button>
        <Switch icon={prefs.voice ? "sound" : "mute"} label={copy.coach.voice} hint={copy.coach.voiceHint} checked={prefs.voice} onChange={(v) => setPrefs({ voice: v })} />
        {prefs.voice ? (
          <div className="row-block">
            <Segmented label={copy.coach.speed} value={prefs.voiceSpeed} onChange={(v) => setPrefs({ voiceSpeed: v })} options={VOICE_SPEEDS.map((v) => ({ value: v, label: copy.coach.speeds[v] }))} />
          </div>
        ) : null}
      </Card>

      <Card className="list">
        <Switch
          icon={prefs.sound ? "sound" : "mute"}
          label={s.sound}
          hint={s.soundHint}
          checked={prefs.sound}
          onChange={(v) => {
            setPrefs({ sound: v });
            if (v) cue("tap");
            if (account) api.updateMe({ sound: v }).catch(() => {});
          }}
        />
        <Switch
          icon="bell"
          label={s.notifications}
          hint={notifHint}
          checked={notifOn}
          disabled={!notificationsSupported() || prefs.notifications === "denied"}
          onChange={async (v) => {
            if (!v) return setPrefs({ notifications: "dismissed" });
            setPrefs({ notifications: await requestNotifications() });
          }}
        />
        {notifOn ? (
          <div className="row-block">
            <Segmented label={s.reminderTime} value={prefs.reminderHour} onChange={(h) => setPrefs({ reminderHour: h })} options={REMINDER_HOURS.map((h) => ({ value: h, label: s.reminderHour(h) }))} />
            <p className="row-hint">{s.notificationsWeb}</p>
            {usualHour(state) != null ? <p className="row-hint">{copy.streaks.reminderUsual(s.reminderHour(usualHour(state)!))}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card className="list" aria-labelledby="acct-h">
        <h2 id="acct-h" className="card-title list-title">
          {s.account}
        </h2>
        {account ? (
          <>
            <div className="row">
              <Icon name="mail" />
              <span className="row-text">
                <span className="row-label">{account.email}</span>
              </span>
            </div>
            {weekly !== null ? (
              <Switch
                icon="doc"
                label={s.weekly}
                hint={s.weeklyHint}
                checked={weekly}
                onChange={async (on) => {
                  setWeekly(on);
                  try {
                    await api.setWeekly({ email: on, pushToken: null, lang: language() });
                  } catch {
                    setWeekly(!on);
                    toast(copy.auth.errors.offline);
                  }
                }}
              />
            ) : null}
            {winback !== null && !isChildProfile(state) ? (
              <Switch
                icon="mail"
                label={copy.platform.emailSettings.winback}
                hint={copy.platform.emailSettings.winbackHint}
                checked={winback}
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
            <button
              className="row row-danger"
              onClick={async () => {
                await signOut();
                toast(s.signedOut);
                router.push("/today");
              }}
            >
              <Icon name="logout" />
              <span className="row-text">
                <span className="row-label">{s.signOut}</span>
              </span>
            </button>
            <Link className="row" href="/settings/blocked">
              <Icon name="block" />
              <span className="row-text">
                <span className="row-label">{copy.social.blockedTitle}</span>
                <span className="row-hint">{copy.social.blockedHint}</span>
              </span>
              <Icon name="chevron" />
            </Link>
            <button
              className="row"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadMyData();
                  toast(copy.dataExport.ready);
                } catch {
                  toast(copy.dataExport.failed);
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Icon name="doc" />
              <span className="row-text">
                <span className="row-label">{exporting ? copy.dataExport.working : copy.dataExport.open}</span>
                <span className="row-hint">{copy.dataExport.hint}</span>
              </span>
            </button>
            <button className="row row-danger" onClick={() => setSheet("delete")}>
              <Icon name="trash" />
              <span className="row-text">
                <span className="row-label">{s.deleteAccount}</span>
              </span>
              <Icon name="chevron" />
            </button>
          </>
        ) : (
          <div className="row-block">
            <SaveBanner title={copy.you.saveCard.title} />
          </div>
        )}
      </Card>

      <Card className="list" aria-labelledby="about-h">
        <h2 id="about-h" className="card-title list-title">
          {s.about}
        </h2>
        <button className="row" onClick={() => setSheet("feedback")}>
          <Icon name="chat" />
          <span className="row-text">
            <span className="row-label">{s.feedback}</span>
          </span>
          <Icon name="chevron" />
        </button>
        <button className="row" onClick={() => setSheet("support")}>
          <Icon name="mail" />
          <span className="row-text">
            <span className="row-label">{copy.support.open}</span>
          </span>
          <Icon name="chevron" />
        </button>
        <button className="row" onClick={() => setSheet("news")}>
          <Icon name="sparkles" />
          <span className="row-text">
            <span className="row-label">{s.whatsNew}</span>
          </span>
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          className="row"
          disabled={saving || !course}
          onClick={async () => {
            if (!course) return;
            setSaving(true);
            const n = await saveLessonsOffline(nextLessonIds(course, state.progress.completed));
            setSaving(false);
            toast(n ? s.offlineDone(n) : s.offlineNone);
          }}
        >
          <Icon name="wifiOff" />
          <span className="row-text">
            <span className="row-label">{saving ? s.offlineWorking : s.offline}</span>
            <span className="row-hint">{s.offlineHint}</span>
          </span>
        </button>
      </Card>

      <Card className="list" aria-labelledby="legal-h">
        <h2 id="legal-h" className="card-title list-title">
          {s.legal}
        </h2>
        <Switch icon="eye" label={s.shareUsage} hint={s.shareUsageHint} checked={prefs.shareUsage} onChange={(v) => setPrefs({ shareUsage: v })} />
        {/* A child's switch only works once a parent PIN guards this page. */}
        <Switch
          icon="spark"
          label={s.aiExplain}
          hint={aiBlocked(state) ? s.aiOff : isChildProfile(state) && !state.parentPin ? s.aiExplainNeedsPin : s.aiExplainHint}
          checked={aiExplainOn(state)}
          disabled={aiBlocked(state) || (isChildProfile(state) && !state.parentPin)}
          onChange={(v) => update((st) => setAiExplain(st, v))}
        />
        <a className="row" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="shield" />
          <span className="row-text">
            <span className="row-label">{s.privacy}</span>
          </span>
          <Icon name="chevron" />
        </a>
        <Link className="row" href="/terms">
          <Icon name="doc" />
          <span className="row-text">
            <span className="row-label">{s.terms}</span>
          </span>
          <Icon name="chevron" />
        </Link>
      </Card>

      <Card className="list">
        <button
          className="row row-danger"
          onClick={() => {
            setSheet("reset");
            cue("gentle-no");
          }}
        >
          <Icon name="refresh" />
          <span className="row-text">
            <span className="row-label">{s.reset}</span>
          </span>
        </button>
      </Card>

      <p className="version">{s.version("0.4.0")}</p>

      <Sheet open={sheet === "coach"} onClose={() => setSheet(null)} labelledBy="coach-title">
        <h2 id="coach-title">{copy.coach.title}</h2>
        <CoachPicker value={prefs.coach ?? "meera"} onChange={(id) => setPrefs({ coach: id })} />
      </Sheet>

      <Sheet open={sheet === "reset"} onClose={() => setSheet(null)} labelledBy="reset-title">
        <Cody animation="sad-soft" size={110} />
        <h2 id="reset-title">{s.resetTitle}</h2>
        <p>{s.resetBody}</p>
        <Button
          block
          variant="danger"
          onClick={async () => {
            if (account) await signOut();
            resetThisDevice();
            setSheet(null);
            router.replace("/");
          }}
        >
          {s.resetConfirm}
        </Button>
        <Button block variant="ghost" onClick={() => setSheet(null)}>
          {s.resetCancel}
        </Button>
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={() => setSheet(null)} labelledBy="delete-title">
        <Cody animation="thinking" size={110} />
        <h2 id="delete-title">{s.deleteTitle}</h2>
        <p>{s.deleteBody}</p>
        <Button
          block
          variant="danger"
          icon="trash"
          loading={deleting}
          onClick={async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              setSheet(null);
              toast(s.deleted);
              router.push("/today");
            } catch {
              toast(copy.auth.errors.offline);
            } finally {
              setDeleting(false);
            }
          }}
        >
          {s.deleteConfirm}
        </Button>
        <Button block variant="ghost" onClick={() => setSheet(null)}>
          {s.deleteCancel}
        </Button>
      </Sheet>

      <Sheet open={sheet === "news"} onClose={() => setSheet(null)} labelledBy="news-title">
        <Cody animation="celebrate" size={110} />
        <h2 id="news-title">{s.whatsNew}</h2>
        <ul className="news">
          {s.whatsNewBody.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Button block onClick={() => setSheet(null)}>
          {copy.lesson.next}
        </Button>
      </Sheet>
      <FeedbackSheet open={sheet === "feedback"} onClose={() => setSheet(null)} />
      <SupportSheet open={sheet === "support"} onClose={() => setSheet(null)} />
    </div>
  );
}
