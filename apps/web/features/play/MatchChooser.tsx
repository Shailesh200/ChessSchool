"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useMatch } from "@/core/store/match.store";
import { useSettings } from "@/core/store/settings.store";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";
import { botProfile } from "@/features/play/bots";
import { BotAvatar } from "@/features/play/BotAvatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IconBadge } from "@/components/ui/IconBadge";
import { startNav } from "@/core/store/nav.store";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";
import { toast } from "@/core/store/toast.store";
import { listItem, listContainer } from "@/core/motion/variants";
import { MatchPreviewPanel } from "./MatchPreviewPanel";

const ELO_PRESETS = [300, 600, 900, 1200, 1600, 2000];
const TIME_PRESETS = [
  { min: 0, label: "No clock" },
  { min: 5, label: "5 min" },
  { min: 10, label: "10 min" },
  { min: 20, label: "20 min" },
  { min: 30, label: "30 min" },
];

type ChooserMode = "bot" | "pass" | "training";
type TrainingMode = "shadow" | "arena" | "assisted" | "lesson";
type AssistedVariant = "full" | "puzzle";

const ASSISTED_VARIANTS: { id: AssistedVariant; title: string; subtitle: string }[] = [
  {
    id: "full",
    title: "Full game",
    subtitle: "Coached bot match at your rating — explain every move",
  },
  {
    id: "puzzle",
    title: "Puzzle drill",
    subtitle: "Single positions with coach feedback and undo",
  },
];

const TRAINING_OPTIONS: {
  id: TrainingMode;
  title: string;
  subtitle: string;
  icon: IconName;
  enrolledOnly: boolean;
}[] = [
  {
    id: "shadow",
    title: "Shadow opponent",
    subtitle: "Rematch a saved game — opponent replays from PGN",
    icon: "users",
    enrolledOnly: true,
  },
  {
    id: "arena",
    title: "Arena tournament",
    subtitle: "4-bot round robin — standings and bonus XP",
    icon: "trophy",
    enrolledOnly: true,
  },
  {
    id: "assisted",
    title: "Assisted play",
    subtitle: "Coach explains your moves — pick full game or puzzle drill below",
    icon: "brain",
    enrolledOnly: true,
  },
  {
    id: "lesson",
    title: "Lesson trainer",
    subtitle: "One position — calculate, confirm, or reveal the answer",
    icon: "puzzle",
    enrolledOnly: true,
  },
];

const TRAINING_ROUTES: Record<TrainingMode, string> = {
  shadow: "/play/shadow",
  arena: "/play/arena",
  assisted: "/play/assisted",
  lesson: "/play/think",
};

