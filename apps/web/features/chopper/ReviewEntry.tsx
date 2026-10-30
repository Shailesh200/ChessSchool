"use client";

import { useSettings } from "@/core/store/settings.store";
import { ReviewQueue, ReviewTab } from "./ReviewScreens";
import { LegacyReview } from "./LegacyReview";

export function ReviewEntry({
  fixture = false,
  queue = false,
}: {
  fixture?: boolean;
  queue?: boolean;
}) {
  const uiKit = useSettings((s) => s.uiKit);
  if (uiKit === "legacy") return <LegacyReview />;
  if (queue) return <ReviewQueue fixture={fixture} />;
  return <ReviewTab fixture={fixture} />;
}
