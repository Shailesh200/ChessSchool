"use client";

import { Icon } from "@/components/ui/Icon";
import { isoDay, useProgression } from "@/core/store/progression.store";

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Kit 08 week strip + daily goal banner (activity from progression store). */
export function LessonCompleteWeekStrip({ lessonDoneToday }: { lessonDoneToday: boolean }) {
  const activityDays = useProgression((s) => s.activityDays);
  const day = isoDay();
  const start = new Date(`${day}T12:00:00`);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = WEEK_LABELS.map((label, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const done = Boolean(activityDays[key]) || (key === day && lessonDoneToday);
    return { label, done, today: key === day };
  });

  return (
    <>
      <div className="cs-week" role="img" aria-label="Practice this week" data-testid="lesson-complete-week">
        {days.map((d) => (
          <div key={d.label + d.done} className={`cs-day${d.done ? " done" : ""}${d.today ? " t" : ""}`}>
            <i>
              {d.done ? (
                <svg className="cs-ic sm" viewBox="0 0 24 24" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : null}
            </i>
            {d.label}
          </div>
        ))}
      </div>
      <div className="banner ok" data-testid="lesson-complete-daily-goal">
        <Icon name="target" size={18} />
        <span>
          Daily goal: {lessonDoneToday ? "1" : "0"} of 1 lesson done
        </span>
      </div>
    </>
  );
}
