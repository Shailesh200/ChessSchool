"use client";

import { copy, dayKey, errorMessage, type AvatarId, type ClassGame, type ClassRoom, type Course, type Homework, type Tournament } from "@chessschool/design";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button, Segmented, Sheet, useToast } from "./ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

const DUE_DAYS = [1, 3, 7, 14] as const;
const dueLabel = (due: string) => new Date(`${due}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
/** 1.5 → "1½", 0.5 → "½". */
const pointsLabel = (p: number) => (p % 1 ? `${Math.floor(p) || ""}½` : String(p));
export const gameHref = (classId: string, id: string) => `/class/game?class=${encodeURIComponent(classId)}&id=${encodeURIComponent(id)}`;

/** A learner's face: their uploaded photo when there is one (and it loads), else the preset avatar. */
export function MemberFace({ id, size, photo }: { id: AvatarId; size: number; photo?: string | null }) {
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <span className="member-face" style={{ width: size, height: size }} aria-hidden>
      {photo && broken !== photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" width={size} height={size} onError={() => setBroken(photo)} />
      ) : id === "cody" ? <Cody animation="idle" size={size - 6} /> : <img src={`/coaches/${id}.png`} alt="" width={size} height={size} />}
    </span>
  );
}

/** One line for a game: whose turn it is, or how it ended. */
export function gameStatus(g: ClassGame): string {
  const t = copy.classroom.games;
  if (g.status === "active") return g.yourTurn ? t.yourTurn : t.theirTurn((g.moves.length % 2 ? g.black : g.white).name);
  const verdict = g.result === "1/2-1/2" ? t.drawn : !g.you ? (g.result ?? "") : (g.result === "1-0") === (g.you === "w") ? t.won : t.lost;
  return g.reason ? `${verdict} · ${t.reasons[g.reason]}` : verdict;
}

function useRun() {
  const { cue } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await work();
      cue("success");
      toast(ok);
    } catch (err) {
      cue("gentle-no");
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** Pick-many list built on the shared choice style. */
function PickList({ items, picked, max, onChange }: { items: { id: string; label: string; group?: string }[]; picked: string[]; max: number; onChange: (next: string[]) => void }) {
  return (
    <div className="pick-list">
      {items.map((it, i) => (
        <div key={it.id} className="pick-item">
          {it.group && it.group !== items[i - 1]?.group ? <h4 className="row-hint">{it.group}</h4> : null}
          <button
            type="button"
            role="checkbox"
            aria-checked={picked.includes(it.id)}
            className="choice"
            onClick={() => onChange(picked.includes(it.id) ? picked.filter((x) => x !== it.id) : picked.length < max ? [...picked, it.id] : picked)}
          >
            <span>{it.label}</span>
            {picked.includes(it.id) ? <Icon name="check" /> : null}
          </button>
        </div>
      ))}
    </div>
  );
}

/** Homework the monitor set: students start each lesson, the monitor sees who is done. */
export function HomeworkSection({ room, course, refresh }: { room: ClassRoom; course: Course | null; refresh: number }) {
  const { state } = useApp();
  const t = copy.classroom.homework;
  const { busy, run } = useRun();
  const [list, setList] = useState<Homework[]>([]);
  const [n, setN] = useState(0);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState<(typeof DUE_DAYS)[number]>(7);
  const monitor = room.role === "monitor";
  const title = (id: string) => course?.lessons.find((l) => l.id === id)?.title ?? id;
  useEffect(() => {
    let live = true;
    api.homework(room.id).then((r) => live && setList(r.homework)).catch(() => {});
    return () => {
      live = false;
    };
  }, [room.id, refresh, n]);
  if (!monitor && !list.length) return null;
  const units = new Map((course?.units ?? []).map((u) => [u.id, u.title]));
  return (
    <section className="class-section" aria-label={t.title}>
      <h3 className="row-label">{t.title}</h3>
      {list.length ? null : <p className="muted">{t.empty}</p>}
      {list.map((h) => (
        <div key={h.id} className="class-item">
          <div className="class-item-head">
            <strong>{t.dueOn(dueLabel(h.due))}</strong>
            <span className="muted">{t.finished(h.members.filter((m) => m.done).length, h.members.length)}</span>
          </div>
          {monitor ? (
            <>
              <p>{h.lessons.map(title).join(", ")}</p>
              {h.members.map((m) => (
                <div key={m.id} className="class-line">
                  <MemberFace id={m.avatar} size={28} />
                  <span className="class-line-name">{m.name}</span>
                  <span className={`badge${m.done ? " badge-member" : ""}`}>{m.done ? t.done : t.notDone}</span>
                </div>
              ))}
              <Button variant="ghost" disabled={busy} onClick={() => void run(async () => { await api.deleteHomework(room.id, h.id); setN((x) => x + 1); }, t.removed)}>
                {t.remove}
              </Button>
            </>
          ) : (
            h.lessons.map((id) => (
              <div key={id} className="class-line">
                <span className="class-line-name">{title(id)}</span>
                {state.progress.completed[id] ? (
                  <span className="badge badge-member">{t.done}</span>
                ) : (
                  <Button href={`/lesson/${id}`}>{t.start}</Button>
                )}
              </div>
            ))
          )}
        </div>
      ))}
      {monitor ? (
        <Button variant="secondary" icon="edit" onClick={() => setAdding(true)}>
          {t.set}
        </Button>
      ) : null}
      <Sheet open={adding} onClose={() => setAdding(false)} labelledBy={`hw-${room.id}`}>
        <h2 id={`hw-${room.id}`}>{t.set}</h2>
        <Segmented label={t.due} value={days} onChange={setDays} options={DUE_DAYS.map((d) => ({ value: d, label: t.dueIn[d] }))} />
        <p className="muted">{t.pickLessons}</p>
        <PickList items={(course?.lessons ?? []).map((l) => ({ id: l.id, label: l.title, group: units.get(l.unit) }))} picked={picked} max={10} onChange={setPicked} />
        <Button
          block
          loading={busy}
          disabled={!picked.length}
          onClick={() =>
            void run(async () => {
              await api.setHomework(room.id, { lessons: picked, due: dayKey(new Date(Date.now() + days * 86_400_000)) });
              setPicked([]);
              setAdding(false);
              setN((x) => x + 1);
            }, t.saved)
          }
        >
          {t.save(picked.length)}
        </Button>
      </Sheet>
    </section>
  );
}

/** My games in this class, the ones waiting on me first. */
export function GamesSection({ room, refresh }: { room: ClassRoom; refresh: number }) {
  const t = copy.classroom.games;
  const [games, setGames] = useState<ClassGame[] | null>(null);
  useEffect(() => {
    let live = true;
    api.classGames(room.id).then((r) => live && setGames(r.games)).catch(() => {});
    return () => {
      live = false;
    };
  }, [room.id, refresh]);
  if (!games) return null;
  return (
    <section className="class-section" aria-label={t.title}>
      <h3 className="row-label">{t.title}</h3>
      {games.length ? (
        <ul className="class-members">
          {games.map((g) => {
            const them = g.you === "b" ? g.white : g.black;
            return (
              <li key={g.id}>
                <Link href={gameHref(room.id, g.id)} className="member-row">
                  <MemberFace id={them.avatar} photo={them.photo} size={40} />
                  <span className="row-text">
                    <span className="row-label">{t.vs(them.name)}</span>
                    <span className="row-hint">
                      {g.tournamentId ? `${t.tournament} · ` : ""}
                      {g.yourTurn ? copy.gym.moveCount(Math.ceil(g.moves.length / 2)) : gameStatus(g)}
                    </span>
                  </span>
                  {g.yourTurn ? <span className="badge badge-brand">{t.yourTurn}</span> : <Icon name="chevron" />}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">{t.empty}</p>
      )}
    </section>
  );
}

/** Round robins in this class with their standings; the monitor can start one. */
export function TournamentSection({ room, refresh, onStarted }: { room: ClassRoom; refresh: number; onStarted: () => void }) {
  const t = copy.classroom.tournament;
  const { busy, run } = useRun();
  const [list, setList] = useState<Tournament[]>([]);
  const [n, setN] = useState(0);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    api.tournaments(room.id).then((r) => live && setList(r.tournaments)).catch(() => {});
    return () => {
      live = false;
    };
  }, [room.id, refresh, n]);
  const monitor = room.role === "monitor";
  if (!monitor && !list.length) return null;
  return (
    <section className="class-section" aria-label={t.title}>
      <h3 className="row-label">{t.title}</h3>
      {list.map((tour) => (
        <div key={tour.id} className="class-item">
          <span className="muted">{t.progress(tour.done, tour.total)}</span>
          <table className="standings">
            <thead>
              <tr>
                <th scope="col" colSpan={2}>
                  {t.player}
                </th>
                <th scope="col">{t.played}</th>
                <th scope="col">{t.points}</th>
              </tr>
            </thead>
            <tbody>
              {tour.standings.map((s, i) => (
                <tr key={s.id}>
                  <td className="muted">{i + 1}</td>
                  <td>
                    <span className="class-line">
                      <MemberFace id={s.avatar} size={28} />
                      <span className="class-line-name">{s.name}</span>
                    </span>
                  </td>
                  <td>{s.played}</td>
                  <td>
                    <strong>{pointsLabel(s.points)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {monitor ? (
        <Button variant="secondary" icon="trophy" onClick={() => setAdding(true)}>
          {t.start}
        </Button>
      ) : null}
      <Sheet open={adding} onClose={() => setAdding(false)} labelledBy={`tour-${room.id}`}>
        <h2 id={`tour-${room.id}`}>{t.start}</h2>
        <p className="muted">{t.body}</p>
        <p className="muted">{t.pick}</p>
        <PickList items={room.members.map((m) => ({ id: m.id, label: m.name || copy.you.noName }))} picked={picked} max={8} onChange={setPicked} />
        <Button
          block
          icon="trophy"
          loading={busy}
          disabled={picked.length < 3}
          onClick={() =>
            void run(async () => {
              await api.startTournament(room.id, picked);
              setPicked([]);
              setAdding(false);
              setN((x) => x + 1);
              onStarted();
            }, t.started)
          }
        >
          {t.send(picked.length)}
        </Button>
      </Sheet>
    </section>
  );
}
