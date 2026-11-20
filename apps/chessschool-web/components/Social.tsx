"use client";

import { copy, errorMessage, SUPPORT_TOPICS, validEmail, type InviteInfo, type MyDetails, type SupportTopic } from "@chessschool/design";
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

/** Profile: your friend code and link, and a field to add a friend by theirs. Friends made this way are friends both ways. */
export function FriendCodeCard() {
  const { state, ready, cue } = useApp();
  const toast = useToast();
  const t = copy.social;
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const on = ready && Boolean(state.account) && !state.activeChild;
  useEffect(() => {
    if (on) api.myInvite().then(setInfo, () => {});
  }, [on]);
  if (!on) return null;
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Card className="friend-code">
      <h2 className="card-title">{t.yourCode}</h2>
      {info ? (
        <>
          <p className="friend-code-value">{info.code}</p>
          <p className="muted">{t.yourCodeHint}</p>
          <div className="friend-code-actions">
            <Button variant="secondary" onClick={async () => toast((await shareLink(t.shareCodeText, info.url)) === "copied" ? t.copied : t.shareCode)}>
              {t.shareCode}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                navigator.clipboard.writeText(info.code).then(
                  () => toast(t.copied),
                  () => {},
                )
              }
            >
              {t.copyCode}
            </Button>
          </div>
        </>
      ) : null}
      <form onSubmit={add} className="friend-code-form">
        <TextField label={t.friendCode} hint={t.friendCodeHint} placeholder={t.friendCodePlaceholder} value={code} onChange={(e) => (setCode(e.target.value), setError(null))} error={error} autoCapitalize="none" autoCorrect="off" maxLength={12} />
        <Button type="submit" disabled={!code.trim()} loading={busy}>
          {t.friendCodeAdd}
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

/** "Download my data": everything stored for the account as a .json file. */
export async function downloadMyData(): Promise<void> {
  const data = await api.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `chessschool-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
