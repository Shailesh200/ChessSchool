"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Mascot } from "@/components/ui/Mascot";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useProgression, levelForXp } from "@/core/store/progression.store";
import { useSettings } from "@/core/store/settings.store";
import { useSession } from "@/core/store/session.store";
import { rankForClasses } from "@/lib/rank";
import { useMounted } from "@/core/hooks/useMounted";
import { ACHIEVEMENTS } from "@/features/progression/achievements";

const HUB_LINKS: { href: string; icon: IconName; label: string; adminOnly?: boolean; authOnly?: boolean }[] = [
  { href: "/library", icon: "learn", label: "Library", authOnly: true },
  { href: "/account", icon: "profile", label: "My ID", authOnly: true },
  { href: "/dashboard", icon: "chart", label: "Dashboard", authOnly: true },
  { href: "/plan", icon: "calendar", label: "Study Plan", authOnly: true },
  { href: "/journal", icon: "journal", label: "Journal", authOnly: true },
  { href: "/themes", icon: "palette", label: "Themes" },
  { href: "/playground", icon: "flask", label: "Playground", adminOnly: true },
  { href: "/settings", icon: "gear", label: "Settings" },
];

export default function ProfilePage() {
  const mounted = useMounted();
  const xp = useProgression((s) => s.xp);
  const streak = useProgression((s) => s.streak);
  const lessons = useProgression((s) => s.lessons);
  const weaknesses = useProgression((s) => s.weaknesses);
  const unlocked = useProgression((s) => s.unlockedAchievements);
  const targetElo = useSettings((s) => s.targetElo);
  const graduated = useProgression((s) => s.graduatedClasses);
  const isAdmin = useSession((s) => s.isAdmin);
  const authed = useSession((s) => s.authed);
  const user = useSession((s) => s.user);
  const hubLinks = HUB_LINKS.filter(
    (l) => (!l.adminOnly || isAdmin) && (!l.authOnly || authed === true),
  );
  const rank = mounted ? rankForClasses(graduated.length) : "Novice";

  const mastered = mounted ? Object.values(lessons).filter((l) => l.mastery >= 0.9).length : 0;
  const level = mounted ? levelForXp(xp) : 1;
  const weakTags = mounted
    ? Object.entries(weaknesses).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Mascot expression="happy" size={72} />
          <div>
            <h1 className="text-2xl font-extrabold text-ink">{user?.name ?? "Guest Player"}</h1>
            <p className="text-sm font-semibold text-ink-500">
              <span className="font-extrabold text-brand">{rank}</span> · Level {level} · {mounted ? xp : 0} XP
            </p>
          </div>
        </div>

        {mounted && authed === false && (
          <Link
            href="/login"
            className="btn-tactile flex items-center justify-between rounded-card border border-brand/40 bg-brand-50 px-4 py-3"
          >
            <span className="text-sm font-extrabold text-brand">
              Log in to unlock your Dashboard, Library, Study Plan &amp; ID →
            </span>
          </Link>
        )}

        <div className="grid grid-cols-3 gap-2">
          {hubLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="btn-tactile flex flex-col items-center gap-1.5 rounded-card border border-hairline bg-surface-card py-4 [box-shadow:var(--shadow-card)]"
            >
              <Icon name={l.icon} size={26} duotone className="text-brand" />
              <span className="text-xs font-extrabold text-ink">{l.label}</span>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Day streak" value={mounted ? streak : 0} icon="flame" tone="text-accent" />
          <Stat label="Lessons mastered" value={mastered} icon="check" tone="text-success" />
          <Stat label="Bot ELO" value={targetElo} icon="target" tone="text-brand" />
          <Stat label="Badges" value={mounted ? unlocked.length : 0} icon="trophy" tone="text-gold" />
        </div>

        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">Learning profile</h2>
          <Card>
            {weakTags.length === 0 ? (
              <p className="text-sm font-semibold text-ink-500">
                No weak spots yet — keep playing and I&apos;ll track what to review.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {weakTags.map(([tag, count]) => (
                  <span
                    key={tag}
                    className="rounded-pill bg-danger/10 px-3 py-1 text-xs font-bold text-danger"
                  >
                    {tag} ×{count}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">Achievements</h2>
          <div className="grid grid-cols-3 gap-3">
            {ACHIEVEMENTS.map((a) => {
              const has = mounted && unlocked.includes(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex flex-col items-center gap-1 rounded-card border p-3 text-center ${
                    has ? "border-gold bg-gold/10" : "border-hairline bg-surface-sunken opacity-60"
                  }`}
                >
                  <span className={`text-2xl ${has ? "" : "grayscale"}`}>{a.emoji}</span>
                  <span className="text-[11px] font-extrabold text-ink">{a.title}</span>
                  <span className="text-[10px] font-semibold text-ink-500">{a.description}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: IconName; tone: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <Icon name={icon} size={24} duotone className={tone} />
      <div className="min-w-0">
        <AnimatedNumber value={value} className="block text-2xl font-extrabold text-ink" />
        <div className="truncate text-xs font-semibold text-ink-500">{label}</div>
      </div>
    </Card>
  );
}
