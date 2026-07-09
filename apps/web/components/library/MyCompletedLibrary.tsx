"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useProgression } from "@/core/store/progression.store";
import { useMounted } from "@/core/hooks/useMounted";

export interface LibLesson {
  id: string;
  title: string;
  emoji: string;
  className: string;
}

/** A regular student's Library = the lessons they've actually completed. */
export function MyCompletedLibrary({ lessons }: { lessons: LibLesson[] }) {
  const records = useProgression((s) => s.lessons);
  const mounted = useMounted();

  const done = mounted
    ? lessons.filter((l) => (records[l.id]?.mastery ?? 0) >= 0.9)
    : [];
  const byClass = new Map<string, LibLesson[]>();
  for (const l of done) {
    const arr = byClass.get(l.className) ?? [];
    arr.push(l);
    byClass.set(l.className, arr);
  }

  return (
    <div>
      <h1 className="text-ink text-2xl font-extrabold">Your Library</h1>
      <p className="text-ink-500 text-sm font-semibold">
        {done.length} {done.length === 1 ? "lesson" : "lessons"} completed — revisit any
        of them anytime.
      </p>

      {done.length === 0 ? (
        <div className="rounded-card border-hairline bg-surface-sunken/50 mt-6 border border-dashed p-6 text-center">
          <p className="text-ink-500 text-sm font-bold">
            📚 No completed lessons yet — finish lessons in the campus and they&apos;ll
            collect here.
          </p>
          <Link
            href="/"
            className="rounded-pill bg-brand mt-3 inline-block px-4 py-2 text-sm font-bold text-white"
          >
            Go to campus →
          </Link>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {[...byClass.entries()].map(([className, items]) => (
            <section key={className}>
              <h2 className="text-ink mb-2 text-sm font-extrabold">{className}</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((l) => (
                  <Link
                    key={l.id}
                    href={`/library/lesson/${l.id}`}
                    className="btn-tactile rounded-card border-hairline bg-surface-card flex items-center gap-3 border p-3 [box-shadow:var(--shadow-card)]"
                  >
                    <span className="text-2xl">{l.emoji}</span>
                    <p className="text-ink min-w-0 flex-1 truncate text-sm font-extrabold">
                      {l.title}
                    </p>
                    <Icon name="check" size={18} className="text-success" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
