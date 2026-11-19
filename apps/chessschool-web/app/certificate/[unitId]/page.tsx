"use client";

import { ApiError, copy } from "@chessschool/design";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";

/** A finished unit's certificate (SVG from the API), shown in full first; Download and Share come after it. */
export default function CertificatePage() {
  const { unitId } = useParams<{ unitId: string }>();
  const { ready } = useApp();
  const [cert, setCert] = useState<{ url: string; path: string; unit: string } | null>(null);
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
          {/* eslint-disable-next-line @next/next/no-img-element -- server-made SVG */}
          <img className="certificate-sheet" src={cert.path} alt={`${copy.certificate.title}: ${cert.unit}`} />
          <p className="muted certificate-hint">{copy.certificate.preview}</p>
          <div className="certificate-actions">
            {/* A plain link: the certificate lives on the API's domain, so it opens in a new tab to save. */}
            <a className="btn btn-secondary" href={cert.url} target="_blank" rel="noopener" download>
              <Icon name="doc" size={22} />
              <span>{copy.certificate.download}</span>
            </a>
            <Button onClick={() => void shareLink(copy.certificate.share(cert.unit), cert.url)}>{copy.certificate.shareAction}</Button>
          </div>
        </>
      ) : (
        <p className="muted" role={error ? "alert" : "status"}>
          {error ?? copy.certificate.loading}
        </p>
      )}
    </main>
  );
}
