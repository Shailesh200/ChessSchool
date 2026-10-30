"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Logo } from "@/components/ui/Logo";
import { CoachAvatar } from "@/components/ui/coachCharacters/CoachAvatar";

/** Internal showcase for Premium Illustrated shell + components (390 / 1280 QA). */
export default function KitShowcasePage() {
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" data-testid="kit-showcase">
        <div>
          <Logo withText />
          <h1 className="text-ink mt-4 text-2xl font-extrabold">Premium kit showcase</h1>
          <p className="text-ink-500 text-sm font-semibold">
            Shell, tokens, and shared components — compare to design-kit screens.
          </p>
        </div>

        <Card className="premium-chip flex flex-wrap gap-2 p-4">
          <span className="premium-chip">
            <strong>7</strong> day streak
          </span>
          <span className="premium-chip">Level 12</span>
        </Card>

        <Card>
          <p className="text-ink mb-3 text-sm font-extrabold">Buttons</p>
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </Card>

        <Card>
          <p className="text-ink mb-2 text-sm font-extrabold">Progress</p>
          <ProgressBar value={0.62} tone="brand" label="XP" />
        </Card>

        <CoachAvatar character="anxious_nerd" size="lg" state="idle" />

        <EmptyState
          illustration="library"
          title="Nothing here yet"
          description="Finish a lesson to fill this space."
          action={{ label: "Go learn", href: "/academy" }}
        />
      </div>
    </AppShell>
  );
}
