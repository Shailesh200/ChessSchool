"use client";

import { ApiError, copy } from "@chessschool/design";
import { useState } from "react";
import { Button, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

type Phase = "ask" | "confirm" | "guest" | "done";

/** Public deletion page. Signed-in deletion calls DELETE /v1/me through the same-origin API proxy. */
export function DeleteAccountScreen() {
  const { state, ready, deleteAccount } = useApp();
  const [phase, setPhase] = useState<Phase>("ask");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = copy.accountDelete;

  if (!ready) return <div className="page-skeleton" aria-busy="true" />;

  const guest = phase === "guest" || (phase !== "done" && phase !== "confirm" && !state.account);

  return (
    <div className="flow flow-doc">
      <TopBar title={t.title} backHref="/" />
      <article className="doc">
        {phase === "done" ? (
          <>
            <h1>{t.doneTitle}</h1>
            <p>{t.doneBody}</p>
            <Button href="/today" block>
              {t.home}
            </Button>
          </>
        ) : guest ? (
          <>
            <p className="lead">{t.signedOut}</p>
            <ol>
              {t.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>
              <a className="link" href={`mailto:${t.email}`}>
                {t.emailLabel}: {t.email}
              </a>
            </p>
            <Button href="/login" block>
              {t.login}
            </Button>
          </>
        ) : phase === "confirm" ? (
          <>
            <h1>{t.confirmTitle}</h1>
            <p>{t.confirmBody}</p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              block
              variant="danger"
              icon="trash"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await deleteAccount();
                  setPhase("done");
                } catch (err) {
                  if (err instanceof ApiError && (err.status === 401 || err.code === "unauthorized")) {
                    setPhase("guest");
                    return;
                  }
                  setError(t.retry);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t.confirm}
            </Button>
            <Button block variant="ghost" onClick={() => (setError(null), setPhase("ask"))} disabled={busy}>
              {t.cancel}
            </Button>
          </>
        ) : (
          <>
            <p className="lead">{t.signedIn}</p>
            <Button block variant="danger" icon="trash" onClick={() => setPhase("confirm")}>
              {t.start}
            </Button>
          </>
        )}
      </article>
    </div>
  );
}
