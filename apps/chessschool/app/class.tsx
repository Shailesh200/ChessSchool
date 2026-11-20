import { copy, dayKey, rankFor, visibleStreak, type ClassMember, type ClassRoom, type ClassVision, type Leaderboard } from "@chessschool/design";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { AvatarFace } from "@/components/AvatarFace";
import { GamesSection, HomeworkSection, TournamentSection } from "@/components/ClassPlay";
import { Icon } from "@/components/Icon";
import { Button, Card, Page, Segmented, Sheet, SwitchRow, T, TextField, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

export default function ClassScreen() {
  const { state, cue } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const [rooms, setRooms] = useState<ClassRoom[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<{ room: ClassRoom; member: ClassMember } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const course = useCourse();
  const t = copy.classroom;

  const load = () => {
    if (!state.account) return;
    api.classes().then((r) => setRooms(r.classes)).catch(() => {});
  };
  // Reload on focus so a report from the report screen hides the member right away.
  useFocusEffect(
    useCallback(() => {
      load();
      setTick((n) => n + 1);
    }, [state.account]),
  );
  const closeCard = () => {
    setOpen(null);
    setConfirm(null);
  };

  const run = async (work: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await work();
      cue("success");
      toast(ok);
      load();
    } catch (err) {
      cue("gentle-no");
      toast(errorMessage(err) || t.invalid);
    } finally {
      setBusy(false);
    }
  };

  if (!state.account) {
    return (
      <Page title={t.title} banner={false} footer={<Button title={copy.you.saveCard.cta} onPress={() => router.push("/signup")} />}>
        <T role="body" color="textMuted">
          {t.needAccount}
        </T>
      </Page>
    );
  }

  return (
    <Page title={t.title} banner={false}>
      <T role="body" color="textMuted">
        {t.body}
      </T>
      {rooms.length ? (
        rooms.map((room) => (
          <Card key={room.id} style={{ gap: 8 }}>
            <T role="heading">{room.name}</T>
            <T role="small" color="brandText" style={{ fontFamily: fonts.bold }}>
              {room.role === "monitor" ? t.monitor : t.student} · {t.members(room.members.length)}
            </T>
            <T role="title" style={{ letterSpacing: 4 }}>
              {room.code}
            </T>
            <Button
              title={t.link}
              icon="club"
              variant="secondary"
              onPress={() => void Share.share({ message: `${room.name}\nhttps://api.chess-school.in/join/${room.code}` })}
            />
            {room.members.map((m) => {
              const me = m.id === state.account?.id;
              const label = `${m.name || copy.you.noName} · ${m.role === "monitor" ? t.monitor : t.student}`;
              return (
                <Pressable
                  key={m.id}
                  disabled={me}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() => setOpen({ room, member: m })}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderRadius: 14, opacity: pressed ? 0.7 : 1 })}
                >
                  <AvatarFace id={m.avatar} photo={m.photo} size={40} />
                  <View style={{ flex: 1 }}>
                    <T role="label">{m.name || copy.you.noName}</T>
                    <T role="small" color="textMuted">
                      {m.role === "monitor" ? t.monitor : t.student}
                    </T>
                  </View>
                  {me ? null : <Icon name="chevron" color={c.textMuted} />}
                </Pressable>
              );
            })}
            <HomeworkSection room={room} course={course} refresh={tick} />
            <GamesSection room={room} refresh={tick} />
            <TournamentSection room={room} refresh={tick} onStarted={() => setTick((n) => n + 1)} />
            <WeekBoard roomId={room.id} refresh={tick} onHidden={setHidden} />
            <VisionBoard roomId={room.id} refresh={tick} />
            <Button
              title={room.role === "monitor" ? t.close : t.leave}
              variant="ghost"
              disabled={busy}
              onPress={() => void run(async () => { await api.leaveClass(room.id); }, room.role === "monitor" ? t.closed : t.left)}
            />
          </Card>
        ))
      ) : (
        <T role="body" color="textMuted">
          {t.empty}
        </T>
      )}
      {rooms.length && hidden !== null ? (
        <Card style={{ padding: 8 }}>
          <SwitchRow
            icon="trophy"
            label={t.showMe}
            hint={t.showMeHint}
            value={!hidden}
            onChange={(show) => {
              setHidden(!show);
              void api.setLeaderboardHidden(!show).then(() => setTick((n) => n + 1)).catch(() => setHidden(show));
            }}
          />
        </Card>
      ) : null}
      <Card style={{ gap: 10 }}>
        <TextField label={t.name} placeholder={t.namePlaceholder} value={name} onChangeText={setName} maxLength={40} />
        <Button title={t.create} disabled={busy || !name.trim()} onPress={() => void run(async () => { await api.createClass(name.trim()); setName(""); }, t.created)} />
      </Card>
      <Card style={{ gap: 10 }}>
        <TextField label={t.code} placeholder="AB12CD" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={6} />
        <Button title={t.join} variant="secondary" disabled={busy || code.trim().length < 6} onPress={() => void run(async () => { await api.joinClass(code.trim()); setCode(""); }, t.joined)} />
      </Card>
      <View style={{ height: 8, backgroundColor: c.bg }} />
      <Sheet visible={Boolean(open)} onClose={closeCard}>
        {open ? (
          <MemberCard
            room={open.room}
            member={open.member}
            confirm={confirm}
            busy={busy}
            onConfirm={setConfirm}
            onReport={() => {
              closeCard();
              router.push({ pathname: "/report", params: { classId: open.room.id, memberId: open.member.id, name: open.member.name || copy.you.noName } });
            }}
            onBlock={() => void run(async () => { await api.blockMember(open.room.id, open.member.id); closeCard(); }, t.blocked)}
            onRemove={() => void run(async () => { await api.removeMember(open.room.id, open.member.id); closeCard(); }, t.removed)}
            onChallenge={(color) =>
              void run(async () => {
                const { game } = await api.challenge(open.room.id, open.member.id, color);
                closeCard();
                router.push({ pathname: "/class-game", params: { classId: open.room.id, id: game.id } });
              }, t.games.started)
            }
          />
        ) : null}
      </Sheet>
    </Page>
  );
}

