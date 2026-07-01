"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import {
  semestersForStage,
  classProgress,
  isClassGraduated,
  isClassUnlocked,
  type SchoolClass,
  type Catalog,
} from "./structure";
import { useProgression } from "@/core/store/progression.store";
import { startNav } from "@/core/store/nav.store";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";

export function CampusMap({ catalog }: { catalog: Catalog }) {
  const records = useProgression((s) => s.lessons);
  const graduated = useProgression((s) => s.graduatedClasses);
  const examsPassed = useProgression((s) => s.schoolExamsPassed);
  const router = useRouter();
  const [showCompleted, setShowCompleted] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [semShown, setSemShown] = useState<Record<string, number>>({});

  const isDone = (cls: SchoolClass) => isClassGraduated(cls, records, graduated);
  // Everything before your current position (the first not-yet-graduated class)
  // is "past" and hidden — whether it was completed or skipped via a placement.
  const frontierIdx = (() => {
    const i = catalog.allClasses.findIndex((c) => !isDone(c));
    return i === -1 ? catalog.allClasses.length : i;
  })();
  const pastIds = new Set(catalog.allClasses.slice(0, frontierIdx).map((c) => c.id));

  // Render only the current semester's classes; future semesters collapse to a
  // tappable teaser (far less DOM → faster paint, less overwhelming).
  const classIndex = new Map(catalog.allClasses.map((c, i) => [c.id, i]));
  const isFutureSem = (sem: { classes: SchoolClass[] }) =>
    Math.min(...sem.classes.map((c) => classIndex.get(c.id) ?? Infinity)) > frontierIdx;

  // Sequential schools: a stage is "cleared" when all its classes are graduated;
  // the next stage unlocks only once the previous is cleared.
  const stageInfos = catalog.stages
    .map((stage) => {
      const semesters = semestersForStage(stage.id, catalog.semesters);
      const classes = semesters.flatMap((s) => s.classes);
      // Cleared = all classes graduated, OR the school exam passed (the shortcut).
      const cleared = examsPassed.includes(stage.id) || (classes.length > 0 && classes.every(isDone));
      return { stage, semesters, classes, cleared };
    })
    .filter((i) => i.classes.length > 0);
  const stages = stageInfos.map((info, idx) => ({
    ...info,
    // Unlocked once every earlier school is cleared.
    unlocked: idx === 0 || stageInfos.slice(0, idx).every((s) => s.cleared),
    prevName: idx > 0 ? stageInfos[idx - 1]!.stage.name : "",
  }));

  return (
    <div className="flex flex-col gap-8">
      {pastIds.size > 0 && (
        <div className="-mb-3 flex justify-end">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="rounded-pill bg-surface-sunken px-3 py-1 text-xs font-bold text-ink-700"
          >
            {showCompleted ? "Hide" : "Show"} past classes ({pastIds.size})
          </button>
        </div>
      )}
      {stages.map(({ stage, semesters, classes: stageClasses, cleared, unlocked, prevName }, sIdx) => {
        const classCount = stageClasses.length;
        const descriptor = stage.blurb.split("·")[1]?.trim();
        const nextName = stages[sIdx + 1]?.stage.name;

        // Locked school — must clear the previous one first.
        if (!unlocked) {
          return (
            <section key={stage.id} className="opacity-70">
              <div className="rounded-card border border-dashed border-hairline bg-surface-sunken/40 p-4 text-center">
                <p className="text-2xl">🔒</p>
                <p className="mt-1 text-sm font-extrabold text-ink">{stage.name}</p>
                <p className="text-xs font-semibold text-ink-500">
                  Graduate {prevName} to unlock · {classCount} {classCount === 1 ? "class" : "classes"}
                </p>
              </div>
            </section>
          );
        }

        // Cleared school — collapse to a graduated banner (tap to review).
        const stageOpen = expanded.has(stage.id);
        if (cleared && !stageOpen) {
          return (
            <section key={stage.id}>
              <button
                onClick={() => setExpanded((s) => new Set(s).add(stage.id))}
                className="btn-tactile flex w-full items-center gap-2 rounded-card border border-gold/50 bg-gold/10 p-3 text-left"
              >
                <span className="text-xl">{stage.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-ink">🎓 {stage.name} — graduated</span>
                  <span className="block text-[11px] font-semibold text-ink-500">
                    {classCount} {classCount === 1 ? "class" : "classes"} · tap to review
                  </span>
                </span>
              </button>
            </section>
          );
        }

        const visibleSems = semesters
          .map((sem) => ({
            sem,
            classes: showCompleted || cleared ? sem.classes : sem.classes.filter((c) => !pastIds.has(c.id)),
          }))
          .filter((x) => x.classes.length > 0);
        return (
          <section key={stage.id}>
            {/* Stage header — the full Elementary → Master ladder */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">{stage.emoji}</span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-extrabold text-ink">{stage.name}</h2>
                <p className="truncate text-[11px] font-semibold text-ink-500">
                  {classCount} {classCount === 1 ? "class" : "classes"}
                  {descriptor ? ` · ${descriptor}` : ""}
                </p>
              </div>
              {cleared && stageOpen && (
                <button
                  onClick={() => setExpanded((s) => { const n = new Set(s); n.delete(stage.id); return n; })}
                  className="shrink-0 rounded-pill bg-surface-sunken px-2.5 py-1 text-[11px] font-bold text-ink-500"
                >
                  Hide
                </button>
              )}
            </div>

            {
              <div className="flex flex-col gap-5">
                {visibleSems.map(({ sem, classes }) => {
                  // Default: future class-groups collapsed, current one expanded.
                  // `expanded` holds the ids the user toggled away from that default,
                  // so ANY group can be collapsed/expanded with a tap.
                  const future = !showCompleted && isFutureSem(sem);
                  const toggled = expanded.has(sem.id);
                  const collapsed = future ? !toggled : toggled;
                  const toggle = () =>
                    setExpanded((s) => {
                      const n = new Set(s);
                      if (n.has(sem.id)) n.delete(sem.id);
                      else n.add(sem.id);
                      return n;
                    });
                  return (
                  <div key={sem.id}>
                    <button onClick={toggle} className="btn-tactile mb-2 flex w-full items-center gap-2 text-left">
                      <span
                        className="shrink-0 rounded-pill px-3 py-1 text-xs font-extrabold text-white"
                        style={{ backgroundColor: sem.color }}
                      >
                        {sem.title}
                      </span>
                      <span className="truncate text-xs font-semibold text-ink-500">{sem.blurb}</span>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        className={`ml-auto shrink-0 text-ink-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
                      >
                        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {collapsed ? (
                      <button
                        onClick={toggle}
                        className="btn-tactile w-full rounded-card border border-dashed border-hairline bg-surface-card/60 p-3 text-center text-xs font-bold text-ink-500"
                      >
                        {future ? "🔒 " : ""}{classes.length} {classes.length === 1 ? "class" : "classes"} — tap to preview
                      </button>
                    ) : (
                    <div className="flex flex-col gap-3">
                      {classes.slice(0, semShown[sem.id] ?? 8).map((cls, i) => (
                        <ClassCard
                          key={cls.id}
                          cls={cls}
                          color={sem.color}
                          records={records}
                          graduated={graduated}
                          allClasses={catalog.allClasses}
                          delay={i * 0.05}
                        />
                      ))}
                      {(semShown[sem.id] ?? 8) < classes.length && (
                        <button
                          onClick={() => setSemShown((s) => ({ ...s, [sem.id]: (s[sem.id] ?? 8) + 8 }))}
                          className="btn-tactile py-2 text-sm font-bold text-brand"
                        >
                          Show {Math.min(8, classes.length - (semShown[sem.id] ?? 8))} more classes ▾
                        </button>
                      )}
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
            }

            {/* School exam — the gateway to the next school (sits just above it). */}
            {!cleared && nextName && (
              <button
                onClick={() => { haptics.fire("tap"); audio.play("exam"); startNav(); router.push(`/exam/school/${stage.id}`); }}
                className="btn-tactile mt-4 flex w-full items-center justify-between rounded-card border-2 border-gold/50 bg-gold/10 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-extrabold text-ink">📝 {stage.name} Exam</span>
                  <span className="block text-xs font-semibold text-ink-500">Pass to unlock {nextName} →</span>
                </span>
                <span className="text-xl">🎓</span>
              </button>
            )}
          </section>
        );
      })}

      {/* End of the ladder */}
      <div className="rounded-card border border-dashed border-hairline bg-surface-sunken/40 p-4 text-center">
        <p className="text-sm font-extrabold text-ink">🚧 More schools coming soon</p>
        <p className="mt-1 text-xs font-semibold text-ink-500">
          New programs are being added — keep climbing the ladder!
        </p>
      </div>
    </div>
  );
}

function ClassCard({
  cls,
  color,
  records,
  graduated,
  allClasses,
  delay,
}: {
  cls: SchoolClass;
  color: string;
  records: ReturnType<typeof useProgression.getState>["lessons"];
  graduated: string[];
  allClasses: SchoolClass[];
  delay: number;
}) {
  const router = useRouter();
  const unlocked = isClassUnlocked(cls.id, records, graduated, allClasses);
  const grad = isClassGraduated(cls, records, graduated);
  const { done, total } = classProgress(cls, records);
  const idx = allClasses.findIndex((c) => c.id === cls.id);
  const prevId = idx > 0 ? allClasses[idx - 1]!.id : null;

  function openClass() {
    if (!unlocked) {
      haptics.fire("error");
      audio.play("fail");
      return;
    }
    haptics.fire("tap");
    audio.play("transition");
    startNav();
    // Open the subject Journey (milestone path), not a raw lesson list.
    router.push(`/class/${cls.id}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 24 }}
      className={`rounded-card border bg-surface-card p-4 [box-shadow:var(--shadow-card)] ${
        grad ? "border-gold" : "border-hairline"
      } ${unlocked ? "" : "opacity-60"}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
          style={{ backgroundColor: unlocked ? `${color}1a` : "var(--surface-sunken)" }}
        >
          {unlocked ? cls.emoji : "🔒"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-extrabold text-ink">{cls.title}</h2>
            {grad && <span className="shrink-0 text-sm" title="Graduated">🎓</span>}
          </div>
          <p className="truncate text-xs font-semibold text-ink-500">{cls.blurb}</p>
        </div>
        <span className="shrink-0 text-xs font-bold text-ink-500">
          {done}/{total}
        </span>
      </div>

      <ProgressBar
        className="mt-3"
        value={done}
        max={total}
        tone={grad ? "gold" : "brand"}
        label={`${cls.title} progress`}
      />

      {unlocked && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={openClass} variant={grad ? "outline" : "primary"} block>
            {grad ? "Review class" : done > 0 ? "Continue" : "Start class"}
          </Button>
          {cls.examId && !grad && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                haptics.fire("tap");
                audio.play("exam");
                router.push(`/lesson/${cls.examId}`);
              }}
            >
              📝 Test out
            </Button>
          )}
        </div>
      )}

      {!unlocked && prevId && (
        <Button
          size="sm"
          variant="outline"
          block
          className="mt-3"
          onClick={() => {
            haptics.fire("tap");
            audio.play("transition");
            startNav();
            router.push(`/class/${prevId}/exam`);
          }}
        >
          🎓 Test to unlock
        </Button>
      )}
    </motion.div>
  );
}
