"use client";

import { AVATARS, copy, weekCard, type AvatarId } from "@chessschool/design";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { ShareCardButton } from "@/components/ShareCard";
import { Button, Card, Sheet, TextField, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

type Child = { id: string; name: string; avatar: AvatarId };

const Face = ({ id, size }: { id: AvatarId; size: number }) => (
  <span className="member-face" style={{ width: size, height: size }} aria-hidden>
    {id === "cody" ? <Cody animation="idle" size={size - 6} /> : <img src={`/coaches/${id}.png`} alt="" width={size} height={size} />}
  </span>
);

/** Children on this account: switch who is learning, add or remove a child, and the parent PIN. */
export default function LearnersPage() {
  const { state, ready, switchLearner, forgetLearner, setParentPin, cue } = useApp();
  const toast = useToast();
  const t = copy.learners;
  const [kids, setKids] = useState<Child[]>([]);
  const [sheet, setSheet] = useState<null | "add" | "pin" | { remove: Child }>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>("kira");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const account = state.account;

  useEffect(() => {
    if (account) api.children().then((r) => setKids(r.children)).catch(() => {});
  }, [account]);

  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  if (!account) {
    return (
      <div className="page page-narrow">
        <TopBar title={t.title} backHref="/you" />
        <p className="page-lead">{t.needAccount}</p>
      </div>
    );
  }

  const main = state.activeChild ? state.parked.main?.profile : state.profile;
  const rows: { id: string | null; name: string; avatar: AvatarId; child?: Child }[] = [
    { id: null, name: main?.name || t.you, avatar: main?.avatar ?? "cody" },
    ...kids.map((k) => ({ id: k.id, name: k.name, avatar: k.avatar, child: k })),
  ];

  const add = async () => {
    setBusy(true);
    try {
      const { child } = await api.addChild(name.trim(), avatar);
      setKids((k) => [...k, child]);
      setSheet(null);
      setName("");
      await switchLearner(child);
      cue("success");
      toast(t.added(child.name));
    } catch {
      toast(t.limit);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow">
      <TopBar title={t.title} backHref="/you" />
      <Card className="list">
        {rows.map((r) => {
          const on = (state.activeChild ?? null) === r.id;
          return (
            <div key={r.id ?? "main"} className="learner-row">
              <button
                type="button"
                className={`member-row${on ? " is-active" : ""}`}
                aria-pressed={on}
                aria-label={on ? `${r.name}, ${t.active}` : t.switchTo(r.name)}
                disabled={on}
                onClick={() => {
                  void switchLearner(r.child ?? null);
                  cue("tap");
                  toast(t.switched(r.name));
                }}
              >
                <Face id={r.avatar} size={44} />
                <span className="row-text">
                  <span className="row-label">{r.id ? r.name : `${r.name} · ${t.you}`}</span>
                  {on ? <span className="row-hint">{t.active}</span> : null}
                </span>
                {on ? <Icon name="check" /> : null}
              </button>
              {r.child ? (
                <button type="button" className="icon-btn" aria-label={`${t.remove} ${r.name}`} onClick={() => setSheet({ remove: r.child! })}>
                  <Icon name="trash" />
                </button>
              ) : null}
            </div>
          );
        })}
        {kids.length < 5 ? (
          <button type="button" className="row" onClick={() => setSheet("add")}>
            <Icon name="profile" />
            <span className="row-text">
              <span className="row-label">{t.add}</span>
            </span>
            <Icon name="chevron" />
          </button>
        ) : null}
      </Card>

      {/* This week's progress of the learner who is active now, as a card a parent can forward. */}
      <ShareCardButton block kind="weekly" data={weekCard(state.progress, new Date())} label={copy.share.weeklyAction} />

      <Card className="list">
        <button type="button" className="row" onClick={() => (setPin(""), setSheet("pin"))}>
          <Icon name="lock" />
          <span className="row-text">
            <span className="row-label">{t.pin}</span>
            <span className="row-hint">{t.pinHint}</span>
          </span>
          <Icon name="chevron" />
        </button>
      </Card>

      <Sheet open={sheet === "add"} onClose={() => setSheet(null)} labelledBy="add-title">
        <h2 id="add-title">{t.addTitle}</h2>
        <TextField label={t.name} placeholder={t.namePlaceholder} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <div className="choices" role="radiogroup" aria-label={copy.you.avatar}>
          {AVATARS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={avatar === id} className="choice" onClick={() => setAvatar(id)}>
              <Face id={id} size={40} />
              <span>{id === "cody" ? "Cody" : id[0].toUpperCase() + id.slice(1)}</span>
              {avatar === id ? <Icon name="check" /> : null}
            </button>
          ))}
        </div>
        <Button block disabled={!name.trim() || busy} loading={busy} onClick={() => void add()}>
          {t.save}
        </Button>
      </Sheet>

      <Sheet open={sheet === "pin"} onClose={() => setSheet(null)} labelledBy="pin-title">
        <h2 id="pin-title">{t.pin}</h2>
        <TextField label={t.pinLabel} value={pin} inputMode="numeric" type="password" maxLength={4} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        <Button
          block
          disabled={pin.length !== 4}
          onClick={() => {
            setParentPin(pin);
            setSheet(null);
            toast(t.pinSaved);
          }}
        >
          {t.pinSet}
        </Button>
        {state.parentPin ? (
          <Button
            block
            variant="ghost"
            onClick={() => {
              setParentPin(null);
              setSheet(null);
              toast(t.pinRemoved);
            }}
          >
            {t.pinRemove}
          </Button>
        ) : null}
      </Sheet>

      <Sheet open={typeof sheet === "object" && sheet !== null} onClose={() => setSheet(null)} labelledBy="remove-title">
        {typeof sheet === "object" && sheet !== null ? (
          <>
            <h2 id="remove-title">{t.removeTitle(sheet.remove.name)}</h2>
            <p>{t.removeBody}</p>
            <Button
              block
              variant="danger"
              loading={busy}
              onClick={async () => {
                const kid = sheet.remove;
                setBusy(true);
                try {
                  await api.removeChild(kid.id);
                  forgetLearner(kid.id);
                  setKids((k) => k.filter((x) => x.id !== kid.id));
                  setSheet(null);
                  toast(t.removed);
                } catch {
                  toast(copy.auth.errors.generic);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t.remove}
            </Button>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}
