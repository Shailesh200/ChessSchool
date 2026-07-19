import type { AdminAnalytics as Analytics } from "@/lib/admin-analytics";
import { Card } from "@/components/ui/Card";

export function AdminAnalytics({ data }: { data: Analytics }) {
  const maxSignup = Math.max(1, ...data.signupsByDay.map((d) => d.count));
  const maxEvent = Math.max(1, ...data.events.map((e) => e.count));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="admin-analytics-heading">
      <div>
        <h2 id="admin-analytics-heading" className="text-ink text-lg font-extrabold">
          Product analytics
        </h2>
        <p className="text-ink-500 text-xs font-semibold">
          Live from the database · refreshed on each page load ·{" "}
          {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Users" value={data.users.total} hint={`${data.users.students} students`} />
        <Stat
          label="Active (7d)"
          value={data.activity.activeLast7d}
          hint="Lesson activity"
        />
        <Stat
          label="Lesson starts"
          value={data.lessons.started}
          hint={`${data.lessons.totalAttempts} attempts`}
        />
        <Stat
          label="Mastered"
          value={data.lessons.mastered}
          hint={`≥90% mastery · ${data.lessons.catalogSize} in catalog`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-ink text-sm font-extrabold">Users</h3>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <Row label="Signed up (7d)" value={data.users.signedUpLast7d} />
            <Row label="Signed up (30d)" value={data.users.signedUpLast30d} />
            <Row label="With progress" value={data.users.withProgress} />
            <Row label="Enrolled profiles" value={data.users.enrolled} />
            <Row label="Onboarded" value={data.users.onboarded} />
            <Row label="Google linked" value={data.users.withGoogle} />
            <Row label="Admins" value={data.users.admins} />
            <Row label="Total XP" value={data.activity.totalXp} />
            <Row label="Avg streak" value={data.activity.avgStreak} />
          </dl>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-ink text-sm font-extrabold">Lessons & games</h3>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <Row label="Catalog lessons" value={data.lessons.catalogSize} />
            <Row label="Progress rows" value={data.lessons.records} />
            <Row label="Started" value={data.lessons.started} />
            <Row label="Mastered (≥90%)" value={data.lessons.mastered} />
            <Row label="Total attempts" value={data.lessons.totalAttempts} />
            <Row label="PvP games" value={data.games.total} />
            <Row label="Waiting / active" value={`${data.games.waiting} / ${data.games.active}`} />
            <Row label="Finished games" value={data.games.over} />
          </dl>
        </Card>
      </div>

      {data.signupsByDay.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-ink text-sm font-extrabold">Signups · last 30 days</h3>
          <ul className="flex flex-col gap-1.5" aria-label="Daily signups">
            {data.signupsByDay.map((d) => (
              <li key={d.day} className="flex items-center gap-2 text-xs">
                <span className="text-ink-500 w-24 shrink-0 font-semibold tabular-nums">
                  {d.day}
                </span>
                <span className="bg-surface-sunken h-2 min-w-0 flex-1 overflow-hidden rounded-full">
                  <span
                    className="bg-brand block h-full rounded-full"
                    style={{ width: `${Math.max(8, (d.count / maxSignup) * 100)}%` }}
                  />
                </span>
                <span className="text-ink w-8 text-right font-bold tabular-nums">{d.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-ink text-sm font-extrabold">Top lessons</h3>
          {data.topLessons.length === 0 ? (
            <p className="text-ink-500 text-xs font-semibold">No lesson activity yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {data.topLessons.map((l, i) => (
                <li key={l.lessonId} className="flex items-start gap-2 text-xs">
                  <span className="text-ink-300 w-5 shrink-0 font-bold tabular-nums">
                    {i + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-ink truncate font-bold">{l.title}</div>
                    <div className="text-ink-500 font-semibold">
                      {l.learners} learners · {l.attempts} attempts · {l.mastered} mastered
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-ink text-sm font-extrabold">Tracked events</h3>
          <p className="text-ink-500 text-[11px] font-semibold">
            Optional client events (Settings → Share usage analytics). Incomplete if users
            opt out.
          </p>
          {data.events.length === 0 ? (
            <p className="text-ink-500 text-xs font-semibold">No events recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {data.events.map((e) => (
                <li key={e.name} className="flex items-center gap-2 text-xs">
                  <span className="text-ink min-w-0 flex-1 truncate font-bold">{e.name}</span>
                  <span className="bg-surface-sunken h-2 w-16 overflow-hidden rounded-full">
                    <span
                      className="bg-brand block h-full rounded-full"
                      style={{ width: `${Math.max(8, (e.count / maxEvent) * 100)}%` }}
                    />
                  </span>
                  <span className="text-ink w-10 text-right font-bold tabular-nums">
                    {e.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-card border-hairline bg-surface-card border p-3 text-center">
      <div className="text-ink text-xl font-extrabold tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="text-ink-500 text-[10px] font-semibold">{label}</div>
      {hint ? <div className="text-ink-300 mt-0.5 text-[9px] font-semibold">{hint}</div> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <>
      <dt className="text-ink-500 font-semibold">{label}</dt>
      <dd className="text-ink text-right font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </dd>
    </>
  );
}
