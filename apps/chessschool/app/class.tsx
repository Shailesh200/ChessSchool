import { copy, dayKey, rankFor, visibleStreak, type ClassMember, type ClassRoom } from "@chessschool/design";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { AvatarFace } from "@/components/AvatarFace";
import { Icon } from "@/components/Icon";
import { Button, Card, Page, Sheet, T, TextField, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
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
  const [confirm, setConfirm] = useState<"block" | "remove" | null>(null);
  const t = copy.classroom;

  const load = () => {
    if (!state.account) return;
    api.classes().then((r) => setRooms(r.classes)).catch(() => {});
  };
  // Reload on focus so a report from the report screen hides the member right away.
  useFocusEffect(useCallback(load, [state.account]));
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
                  <AvatarFace id={m.avatar} size={40} />
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
          />
        ) : null}
      </Sheet>
    </Page>
  );
}

function MemberCard({ room, member, confirm, busy, onConfirm, onReport, onBlock, onRemove }: {
  room: ClassRoom;
  member: ClassMember;
  confirm: "block" | "remove" | null;
  busy: boolean;
  onConfirm: (v: "block" | "remove" | null) => void;
  onReport: () => void;
  onBlock: () => void;
  onRemove: () => void;
}) {
  const { c } = useTheme();
  const t = copy.classroom;
  const name = member.name || copy.you.noName;
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
      <AvatarFace id={member.avatar} size={84} />
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
