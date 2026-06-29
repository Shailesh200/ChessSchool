"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useProgression } from "@/core/store/progression.store";
import { useMounted } from "@/core/hooks/useMounted";
import { listJournal, deleteJournalEntry, type JournalEntry } from "@/core/db/db";

const CONF = ["😣", "😕", "😐", "🙂", "😄"];
const KIND_EMOJI: Record<string, string> = {
  lesson: "📖", match: "♟️", review: "🔍", exam: "📝", reflection: "🧠",
};

export default function JournalPage() {
  const mounted = useMounted();
  const weaknesses = useProgression((s) => s.weaknesses);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);

  useEffect(() => {
    listJournal().then(setEntries);
  }, []);

  async function remove(id: string) {
    await deleteJournalEntry(id);
    setEntries((e) => e?.filter((x) => x.id !== id) ?? null);
  }

  const avgConf =
    entries && entries.length
      ? entries.reduce((a, b) => a + b.confidence, 0) / entries.length
      : 0;
  const topMistakes = mounted
    ? Object.entries(weaknesses).sort((a, b) => b[1] - a[1]).slice(0, 3)
    : [];

  const byDay = new Map<string, JournalEntry[]>();
  for (const e of entries ?? []) {
    const arr = byDay.get(e.day) ?? [];
    arr.push(e);
    byDay.set(e.day, arr);
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <BackButton />
        <h1 className="text-xl font-extrabold text-ink">Learning Journal</h1>

        <Card>
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink-300">Growth summary</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Mini label="Entries" value={entries ? `${entries.length}` : "—"} />
            <Mini label="Avg confidence" value={avgConf ? `${CONF[Math.round(avgConf) - 1] ?? ""}` : "—"} />
            <Mini label="Recurring" value={`${topMistakes.length}`} />
          </div>
          {topMistakes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topMistakes.map(([tag, n]) => (
                <span key={tag} className="rounded-pill bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">
                  {tag} ×{n}
                </span>
              ))}
            </div>
          )}
        </Card>

        {!entries ? (
          <div className="skeleton h-24 rounded-card" />
        ) : entries.length === 0 ? (
          <Card className="text-center">
            <p className="text-3xl">🧠</p>
            <p className="mt-1 text-sm font-bold text-ink">No entries yet</p>
            <p className="text-xs font-semibold text-ink-500">
              Finish a lesson or match and tap “Reflect” to start journaling.
            </p>
            <Link href="/"><Button className="mt-3">Go learn</Button></Link>
          </Card>
        ) : (
          [...byDay.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-extrabold text-ink">
                {new Date(day + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </h2>
              <div className="flex flex-col gap-2">
                {list.map((e) => (
                  <Card key={e.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{KIND_EMOJI[e.kind] ?? "📔"}</span>
                      <span className="flex-1 text-sm font-extrabold text-ink">{e.title}</span>
                      <span className="text-lg" title={`Confidence ${e.confidence}/5`}>{CONF[e.confidence - 1]}</span>
                      <button
                        aria-label="Delete entry"
                        onClick={() => remove(e.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-300 hover:bg-surface-sunken"
                      >
                        ✕
                      </button>
                    </div>
                    {e.summary && <p className="mt-1 text-xs font-semibold text-ink-500">{e.summary}</p>}
                    {e.note && <p className="mt-1 text-sm font-semibold text-ink-700">“{e.note}”</p>}
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-surface-sunken px-2 py-2">
      <div className="text-lg font-extrabold text-ink">{value}</div>
      <div className="text-[10px] font-semibold text-ink-500">{label}</div>
    </div>
  );
}
