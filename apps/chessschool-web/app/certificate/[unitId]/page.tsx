"use client";

import { ApiError, copy } from "@chessschool/design";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/state";

/** A finished unit's certificate (SVG from the API) with a Print button; print shows only the certificate. */
export default function CertificatePage() {
  const { unitId } = useParams<{ unitId: string }>();
  const { ready } = useApp();
  const [cert, setCert] = useState<{ path: string; unit: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    api
      .certificateLink(unitId)
      .then((r) => {
        if (live) setCert(r);
      })
      .catch((err) => {
        if (live) setError(err instanceof ApiError && err.status === 403 ? copy.certificate.notFinished : errorMessage(err));
      });
    return () => {
      live = false;
    };
  }, [ready, unitId]);

  return (
    <main className="certificate-page">
      {cert ? (
        <>
          <div className="certificate-actions">
            <Button icon="doc" onClick={() => window.print()}>
              {copy.certificate.print}
            </Button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- server-made SVG */}
          <img className="certificate-sheet" src={cert.path} alt={`${copy.certificate.title}: ${cert.unit}`} />
        </>
      ) : (
        <p className="muted" role={error ? "alert" : "status"}>
          {error ?? copy.certificate.loading}
        </p>
      )}
    </main>
  );
}
