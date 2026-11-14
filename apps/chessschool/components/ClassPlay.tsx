import { copy, dayKey, type ClassGame, type ClassRoom, type Course, type Homework, type Tournament } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { AvatarFace } from "./AvatarFace";
import { openLesson } from "./PathList";
import { Badge, Button, Choice, Segmented, Sheet, T, useToast } from "./ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

const DUE_DAYS = [1, 3, 7, 14] as const;
const dueLabel = (due: string) => new Date(`${due}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
/** 1.5 → "1½", 0.5 → "½". */
export const pointsLabel = (p: number) => (p % 1 ? `${Math.floor(p) || ""}½` : String(p));

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

/** Homework the monitor set: students start each lesson, the monitor sees who is done. */
export function HomeworkSection({ room, course, refresh }: { room: ClassRoom; course: Course | null; refresh: number }) {
  const { state } = useApp();
  const { c } = useTheme();
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
  return (
    <View style={{ gap: 8, paddingTop: 8 }}>
      <T role="label">{t.title}</T>
      {list.length ? null : (
        <T role="small" color="textMuted">
          {t.empty}
        </T>
      )}
      {list.map((h) => (
        <View key={h.id} style={{ gap: 6, padding: 12, borderRadius: 14, backgroundColor: c.sunken }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T role="label" color="brandText" style={{ flex: 1 }}>
              {t.dueOn(dueLabel(h.due))}
            </T>
            <T role="small" color="textMuted">
              {t.finished(h.members.filter((m) => m.done).length, h.members.length)}
            </T>
          </View>
          {monitor ? (
            <>
              <T role="body">{h.lessons.map(title).join(", ")}</T>
              {h.members.map((m) => (
                <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <AvatarFace id={m.avatar} size={28} />
                  <T role="body" style={{ flex: 1 }} numberOfLines={1}>
                    {m.name}
                  </T>
                  <Badge tone={m.done ? "success" : "neutral"}>{m.done ? t.done : t.notDone}</Badge>
                </View>
              ))}
              <Button title={t.remove} variant="ghost" disabled={busy} onPress={() => void run(async () => { await api.deleteHomework(room.id, h.id); setN((x) => x + 1); }, t.removed)} />
            </>
          ) : (
            h.lessons.map((id) => {
              const done = Boolean(state.progress.completed[id]);
              return (
                <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
                  <T role="body" style={{ flex: 1 }} numberOfLines={2}>
                    {title(id)}
                  </T>
                  {done ? <Badge tone="success">{t.done}</Badge> : <Button title={t.start} block={false} onPress={() => openLesson(id)} />}
                </View>
              );
            })
          )}
        </View>
      ))}
      {monitor ? <Button title={t.set} icon="edit" variant="secondary" onPress={() => setAdding(true)} /> : null}
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <T role="heading" header>
          {t.set}
        </T>
        <View style={{ alignSelf: "stretch", gap: 6 }}>
          <T role="label">{t.due}</T>
          <Segmented label={t.due} value={days} onChange={setDays} options={DUE_DAYS.map((d) => ({ value: d, label: t.dueIn[d] }))} />
        </View>
        <T role="small" color="textMuted" style={{ alignSelf: "stretch" }}>
          {t.pickLessons}
        </T>
        <ScrollView style={{ alignSelf: "stretch", maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
          {(course?.units ?? []).map((u) => (
            <View key={u.id} style={{ gap: 6 }}>
              <T role="label" color="textMuted">
                {u.title}
              </T>
              {course!.lessons
                .filter((l) => l.unit === u.id)
                .map((l) => (
                  <Choice
                    key={l.id}
                    label={l.title}
                    selected={picked.includes(l.id)}
                    onPress={() => setPicked((p) => (p.includes(l.id) ? p.filter((x) => x !== l.id) : p.length < 10 ? [...p, l.id] : p))}
                  />
                ))}
            </View>
          ))}
        </ScrollView>
        <View style={{ alignSelf: "stretch" }}>
          <Button
            title={t.save(picked.length)}
            loading={busy}
            disabled={!picked.length}
            onPress={() =>
              void run(async () => {
                await api.setHomework(room.id, { lessons: picked, due: dayKey(new Date(Date.now() + days * 86_400_000)) });
                setPicked([]);
                setAdding(false);
                setN((x) => x + 1);
              }, t.saved)
            }
          />
        </View>
      </Sheet>
    </View>
  );
}

/** My games in this class, the ones waiting on me first. */
export function GamesSection({ room, refresh }: { room: ClassRoom; refresh: number }) {
  const { c } = useTheme();
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
    <View style={{ gap: 6, paddingTop: 8 }}>
      <T role="label">{t.title}</T>
      {games.length ? (
        games.map((g) => {
          const them = g.you === "b" ? g.white : g.black;
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={`${t.vs(them.name)}. ${gameStatus(g)}`}
              onPress={() => router.push({ pathname: "/class-game", params: { classId: room.id, id: g.id } })}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderRadius: 14, opacity: pressed ? 0.7 : 1 })}
            >
              <AvatarFace id={them.avatar} size={40} />
              <View style={{ flex: 1 }}>
                <T role="label" numberOfLines={1}>
                  {t.vs(them.name)}
                </T>
                <T role="small" color="textMuted" numberOfLines={1}>
                  {g.tournamentId ? `${t.tournament} · ` : ""}
                  {g.yourTurn ? copy.gym.moveCount(Math.ceil(g.moves.length / 2)) : gameStatus(g)}
                </T>
              </View>
              {g.yourTurn ? <Badge tone="brand">{t.yourTurn}</Badge> : null}
            </Pressable>
          );
        })
      ) : (
        <T role="small" color="textMuted">
          {t.empty}
        </T>
      )}
      <View style={{ height: 1, backgroundColor: c.line, marginTop: 4 }} />
    </View>
  );
}

/** Round robins in this class with their standings; the monitor can start one. */
export function TournamentSection({ room, refresh, onStarted }: { room: ClassRoom; refresh: number; onStarted: () => void }) {
  const { c } = useTheme();
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
    <View style={{ gap: 8, paddingTop: 8 }}>
      <T role="label">{t.title}</T>
      {list.map((tour) => (
        <View key={tour.id} style={{ gap: 4, padding: 12, borderRadius: 14, backgroundColor: c.sunken }}>
          <T role="small" color="textMuted">
            {t.progress(tour.done, tour.total)}
          </T>
          <View style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}>
            <T role="micro" color="textMuted" style={{ flex: 1 }}>
              {t.player}
            </T>
            <T role="micro" color="textMuted" style={{ width: 52, textAlign: "right" }}>
              {t.played}
            </T>
            <T role="micro" color="textMuted" style={{ width: 52, textAlign: "right" }}>
              {t.points}
            </T>
          </View>
          {tour.standings.map((s, i) => (
            <View key={s.id} accessible accessibilityLabel={`${i + 1}. ${s.name}, ${t.played} ${s.played}, ${t.points} ${pointsLabel(s.points)}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 }}>
              <T role="label" color="textMuted" style={{ width: 18 }}>
                {String(i + 1)}
              </T>
              <AvatarFace id={s.avatar} size={28} />
              <T role="body" style={{ flex: 1 }} numberOfLines={1}>
                {s.name}
              </T>
              <T role="body" color="textMuted" style={{ width: 52, textAlign: "right" }}>
                {String(s.played)}
              </T>
              <T role="label" color="brandText" style={{ width: 52, textAlign: "right" }}>
                {pointsLabel(s.points)}
              </T>
            </View>
          ))}
        </View>
      ))}
      {monitor ? <Button title={t.start} icon="trophy" variant="secondary" onPress={() => setAdding(true)} /> : null}
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <T role="heading" header>
          {t.start}
        </T>
        <T role="body" color="textMuted" center>
          {t.body}
        </T>
        <T role="small" color="textMuted" style={{ alignSelf: "stretch" }}>
          {t.pick}
        </T>
        <ScrollView style={{ alignSelf: "stretch", maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
          {room.members.map((m) => (
            <Choice
              key={m.id}
              label={m.name || copy.you.noName}
              selected={picked.includes(m.id)}
              onPress={() => setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : p.length < 8 ? [...p, m.id] : p))}
            />
          ))}
        </ScrollView>
        <View style={{ alignSelf: "stretch" }}>
          <Button
            title={t.send(picked.length)}
            icon="trophy"
            loading={busy}
            disabled={picked.length < 3}
            onPress={() =>
              void run(async () => {
                await api.startTournament(room.id, picked);
                setPicked([]);
                setAdding(false);
                setN((x) => x + 1);
                onStarted();
              }, t.started)
            }
          />
        </View>
      </Sheet>
    </View>
  );
}
