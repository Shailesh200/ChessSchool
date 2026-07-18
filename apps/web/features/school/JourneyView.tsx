"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ContentIcon } from "@/components/ui/ContentIcon";
import { BackButton } from "@/components/ui/BackButton";
import { isClassUnlocked, type SchoolClass } from "./structure";
import { isUnlocked } from "@/features/lessons/unlock";
import { useProgression } from "@/core/store/progression.store";
import { startNav } from "@/core/store/nav.store";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";
import {
  JourneyHeaderStats,
  JourneyLessonList,
  JourneyLessonPreview,
  JourneyProgressSummary,
  type JourneyNodeData,
} from "./JourneyLessonList";

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
  const [shown, setShown] = useState(6);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const unlockedClass = isClassUnlocked(cls.id, records, graduated, allClasses);
  const done = lessons.filter((l) => (records[l.id]?.mastery ?? 0) >= 0.9).length;
  const minutes = (lessons.length + (cls.examId ? 1 : 0)) * 3;

  // The first unlocked, not-yet-mastered lesson is the "active" milestone.
  const activeIndex = unlockedClass
    ? lessons.findIndex(
        (l) => isUnlocked(l.id, records) && (records[l.id]?.mastery ?? 0) < 0.9,
      )
    : -1;
  const nodes = lessons.map((l, i) => {
    const mastery = records[l.id]?.mastery ?? 0;
    const status: NodeStatus =
      !unlockedClass || !isUnlocked(l.id, records)
        ? "locked"
        : mastery >= 0.9
          ? "completed"
          : i === activeIndex
            ? "active"
            : "locked";
    return {
      id: l.id,
      title: l.title,
      subtitle: l.subtitle,
      emoji: l.emoji,
      mastery,
      status,
    };
  });
  // Collapsed by default — always show up to the active milestone; load more on demand.
  const visibleCount = Math.min(nodes.length, Math.max(shown, activeIndex + 1));

  function isDesktopJourney() {
    return (
      typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
    );
  }

  function selectNode(id: string, status: NodeStatus) {
    if (status === "locked") {
      haptics.fire("error");
      audio.play("fail");
      return;
    }
    setSelectedId(id);
    if (!isDesktopJourney()) go(id, status);
  }

  function go(id: string, status: NodeStatus) {
    if (status === "locked") {
      haptics.fire("error");
      audio.play("fail");
      return;
    }
    if (busy) return; // ignore taps while a navigation is already in flight
    setBusy(id);
    haptics.fire("tap");
    audio.play("transition");
    startNav();
    router.push(`/lesson/${id}`);
  }

  const firstActionable =
    nodes.find((n) => n.status === "active") ??
    nodes.find((n) => n.status === "completed");

  const examNode: JourneyNodeData | null = examLesson
    ? {
        id: examLesson.id,
        title: examLesson.title,
        subtitle: "Pass to graduate",
        emoji: "📝",
        mastery: 0,
        status: unlockedClass ? "exam" : "locked",
      }
    : null;

  const activeId = nodes.find((n) => n.status === "active")?.id;
  const allNodes = examNode ? [...nodes, examNode] : nodes;
  const previewId = selectedId ?? activeId ?? firstActionable?.id ?? null;
  const previewNode = allNodes.find((n) => n.id === previewId) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <BackButton label="Campus" fallback="/" className="self-start lg:hidden" />
      <button
        onClick={() => router.push("/academy")}
        className="text-brand hidden self-start text-sm font-bold lg:inline-flex lg:items-center lg:gap-1"
      >
        <Icon name="chevronRight" size={16} className="rotate-180" />
        Campus
      </button>

      {/* Subject header */}
      <div className="rounded-card border-hairline bg-surface-card border p-4 [box-shadow:var(--shadow-card)] lg:p-5">
        <div className="flex items-center gap-3">
          <div className="bg-brand-50 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl lg:h-16 lg:w-16">
            <ContentIcon emoji={cls.emoji} size={28} variant="badge" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-ink truncate text-lg font-extrabold lg:text-2xl">
              {cls.title}
            </h1>
            <p className="text-ink-500 truncate text-xs font-semibold lg:text-sm">
              {cls.blurb}
            </p>
          </div>
        </div>
        <JourneyHeaderStats
          lessonCount={lessons.length}
          minutes={minutes}
          done={done}
        />
        <JourneyProgressSummary
          done={done}
          total={lessons.length}
          className="hidden lg:block"
        />
        {firstActionable && (
          <Button
            block
            className="mt-3 lg:mt-4 lg:max-w-xs"
            loading={busy === firstActionable.id}
            onClick={() => go(firstActionable.id, firstActionable.status)}
          >
            {done > 0 ? "Continue journey" : "Start journey"}
          </Button>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(300px,3fr)] lg:items-start lg:gap-8">
        {/* Milestone path */}
        <ol className="relative mx-auto flex w-full max-w-xs flex-col items-center lg:max-w-md lg:justify-self-center">
          {nodes.slice(0, visibleCount).map((n, i) => (
            <JourneyNode
              key={n.id}
              node={n}
              index={i}
              onClick={() => selectNode(n.id, n.status)}
            />
          ))}
          {visibleCount < nodes.length && (
            <li className="mt-3 w-full">
              <Button
                variant="ghost"
                block
                onClick={() => {
                  setShown((s) => s + 8);
                  haptics.fire("tap");
                }}
              >
                Show {Math.min(8, nodes.length - visibleCount)} more lessons ▾
              </Button>
            </li>
          )}
          {examLesson && visibleCount >= nodes.length && examNode && (
            <JourneyNode
              node={examNode}
              index={nodes.length}
              onClick={() => selectNode(examNode.id, examNode.status)}
              isExam
            />
          )}
        </ol>

        <div className="hidden flex-col gap-4 lg:flex">
          <JourneyLessonPreview
            node={previewNode}
            busy={busy === previewNode?.id}
            onStart={() => {
              if (previewNode) go(previewNode.id, previewNode.status);
            }}
          />
          <JourneyLessonList
            nodes={nodes}
            examNode={visibleCount >= nodes.length ? examNode : null}
            activeId={previewId ?? undefined}
            onSelect={selectNode}
            className="max-h-[280px]"
          />
        </div>
      </div>

      {/* Test out (#12/#2) — appears once you're ≥50% through the class. */}
      {unlockedClass &&
        lessons.length > 0 &&
        done / lessons.length >= 0.5 &&
        done < lessons.length && (
          <div className="mx-auto w-full max-w-xs lg:max-w-md">
            <Button
              variant="outline"
              block
              onClick={() => {
                haptics.fire("tap");
                audio.play("transition");
                startNav();
                router.push(`/class/${cls.id}/exam`);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="cap" size={18} className="text-gold" />
                Test out of this class
              </span>
            </Button>
            <p className="text-ink-500 mt-1 text-center text-[11px] font-semibold">
              You&apos;re halfway — pass the exam (≥67%) to skip straight to the next
              class.
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
  node: {
    id: string;
    title: string;
    subtitle: string;
    emoji: string;
    mastery: number;
    status: NodeStatus;
  };
  index: number;
  onClick: () => void;
  isExam?: boolean;
}) {
  const offset =
    index % 2 === 0
      ? "translate-x-0"
      : index % 4 === 1
        ? "translate-x-12"
        : "-translate-x-12";
  const r = 30;
  const circ = 2 * Math.PI * r;
  const ringColor =
    node.status === "completed" ? "#f6c343" : isExam ? "#f59e0b" : "#5b5bd6";
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
          className="rounded-pill my-1 h-6 w-1.5"
          style={{ background: "var(--hairline)" }}
        />
      )}
      <motion.button
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: index * 0.04,
          type: "spring",
          stiffness: 280,
          damping: 22,
        }}
        whileTap={{ scale: 0.92 }}
        onClick={onClick}
        className={`group flex flex-col items-center gap-1 ${offset}`}
        aria-label={`${node.title}${node.status === "locked" ? " (locked)" : ""}`}
      >
        <span className="relative inline-flex items-center justify-center">
          {node.status === "active" && (
            <motion.span
              className="bg-brand/25 absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <svg width="76" height="76" className="-rotate-90">
            <circle
              cx="38"
              cy="38"
              r={r}
              fill="none"
              stroke="var(--surface-sunken)"
              strokeWidth="6"
            />
            <circle
              cx="38"
              cy="38"
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={
                circ *
                (1 -
                  (node.status === "locked"
                    ? 0
                    : Math.max(node.mastery, node.status === "completed" ? 1 : 0.06)))
              }
            />
          </svg>
          <span
            className="absolute flex h-12 w-12 items-center justify-center rounded-full text-xl [box-shadow:var(--shadow-button)]"
            style={{
              background: bg,
              filter: node.status === "locked" ? "grayscale(1)" : "none",
              opacity: node.status === "locked" ? 0.6 : 1,
            }}
          >
            {node.status === "locked" ? (
              <Icon name="lock" size={20} className="text-ink-400" />
            ) : node.status === "completed" ? (
              <Icon name="check" size={20} className="text-gold" />
            ) : (
              <ContentIcon emoji={node.emoji} size={22} variant="plain" />
            )}
          </span>
        </span>
        <span className="text-ink max-w-[9rem] truncate text-sm font-extrabold">
          {node.title}
        </span>
        <span className="text-ink-500 max-w-[9rem] truncate text-[11px] font-semibold">
          {node.subtitle}
        </span>
      </motion.button>
    </li>
  );
}
