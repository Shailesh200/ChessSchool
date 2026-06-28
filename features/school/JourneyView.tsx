"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { isClassUnlocked, type SchoolClass } from "./structure";
import { useProgression } from "@/core/store/progression.store";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";

type NodeStatus = "completed" | "active" | "locked" | "exam";
type LessonLite = { id: string; title: string; subtitle: string; emoji: string };

/** Subject Journey — a connected milestone path of lessons → exam (#96/#97). */
export function JourneyView({
  cls,
  lessons,
  examLesson,
  allClasses,
}: {
  cls: { id: string; title: string; emoji: string; blurb: string; examId?: string };
  lessons: LessonLite[];
  examLesson: { id: string; title: string } | null;
  allClasses: SchoolClass[];
}) {
  const router = useRouter();
  const records = useProgression((s) => s.lessons);
  const graduated = useProgression((s) => s.graduatedClasses);

  const unlockedClass = isClassUnlocked(cls.id, records, graduated, allClasses);
  const done = lessons.filter((l) => (records[l.id]?.mastery ?? 0) >= 0.9).length;
  const minutes = (lessons.length + (cls.examId ? 1 : 0)) * 3;

  // The first unlocked, not-yet-mastered lesson is the "active" milestone.
  const activeIndex = unlockedClass
    ? lessons.findIndex((l) => (records[l.id]?.mastery ?? 0) < 0.9)
    : -1;
  const nodes = lessons.map((l, i) => {
    const mastery = records[l.id]?.mastery ?? 0;
    const status: NodeStatus =
      mastery >= 0.9 ? "completed" : i === activeIndex ? "active" : "locked";
    return { id: l.id, title: l.title, subtitle: l.subtitle, emoji: l.emoji, mastery, status };
  });

  function go(id: string, status: NodeStatus) {
    if (status === "locked") {
      haptics.fire("error");
      audio.play("fail");
      return;
    }
    haptics.fire("tap");
    audio.play("transition");
    router.push(`/lesson/${id}`);
  }

  const firstActionable = nodes.find((n) => n.status === "active") ?? nodes.find((n) => n.status === "completed");

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => router.push("/")} className="self-start text-sm font-bold text-brand">
        ← Campus
      </button>

      {/* Subject header */}
      <div className="rounded-card border border-hairline bg-surface-card p-4 [box-shadow:var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl">
            {cls.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold text-ink">{cls.title}</h1>
            <p className="truncate text-xs font-semibold text-ink-500">{cls.blurb}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-pill bg-surface-sunken px-2 py-1 text-ink-700">📚 {lessons.length} lessons</span>
          <span className="rounded-pill bg-surface-sunken px-2 py-1 text-ink-700">⏱️ ~{minutes} min</span>
          <span className="rounded-pill bg-surface-sunken px-2 py-1 text-ink-700">⭐ {done}/{lessons.length} mastered</span>
        </div>
        {firstActionable && (
          <Button
            block
            className="mt-3"
            onClick={() => go(firstActionable.id, firstActionable.status)}
          >
            {done > 0 ? "Continue journey" : "Start journey"}
          </Button>
        )}
      </div>

      {/* Milestone path */}
      <ol className="relative mx-auto flex w-full max-w-xs flex-col items-center">
        {nodes.map((n, i) => (
          <JourneyNode key={n.id} node={n} index={i} onClick={() => go(n.id, n.status)} />
        ))}
        {examLesson && (
          <JourneyNode
            node={{
              id: examLesson.id,
              title: examLesson.title,
              subtitle: "Pass to graduate",
              emoji: "📝",
              mastery: 0,
              status: unlockedClass ? "exam" : "locked",
            }}
            index={nodes.length}
            onClick={() => go(examLesson.id, unlockedClass ? "exam" : "locked")}
            isExam
          />
        )}
      </ol>

      {/* Test out (#12/#2) — appears once you're ≥50% through the class. */}
      {unlockedClass && lessons.length > 0 && done / lessons.length >= 0.5 && done < lessons.length && (
        <div className="mx-auto w-full max-w-xs">
          <Button
            variant="outline"
            block
            onClick={() => {
              haptics.fire("tap");
              audio.play("transition");
              router.push(`/class/${cls.id}/exam`);
            }}
          >
            🎓 Test out of this class
          </Button>
          <p className="mt-1 text-center text-[11px] font-semibold text-ink-500">
            You&apos;re halfway — pass the exam (≥67%) to skip straight to the next class.
          </p>
        </div>
      )}
    </div>
  );
}

function JourneyNode({
  node,
  index,
  onClick,
  isExam = false,
}: {
  node: { id: string; title: string; subtitle: string; emoji: string; mastery: number; status: NodeStatus };
  index: number;
  onClick: () => void;
  isExam?: boolean;
}) {
  const offset = index % 2 === 0 ? "translate-x-0" : index % 4 === 1 ? "translate-x-12" : "-translate-x-12";
  const r = 30;
  const circ = 2 * Math.PI * r;
  const ringColor = node.status === "completed" ? "#f6c343" : isExam ? "#f59e0b" : "#5b5bd6";
  const bg =
    node.status === "locked"
      ? "var(--surface-sunken)"
      : node.status === "completed"
        ? "#fff"
        : isExam
          ? "#fff7e6"
          : "#fff";

  return (
    <li className="flex w-full flex-col items-center">
      {index > 0 && (
        <span
          aria-hidden
          className="my-1 h-6 w-1.5 rounded-pill"
          style={{ background: "var(--hairline)" }}
        />
      )}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, type: "spring", stiffness: 280, damping: 22 }}
        whileTap={{ scale: 0.92 }}
        onClick={onClick}
        className={`group flex flex-col items-center gap-1 ${offset}`}
        aria-label={`${node.title}${node.status === "locked" ? " (locked)" : ""}`}
      >
        <span className="relative inline-flex items-center justify-center">
          {node.status === "active" && (
            <motion.span
              className="absolute inset-0 rounded-full bg-brand/25"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <svg width="76" height="76" className="-rotate-90">
            <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth="6" />
            <circle
              cx="38" cy="38" r={r} fill="none" stroke={ringColor} strokeWidth="6"
              strokeLinecap="round" strokeDasharray={circ}
              strokeDashoffset={circ * (1 - (node.status === "locked" ? 0 : Math.max(node.mastery, node.status === "completed" ? 1 : 0.06)))}
            />
          </svg>
          <span
            className="absolute flex h-12 w-12 items-center justify-center rounded-full text-xl [box-shadow:var(--shadow-button)]"
            style={{ background: bg, filter: node.status === "locked" ? "grayscale(1)" : "none", opacity: node.status === "locked" ? 0.6 : 1 }}
          >
            {node.status === "locked" ? "🔒" : node.status === "completed" ? "✓" : node.emoji}
          </span>
        </span>
        <span className="max-w-[9rem] truncate text-sm font-extrabold text-ink">{node.title}</span>
        <span className="max-w-[9rem] truncate text-[11px] font-semibold text-ink-500">{node.subtitle}</span>
      </motion.button>
    </li>
  );
}
