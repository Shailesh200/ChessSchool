"use client";

import { ApiError, copy, dayKey, rankFor, visibleStreak, type AvatarId, type ClassMember, type ClassRoom } from "@chessschool/design";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, Card, Sheet, TextField, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

export default function ClassPage() {
  const { state, ready, cue } = useApp();
  const toast = useToast();
  const [rooms, setRooms] = useState<ClassRoom[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<{ room: ClassRoom; member: ClassMember } | null>(null);
  const [confirm, setConfirm] = useState<"block" | "remove" | null>(null);
  const t = copy.classroom;
  const closeCard = () => {
    setOpen(null);
    setConfirm(null);
  };

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
                      <button type="button" className="member-row" disabled={m.id === state.account?.id} onClick={() => setOpen({ room, member: m })}>
                        <MemberFace id={m.avatar} size={40} />
                        <span className="row-text">
                          <span className="row-label">{m.name || copy.you.noName}</span>
                          <span className="row-hint">{m.role === "monitor" ? t.monitor : t.student}</span>
                        </span>
                        {m.id === state.account?.id ? null : <Icon name="chevron" />}
                      </button>
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
          <Sheet open={Boolean(open)} onClose={closeCard} labelledBy="member-title">
            {open ? (
              <MemberCard
                room={open.room}
                member={open.member}
                confirm={confirm}
                busy={busy}
                onConfirm={setConfirm}
                onBlock={() => void run(async () => { await api.blockMember(open.room.id, open.member.id); closeCard(); }, t.blocked)}
                onRemove={() => void run(async () => { await api.removeMember(open.room.id, open.member.id); closeCard(); }, t.removed)}
              />
            ) : null}
          </Sheet>
          <Link href="/login" className="link-muted">
            {copy.you.saveCard.login}
          </Link>
        </>
      )}
    </div>
  );
}

function MemberFace({ id, size }: { id: AvatarId; size: number }) {
  return (
    <span className="member-face" style={{ width: size, height: size }} aria-hidden>
      {id === "cody" ? <Cody animation="idle" size={size - 6} /> : <img src={`/coaches/${id}.png`} alt="" width={size} height={size} />}
    </span>
  );
}

function MemberCard({ room, member, confirm, busy, onConfirm, onBlock, onRemove }: {
  room: ClassRoom;
  member: ClassMember;
  confirm: "block" | "remove" | null;
  busy: boolean;
  onConfirm: (v: "block" | "remove" | null) => void;
  onBlock: () => void;
  onRemove: () => void;
}) {
  const t = copy.classroom;
  const name = member.name || copy.you.noName;
  if (confirm) {
    return (
      <>
        <h2 id="member-title">{confirm === "block" ? t.blockTitle(name) : t.removeTitle(name)}</h2>
        <p>{confirm === "block" ? t.blockBody : t.removeBody}</p>
        <Button block variant="danger" loading={busy} onClick={confirm === "block" ? onBlock : onRemove}>
          {confirm === "block" ? t.block : t.remove}
        </Button>
        <Button block variant="ghost" onClick={() => onConfirm(null)}>
          {t.cancel}
        </Button>
      </>
    );
  }
  const stats = [
    { value: String(member.lessons), label: t.stats.lessons },
    { value: String(visibleStreak(member.streak, dayKey(new Date()))), label: t.stats.streak },
    { value: copy.ranks[rankFor(member.xp).rank], label: t.stats.rank },
  ];
  const report = `/class/report?class=${encodeURIComponent(room.id)}&member=${encodeURIComponent(member.id)}&name=${encodeURIComponent(name)}`;
  return (
    <>
      <MemberFace id={member.avatar} size={84} />
      <h2 id="member-title">{name}</h2>
      <p className="muted">
        {member.role === "monitor" ? t.monitor : t.student} · {t.joinedOn(new Date(member.joinedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}
      </p>
      <div className="member-stats">
        {stats.map((st) => (
          <div key={st.label} className="stat">
            <strong>{st.value}</strong>
            <span>{st.label}</span>
          </div>
        ))}
      </div>
      <div className="member-actions">
        <Button variant="secondary" icon="flag" href={report}>
          {t.report}
        </Button>
        <Button variant="secondary" icon="block" onClick={() => onConfirm("block")}>
          {t.block}
        </Button>
      </div>
      {room.role === "monitor" ? (
        <Button block variant="danger" onClick={() => onConfirm("remove")}>
          {t.remove}
        </Button>
      ) : null}
    </>
  );
}