export function MatchChooser() {
  const start = useMatch((s) => s.start);
  const targetElo = useSettings((s) => s.targetElo);
  const setSetting = useSettings((s) => s.set);
  const rating = useProgression((s) => s.rating);
  const authed = useSession((s) => s.authed);
  const rehydrateReady = useRehydrateReady();
  const guest = rehydrateReady && authed === false;
  const needsEnroll = !rehydrateReady || authed !== true;

  const [mode, setMode] = useState<ChooserMode>("bot");
  const [trainingMode, setTrainingMode] = useState<TrainingMode>("shadow");
  const [assistedVariant, setAssistedVariant] = useState<AssistedVariant>("full");
  const [adaptive, setAdaptive] = useState(false);
  const [timeMin, setTimeMin] = useState(0);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  function guardEnrolled(action: () => void) {
    if (needsEnroll) {
      toast("Enroll to unlock this feature", { tone: "default" });
      startNav();
      router.push("/register?next=/play");
      return;
    }
    action();
  }

  function beginBotOrPass() {
    haptics.fire("success");
    audio.play("unlock");
    const elo = adaptive ? rating : targetElo;
    start(mode === "bot" ? "bot" : "pass", elo, timeMin);
  }

  function beginTraining() {
    guardEnrolled(() => {
      haptics.fire("success");
      audio.play("select");
      startNav();
      const route =
        trainingMode === "assisted"
          ? `/play/assisted?mode=${assistedVariant}`
          : TRAINING_ROUTES[trainingMode];
      router.push(route);
    });
  }

  async function playOnline() {
    guardEnrolled(async () => {
      setCreating(true);
      haptics.fire("success");
      try {
        const r = await fetch("/api/session", {
          method: "POST",
          credentials: "include",
        });
        if (r.status === 401) {
          toast("Log in to play online", { tone: "default" });
          startNav();
          router.push("/login?next=/play");
          return;
        }
        if (!r.ok) throw new Error();
        const { id, seatToken } = (await r.json()) as { id: string; seatToken: string };
        localStorage.setItem(`chessschool.online.${id}`, "w");
        localStorage.setItem(`chessschool.online.${id}.token`, seatToken);
        startNav();
        router.push(`/play/online/${id}`);
      } catch {
        toast("Could not create game", { tone: "danger" });
      } finally {
        setCreating(false);
      }
    });
  }

  const selectedTraining = TRAINING_OPTIONS.find((t) => t.id === trainingMode)!;
  const trainingPreviewLabel =
    trainingMode === "assisted"
      ? `${selectedTraining.title} · ${ASSISTED_VARIANTS.find((v) => v.id === assistedVariant)?.title ?? "Full game"}`
      : selectedTraining.title;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-8">
      <motion.div
        variants={listContainer}
        initial={false}
        animate="enter"
        className="flex flex-col gap-4"
      >
        <motion.h1 variants={listItem} className="text-ink text-xl font-extrabold">
          New match
        </motion.h1>

        <motion.div
          variants={listItem}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <ModeCard
            active={mode === "bot"}
            iconName="robot"
            title="vs Bot"
            subtitle="Adaptive AI 300–2000"
            onClick={() => {
              setMode("bot");
              haptics.fire("select");
            }}
          />
          <ModeCard
            active={mode === "pass"}
            iconName="users"
            title="vs Human"
            subtitle="Pass & play on one device"
            onClick={() => {
              setMode("pass");
              haptics.fire("select");
            }}
          />
          <ModeCard
            active={mode === "training"}
            iconName="target"
            title="Training"
            subtitle="Shadow, arena, assisted & drills"
            className="col-span-2 sm:col-span-1"
            onClick={() => {
              setMode("training");
              haptics.fire("select");
            }}
          />
        </motion.div>

        {mode === "bot" && (
          <>
            <motion.div variants={listItem}>
              <Card>
                <p className="text-ink mb-2 text-sm font-extrabold">
                  Opponent strength
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAdaptive((a) => !a);
                    haptics.fire("select");
                  }}
                  className={`rounded-card mb-2 flex w-full items-center justify-between border-2 px-3 py-2 text-left transition-colors ${
                    adaptive
                      ? "border-brand bg-brand-50"
                      : "border-hairline bg-surface-card"
                  }`}
                >
                  <span>
                    <span className="text-ink flex items-center gap-1.5 text-sm font-extrabold">
                      <Icon name="target" size={16} className="text-brand shrink-0" />
                      Adaptive bot
                    </span>
                    <span className="text-ink-500 block text-xs font-semibold">
                      Matches your level (~{rating}) &amp; adjusts as you play
                    </span>
                  </span>
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full border-2 ${adaptive ? "border-brand bg-brand" : "border-ink-300"}`}
                  />
                </button>
                <div
                  className={`flex flex-wrap gap-2 ${adaptive ? "pointer-events-none opacity-40" : ""}`}
                >
                  {ELO_PRESETS.map((elo) => (
                    <button
                      key={elo}
                      type="button"
                      onClick={() => {
                        setSetting("targetElo", elo);
                        haptics.fire("select");
                      }}
                      className={`rounded-pill flex items-center gap-1.5 px-2.5 py-1 text-sm font-bold transition-colors ${
                        targetElo === elo
                          ? "bg-brand text-white"
                          : "bg-surface-sunken text-ink-500"
                      }`}
                    >
                      <BotAvatar elo={elo} size={32} />
                      {elo}
                    </button>
                  ))}
                </div>
                {!adaptive && (
                  <div className="mt-4 flex items-center gap-3">
                    <BotAvatar elo={targetElo} size={56} />
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-extrabold">
                        {botProfile(targetElo).name}
                      </p>
                      <p className="text-ink-500 text-xs font-semibold">
                        {botProfile(targetElo).blurb}
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div variants={listItem}>
              <TimeControlCard timeMin={timeMin} onSelect={setTimeMin} />
            </motion.div>

            <motion.div variants={listItem}>
              <Button size="lg" block onClick={beginBotOrPass}>
                Start match
              </Button>
            </motion.div>
          </>
        )}

        {mode === "pass" && (
          <>
            <motion.div variants={listItem}>
              <TimeControlCard timeMin={timeMin} onSelect={setTimeMin} />
            </motion.div>
            <motion.div variants={listItem} className="flex flex-col gap-2">
              <Button size="lg" block onClick={beginBotOrPass}>
                Start (one device)
              </Button>
              <Button
                size="lg"
                variant="outline"
                block
                loading={creating}
                disabled={guest}
                onClick={playOnline}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Icon name="link" size={18} className="shrink-0" />
                  {guest
                    ? "Enroll to play online"
                    : "Play a friend online (share link)"}
                </span>
              </Button>
            </motion.div>
          </>
        )}

        {mode === "training" && (
          <>
            <motion.div variants={listItem}>
              <Card>
                <p className="text-ink mb-3 text-sm font-extrabold">Training mode</p>
                <div className="flex flex-col gap-2">
                  {TRAINING_OPTIONS.map((opt) => {
                    const active = trainingMode === opt.id;
                    const locked = needsEnroll && opt.enrolledOnly;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (locked) {
                            guardEnrolled(() => void 0);
                            return;
                          }
                          setTrainingMode(opt.id);
                          haptics.fire("select");
                        }}
                        className={`rounded-card flex items-start gap-3 border-2 px-3 py-2.5 text-left transition-colors ${
                          active
                            ? "border-brand bg-brand-50"
                            : "border-hairline bg-surface-card"
                        } ${locked ? "opacity-70" : ""}`}
                      >
                        <span
                          className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${active ? "border-brand bg-brand" : "border-ink-300"}`}
                        />
                        <span className="flex min-w-0 flex-1 items-start gap-2">
                          <IconBadge name={opt.icon} size="md" tone="brand" />
                          <span>
                            <span className="text-ink flex items-center gap-1.5 text-sm font-extrabold">
                              {opt.title}
                              {locked && (
                                <Icon name="lock" size={14} className="text-ink-400" />
                              )}
                            </span>
                            <span className="text-ink-500 block text-xs font-semibold">
                              {opt.subtitle}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {guest && (
                  <p className="text-ink-500 mt-3 text-xs font-semibold">
                    Training modes require a free student account.{" "}
                    <button
                      type="button"
                      className="text-brand font-bold"
                      onClick={() => router.push("/register?next=/play")}
                    >
                      Enroll →
                    </button>
                  </p>
                )}
              </Card>
            </motion.div>

            {trainingMode === "assisted" && !needsEnroll && (
              <motion.div variants={listItem}>
                <Card>
                  <p className="text-ink mb-3 text-sm font-extrabold">
                    Assisted format
                  </p>
                  <div className="flex flex-col gap-2">
                    {ASSISTED_VARIANTS.map((opt) => {
                      const active = assistedVariant === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setAssistedVariant(opt.id);
                            haptics.fire("select");
                          }}
                          className={`rounded-card flex items-start gap-3 border-2 px-3 py-2.5 text-left transition-colors ${
                            active
                              ? "border-brand bg-brand-50"
                              : "border-hairline bg-surface-card"
                          }`}
                        >
                          <span
                            className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${active ? "border-brand bg-brand" : "border-ink-300"}`}
                          />
                          <span>
                            <span className="text-ink block text-sm font-extrabold">
                              {opt.title}
                            </span>
                            <span className="text-ink-500 block text-xs font-semibold">
                              {opt.subtitle}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            )}

            <motion.div variants={listItem}>
              <Card className="bg-surface-sunken/50">
                <p className="text-ink text-sm font-extrabold">
                  {selectedTraining.title}
                </p>
                <p className="text-ink-500 mt-1 text-xs font-semibold">
                  {trainingMode === "assisted"
                    ? ASSISTED_VARIANTS.find((v) => v.id === assistedVariant)?.subtitle
                    : selectedTraining.subtitle}
                </p>
              </Card>
            </motion.div>

            <motion.div variants={listItem}>
              <Button size="lg" block onClick={beginTraining} disabled={needsEnroll}>
                {needsEnroll
                  ? "Enroll to start"
                  : trainingMode === "assisted"
                    ? `Start ${ASSISTED_VARIANTS.find((v) => v.id === assistedVariant)?.title.toLowerCase() ?? "assisted play"}`
                    : `Start ${selectedTraining.title.toLowerCase()}`}
              </Button>
            </motion.div>
          </>
        )}
      </motion.div>

      <MatchPreviewPanel
        mode={mode}
        targetElo={targetElo}
        adaptive={adaptive}
        rating={rating}
        timeMin={timeMin}
        trainingLabel={mode === "training" ? trainingPreviewLabel : undefined}
      />
    </div>
  );
}

function TimeControlCard({
  timeMin,
  onSelect,
}: {
  timeMin: number;
  onSelect: (min: number) => void;
}) {
  return (
    <Card>
      <p className="text-ink mb-2 text-sm font-extrabold">Time control</p>
      <div className="flex flex-wrap gap-2">
        {TIME_PRESETS.map((t) => (
          <button
            key={t.min}
            type="button"
            onClick={() => {
              onSelect(t.min);
              haptics.fire("select");
            }}
            className={`rounded-pill px-3 py-1 text-sm font-bold transition-colors ${
              timeMin === t.min
                ? "bg-brand text-white"
                : "bg-surface-sunken text-ink-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function ModeCard({
  active,
  iconName,
  title,
  subtitle,
  onClick,
  className,
}: {
  active: boolean;
  iconName: IconName;
  title: string;
  subtitle: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-tactile rounded-card border-2 p-4 text-left transition-colors ${
        active ? "border-brand bg-brand-50" : "border-hairline bg-surface-card"
      } ${className ?? ""}`}
    >
      <IconBadge name={iconName} size="lg" tone="brand" selected={active} />
      <div className="text-ink mt-2 text-sm font-extrabold">{title}</div>
      <div className="text-ink-500 text-xs font-semibold">{subtitle}</div>
    </button>
  );
}
