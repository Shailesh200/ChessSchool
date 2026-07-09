"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { journalKindIcon } from "@/components/ui/iconMaps";
import { cn } from "@/components/ui/cn";
import { useProgression } from "@/core/store/progression.store";
import { useMounted } from "@/core/hooks/useMounted";
import { listJournal, deleteJournalEntry, type JournalEntry } from "@/core/db/db";

const CONF = ["😣", "😕", "😐", "🙂", "😄"];

export default function JournalPage() {
  const mounted = useMounted();
  const weaknesses = useProgression((s) => s.weaknesses);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    listJournal().then(setEntries);
  }, []);

  const activeEntryId = selectedId ?? entries?.[0]?.id ?? null;

  async function remove(id: string) {
    await deleteJournalEntry(id);
    setEntries((e) => e?.filter((x) => x.id !== id) ?? null);
    setSelectedId((current) => (current === id ? null : current));
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

  const selected = entries?.find((e) => e.id === activeEntryId) ?? null;

  return (
    <AppShell>
      <div className="flex flex-col gap-5 lg:gap-6">
        <BackButton />
        <h1 className="text-ink text-xl font-extrabold lg:text-2xl">
          Learning Journal
        </h1>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,1.15fr)] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-5">
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
              <Card className="text-center lg:col-span-2">
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
              <div className="flex flex-col gap-4 lg:max-h-[min(70vh,640px)] lg:overflow-y-auto">
                {[...byDay.entries()].map(([day, list]) => (
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
                        <JournalEntryRow
                          key={e.id}
                          entry={e}
                          selected={activeEntryId === e.id}
                          onSelect={() => setSelectedId(e.id)}
                          onDelete={() => remove(e.id)}
                          variant="list"
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <JournalEntryDetail
            entry={selected}
            className="hidden lg:flex"
            onDelete={selected ? () => remove(selected.id) : undefined}
          />
        </div>
      </div>
    </AppShell>
  );
}

function JournalEntryRow({
  entry,
  selected,
  onSelect,
  onDelete,
  variant,
}: {
  entry: JournalEntry;
  selected?: boolean;
  onSelect?: () => void;
  onDelete: () => void;
  variant: "list" | "card";
}) {
  const interactive = variant === "list";

  return (
    <Card
      className={cn(
        "p-3",
        interactive && "cursor-pointer transition-colors lg:p-2.5",
        interactive && selected && "ring-brand/30 bg-brand-50/50 ring-1",
        interactive && !selected && "hover:bg-surface-sunken/50",
      )}
      {...(interactive
        ? {
            role: "button" as const,
            tabIndex: 0,
            onClick: onSelect,
            onKeyDown: (ev: React.KeyboardEvent) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onSelect?.();
              }
            },
          }
        : {})}
    >
      <div className="flex items-center gap-2">
        <Icon
          name={journalKindIcon(entry.kind)}
          size={18}
          className="text-brand shrink-0"
        />
        <span className="text-ink flex-1 text-sm font-extrabold">{entry.title}</span>
        <span className="text-lg" title={`Confidence ${entry.confidence}/5`}>
          {CONF[entry.confidence - 1]}
        </span>
        <button
          aria-label="Delete entry"
          onClick={(ev) => {
            ev.stopPropagation();
            onDelete();
          }}
          className="text-ink-300 hover:bg-surface-sunken flex h-7 w-7 items-center justify-center rounded-full"
        >
          ✕
        </button>
      </div>
      {entry.summary && (
        <p
          className={cn(
            "text-ink-500 mt-1 text-xs font-semibold",
            interactive && "lg:hidden",
          )}
        >
          {entry.summary}
        </p>
      )}
      {entry.note && (
        <p
          className={cn(
            "text-ink-700 mt-1 text-sm font-semibold",
            interactive && "lg:hidden",
          )}
        >
          “{entry.note}”
        </p>
      )}
    </Card>
  );
}

function JournalEntryDetail({
  entry,
  className,
  onDelete,
}: {
  entry: JournalEntry | null;
  className?: string;
  onDelete?: () => void;
}) {
  return (
    <aside
      aria-label="Journal entry detail"
      className={cn(
        "rounded-card border-hairline bg-surface-card sticky top-6 flex min-h-[320px] flex-col border p-5 [box-shadow:var(--shadow-card)]",
        className,
      )}
    >
      {!entry ? (
        <>
          <Icon name="brain" size={40} className="text-brand mb-2" duotone />
          <p className="text-ink text-sm font-extrabold">Select an entry</p>
          <p className="text-ink-500 mt-1 text-xs font-semibold">
            Your reflections appear here on desktop. Finish a lesson and tap Reflect to
            add one.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <Icon
              name={journalKindIcon(entry.kind)}
              size={22}
              className="text-brand shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-ink text-lg font-extrabold">{entry.title}</p>
              <p className="text-ink-500 text-xs font-semibold">
                {new Date(entry.day + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <span className="text-2xl" title={`Confidence ${entry.confidence}/5`}>
              {CONF[entry.confidence - 1]}
            </span>
          </div>
          {entry.summary && (
            <p className="text-ink-700 mt-4 text-sm leading-relaxed font-semibold">
              {entry.summary}
            </p>
          )}
          {entry.note && (
            <blockquote className="border-brand/30 text-ink mt-4 border-l-4 pl-4 text-base leading-relaxed font-semibold italic">
              “{entry.note}”
            </blockquote>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-danger mt-auto pt-6 text-left text-sm font-bold"
            >
              Delete entry
            </button>
          )}
        </>
      )}
    </aside>
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
