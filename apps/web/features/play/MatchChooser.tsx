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
  const [timeMin, setTimeMin] = useState(0);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  function begin() {
    haptics.fire("success");
    audio.play("unlock");
    // Adaptive: the bot plays at your current rating (which then moves with results).
    start(mode, adaptive ? rating : targetElo, timeMin);
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
            emoji="🤖"
            title="vs Bot"
            subtitle="Adaptive AI 300–2000"
            onClick={() => {
              setMode("bot");
              haptics.fire("select");
            }}
          />
          <ModeCard
            active={mode === "pass"}
            emoji="👥"
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
                  <span className="text-ink text-sm font-extrabold">
                    🎯 Adaptive bot
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
                    className={`rounded-pill px-3 py-1 text-sm font-bold transition-colors ${
                      targetElo === elo
                        ? "bg-brand text-white"
                        : "bg-surface-sunken text-ink-500"
                    }`}
                  >
                    {elo}
                  </button>
                ))}
              </div>
              {!adaptive && (
                <p className="text-ink mt-3 flex items-center gap-2 text-sm font-bold">
                  <span className="text-lg">{botProfile(targetElo).emoji}</span>
                  {botProfile(targetElo).name}
                  <span className="text-ink-500 font-semibold">
                    · {botProfile(targetElo).blurb}
                  </span>
                </p>
              )}
            </Card>
          </motion.div>
        )}

        <motion.div variants={listItem}>
          <Card>
            <p className="text-ink mb-2 text-sm font-extrabold">Time control</p>
            <div className="flex flex-wrap gap-2">
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
              🔗 Play a friend online (share link)
            </Button>
          )}
        </motion.div>
      </motion.div>

      <MatchPreviewPanel
        mode={mode}
        targetElo={targetElo}
        adaptive={adaptive}
        rating={rating}
        timeMin={timeMin}
      />
    </div>
  );
}

function ModeCard({
  active,
  emoji,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  emoji: string;
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
      <div className="text-3xl">{emoji}</div>
      <div className="text-ink mt-2 text-sm font-extrabold">{title}</div>
      <div className="text-ink-500 text-xs font-semibold">{subtitle}</div>
    </button>
  );
}
