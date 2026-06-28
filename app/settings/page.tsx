"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { useSettings } from "@/core/store/settings.store";
import Link from "next/link";
import { useMounted } from "@/core/hooks/useMounted";
import { audio } from "@/core/audio/audioEngine";
import { DataSection } from "@/features/settings/DataSection";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-extrabold text-ink">{label}</p>
        {hint && <p className="text-xs font-semibold text-ink-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const mounted = useMounted();
  const s = useSettings();

  if (!mounted) {
    return (
      <AppShell>
        <div className="skeleton h-96 rounded-card" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-extrabold text-ink">Settings</h1>

        <Card className="divide-y divide-hairline py-0">
          <Section title="Sound & Feel" />
          <Row label="Sound effects">
            <Toggle checked={s.sound} onChange={(v) => { s.set("sound", v); if (v) audio.play("select"); }} label="Sound effects" />
          </Row>
          <Row label="Volume" hint={`${Math.round(s.volume * 100)}%`}>
            <input
              type="range" min={0} max={1} step={0.05} value={s.volume}
              onChange={(e) => s.set("volume", Number(e.target.value))}
              onPointerUp={() => audio.play("notify")}
              className="w-32 accent-[var(--brand-500)]"
              aria-label="Volume"
            />
          </Row>
          <Row label="Haptics" hint="Vibration on supported devices">
            <Toggle checked={s.haptics} onChange={(v) => s.set("haptics", v)} label="Haptics" />
          </Row>
        </Card>

        <Card className="divide-y divide-hairline py-0">
          <Section title="Accessibility" />
          <Row label="Reduce motion" hint="Minimize animations">
            <Toggle checked={s.reducedMotion} onChange={(v) => s.set("reducedMotion", v)} label="Reduce motion" />
          </Row>
          <Row label="High contrast">
            <Toggle checked={s.highContrast} onChange={(v) => s.set("highContrast", v)} label="High contrast" />
          </Row>
          <Row label="Colorblind board" hint="Deuteranopia-friendly palette">
            <Toggle
              checked={s.colorblind !== "none"}
              onChange={(v) => s.set("colorblind", v ? "deuteranopia" : "none")}
              label="Colorblind board"
            />
          </Row>
          <Row label="Text size" hint={`${Math.round(s.textScale * 100)}%`}>
            <input
              type="range" min={0.9} max={1.4} step={0.1} value={s.textScale}
              onChange={(e) => s.set("textScale", Number(e.target.value))}
              className="w-32 accent-[var(--brand-500)]"
              aria-label="Text size"
            />
          </Row>
        </Card>

        <Card className="divide-y divide-hairline py-0">
          <Section title="Learning & Board" />
          <Row label="Coach hints" hint="Show arrows and tips">
            <Toggle checked={s.hints} onChange={(v) => s.set("hints", v)} label="Coach hints" />
          </Row>
          <Row label="Themes" hint="Board & school themes with live preview">
            <Link
              href="/themes"
              className="rounded-pill bg-brand px-4 py-1.5 text-sm font-bold text-white"
            >
              Open Theme Studio →
            </Link>
          </Row>
          <Row label="Bot difficulty" hint={`Target ELO ${s.targetElo}`}>
            <input
              type="range" min={500} max={2500} step={100} value={s.targetElo}
              onChange={(e) => s.set("targetElo", Number(e.target.value))}
              className="w-32 accent-[var(--brand-500)]"
              aria-label="Bot difficulty"
            />
          </Row>
          <Row label="Coach personality" hint="Tone of feedback">
            <select
              value={s.coachPersonality}
              onChange={(e) => s.set("coachPersonality", e.target.value as typeof s.coachPersonality)}
              className="rounded-pill border border-hairline bg-surface px-3 py-1.5 text-sm font-bold"
              aria-label="Coach personality"
            >
              <option value="friendly">😊 Friendly Teacher</option>
              <option value="strict">🎩 Strict Grandmaster</option>
              <option value="mentor">🧑‍🏫 Mentor</option>
              <option value="tactical">⚔️ Tactical</option>
              <option value="minimal">🔇 Minimal</option>
            </select>
          </Row>
        </Card>

        <Card className="divide-y divide-hairline py-0">
          <Section title="Advanced" />
          <Row label="Performance diagnostics" hint="Show FPS & route timing">
            <Toggle checked={s.diagnostics} onChange={(v) => s.set("diagnostics", v)} label="Performance diagnostics" />
          </Row>
        </Card>

        <DataSection />

        <p className="pb-4 text-center text-xs font-semibold text-ink-300">ChessSchool v3.0 · Guest mode</p>
      </div>
    </AppShell>
  );
}

function Section({ title }: { title: string }) {
  return <p className="pt-4 text-xs font-extrabold uppercase tracking-wide text-ink-300">{title}</p>;
}
