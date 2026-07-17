"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { ContentIcon } from "@/components/ui/ContentIcon";
import { cn } from "@/components/ui/cn";

export type LibrarySemester = {
  id: string;
  title: string;
  blurb: string;
  color: string;
};

export type LibraryClass = {
  id: string;
  semesterId: string;
  title: string;
  emoji: string;
};

export function LibraryBrowse({
  semesters,
  classes,
  countByClass,
  total,
  userName,
}: {
  semesters: LibrarySemester[];
  classes: LibraryClass[];
  countByClass: Record<string, number>;
  total: number;
  userName: string | null;
}) {
  const [activeSemester, setActiveSemester] = useState<string>("all");

  const visibleSemesters = useMemo(() => {
    if (activeSemester === "all") return semesters;
    return semesters.filter((s) => s.id === activeSemester);
  }, [activeSemester, semesters]);

  return (
    <AppShell>
      <div className="flex flex-col gap-5 lg:gap-6">
        <BackButton />

        <div>
          <h1 className="text-ink text-xl font-extrabold lg:text-2xl">
            Chess Lesson Library
          </h1>
          <p className="text-ink-600 mt-2 text-sm leading-relaxed font-semibold">
            Browse every free chess lesson at ChessSchool — tactics puzzles, opening
            theory, endgames, and beginner classes. {total.toLocaleString()} interactive
            lessons across {classes.length} classes.
            {userName
              ? ` Welcome back, ${userName}!`
              : " Enroll free to track your progress."}
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <nav
            className="hidden flex-col gap-1 lg:sticky lg:top-6 lg:flex"
            aria-label="Library filters"
          >
            <FilterButton
              active={activeSemester === "all"}
              onClick={() => setActiveSemester("all")}
            >
              All semesters
            </FilterButton>
            {semesters.map((sem) => (
              <FilterButton
                key={sem.id}
                active={activeSemester === sem.id}
                onClick={() => setActiveSemester(sem.id)}
              >
                {sem.title}
              </FilterButton>
            ))}
          </nav>

          <div className="flex flex-col gap-6">
            {visibleSemesters.map((sem) => {
              const semClasses = classes.filter((c) => c.semesterId === sem.id);
              if (semClasses.length === 0) return null;
              return (
                <section key={sem.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="rounded-pill shrink-0 px-3 py-1 text-xs font-extrabold text-white"
                      style={{ backgroundColor: sem.color }}
                    >
                      {sem.title}
                    </span>
                    <span className="text-ink-500 truncate text-xs font-semibold">
                      {sem.blurb}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {semClasses.map((c) => (
                      <Link
                        key={c.id}
                        href={`/class/${c.id}`}
                        className="btn-tactile rounded-card border-hairline bg-surface-card flex items-center gap-3 border p-3 [box-shadow:var(--shadow-card)]"
                      >
                        <ContentIcon emoji={c.emoji} size={22} tone="brand" />
                        <div className="min-w-0 flex-1">
                          <p className="text-ink truncate text-sm font-extrabold">
                            {c.title}
                          </p>
                          <p className="text-ink-500 truncate text-xs font-semibold">
                            {countByClass[c.id] ?? 0} lessons
                          </p>
                        </div>
                        <Icon name="arrowRight" size={18} className="text-brand" />
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors",
        active
          ? "bg-brand-50 text-brand"
          : "text-ink-500 hover:bg-surface-sunken/80 hover:text-ink",
      )}
      aria-current={active ? "true" : undefined}
    >
      {children}
    </button>
  );
}
