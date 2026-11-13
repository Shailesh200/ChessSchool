import { copy, type ClassRoom } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Share, View } from "react-native";
import { Button, Card, Page, T, TextField, useToast } from "@/components/ui";
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
  const t = copy.classroom;

  const load = () => {
    if (!state.account) return;
    api.classes().then((r) => setRooms(r.classes)).catch(() => {});
  };
  useEffect(load, [state.account]);

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
            {room.members.map((m) => (
              <T key={m.id} role="body">
                {m.name || copy.you.noName} · {m.role === "monitor" ? t.monitor : t.student}
              </T>
            ))}
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
    </Page>
  );
}
