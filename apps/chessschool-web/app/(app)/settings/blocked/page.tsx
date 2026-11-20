"use client";

import { copy, type BlockedPlayer } from "@chessschool/design";
import { useEffect, useState } from "react";
import { MemberFace } from "@/components/ClassPlay";
import { Button, Card, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

/** Settings → Blocked players: everyone you blocked (class, board, profile or challenge), with Unblock. */
export default function BlockedPage() {
  const { state, ready } = useApp();
  const toast = useToast();
  const t = copy.social;
  const [list, setList] = useState<BlockedPlayer[] | null>(null);
  useEffect(() => {
    if (ready && state.account) api.blocks().then((r) => setList(r.blocked), () => setList([]));
  }, [ready, state.account]);
  const unblock = (p: BlockedPlayer) =>
    api
      .unblockPlayer(p.id)
      .then(() => {
        setList((l) => l?.filter((x) => x.id !== p.id) ?? l);
        toast(t.unblocked(p.name));
      })
      .catch(() => toast(copy.auth.errors.offline));

  return (
    <div className="page page-narrow">
      <TopBar title={t.blockedTitle} backHref="/settings" />
      <p className="page-lead">{t.blockedHint}</p>
      {!list ? (
        <div className="page-skeleton" aria-busy="true" />
      ) : list.length === 0 ? (
        <p className="muted">{t.blockedNone}</p>
      ) : (
        <Card as="div">
          <ul className="blocked-list">
            {list.map((p) => (
              <li key={p.id}>
                <MemberFace id={p.avatar} size={40} />
                <strong>{p.name}</strong>
                <Button variant="secondary" onClick={() => void unblock(p)}>
                  {t.unblock}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
