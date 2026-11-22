"use client";

import { AVATARS, BANNERS, BIO_MAX, cleanName, copy, normalizeUsername, countryName, emptyDetails, errorMessage, flagOf, GOAL_MAX, nameProblem, PIECES, SHORT_MAX, SOCIALS, type AvatarId, type ProfileDetails } from "@chessschool/design";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MemberFace } from "@/components/MemberFace";
import { Icon } from "@/components/Icon";
import { bannerVar, saveUsername, squareJpeg, UsernameField, usernameError, useMyDetails, useUsernameStatus } from "@/components/Social";
import { Button, Card, SaveBanner, TextField, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

type FieldErrors = Partial<Record<string, string>>;

/** Profile editor: picture, name, bio, favourites, links and banner colour; board and theme looks are one click away. */
export default function ProfileEditPage() {
  const { state, ready, setProfile, cue, update } = useApp();
  const router = useRouter();
  const toast = useToast();
  const t = copy.profileEdit;
  const { mine, setMine } = useMyDetails();
  const [d, setD] = useState<ProfileDetails>(emptyDetails());
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const currentUsername = state.account?.username ?? null;
  const [username, setUsername] = useState("");
  const usernameStatus = useUsernameStatus(username || (currentUsername ?? ""), currentUsername);
  useEffect(() => {
    if (currentUsername) setUsername(currentUsername);
  }, [currentUsername]);
  useEffect(() => {
    if (ready) setName(state.profile.name);
  }, [ready, state.profile.name]);
  useEffect(() => {
    if (!mine) return;
    setD(mine.details);
    setYear(mine.details.playingSince ? String(mine.details.playingSince) : "");
  }, [mine]);

  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  if (!state.account) {
    return (
      <div className="page page-narrow">
        <TopBar title={t.title} backHref="/you" />
        <p className="page-lead">{t.signIn}</p>
        <SaveBanner title={copy.you.saveCard.title} />
      </div>
    );
  }

  const set = (patch: Partial<ProfileDetails>) => {
    setD((x) => ({ ...x, ...patch }));
    setErrors({});
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setPhotoBusy(true);
    try {
      const image = await squareJpeg(f);
      setMine(await api.uploadPhoto({ image, mediaType: "image/jpeg" }));
      cue("success");
      toast(t.photoSaved);
    } catch (err) {
      toast((err as { code?: string }).code === "unavailable" ? t.photoUnavailable : t.photoFailed);
    } finally {
      setPhotoBusy(false);
      if (file.current) file.current.value = "";
      if (camera.current) camera.current.value = "";
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
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanName(name);
    const problem = nameProblem(name);
    // Reserved names are left to the server: staff accounts may use them.
    if (problem && problem !== "reserved") return setErrors({ name: copy.social.nameProblems[problem] });
    const newUsername = currentUsername !== null && username && normalizeUsername(username) !== currentUsername ? normalizeUsername(username) : null;
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
      setMine(await api.saveDetails({ ...d, playingSince: year.trim() ? Number.parseInt(year, 10) : null }));
      cue("success");
      toast(t.saved);
      router.push("/you");
    } catch (err) {
      cue("gentle-no");
      const x = err as { code?: string; message?: string };
      if (x.code === "name_not_allowed") setErrors({ name: errorMessage(err) });
      else if (x.code === "invalid_input" && x.message?.includes(":")) {
        const [field, reason] = x.message.split(":") as [string, keyof typeof t.problems];
        setErrors({ [field]: t.problems[reason] ?? t.problems.invalid });
      } else toast(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const child = state.profile.who === "child";

  return (
    <form className="page page-narrow profile-edit" onSubmit={save}>
      <TopBar title={t.title} backHref="/you" />

      <Card className="profile-photo">
        <h2 className="card-title">{t.photo}</h2>
        <MemberFace id={state.profile.avatar} photo={mine?.photo} size={96} />
        <p className="muted small">{mine?.photoHidden ? t.photoHidden : t.photoHint}</p>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
        <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => void upload(e.target.files?.[0])} />
        <div className="profile-photo-pair">
          <Button type="button" variant="secondary" icon="edit" loading={photoBusy} onClick={() => file.current?.click()}>
            {photoBusy ? t.uploading : t.fromLibrary}
          </Button>
          <Button type="button" variant="secondary" icon="eye" disabled={photoBusy} onClick={() => camera.current?.click()}>
            {t.fromCamera}
          </Button>
        </div>
        <div className="profile-photo-actions">
          {mine?.photo ? (
            <Button type="button" variant="ghost" icon="trash" disabled={photoBusy} onClick={() => void removePhoto()}>
              {t.removePhoto}
            </Button>
          ) : null}
        </div>
        <p className="row-label">{t.usePreset}</p>
        <div className="avatar-grid" role="radiogroup" aria-label={t.usePreset}>
          {AVATARS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={!mine?.photo && state.profile.avatar === id} aria-label={id === "cody" ? "Chaukor" : id[0]!.toUpperCase() + id.slice(1)} className={`avatar-pick${state.profile.avatar === id ? " is-on" : ""}`} onClick={() => pickPreset(id)}>
              <MemberFace id={id} size={64} />
            </button>
          ))}
        </div>
      </Card>

      <Card className="profile-fields">
        <TextField label={t.name} placeholder={copy.auth.namePlaceholder} value={name} onChange={(e) => (setName(e.target.value), setErrors({}))} error={errors.name} maxLength={40} />
        {currentUsername !== null ? <UsernameField value={username} onChange={(v) => (setUsername(v), setErrors({}))} current={currentUsername} label={t.username} hint={t.usernameHint} error={errors.username} /> : null}
        <div className="field">
          <span className="row-label" id="country-l">
            {t.country}
          </span>
          <Link className="country-field" href="/country" aria-labelledby="country-l" aria-describedby="country-h">
            <span className="country-field-flag" aria-hidden>
              {state.profile.country ? flagOf(state.profile.country) : "🏳️"}
            </span>
            <span className="country-field-name">{state.profile.country ? countryName(state.profile.country) : copy.country.none}</span>
            <Icon name="chevron" />
          </Link>
          <p className="field-hint" id="country-h">
            {t.countryHint}
          </p>
        </div>
        <div className={`field${errors.bio ? " has-error" : ""}`}>
          <label htmlFor="bio">{t.bio}</label>
          <div className="field-box">
            <textarea id="bio" rows={3} maxLength={BIO_MAX} placeholder={t.bioPlaceholder} value={d.bio} onChange={(e) => set({ bio: e.target.value })} aria-invalid={errors.bio ? true : undefined} />
          </div>
          {errors.bio ? (
            <p className="field-error" role="alert">
              {errors.bio}
            </p>
          ) : (
            <p className="field-hint">{t.bioHint(BIO_MAX - d.bio.length)}</p>
          )}
        </div>
        <fieldset className="report-reasons">
          <legend className="row-label">{t.favPiece}</legend>
          <div className="report-chips" role="radiogroup" aria-label={t.favPiece}>
            {[null, ...PIECES].map((p) => (
              <button key={p ?? "none"} type="button" role="radio" aria-checked={d.favPiece === p} className={`report-chip${d.favPiece === p ? " on" : ""}`} onClick={() => set({ favPiece: p })}>
                {p ? t.pieces[p] : t.none}
              </button>
            ))}
          </div>
        </fieldset>
        <TextField label={t.favOpening} placeholder={t.favOpeningPlaceholder} value={d.favOpening} onChange={(e) => set({ favOpening: e.target.value })} error={errors.favOpening} maxLength={SHORT_MAX} />
        <TextField label={t.goal} placeholder={t.goalPlaceholder} value={d.goal} onChange={(e) => set({ goal: e.target.value })} error={errors.goal} maxLength={GOAL_MAX} />
        <TextField label={t.playingSince} placeholder={t.playingSincePlaceholder} inputMode="numeric" value={year} onChange={(e) => (setYear(e.target.value.replace(/\D/g, "").slice(0, 4)), setErrors({}))} error={errors.playingSince} maxLength={4} />
        <TextField label={t.city} placeholder={t.cityPlaceholder} hint={child ? t.childNote : t.cityHint} value={d.city} onChange={(e) => set({ city: e.target.value })} error={errors.city} maxLength={SHORT_MAX} />
      </Card>

      <Card>
        <h2 className="card-title">{t.banner}</h2>
        <div className="banner-picks" role="radiogroup" aria-label={t.banner}>
          {BANNERS.map((b) => {
            const on = (d.banner ?? "brand") === b;
            return (
              <button key={b} type="button" role="radio" aria-checked={on} aria-label={t.banners[b]} title={t.banners[b]} className={`banner-pick${on ? " is-on" : ""}`} style={{ background: bannerVar(b) }} onClick={() => set({ banner: b })}>
                {on ? <Icon name="check" size={20} /> : null}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="profile-fields">
        <h2 className="card-title">{t.socials}</h2>
        <p className="muted small">{child ? t.childNote : t.socialsHint}</p>
        {SOCIALS.map((n) => (
          <TextField key={n} label={t.networks[n]} placeholder={t.handlePlaceholder} value={d.socials[n] ?? ""} onChange={(e) => set({ socials: { ...d.socials, [n]: e.target.value } })} error={errors[`socials.${n}`]} autoCapitalize="none" autoCorrect="off" maxLength={120} />
        ))}
      </Card>

      <Card className="list">
        <Link className="row" href="/settings/looks">
          <Icon name="palette" />
          <span className="row-text">
            <span className="row-label">{t.looks}</span>
            <span className="row-hint">{t.looksHint}</span>
          </span>
          <Icon name="chevron" />
        </Link>
        <Link className="row" href={`/player?id=${encodeURIComponent(state.account.id)}`}>
          <Icon name="profile" />
          <span className="row-text">
            <span className="row-label">{t.preview}</span>
          </span>
          <Icon name="chevron" />
        </Link>
      </Card>

      <Button type="submit" block loading={saving}>
        {t.save}
      </Button>
    </form>
  );
}
