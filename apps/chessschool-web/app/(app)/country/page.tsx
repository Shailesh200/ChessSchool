"use client";

import { copy, COUNTRIES, flagOf } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

/** Picks the country shown as a flag on leaderboards; saved on the profile (and the account when signed in). */
export default function CountryPage() {
  const { state, ready, setProfile, cue } = useApp();
  const router = useRouter();
  const t = copy.country;
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hits = needle ? COUNTRIES.filter(([code, name]) => name.toLowerCase().includes(needle) || code.toLowerCase() === needle) : COUNTRIES;
    // India first when nothing is typed: most learners are there.
    return needle ? hits : [...hits.filter(([code]) => code === "IN"), ...hits.filter(([code]) => code !== "IN")];
  }, [q]);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const current = state.profile.country ?? null;
  const pick = (code: string) => {
    setProfile({ country: code });
    cue("tap");
    if (state.account) api.updateMe({ country: code }).catch(() => {});
    router.back();
  };
  return (
    <div className="page page-narrow country-page">
      <TopBar title={t.title} />
      <p className="muted">{t.body}</p>
      <label className="field">
        <span className="field-label">{t.search}</span>
        <input type="search" placeholder={t.placeholder} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="country-name" />
      </label>
      <div className="country-list" role="radiogroup" aria-label={t.title}>
        {list.map(([code, name]) => (
          <button key={code} type="button" role="radio" aria-checked={code === current} className={code === current ? "is-on" : ""} onClick={() => pick(code)}>
            <span aria-hidden>{flagOf(code)}</span>
            <span>{name}</span>
            {code === current ? <Icon name="check" size={18} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