type Confirm = "block" | "remove" | "challenge" | null;

function MemberCard({ room, member, confirm, busy, onConfirm, onReport, onBlock, onRemove, onChallenge }: {
  room: ClassRoom;
  member: ClassMember;
  confirm: Confirm;
  busy: boolean;
  onConfirm: (v: Confirm) => void;
  onReport: () => void;
  onBlock: () => void;
  onRemove: () => void;
  onChallenge: (color: "w" | "b" | "random") => void;
}) {
  const { c } = useTheme();
  const t = copy.classroom;
  const name = member.name || copy.you.noName;
  const [color, setColor] = useState<"w" | "b" | "random">("random");
  if (confirm === "challenge") {
    return (
      <View style={{ gap: 12 }}>
        <T role="heading">{t.games.challengeTitle(name)}</T>
        <T role="body" color="textMuted">
          {t.games.challengeBody}
        </T>
        <T role="label">{t.games.color}</T>
        <Segmented label={t.games.color} value={color} onChange={setColor} options={(["w", "b", "random"] as const).map((v) => ({ value: v, label: copy.play.sides[v] }))} />
        <Button title={t.games.send} icon="play" loading={busy} onPress={() => onChallenge(color)} />
        <Button title={t.cancel} variant="ghost" onPress={() => onConfirm(null)} />
      </View>
    );
  }
  if (confirm) {
    return (
      <View style={{ gap: 12 }}>
        <T role="heading">{confirm === "block" ? t.blockTitle(name) : t.removeTitle(name)}</T>
        <T role="body" color="textMuted">
          {confirm === "block" ? t.blockBody : t.removeBody}
        </T>
        <Button title={confirm === "block" ? t.block : t.remove} variant="danger" loading={busy} onPress={confirm === "block" ? onBlock : onRemove} />
        <Button title={t.cancel} variant="ghost" onPress={() => onConfirm(null)} />
      </View>
    );
  }
  const stats = [
    { value: String(member.lessons), label: t.stats.lessons },
    { value: String(visibleStreak(member.streak, dayKey(new Date()))), label: t.stats.streak },
    { value: copy.ranks[rankFor(member.xp).rank], label: t.stats.rank },
  ];
  return (
    <View style={{ gap: 16, alignItems: "center" }}>
      <AvatarFace id={member.avatar} photo={member.photo} size={84} />
      <View style={{ alignItems: "center", gap: 2 }}>
        <T role="title">{name}</T>
        <T role="small" color="textMuted">
          {member.role === "monitor" ? t.monitor : t.student} · {t.joinedOn(new Date(member.joinedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}
        </T>
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch" }}>
        {stats.map((st) => (
          <View key={st.label} accessible accessibilityLabel={`${st.value} ${st.label}`} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: c.sunken }}>
            <T role="heading">{st.value}</T>
            <T role="micro" color="textMuted">
              {st.label}
            </T>
          </View>
        ))}
      </View>
      <View style={{ alignSelf: "stretch" }}>
        <Button title={t.games.challenge} icon="play" onPress={() => onConfirm("challenge")} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch" }}>
        <View style={{ flex: 1 }}>
          <Button title={t.report} icon="flag" variant="secondary" onPress={onReport} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t.block} icon="block" variant="secondary" onPress={() => onConfirm("block")} />
        </View>
      </View>
      {room.role === "monitor" ? (
        <View style={{ alignSelf: "stretch" }}>
          <Button title={t.remove} variant="danger" onPress={() => onConfirm("remove")} />
        </View>
      ) : null}
    </View>
  );
}

