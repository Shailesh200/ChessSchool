"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useProgression } from "@/core/store/progression.store";
import { useMatch } from "@/core/store/match.store";
import { currentLocation, classProgress, type Catalog } from "./structure";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";

/**
 * "Where am I + Continue" card (#61/#64). Always-visible breadcrumb of the
 * student's place in school plus the single most useful next action.
 */
export function ResumeCard({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const records = useProgression((s) => s.lessons);
  const graduated = useProgression((s) => s.graduatedClasses);
  const activeMatch = useMatch((s) => s.active);

  const loc = currentLocation(records, graduated, catalog.semesters, catalog.titles);
  const prog = classProgress(loc.cls, records);
  const semesterShort = loc.semester.title.split("·")[0]?.trim() ?? loc.semester.title;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-card border border-brand-100 bg-surface-card p-4 [box-shadow:var(--shadow-card)]"
    >
      {/* breadcrumb */}
      <nav aria-label="Your place in school" className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-bold text-ink-500">
        <span>🎓 {semesterShort}</span>
        <span aria-hidden>›</span>
        <span className="text-brand">{loc.cls.title}</span>
        <span aria-hidden>›</span>
        <span className="truncate">Class {loc.classIndex}/{loc.totalClasses}</span>
      </nav>

      <h2 className="mt-1 truncate text-lg font-extrabold text-ink">
        {loc.complete ? "🏆 You've graduated!" : loc.lessonTitle}
      </h2>
      <p className="text-xs font-semibold text-ink-500">
        {loc.complete ? "Replay classes or sharpen up with a match." : `Next in ${loc.cls.title}`}
      </p>

      <ProgressBar className="mt-2" value={prog.done} max={prog.total} tone="brand" label="Class progress" />

      <div className="mt-3 flex gap-2">
        <Button
          block
          onClick={() => {
            haptics.fire("tap");
            audio.play("transition");
            router.push(`/lesson/${loc.lessonId}`);
          }}
        >
          {loc.complete ? "Review a class" : prog.done > 0 ? "Continue learning" : "Start learning"}
        </Button>
        {activeMatch && !activeMatch.finished && (
          <Link href="/play" className="shrink-0">
            <Button variant="outline" aria-label="Resume your match">♟️ Resume</Button>
          </Link>
        )}
      </div>
    </motion.div>
  );
}
