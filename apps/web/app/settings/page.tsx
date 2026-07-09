"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { useSettings, type CoachPersonality } from "@/core/store/settings.store";
import { Select } from "@/components/ui/Select";
import { useMounted } from "@/core/hooks/useMounted";
import { useSession } from "@/core/store/session.store";
import { BackButton } from "@/components/ui/BackButton";
import { audio } from "@/core/audio/audioEngine";
import { DataSection } from "@/features/settings/DataSection";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-ink text-sm font-extrabold">{label}</p>
        {hint && <p className="text-ink-500 text-xs font-semibold">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const mounted = useMounted();
  const s = useSettings();
  const isAdmin = useSession((st) => st.isAdmin);
  const authed = useSession((st) => st.authed);
  const user = useSession((st) => st.user);

  if (!mounted) {
    return (
      <AppShell>
        <div className="skeleton rounded-card h-96" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <BackButton />
        <h1 className="text-ink text-xl font-extrabold">Settings</h1>

        <Card className="divide-hairline divide-y py-0">
          <Section title="Sound & Feel" />
          <Row label="Sound effects">
            <Toggle
              checked={s.sound}
              onChange={(v) => {
                s.set("sound", v);
                if (v) audio.play("select");
              }}
              label="Sound effects"
            />
          </Row>
          <Row label="Volume" hint={`${Math.round(s.volume * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              onChange={(e) => s.set("volume", Number(e.target.value))}
              onPointerUp={() => audio.play("notify")}
              className="w-32 accent-[var(--brand-500)]"
              aria-label="Volume"
            />
          </Row>
          <Row label="Haptics" hint="Vibration on supported devices">
            <Toggle
              checked={s.haptics}
              onChange={(v) => s.set("haptics", v)}
              label="Haptics"
            />
          </Row>
        </Card>

        <Card className="divide-hairline divide-y py-0">
          <Section title="Accessibility" />
          <Row label="Reduce motion" hint="Minimize animations">
            <Toggle
              checked={s.reducedMotion}
              onChange={(v) => s.set("reducedMotion", v)}
              label="Reduce motion"
            />
          </Row>
          <Row label="High contrast">
            <Toggle
              checked={s.highContrast}
              onChange={(v) => s.set("highContrast", v)}
              label="High contrast"
            />
          </Row>
          <Row label="Colorblind board" hint="Deuteranopia-friendly palette">
            <Toggle
              checked={s.colorblind !== "none"}
              onChange={(v) => s.set("colorblind", v ? "deuteranopia" : "none")}
              label="Colorblind board"
            />
          </Row>
        </Card>

        <Card className="divide-hairline divide-y py-0">
          <Section title="Learning & Board" />
          <Row label="Coach hints" hint="Show arrows and tips">
            <Toggle
              checked={s.hints}
              onChange={(v) => s.set("hints", v)}
              label="Coach hints"
            />
          </Row>
          <Row label="Bot difficulty" hint={`Target ELO ${s.targetElo}`}>
            <input
              type="range"
              min={300}
              max={2500}
              step={100}
              value={s.targetElo}
              onChange={(e) => s.set("targetElo", Number(e.target.value))}
              className="w-32 accent-[var(--brand-500)]"
              aria-label="Bot difficulty"
            />
          </Row>
          <Row label="Coach personality" hint="Tone of feedback">
            <Select
              className="w-40 shrink-0"
              options={[
                { id: "friendly", title: "😊 Friendly" },
                { id: "strict", title: "🎩 Strict" },
                { id: "mentor", title: "🧑‍🏫 Mentor" },
                { id: "tactical", title: "⚔️ Tactical" },
                { id: "minimal", title: "🔇 Minimal" },
              ]}
              value={s.coachPersonality}
              onChange={(v) => s.set("coachPersonality", v as CoachPersonality)}
            />
          </Row>
        </Card>

        {isAdmin && (
          <Card className="divide-hairline divide-y py-0">
            <Section title="Advanced" />
            <Row label="Performance diagnostics" hint="Show FPS & route timing">
              <Toggle
                checked={s.diagnostics}
                onChange={(v) => s.set("diagnostics", v)}
                label="Performance diagnostics"
              />
            </Row>
          </Card>
        )}

        <Card className="divide-hairline divide-y py-0">
          <Section title="Privacy" />
          <Row
            label="Share performance data"
            hint="Anonymous page speed metrics (LCP, CLS)"
          >
            <Toggle
              checked={s.sharePerformance}
              onChange={(v) => s.set("sharePerformance", v)}
              label="Share performance data"
            />
          </Row>
          <Row label="Share usage analytics" hint="Lesson completes, sign-ups — no PII">
            <Toggle
              checked={s.shareAnalytics}
              onChange={(v) => s.set("shareAnalytics", v)}
              label="Share usage analytics"
            />
          </Row>
        </Card>

        {authed === true && <DataSection />}

        <p className="text-ink-300 pb-4 text-center text-xs font-semibold">
          ChessSchool v3.0 · {user ? user.name : "Guest mode"}
        </p>
      </div>
    </AppShell>
  );
}

function Section({ title }: { title: string }) {
  return (
    <p className="text-ink-300 pt-4 text-xs font-extrabold tracking-wide uppercase">
      {title}
    </p>
  );
}
