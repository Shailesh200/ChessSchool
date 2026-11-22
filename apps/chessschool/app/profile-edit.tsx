import { BANNERS, BIO_MAX, cleanName, copy, normalizeUsername, countryName, emptyDetails, errorMessage, flagOf, GOAL_MAX, isChildProfile, nameProblem, PIECES, SHORT_MAX, SOCIALS, type AvatarId, type ProfileDetails } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AvatarFace, AvatarPicker } from "@/components/AvatarFace";
import { Icon } from "@/components/Icon";
import { pickPhoto, saveUsername, UsernameField, usernameError, useMyDetails, useUsernameStatus } from "@/components/Social";
import { Button, Card, Page, Row, SaveBanner, T, TextField, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

type FieldErrors = Partial<Record<string, string>>;

/** Profile editor: picture, name, bio, favourites, links and banner colour; board and theme looks are one tap away. */
export default function ProfileEdit() {
  const { state, setProfile, cue, update } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const t = copy.profileEdit;
  const { mine, setMine } = useMyDetails();
  const [d, setD] = useState<ProfileDetails>(emptyDetails());
  const [name, setName] = useState(state.profile.name);
  const currentUsername = state.account?.username ?? null;
  const [username, setUsername] = useState(currentUsername ?? "");
  const usernameStatus = useUsernameStatus(username, currentUsername);
  const [year, setYear] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  useEffect(() => {
    if (!mine) return;
    setD(mine.details);
    setYear(mine.details.playingSince ? String(mine.details.playingSince) : "");
  }, [mine]);

  if (!state.account) {
    return (
      <Page title={t.title} banner={false}>
        <T role="body" color="textMuted">
          {t.signIn}
        </T>
        <SaveBanner title={copy.you.saveCard.title} />
      </Page>
    );
  }

  const set = (patch: Partial<ProfileDetails>) => {
    setD((x) => ({ ...x, ...patch }));
    setErrors({});
  };
  const photo = async (source: "camera" | "library") => {
    const shot = await pickPhoto(source);
    if (!shot) return;
    if (shot === "denied" || shot === "missing") return toast(shot === "denied" ? t.photoDenied : t.photoMissing);
    setPhotoBusy(true);
    try {
      setMine(await api.uploadPhoto({ image: shot, mediaType: "image/jpeg" }));
      cue("success");
      toast(t.photoSaved);
    } catch (err) {
      toast((err as { code?: string }).code === "unavailable" ? t.photoUnavailable : t.photoFailed);
    } finally {
      setPhotoBusy(false);
    }
  };
  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      setMine(await api.removePhoto());
      toast(t.photoRemoved);
    } catch {
      toast(copy.auth.errors.offline);
    } finally {
      setPhotoBusy(false);
    }
  };
  const pickPreset = (avatar: AvatarId) => {
    setProfile({ avatar });
    cue("tap");
    api.updateMe({ avatar }).catch(() => {});
    if (mine?.photo) void removePhoto();
  };

  const save = async () => {
    const clean = cleanName(name);
    const problem = nameProblem(name);
    if (problem && problem !== "reserved") return setErrors({ name: copy.social.nameProblems[problem] });
    const since = year.trim() ? Number.parseInt(year, 10) : null;
    const newUsername = currentUsername !== null && normalizeUsername(username) !== currentUsername ? normalizeUsername(username) : null;
    if (newUsername && usernameStatus !== "ok") return setErrors({ username: usernameError(usernameStatus === "checking" ? null : usernameStatus) ?? copy.social.usernameChecking });
    setSaving(true);
    try {
      if (newUsername) {
        const r = await saveUsername(newUsername);
        if (!("username" in r)) {
          setSaving(false);
          cue("gentle-no");
          return setErrors({ username: usernameError(r.problem) ?? copy.auth.errors.offline });
        }
        update((s) => (s.account ? { ...s, account: { ...s.account, username: r.username }, usernameAsked: true } : s));
      }
      if (clean !== state.profile.name) {
        await api.updateMe({ name: clean });
        setProfile({ name: clean });
      }
      setMine(await api.saveDetails({ ...d, playingSince: since }));
      cue("success");
      toast(t.saved);
      router.back();
    } catch (err) {
      cue("gentle-no");
      const e = err as { code?: string; message?: string };
      if (e.code === "name_not_allowed") setErrors({ name: errorMessage(err) });
      else if (e.code === "invalid_input" && e.message?.includes(":")) {
        const [field, reason] = e.message.split(":") as [string, keyof typeof t.problems];
        setErrors({ [field]: t.problems[reason] ?? t.problems.invalid });
      } else toast(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const pill = (on: boolean) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center" as const, borderWidth: on ? 2 : 1, borderColor: on ? c.brand : c.line, backgroundColor: on ? c.brandSoft : c.card });

  return (
    <Page title={t.title} banner={false} footer={<Button title={t.save} loading={saving} onPress={() => void save()} />}>
      <Card style={{ gap: 12, alignItems: "center" }}>
        <T role="heading" header>
          {t.photo}
        </T>
        <AvatarFace id={state.profile.avatar} photo={mine?.photo} size={96} />
        <T role="small" color="textMuted" center>
          {mine?.photoHidden ? t.photoHidden : t.photoHint}
        </T>
        <View style={{ alignSelf: "stretch", gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title={photoBusy ? t.uploading : t.fromLibrary} icon="edit" variant="secondary" loading={photoBusy} onPress={() => void photo("library")} style={{ flex: 1 }} />
            <Button title={t.fromCamera} icon="eye" variant="secondary" disabled={photoBusy} onPress={() => void photo("camera")} style={{ flex: 1 }} />
          </View>
          {mine?.photo ? <Button title={t.removePhoto} icon="trash" variant="ghost" disabled={photoBusy} onPress={() => void removePhoto()} /> : null}
        </View>
        <T role="label">{t.usePreset}</T>
        <AvatarPicker value={state.profile.avatar} onChange={pickPreset} />
      </Card>

      <Card style={{ gap: 14 }}>
        <TextField label={t.name} placeholder={copy.auth.namePlaceholder} value={name} onChangeText={(v) => (setName(v), setErrors({}))} error={errors.name} maxLength={40} />
        {currentUsername !== null ? (
          <View style={{ gap: 4 }}>
            <UsernameField value={username} onChange={(v) => (setUsername(v), setErrors({}))} current={currentUsername} label={t.username} hint={t.usernameHint} />
            {errors.username ? (
              <T role="small" color="dangerText">
                {errors.username}
              </T>
            ) : null}
          </View>
        ) : null}
        <View style={{ gap: 6 }}>
          <T role="label">{t.country}</T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.country}: ${state.profile.country ? countryName(state.profile.country) : copy.country.none}`}
            accessibilityHint={t.countryHint}
            onPress={() => router.push("/country")}
            style={{ minHeight: 52, borderRadius: 16, borderWidth: 2, borderColor: c.line, backgroundColor: c.card, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }}
          >
            <T role="heading">{state.profile.country ? flagOf(state.profile.country) : "🏳️"}</T>
            <T role="body" style={{ flex: 1 }} numberOfLines={1}>
              {state.profile.country ? countryName(state.profile.country) : copy.country.none}
            </T>
            <Icon name="chevron" size={18} color={c.textMuted} />
          </Pressable>
          <T role="small" color="textMuted">
            {t.countryHint}
          </T>
        </View>
        <TextField label={t.bio} placeholder={t.bioPlaceholder} value={d.bio} onChangeText={(v) => set({ bio: v })} error={errors.bio} hint={t.bioHint(BIO_MAX - d.bio.length)} maxLength={BIO_MAX} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
        <View style={{ gap: 8 }}>
          <T role="label">{t.favPiece}</T>
          <View accessibilityRole="radiogroup" accessibilityLabel={t.favPiece} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[null, ...PIECES].map((p) => (
              <Pressable key={p ?? "none"} accessibilityRole="radio" accessibilityState={{ checked: d.favPiece === p }} onPress={() => set({ favPiece: p })} style={pill(d.favPiece === p)}>
                <T role="label" style={{ color: d.favPiece === p ? c.brandText : c.text }}>
                  {p ? t.pieces[p] : t.none}
                </T>
              </Pressable>
            ))}
          </View>
        </View>
        <TextField label={t.favOpening} placeholder={t.favOpeningPlaceholder} value={d.favOpening} onChangeText={(v) => set({ favOpening: v })} error={errors.favOpening} maxLength={SHORT_MAX} />
        <TextField label={t.goal} placeholder={t.goalPlaceholder} value={d.goal} onChangeText={(v) => set({ goal: v })} error={errors.goal} maxLength={GOAL_MAX} />
        <TextField label={t.playingSince} placeholder={t.playingSincePlaceholder} value={year} onChangeText={(v) => (setYear(v.replace(/\D/g, "").slice(0, 4)), setErrors({}))} error={errors.playingSince} keyboardType="number-pad" maxLength={4} />
        <TextField label={t.city} placeholder={t.cityPlaceholder} hint={isChildProfile(state) ? t.childNote : t.cityHint} value={d.city} onChangeText={(v) => set({ city: v })} error={errors.city} maxLength={SHORT_MAX} />
      </Card>

      <Card style={{ gap: 10 }}>
        <T role="label">{t.banner}</T>
        <View accessibilityRole="radiogroup" accessibilityLabel={t.banner} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {BANNERS.map((b) => {
            const on = (d.banner ?? "brand") === b;
            return (
              <Pressable key={b} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t.banners[b]} onPress={() => set({ banner: b })} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c[b], borderWidth: 3, borderColor: on ? c.text : "transparent", alignItems: "center", justifyContent: "center" }}>
                {on ? <Icon name="check" size={20} color={c.onBrand} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <T role="heading" header>
          {t.socials}
        </T>
        <T role="small" color="textMuted">
          {isChildProfile(state) ? t.childNote : t.socialsHint}
        </T>
        {SOCIALS.map((n) => (
          <TextField
            key={n}
            label={t.networks[n]}
            placeholder={t.handlePlaceholder}
            value={d.socials[n] ?? ""}
            onChangeText={(v) => set({ socials: { ...d.socials, [n]: v } })}
            error={errors[`socials.${n}`]}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={120}
          />
        ))}
      </Card>

      <Card style={{ padding: 6 }}>
        <Row icon="palette" label={t.looks} hint={t.looksHint} chevron onPress={() => router.push("/looks")} />
        <Row icon="profile" label={t.preview} chevron onPress={() => router.push({ pathname: "/player", params: { id: state.account!.id } })} />
      </Card>
    </Page>
  );
}
