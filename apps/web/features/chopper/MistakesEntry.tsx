"use client";

import { useSettings } from "@/core/store/settings.store";
import { FixMistakes } from "./FixMistakes";
import { PracticeMistakesPlayer } from "./PracticeMistakesPlayer";

export function MistakesEntry({
  fixture = false,
  play = false,
}: {
  fixture?: boolean;
  play?: boolean;
}) {
  const uiKit = useSettings((s) => s.uiKit);
  if (uiKit === "legacy" || play) return <PracticeMistakesPlayer />;
  return <FixMistakes fixture={fixture} />;
}
