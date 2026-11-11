"use client";

import { ApiError, copy, type ClassRoom } from "@chessschool/design";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, TextField, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

export default function ClassPage() {
  const { state, ready, cue } = useApp();
  const toast = useToast();
  const [rooms, setRooms] = useState<ClassRoom[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const t = copy.classroom;

  const load = () => {
    if (!state.account) return;
    api.classes().then((r) => setRooms(r.classes)).catch(() => {});
  };
  useEffect(() => {
    load();
    // Reloads when the account appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.account]);

  if (!ready) return <div className="page-skeleton" aria-busy="true" />;

  const run = async (work: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await work();
      cue("success");
      toast(ok);
      load();
    } catch (err) {
      cue("gentle-no");
      toast(err instanceof ApiError && err.code === "not_found" ? t.invalid : copy.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow">
      <TopBar title={t.title} backHref="/you" />
      <p className="page-lead">{state.account ? t.body : t.needAccount}</p>
      {!state.account ? (
        <Button href="/signup" block>
          {copy.you.saveCard.cta}
        </Button>
      ) : (
        <>
          {rooms.length ? (
            rooms.map((room) => (
              <Card key={room.id}>
                <h2 className="card-title">{room.name}</h2>
                <p className="muted">
                  {room.role === "monitor" ? t.monitor : t.student} · {t.members(room.members.length)}
                </p>
                <p className="class-code">{room.code}</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const link = `https://api.chess-school.in/join/${room.code}`;
                    void navigator.share?.({ title: room.name, text: room.name, url: link }).catch(() => navigator.clipboard.writeText(link));
                  }}
                >
                  {t.link}
                </Button>
                <ul className="class-members">
                  {room.members.map((m) => (
                    <li key={m.id}>
                      {m.name || copy.you.noName} · {m.role === "monitor" ? t.monitor : t.student}
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" disabled={busy} onClick={() => void run(async () => { await api.leaveClass(room.id); }, room.role === "monitor" ? t.closed : t.left)}>
                  {room.role === "monitor" ? t.close : t.leave}
                </Button>
              </Card>
            ))
          ) : (
            <p className="muted">{t.empty}</p>
          )}
          <Card>
            <TextField label={t.name} placeholder={t.namePlaceholder} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            <Button block disabled={busy || !name.trim()} onClick={() => void run(async () => { await api.createClass(name.trim(), "web"); setName(""); }, t.created)}>
              {t.create}
            </Button>
          </Card>
          <Card>
            <TextField label={t.code} placeholder="AB12CD" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <Button block variant="secondary" disabled={busy || code.trim().length < 6} onClick={() => void run(async () => { await api.joinClass(code.trim()); setCode(""); }, t.joined)}>
              {t.join}
            </Button>
          </Card>
          <Link href="/login" className="link-muted">
            {copy.you.saveCard.login}
          </Link>
        </>
      )}
    </div>
  );
}
