"use client";

import { copy } from "@chessschool/design";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { StatusScreen } from "@/components/StatusScreen";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return <StatusScreen pose="sad-soft" title={copy.system.errorTitle} body={copy.system.errorBody} cta={copy.system.retry} onAction={reset} />;
}
