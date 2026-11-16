import { copy, weekCard, type AvatarId } from "@chessschool/design";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AvatarFace, AvatarPicker } from "@/components/AvatarFace";
import { Icon } from "@/components/Icon";
import { ShareCardButton } from "@/components/Growth";
import { Button, Card, Page, Row, Sheet, T, TextField, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

type Child = { id: string; name: string; avatar: AvatarId };

/** Children on this account: switch who is learning, add or remove a child, and the parent PIN. */
export default function Learners() {
  const { state, switchLearner, forgetLearner, setParentPin, cue } = useApp();
  const { c } = useTheme();
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

  if (!account) {
    return (
      <Page title={t.title} banner={false}>
        <T role="body" color="textMuted">
          {t.needAccount}
        </T>
      </Page>
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
    } catch (err) {
      toast(errorMessage(err) || t.limit);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t.title} banner={false}>
      <Card style={{ padding: 6 }}>
        {rows.map((r) => {
          const on = (state.activeChild ?? null) === r.id;
          return (
            <View key={r.id ?? "main"} style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={on ? `${r.name}, ${t.active}` : t.switchTo(r.name)}
                disabled={on}
                onPress={() => {
                  void switchLearner(r.child ?? null);
                  cue("tap");
                  toast(t.switched(r.name));
                }}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, backgroundColor: on ? c.brandSoft : pressed ? c.sunken : "transparent" })}
              >
                <AvatarFace id={r.avatar} size={44} />
                <View style={{ flex: 1 }}>
                  <T role="label">{r.id ? r.name : `${r.name} · ${t.you}`}</T>
                  {on ? (
                    <T role="small" color="brandText">
                      {t.active}
                    </T>
                  ) : null}
                </View>
                {on ? <Icon name="check" color={c.brandText} /> : null}
              </Pressable>
              {r.child ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`${t.remove} ${r.name}`} onPress={() => setSheet({ remove: r.child! })} style={{ padding: 12 }}>
                  <Icon name="trash" color={c.textMuted} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {kids.length < 5 ? <Row icon="profile" label={t.add} chevron onPress={() => setSheet("add")} /> : null}
      </Card>

      {/* This week's progress of the learner who is active now, as a card a parent can forward. */}
      <ShareCardButton kind="weekly" data={weekCard(state.progress, new Date())} label={copy.share.weeklyAction} />

      <Card style={{ padding: 6 }}>
        <Row icon="lock" label={t.pin} hint={t.pinHint} chevron onPress={() => (setPin(""), setSheet("pin"))} />
      </Card>

      <Sheet visible={sheet === "add"} onClose={() => setSheet(null)}>
        <T role="heading" center>
          {t.addTitle}
        </T>
        <View style={{ alignSelf: "stretch", gap: 12 }}>
          <TextField label={t.name} placeholder={t.namePlaceholder} value={name} onChangeText={setName} maxLength={40} />
          <AvatarPicker value={avatar} onChange={setAvatar} />
          <Button title={t.save} disabled={!name.trim() || busy} loading={busy} onPress={() => void add()} />
        </View>
      </Sheet>

      <Sheet visible={sheet === "pin"} onClose={() => setSheet(null)}>
        <T role="heading" center>
          {t.pin}
        </T>
        <View style={{ alignSelf: "stretch", gap: 12 }}>
          <TextField label={t.pinLabel} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} />
          <Button
            title={t.pinSet}
            disabled={pin.length !== 4}
            onPress={() => {
              setParentPin(pin);
              setSheet(null);
              toast(t.pinSaved);
            }}
          />
          {state.parentPin ? (
            <Button
              title={t.pinRemove}
              variant="ghost"
              onPress={() => {
                setParentPin(null);
                setSheet(null);
                toast(t.pinRemoved);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <Sheet visible={typeof sheet === "object" && sheet !== null} onClose={() => setSheet(null)}>
        {typeof sheet === "object" && sheet !== null ? (
          <View style={{ alignSelf: "stretch", gap: 12 }}>
            <T role="heading">{t.removeTitle(sheet.remove.name)}</T>
            <T role="body" color="textMuted">
              {t.removeBody}
            </T>
            <Button
              title={t.remove}
              variant="danger"
              loading={busy}
              onPress={async () => {
                const kid = sheet.remove;
                setBusy(true);
                try {
                  await api.removeChild(kid.id);
                  forgetLearner(kid.id);
                  setKids((k) => k.filter((x) => x.id !== kid.id));
                  setSheet(null);
                  toast(t.removed);
                } catch (err) {
                  toast(errorMessage(err) || copy.auth.errors.generic);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Page>
  );
}
