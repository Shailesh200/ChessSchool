"use client";

import { copy } from "@chessschool/design";
import { StatusScreen } from "@/components/StatusScreen";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <StatusScreen pose="sad-soft" title={copy.system.errorTitle} body={copy.system.errorBody} cta={copy.system.retry} onAction={reset} />;
}
