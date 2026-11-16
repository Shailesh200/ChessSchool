"use client";

import { copy } from "@chessschool/design";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { api } from "@/lib/api";

/** A shared card's page: the card and one button into the first lesson. */
export default function SharedCardPage() {
  const { id } = useParams<{ id: string }>();
  const [image, setImage] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    api
      .share(id)
      .then((s) => setImage(s.image))
      .catch(() => setImage(null));
  }, [id]);
  return (
    <main className="landing">
      <Wordmark size="lg" />
      <h1>{copy.share.pageTitle}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- server-made PNG */}
      {image ? <img className="landing-card" src={image} alt={copy.share.pageTitle} width={270} height={480} /> : null}
      {image === null ? <p role="alert">{copy.share.missing}</p> : null}
      <p className="lead">{copy.share.pageBody}</p>
      <Button block href="/">
        {copy.share.start}
      </Button>
    </main>
  );
}
