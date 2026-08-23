"use client";

import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CoachAvatar } from "@/components/ui/coachCharacters/CoachAvatar";
import { useSettings } from "@/core/store/settings.store";
import { startNav } from "@/core/store/nav.store";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";
import { trackEvent } from "@/core/analytics/track";

export function EnrollPrompt({
  open,
  onClose,
  next = "/academy",
}: {
  open: boolean;
  onClose: () => void;
  /** Post-enroll return path. */
  next?: string;
}) {
  const router = useRouter();
  const setSetting = useSettings((s) => s.set);
  const coachCharacter = useSettings((s) => s.coachCharacter);

  function enroll() {
    haptics.fire("success");
    audio.play("unlock");
    trackEvent("enroll_cta_click", { source: "prompt", next });
    startNav();
    router.push(`/register?next=${encodeURIComponent(next)}`);
    onClose();
  }

  function snooze() {
    setSetting("enrollPromptDismissedAt", Date.now());
    haptics.fire("select");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Save your progress">
      <div className="flex flex-col items-center gap-4 text-center">
        <CoachAvatar character={coachCharacter} size={72} state="idle" />
        <p className="text-ink-600 text-sm leading-relaxed font-semibold">
          You&apos;re making real progress! Enroll free to keep your XP, streak, and
          class unlocks on every device — everything you&apos;ve done so far comes with
          you.
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" block onClick={enroll}>
            <span className="inline-flex items-center justify-center gap-2">
              <Icon name="cap" size={18} className="shrink-0" duotone />
              Enroll free
            </span>
          </Button>
          <Button variant="ghost" block onClick={snooze}>
            Maybe later
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Inline campus / lesson banner — same copy, compact. */
export function EnrollPromptBanner({
  next = "/academy",
  className = "",
}: {
  next?: string;
  className?: string;
}) {
  const router = useRouter();
  const setSetting = useSettings((s) => s.set);

  return (
    <div
      className={`rounded-card border-brand-100 bg-brand-50 border p-4 text-center ${className}`}
    >
      <p className="text-ink text-sm font-extrabold">Save your progress</p>
      <p className="text-ink-500 mt-1 text-xs font-semibold">
        Enroll free to keep your XP and continue on any device.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <Button
          size="sm"
          block
          onClick={() => {
            trackEvent("enroll_cta_click", { source: "banner", next });
            startNav();
            router.push(`/register?next=${encodeURIComponent(next)}`);
          }}
        >
          Enroll free
        </Button>
        <button
          type="button"
          className="text-ink-500 text-xs font-bold"
          onClick={() => setSetting("enrollPromptDismissedAt", Date.now())}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
