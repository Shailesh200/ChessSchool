"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { journalKindIcon } from "@/components/ui/iconMaps";
import { useProgression } from "@/core/store/progression.store";
import { useMounted } from "@/core/hooks/useMounted";
import { listJournal, deleteJournalEntry, type JournalEntry } from "@/core/db/db";

const CONF = ["😣", "😕", "😐", "🙂", "😄"];

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
    ? Object.entries(weaknesses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
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
        <h1 className="text-ink text-xl font-extrabold">Learning Journal</h1>

        <Card>
          <p className="text-ink-300 text-xs font-extrabold tracking-wide uppercase">
            Growth summary
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Mini label="Entries" value={entries ? `${entries.length}` : "—"} />
            <Mini
              label="Avg confidence"
              value={avgConf ? `${CONF[Math.round(avgConf) - 1] ?? ""}` : "—"}
            />
            <Mini label="Recurring" value={`${topMistakes.length}`} />
          </div>
          {topMistakes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topMistakes.map(([tag, n]) => (
                <span
                  key={tag}
                  className="rounded-pill bg-danger/10 text-danger px-2 py-0.5 text-xs font-bold"
                >
                  {tag} ×{n}
                </span>
              ))}
            </div>
          )}
        </Card>

        {!entries ? (
          <div className="skeleton rounded-card h-24" />
        ) : entries.length === 0 ? (
          <Card className="text-center">
            <Icon name="brain" size={40} className="text-brand mx-auto" duotone />
            <p className="text-ink mt-1 text-sm font-bold">No entries yet</p>
            <p className="text-ink-500 text-xs font-semibold">
              Finish a lesson or match and tap “Reflect” to start journaling.
            </p>
            <Link href="/">
              <Button className="mt-3">Go learn</Button>
            </Link>
          </Card>
        ) : (
          [...byDay.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="text-ink mb-2 text-sm font-extrabold">
                {new Date(day + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h2>
              <div className="flex flex-col gap-2">
                {list.map((e) => (
                  <Card key={e.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <Icon
                        name={journalKindIcon(e.kind)}
                        size={18}
                        className="text-brand shrink-0"
                      />
                      <span className="text-ink flex-1 text-sm font-extrabold">
                        {e.title}
                      </span>
                      <span className="text-lg" title={`Confidence ${e.confidence}/5`}>
                        {CONF[e.confidence - 1]}
                      </span>
                      <button
                        aria-label="Delete entry"
                        onClick={() => remove(e.id)}
                        className="text-ink-300 hover:bg-surface-sunken flex h-7 w-7 items-center justify-center rounded-full"
                      >
                        ✕
                      </button>
                    </div>
                    {e.summary && (
                      <p className="text-ink-500 mt-1 text-xs font-semibold">
                        {e.summary}
                      </p>
                    )}
                    {e.note && (
                      <p className="text-ink-700 mt-1 text-sm font-semibold">
                        “{e.note}”
                      </p>
                    )}
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
      <div className="text-ink text-lg font-extrabold">{value}</div>
      <div className="text-ink-500 text-[10px] font-semibold">{label}</div>
    </div>
  );
}
