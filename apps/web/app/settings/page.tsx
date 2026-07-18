"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Toggle } from "@/components/ui/Toggle";
import { useSettings } from "@/core/store/settings.store";
import { useSession } from "@/core/store/session.store";
import { BackButton } from "@/components/ui/BackButton";
import { audio } from "@/core/audio/audioEngine";
import { DataSection } from "@/features/settings/DataSection";
import { CoachCharacterPicker } from "@/features/settings/CoachCharacterPicker";
import {
  SettingsNav,
  SettingsPanel,
  type SettingsSectionId,
} from "@/features/settings/SettingsLayout";
import type { CoachCharacterId } from "@/features/coaching/characters";

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
  const s = useSettings();
  const isAdmin = useSession((st) => st.isAdmin);
  const authed = useSession((st) => st.authed);
  const user = useSession((st) => st.user);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("sound");

  const showAdvanced = isAdmin;
  const showData = authed === true;

  return (
    <AppShell>
      <div className="flex flex-col gap-5 lg:gap-6">
        <BackButton />
        <h1 className="text-ink text-xl font-extrabold lg:text-2xl">Settings</h1>

        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <SettingsNav
            active={activeSection}
            onSelect={setActiveSection}
            isAdmin={showAdvanced}
            authed={showData}
          />

          <div className="flex max-w-2xl flex-col gap-5 lg:max-w-none">
            <SettingsPanel
              id="sound"
              title="Sound & Feel"
              activeSection={activeSection}
            >
              <Row label="Sound effects">
                <Toggle
                  checked={s.sound}
                  onChange={(v) => {
                    if (!v) {
                      void import("@/core/audio/coachSpeech").then((m) =>
                        m.stopCoachSpeech(),
                      );
                    }
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
              <Row
                label="Coach speech"
                hint="Read coach lines aloud in lessons and matches"
              >
                <Toggle
                  checked={s.coachSpeech}
                  onChange={(v) => {
                    if (!v) {
                      void import("@/core/audio/coachSpeech").then((m) =>
                        m.stopCoachSpeech(),
                      );
                    }
                    s.set("coachSpeech", v);
                  }}
                  label="Coach speech"
                />
              </Row>
              <div className="border-hairline -mx-1 border-t py-4">
                <p className="text-ink text-sm font-extrabold">Coach character</p>
                <p className="text-ink-500 mt-0.5 mb-3 text-xs font-semibold">
                  One coach for lessons and matches — tap to preview their voice.
                </p>
                <CoachCharacterPicker
                  value={s.coachCharacter}
                  onChange={(id) => s.set("coachCharacter", id as CoachCharacterId)}
                />
              </div>
              <Row label="Haptics" hint="Vibration on supported devices">
                <Toggle
                  checked={s.haptics}
                  onChange={(v) => s.set("haptics", v)}
                  label="Haptics"
                />
              </Row>
            </SettingsPanel>

            <SettingsPanel
              id="accessibility"
              title="Accessibility"
              activeSection={activeSection}
            >
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
            </SettingsPanel>

            <SettingsPanel
              id="learning"
              title="Learning & Board"
              activeSection={activeSection}
            >
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
            </SettingsPanel>

            {showAdvanced && (
              <SettingsPanel
                id="advanced"
                title="Advanced"
                activeSection={activeSection}
              >
                <Row label="Performance diagnostics" hint="Show FPS & route timing">
                  <Toggle
                    checked={s.diagnostics}
                    onChange={(v) => s.set("diagnostics", v)}
                    label="Performance diagnostics"
                  />
                </Row>
              </SettingsPanel>
            )}

            <SettingsPanel id="privacy" title="Privacy" activeSection={activeSection}>
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
              <Row
                label="Share usage analytics"
                hint="Lesson completes, sign-ups — no PII"
              >
                <Toggle
                  checked={s.shareAnalytics}
                  onChange={(v) => s.set("shareAnalytics", v)}
                  label="Share usage analytics"
                />
              </Row>
            </SettingsPanel>

            {showData && (
              <SettingsPanel id="data" title="Your data" activeSection={activeSection}>
                <DataSection embedded />
              </SettingsPanel>
            )}
          </div>
        </div>

        <p className="text-ink-300 pb-4 text-center text-xs font-semibold lg:text-left">
          ChessSchool v3.0 · {user ? user.name : "Guest mode"}
        </p>
      </div>
    </AppShell>
  );
}