/** This week's lessons in one class, most first. */
function WeekBoard({ roomId, refresh, onHidden }: { roomId: string; refresh: number; onHidden: (hidden: boolean) => void }) {
  const { c } = useTheme();
  const t = copy.classroom;
  const [board, setBoard] = useState<Leaderboard | null>(null);
  useEffect(() => {
    let live = true;
    api
      .leaderboard(roomId, dayKey(new Date()))
      .then((b) => {
        if (!live) return;
        setBoard(b);
        onHidden(b.hidden);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [roomId, refresh, onHidden]);
  if (!board) return null;
  const any = board.entries.some((e) => e.lessons > 0);
  return (
    <View style={{ gap: 6, paddingTop: 8 }}>
      <T role="label">{t.weekTitle}</T>
      {any ? (
        board.entries.slice(0, 10).map((e, i) => (
          <View key={e.id} accessible accessibilityLabel={`${i + 1}. ${e.name}, ${t.weekLessons(e.lessons)}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: e.me ? c.brandSoft : "transparent" }}>
            <T role="label" color="textMuted" style={{ width: 22 }}>
              {String(i + 1)}
            </T>
            <AvatarFace id={e.avatar} size={28} />
            <T role="body" style={{ flex: 1 }} numberOfLines={1}>
              {e.me ? `${e.name} (${t.you})` : e.name}
            </T>
            <T role="label" color="brandText">
              {e.xp === undefined ? t.weekLessons(e.lessons) : copy.classXp.value(e.xp)}
            </T>
          </View>
        ))
      ) : (
        <T role="small" color="textMuted">
          {t.weekEmpty}
        </T>
      )}
    </View>
  );
}

/** Today's best board-vision score per game in one class. */
function VisionBoard({ roomId, refresh }: { roomId: string; refresh: number }) {
  const { c } = useTheme();
  const t = copy.vision;
  const [board, setBoard] = useState<ClassVision | null>(null);
  useEffect(() => {
    let live = true;
    api
      .classVision(roomId, dayKey(new Date()))
      .then((b) => live && setBoard(b))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [roomId, refresh]);
  if (!board) return null;
  return (
    <View style={{ gap: 6, paddingTop: 8 }}>
      <T role="label">{t.classTitle}</T>
      {board.best.length ? (
        board.best.map((e) => {
          const game = t.games[e.game as keyof typeof t.games]?.name ?? e.game;
          const who = e.me ? `${e.name} (${copy.classroom.you})` : e.name;
          return (
            <View key={e.game} accessible accessibilityLabel={`${game}: ${who}, ${e.score}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: e.me ? c.brandSoft : "transparent" }}>
              <AvatarFace id={e.avatar} size={28} />
              <View style={{ flex: 1 }}>
                <T role="small" color="textMuted">
                  {game}
                </T>
                <T role="body" numberOfLines={1}>
                  {who}
                </T>
              </View>
              <T role="label" color="brandText">
                {String(e.score)}
              </T>
            </View>
          );
        })
      ) : (
        <T role="small" color="textMuted">
          {t.classEmpty}
        </T>
      )}
    </View>
  );
}
