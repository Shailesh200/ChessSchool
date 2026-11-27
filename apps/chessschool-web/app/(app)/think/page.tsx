"use client";

import { thinkTrack } from "@chessschool/chess";
import { copy, language } from "@chessschool/design";
import Link from "next/link";
import { useMemo } from "react";
import { Icon } from "@/components/Icon";
import { Card, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

/** "Think like a player": the five parts of the track, every lesson open. */
export default function ThinkPage() {
  const { state, ready } = useApp();
  const units = useMemo(() => thinkTrack(language()), []);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const done = state.progress.completed;
  const all = units.flatMap((u) => u.lessons);
  return (
    <div className="page page-narrow think">
      <TopBar title={copy.think.title} />
      <p className="muted">
        {copy.think.sub} · {copy.think.progress(all.filter((l) => done[l.id]).length, all.length)}
      </p>
      {units.map((u) => (
        <Card key={u.id} className="think-unit">
          <h2>{u.title}</h2>
          <p className="muted">{u.sub}</p>
          <ul className="think-lessons">
            {u.lessons.map((l) => (
              <li key={l.id}>
                <Link href={`/lesson/${l.id}`}>
                  <span>
                    <strong>{l.title}</strong>
                    <span className="muted">
                      {l.sub} · {l.minutes} min
                    </span>
                  </span>
                  {done[l.id] ? <Icon name="check" /> : <Icon name="chevron" />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
