"use client";

import { REMINDER_HOURS, copy, PRIVACY_URL, type Appearance } from "@chessschool/design";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { Cody } from "@/components/Lottie";
import { Button, Card, Segmented, Sheet, Switch, TopBar, useToast, SaveBanner } from "@/components/ui";
import { api } from "@/lib/api";
import { notificationsSupported, requestNotifications } from "@/lib/notifications";
import { useApp } from "@/lib/state";

export default function SettingsPage() {
  const { state, ready, setPrefs, signOut, resetThisDevice, deleteAccount, cue } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "reset" | "delete" | "feedback" | "news">(null);
  const [deleting, setDeleting] = useState(false);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;

  const { prefs, account } = state;
  const s = copy.settings;
  const notifOn = prefs.notifications === "granted";
  const notifHint = !notificationsSupported() ? s.notificationsUnsupported : prefs.notifications === "denied" ? s.notificationsDenied : s.notificationsHint;


  return (
    <div className="page page-narrow">
      <TopBar title={s.title} backHref="/you" />

      <Card className="list">
        <Link className="row" href="/settings/looks">
          <Icon name="palette" />
          <span className="row-text">
            <span className="row-label">{s.looks}</span>
            <span className="row-hint">{s.looksHint}</span>
          </span>
          <Icon name="chevron" />
        </Link>
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
            <button
              className="row"
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
            <button className="row" onClick={() => setSheet("delete")}>
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
        <button className="row" onClick={() => setSheet("news")}>
          <Icon name="sparkles" />
          <span className="row-text">
            <span className="row-label">{s.whatsNew}</span>
          </span>
          <Icon name="chevron" />
        </button>
      </Card>

      <Card className="list" aria-labelledby="legal-h">
        <h2 id="legal-h" className="card-title list-title">
          {s.legal}
        </h2>
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
            router.replace("/welcome");
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
    </div>
  );
}
