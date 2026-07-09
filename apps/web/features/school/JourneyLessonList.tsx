"use client";

import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/Icon";
import { ContentIcon } from "@/components/ui/ContentIcon";
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

/** Desktop lesson preview — coach blurb + Start CTA per journey wireframe. */
export function JourneyLessonPreview({
  node,
  onStart,
  busy,
}: {
  node: JourneyNodeData | null;
  onStart: () => void;
  busy?: boolean;
}) {
  if (!node) {
    return (
      <div
        className="rounded-card border-hairline bg-surface-card flex min-h-[280px] flex-col items-center justify-center border p-6 text-center [box-shadow:var(--shadow-card)]"
        aria-label="Lesson preview"
      >
        <Icon name="learn" size={40} className="text-brand mb-2" duotone />
        <p className="text-ink text-sm font-extrabold">Select a milestone</p>
        <p className="text-ink-500 mt-1 max-w-xs text-xs font-semibold">
          Tap a node on the path to preview the lesson before you start.
        </p>
      </div>
    );
  }

  const locked = node.status === "locked";
  const coach =
    node.status === "exam"
      ? "Pass the class exam to graduate. Take your time — you need about two-thirds correct to pass."
      : node.status === "completed"
        ? "You mastered this one. Replay anytime to keep the pattern sharp."
        : node.subtitle ||
          "Work through the positions with Cody. Each step builds on the last.";

  return (
    <div
      className="rounded-card border-hairline bg-surface-card flex flex-col border [box-shadow:var(--shadow-card)]"
      aria-label="Lesson preview"
    >
      <div className="border-hairline flex items-center gap-3 border-b px-5 py-4">
        <LessonListIcon node={node} />
        <div className="min-w-0 flex-1">
          <p className="text-ink truncate text-lg font-extrabold">{node.title}</p>
          <p className="text-ink-500 truncate text-xs font-semibold">{node.subtitle}</p>
        </div>
        {node.status === "active" && (
          <span className="rounded-pill bg-brand/15 text-brand shrink-0 px-2 py-0.5 text-[10px] font-extrabold uppercase">
            Up next
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        <div className="rounded-card bg-surface-sunken/80 flex aspect-[4/3] max-h-40 items-center justify-center">
          <ContentIcon emoji={node.emoji} size={48} variant="badge" />
        </div>
        <p className="text-ink-700 text-sm leading-relaxed font-semibold">{coach}</p>
        {node.status !== "locked" &&
          node.mastery > 0 &&
          node.status !== "completed" && (
            <ProgressBar
              value={Math.round(node.mastery * 100)}
              max={100}
              tone="brand"
              label="Mastery"
            />
          )}
        <button
          type="button"
          disabled={locked}
          onClick={onStart}
          className="btn-tactile rounded-pill bg-brand mt-auto w-full py-3 text-sm font-extrabold text-white disabled:opacity-50"
        >
          {busy
            ? "Opening…"
            : node.status === "exam"
              ? "Start exam"
              : node.status === "completed"
                ? "Review lesson"
                : "Start lesson"}
        </button>
      </div>
    </div>
  );
}

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
      role="navigation"
      className={cn(
        "rounded-card border-hairline bg-surface-card flex flex-col border [box-shadow:var(--shadow-card)]",
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
      <span className="bg-warning/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <ContentIcon name="journal" size={18} variant="plain" />
      </span>
    );
  }
  if (node.status === "active") {
    return (
      <span className="bg-brand-50 ring-brand/40 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-2">
        <ContentIcon emoji={node.emoji} size={20} variant="plain" />
      </span>
    );
  }
  return (
    <span className="bg-surface-sunken flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
      <ContentIcon emoji={node.emoji} size={20} variant="plain" />
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
