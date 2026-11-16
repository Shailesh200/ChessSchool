"use client";

import { copy } from "@chessschool/design";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Cody } from "@/components/Lottie";
import { Button } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { api } from "@/lib/api";
import { INVITE_KEY } from "@/lib/share";

/** An invite link: remembers the code on this device (it is accepted when the friend makes an account), then into the first lesson. */
export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    api
      .invite(code)
      .then((r) => {
        setName(r.name);
        try {
          localStorage.setItem(INVITE_KEY, r.code);
        } catch {}
      })
      .catch(() => setMissing(true));
  }, [code]);
  return (
    <main className="landing">
      <Wordmark size="lg" />
      <Cody animation="wave" size={150} label={copy.a11y.mascot} />
      <h1>{missing ? copy.invite.missing : copy.invite.pageTitle(name ?? "")}</h1>
      {missing ? null : <p className="lead">{copy.invite.pageBody}</p>}
      <Button block href="/">
        {copy.invite.start}
      </Button>
    </main>
  );
}
