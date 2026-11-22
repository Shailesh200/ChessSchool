"use client";

import { copy, errorMessage, normalizeUsername, SUPPORT_TOPICS, USERNAME_MAX, usernameProblem, validEmail, type InviteInfo, type MyDetails, type SupportTopic, type UsernameProblem } from "@chessschool/design";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";
import { Button, Card, Sheet, TextField, useToast } from "./ui";

export const WEB_VERSION = "0.4.0";

/** CSS colour for a banner id (palette key → --cs-kebab-case). */
export const bannerVar = (id: string | null) => `var(--cs-${(id ?? "brand").replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)})`;

/** The signed-in account's profile details and photo; null while loading or signed out. */
export function useMyDetails() {
  const { state, ready } = useApp();
  const [mine, setMine] = useState<MyDetails | null>(null);
  const on = ready && Boolean(state.account);
  const reload = useCallback(() => {
    if (on) api.myDetails().then(setMine, () => {});
  }, [on]);
  useEffect(reload, [reload]);
  return { mine: on ? mine : null, setMine, reload };
}

/** Crops the centre square of an image file and returns a 512px JPEG as base64 (no data: prefix), so uploads stay small. */
export async function squareJpeg(file: File, side = 512): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const s = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(side, s);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, out, out);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "";
}

/** Why a username can't be used, in the app language (null while it is fine or still being checked). */
export const usernameError = (problem: UsernameProblem | null) => (problem ? copy.social.usernameProblems[problem] : null);

/** "ok", "checking" or the problem with `value` as this account's username (local rules, then the server after a pause). */
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

/** A username box with a live availability check. */
export function UsernameField({ value, onChange, current, label = copy.social.username, hint, error }: { value: string; onChange: (v: string) => void; current: string | null; label?: string; hint?: string; error?: string | null }) {
  const status = useUsernameStatus(value, current);
  const t = copy.social;
  return (
    <TextField
      label={label}
      hint={status === "checking" ? t.usernameChecking : status === "ok" && normalizeUsername(value) !== current ? t.usernameFree : (hint ?? t.usernameRules)}
      error={error ?? (status !== "ok" && status !== "checking" ? usernameError(status) : null)}
      placeholder={t.usernamePlaceholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\s/g, "").slice(0, USERNAME_MAX + 1))}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      maxLength={USERNAME_MAX + 1}
    />
  );
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
  const { state, ready, cue, update } = useApp();
  const toast = useToast();
  const t = copy.social;
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = state.account?.username ?? null;
  const [pick, setPick] = useState(mine ?? "");
  const pickStatus = useUsernameStatus(pick, mine);
  const on = ready && Boolean(state.account) && !state.activeChild;
  useEffect(() => {
    if (on) api.myInvite().then(setInfo, () => {});
  }, [on]);
  useEffect(() => setPick(mine ?? ""), [mine]);
  if (!on) return null;
  const skip = () => update((s) => ({ ...s, usernameAsked: true }));

  const savePick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (normalizeUsername(pick) === mine) return skip();
    setBusy(true);
    const r = await saveUsername(pick);
    setBusy(false);
    if ("username" in r) {
      update((s) => (s.account ? { ...s, account: { ...s.account, username: r.username }, usernameAsked: true } : s));
      cue("success");
      toast(t.usernameSaved(r.username));
    } else {
      cue("gentle-no");
      setError(usernameError(r.problem) ?? copy.auth.errors.offline);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
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

  if (!state.usernameAsked && mine) {
    return (
      <Card className="friend-code">
        <h2 className="card-title">{t.pickTitle}</h2>
        <p className="muted">{t.pickBody}</p>
        <form onSubmit={savePick} className="friend-code-form">
          <UsernameField value={pick} onChange={(v) => (setPick(v), setError(null))} current={mine} error={error} />
          <div className="friend-code-actions">
            <Button type="submit" loading={busy} disabled={pickStatus !== "ok"}>
              {t.pickSave}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={skip}>
              {t.pickSkip}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="friend-code">
      <h2 className="card-title">{t.yourUsername}</h2>
      {mine ? <p className="friend-code-value">{t.at(mine)}</p> : null}
      <p className="muted">{t.yourUsernameHint}</p>
      <div className="friend-code-actions">
        {info ? (
          <Button variant="secondary" onClick={async () => toast((await shareLink(t.shareCodeText, info.url)) === "copied" ? t.copied : t.shareCode)}>
            {t.shareCode}
          </Button>
        ) : null}
        {mine ? (
          <Button
            variant="ghost"
            onClick={() =>
              navigator.clipboard.writeText(t.at(mine)).then(
                () => toast(t.copied),
                () => {},
              )
            }
          >
            {t.copyUsername}
          </Button>
        ) : null}
      </div>
      <form onSubmit={add} className="friend-code-form">
        <TextField label={t.addByUsername} hint={t.addByUsernameHint} placeholder={t.usernamePlaceholder} value={name} onChange={(e) => (setName(e.target.value.replace(/\s/g, "")), setError(null))} error={error} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={USERNAME_MAX + 1} />
        <Button type="submit" disabled={!name.trim()} loading={busy}>
          {t.usernameAdd}
        </Button>
      </form>
    </Card>
  );
}

/** "Contact us / Report a problem": goes to the API with the app version and platform, and on to the team by email. */
export function SupportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, cue } = useApp();
  const toast = useToast();
  const t = copy.support;
  const [topic, setTopic] = useState<SupportTopic>("problem");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (message.trim().length < 10) return setError(t.tooShort);
    if (!state.account && !validEmail(email)) return setError(t.emailBad);
    setBusy(true);
    try {
      await api.support({ topic, message: message.trim(), email: state.account ? undefined : email.trim(), platform: "web", version: WEB_VERSION, guestId: state.guestId });
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
    <Sheet open={open} onClose={onClose} labelledBy="support-title">
      <h2 id="support-title">{t.title}</h2>
      <p>{t.body}</p>
      <div className="seg" role="radiogroup" aria-label={t.topic}>
        {SUPPORT_TOPICS.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={topic === id} onClick={() => setTopic(id)}>
            {t.topics[id]}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="sr-only">{t.message}</span>
        <textarea className="textarea" rows={5} maxLength={4000} value={message} placeholder={t.placeholder} onChange={(e) => (setMessage(e.target.value), setError(null))} aria-invalid={Boolean(error) || undefined} />
      </label>
      {state.account ? null : <TextField label={t.email} type="email" placeholder={t.emailPlaceholder} value={email} onChange={(e) => (setEmail(e.target.value), setError(null))} autoComplete="email" />}
      <p className="muted small">{t.includes(WEB_VERSION, "web")}</p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button block icon="mail" loading={busy} onClick={send}>
        {t.send}
      </Button>
    </Sheet>
  );
}

