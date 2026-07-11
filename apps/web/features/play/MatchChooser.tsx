"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useMatch, type MatchMode } from "@/core/store/match.store";
import { useSettings } from "@/core/store/settings.store";
import { useProgression } from "@/core/store/progression.store";
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

export function MatchChooser() {
  const start = useMatch((s) => s.start);
  const targetElo = useSettings((s) => s.targetElo);
  const setSetting = useSettings((s) => s.set);
  const rating = useProgression((s) => s.rating);
  const [mode, setMode] = useState<MatchMode>("bot");
  const [adaptive, setAdaptive] = useState(false);
  const [thinkingGame, setThinkingGame] = useState(false);
  const [timeMin, setTimeMin] = useState(0);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  function begin() {
    haptics.fire("success");
    audio.play("unlock");
    const elo = adaptive ? rating : targetElo;
    const clock = thinkingGame && mode === "bot" ? 0 : timeMin;
    start(mode, elo, clock, false, thinkingGame && mode === "bot");
  }

  async function playOnline() {
    setCreating(true);
    haptics.fire("success");
    try {
      const r = await fetch("/api/session", { method: "POST", credentials: "include" });
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
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-8">
      <motion.div
        variants={listContainer}
        initial="initial"
        animate="enter"
        className="flex flex-col gap-4"
      >
        <motion.h1 variants={listItem} className="text-ink text-xl font-extrabold">
          New match
        </motion.h1>

        <motion.div variants={listItem} className="grid grid-cols-2 gap-3">
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
            subtitle="Two players, one device · or play online"
            onClick={() => {
              setMode("pass");
              haptics.fire("select");
            }}
          />
        </motion.div>

        {mode === "bot" && (
          <motion.div variants={listItem}>
            <Card>
              <p className="text-ink mb-2 text-sm font-extrabold">Opponent strength</p>
              <button
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
              <button
                type="button"
                onClick={() => {
                  setThinkingGame((t) => !t);
                  haptics.fire("select");
                }}
                className={`rounded-card mt-4 flex w-full items-center justify-between border-2 px-3 py-2 text-left transition-colors ${
                  thinkingGame
                    ? "border-brand bg-brand-50"
                    : "border-hairline bg-surface-card"
                }`}
              >
                <span>
                  <span className="text-ink flex items-center gap-1.5 text-sm font-extrabold">
                    <Icon name="brain" size={16} className="text-brand shrink-0" />
                    Thinking game
                  </span>
                  <span className="text-ink-500 block text-xs font-semibold">
                    No clock — coach prompts and confirm each move
                  </span>
                </span>
                <span
                  className={`h-5 w-5 shrink-0 rounded-full border-2 ${thinkingGame ? "border-brand bg-brand" : "border-ink-300"}`}
                />
              </button>
            </Card>
          </motion.div>
        )}

        <motion.div variants={listItem}>
          <Card>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => {
                haptics.fire("select");
                audio.play("select");
                startNav();
                router.push("/play/think");
              }}
            >
              <span className="flex items-center gap-3">
                <IconBadge name="brain" size="lg" tone="brand" />
                <span>
                  <span className="text-ink block text-sm font-extrabold">
                    Calculation trainer
                  </span>
                  <span className="text-ink-500 block text-xs font-semibold">
                    One position — calculate, confirm, or reveal the answer
                  </span>
                </span>
              </span>
              <Icon name="chevronRight" size={18} className="text-ink-300 shrink-0" />
            </button>
          </Card>
        </motion.div>

        <motion.div variants={listItem}>
          <Card className={thinkingGame && mode === "bot" ? "opacity-50" : undefined}>
            <p className="text-ink mb-2 text-sm font-extrabold">Time control</p>
            {thinkingGame && mode === "bot" && (
              <p className="text-ink-500 mb-2 text-xs font-semibold">
                Disabled for thinking games — calculate without clock pressure.
              </p>
            )}
            <div
              className={`flex flex-wrap gap-2 ${thinkingGame && mode === "bot" ? "pointer-events-none" : ""}`}
            >
              {TIME_PRESETS.map((t) => (
                <button
                  key={t.min}
                  onClick={() => {
                    setTimeMin(t.min);
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
        </motion.div>

        <motion.div variants={listItem} className="flex flex-col gap-2">
          <Button size="lg" block onClick={begin}>
            {mode === "pass" ? "Start (one device)" : "Start match"}
          </Button>
          {/* Online play is a Human-mode option only — hidden for vs Bot. */}
          {mode === "pass" && (
            <Button
              size="lg"
              variant="outline"
              block
              loading={creating}
              onClick={playOnline}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Icon name="link" size={18} className="shrink-0" />
                Play a friend online (share link)
              </span>
            </Button>
          )}
        </motion.div>
      </motion.div>

      <MatchPreviewPanel
        mode={mode}
        targetElo={targetElo}
        adaptive={adaptive}
        rating={rating}
        timeMin={thinkingGame && mode === "bot" ? 0 : timeMin}
        thinkingGame={thinkingGame && mode === "bot"}
      />
    </div>
  );
}

function ModeCard({
  active,
  iconName,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  iconName: IconName;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn-tactile rounded-card border-2 p-4 text-left transition-colors ${
        active ? "border-brand bg-brand-50" : "border-hairline bg-surface-card"
      }`}
    >
      <IconBadge name={iconName} size="lg" tone="brand" selected={active} />
      <div className="text-ink mt-2 text-sm font-extrabold">{title}</div>
      <div className="text-ink-500 text-xs font-semibold">{subtitle}</div>
    </button>
  );
}
