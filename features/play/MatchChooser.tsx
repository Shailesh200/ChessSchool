"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useMatch, type MatchMode } from "@/core/store/match.store";
import { useSettings } from "@/core/store/settings.store";
import { startNav } from "@/core/store/nav.store";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";
import { listItem, listContainer } from "@/core/motion/variants";

const ELO_PRESETS = [600, 900, 1200, 1600, 2000];
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
  const [mode, setMode] = useState<MatchMode>("bot");
  const [timeMin, setTimeMin] = useState(0);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  function begin() {
    haptics.fire("success");
    audio.play("unlock");
    start(mode, targetElo, timeMin);
  }

  async function playOnline() {
    setCreating(true);
    haptics.fire("success");
    try {
      const r = await fetch("/api/session", { method: "POST" });
      if (!r.ok) throw new Error();
      const { id } = (await r.json()) as { id: string };
      localStorage.setItem(`chessschool.online.${id}`, "w");
      startNav();
      router.push(`/play/online/${id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <motion.div
      variants={listContainer}
      initial="initial"
      animate="enter"
      className="flex flex-col gap-4"
    >
      <motion.h1 variants={listItem} className="text-xl font-extrabold text-ink">
        New match
      </motion.h1>

      <motion.div variants={listItem} className="grid grid-cols-2 gap-3">
        <ModeCard
          active={mode === "bot"}
          emoji="🤖"
          title="vs Bot"
          subtitle="Adaptive AI 600–2000"
          onClick={() => { setMode("bot"); haptics.fire("select"); }}
        />
        <ModeCard
          active={mode === "pass"}
          emoji="👥"
          title="vs Human"
          subtitle="Two players, one device"
          onClick={() => { setMode("pass"); haptics.fire("select"); }}
        />
      </motion.div>

      {mode === "bot" && (
        <motion.div variants={listItem}>
          <Card>
            <p className="mb-2 text-sm font-extrabold text-ink">Opponent strength</p>
            <div className="flex flex-wrap gap-2">
              {ELO_PRESETS.map((elo) => (
                <button
                  key={elo}
                  onClick={() => { setSetting("targetElo", elo); haptics.fire("select"); }}
                  className={`rounded-pill px-3 py-1 text-sm font-bold transition-colors ${
                    targetElo === elo ? "bg-brand text-white" : "bg-surface-sunken text-ink-500"
                  }`}
                >
                  {elo}
                </button>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div variants={listItem}>
        <Card>
          <p className="mb-2 text-sm font-extrabold text-ink">Time control</p>
          <div className="flex flex-wrap gap-2">
            {TIME_PRESETS.map((t) => (
              <button
                key={t.min}
                onClick={() => { setTimeMin(t.min); haptics.fire("select"); }}
                className={`rounded-pill px-3 py-1 text-sm font-bold transition-colors ${
                  timeMin === t.min ? "bg-brand text-white" : "bg-surface-sunken text-ink-500"
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
          Start match
        </Button>
        <Button size="lg" variant="outline" block loading={creating} onClick={playOnline}>
          🔗 Play a friend online (share link)
        </Button>
      </motion.div>
    </motion.div>
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
      <div className="mt-2 text-sm font-extrabold text-ink">{title}</div>
      <div className="text-xs font-semibold text-ink-500">{subtitle}</div>
    </button>
  );
}
