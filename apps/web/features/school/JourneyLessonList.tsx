"use client";

import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";

type NodeStatus = "completed" | "active" | "locked" | "exam";

export type JourneyNodeData = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  mastery: number;
  status: NodeStatus;
};

/** Compact lesson list for Journey desktop sidebar (lg+). */
export function JourneyLessonList({
  nodes,
  examNode,
  activeId,
  onSelect,
  className,
}: {
  nodes: JourneyNodeData[];
  examNode?: JourneyNodeData | null;
  activeId?: string;
  onSelect: (id: string, status: NodeStatus) => void;
  className?: string;
}) {
  const all = examNode ? [...nodes, examNode] : nodes;

  return (
    <aside
      className={cn(
        "rounded-card border-hairline bg-surface-card hidden flex-col border [box-shadow:var(--shadow-card)] lg:flex",
        className,
      )}
      aria-label="Lesson list"
    >
      <div className="border-hairline border-b px-4 py-3">
        <p className="text-ink text-sm font-extrabold">Lessons</p>
        <p className="text-ink-500 text-xs font-semibold">
          {nodes.filter((n) => n.status === "completed").length}/{nodes.length} mastered
        </p>
      </div>
      <ul className="flex max-h-[min(70vh,640px)] flex-col gap-1 overflow-y-auto p-2">
        {all.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(node.id, node.status)}
              disabled={node.status === "locked"}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                node.id === activeId && "bg-brand-50 ring-brand/30 ring-1",
                node.status === "locked"
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-surface-sunken/80",
              )}
            >
              <LessonListIcon node={node} />
              <span className="min-w-0 flex-1">
                <span className="text-ink block truncate text-sm font-extrabold">
                  {node.title}
                </span>
                <span className="text-ink-500 block truncate text-[11px] font-semibold">
                  {node.subtitle}
                </span>
              </span>
              {node.status !== "locked" &&
                node.mastery > 0 &&
                node.status !== "completed" && (
                  <span className="text-brand shrink-0 text-[10px] font-extrabold tabular-nums">
                    {Math.round(node.mastery * 100)}%
                  </span>
                )}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function LessonListIcon({ node }: { node: JourneyNodeData }) {
  if (node.status === "locked") {
    return (
      <span className="bg-surface-sunken flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <Icon name="lock" size={18} className="text-ink-300" />
      </span>
    );
  }
  if (node.status === "completed") {
    return (
      <span className="bg-gold/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <Icon name="check" size={18} className="text-gold" />
      </span>
    );
  }
  if (node.status === "exam") {
    return (
      <span className="bg-warning/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
        📝
      </span>
    );
  }
  if (node.status === "active") {
    return (
      <span className="bg-brand-50 ring-brand/40 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ring-2">
        {node.emoji}
      </span>
    );
  }
  return (
    <span className="bg-surface-sunken flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
      {node.emoji}
    </span>
  );
}

export function JourneyHeaderStats({
  lessonCount,
  minutes,
  done,
  className,
}: {
  lessonCount: number;
  minutes: number;
  done: number;
  className?: string;
}) {
  return (
    <div className={cn("mt-3 flex flex-wrap gap-2 text-[11px] font-bold", className)}>
      <span className="rounded-pill bg-surface-sunken text-ink-700 flex items-center gap-1 px-2 py-1">
        <Icon name="learn" size={14} className="text-brand" />
        {lessonCount} lessons
      </span>
      <span className="rounded-pill bg-surface-sunken text-ink-700 px-2 py-1">
        ~{minutes} min
      </span>
      <span className="rounded-pill bg-surface-sunken text-ink-700 flex items-center gap-1 px-2 py-1">
        <Icon name="star" size={14} className="text-gold" />
        {done}/{lessonCount} mastered
      </span>
    </div>
  );
}

export function JourneyProgressSummary({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  return (
    <div className={cn("mt-4", className)}>
      <ProgressBar value={done} max={total || 1} tone="brand" label="Class progress" />
    </div>
  );
}
