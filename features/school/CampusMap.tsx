"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import {
  STAGES,
  semestersForStage,
  classProgress,
  isClassGraduated,
  isClassUnlocked,
  type SchoolClass,
} from "./structure";
import { useProgression } from "@/core/store/progression.store";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";

export function CampusMap() {
  const records = useProgression((s) => s.lessons);
  const graduated = useProgression((s) => s.graduatedClasses);

  return (
    <div className="flex flex-col gap-8">
      {STAGES.map((stage) => {
        const semesters = semestersForStage(stage.id);
        return (
          <section key={stage.id}>
            {/* Stage header — the full Elementary → Master ladder */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">{stage.emoji}</span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-extrabold text-ink">{stage.name}</h2>
                <p className="truncate text-[11px] font-semibold text-ink-500">{stage.blurb}</p>
              </div>
            </div>

            {stage.status === "upcoming" || semesters.length === 0 ? (
              <div className="rounded-card border border-dashed border-hairline bg-surface-sunken/50 p-4 text-center">
                <p className="text-xs font-bold text-ink-500">
                  🔒 Unlocks after you graduate the earlier stages — more classes coming.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {semesters.map((sem) => (
                  <div key={sem.id}>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="shrink-0 rounded-pill px-3 py-1 text-xs font-extrabold text-white"
                        style={{ backgroundColor: sem.color }}
                      >
                        {sem.title}
                      </span>
                      <span className="truncate text-xs font-semibold text-ink-500">{sem.blurb}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {sem.classes.map((cls, i) => (
                        <ClassCard
                          key={cls.id}
                          cls={cls}
                          color={sem.color}
                          records={records}
                          graduated={graduated}
                          delay={i * 0.05}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ClassCard({
  cls,
  color,
  records,
  graduated,
  delay,
}: {
  cls: SchoolClass;
  color: string;
  records: ReturnType<typeof useProgression.getState>["lessons"];
  graduated: string[];
  delay: number;
}) {
  const router = useRouter();
  const unlocked = isClassUnlocked(cls.id, records, graduated);
  const grad = isClassGraduated(cls, records, graduated);
  const { done, total } = classProgress(cls, records);

  function openClass() {
    if (!unlocked) {
      haptics.fire("error");
      audio.play("fail");
      return;
    }
    haptics.fire("tap");
    audio.play("transition");
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
    </motion.div>
  );
}
