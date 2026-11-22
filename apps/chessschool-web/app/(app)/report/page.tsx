"use client";

import { copy, PLAYER_REPORT_REASONS, type PlayerReportReason } from "@chessschool/design";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Switch, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

/** Reports any player (`player`) or whoever sent a challenge link (`challenge`). Was /class/report before classes were removed. */
function Report() {
  const params = useSearchParams();
  const playerId = params.get("player") ?? "";
  const challenge = params.get("challenge") ?? "";
  const backHref = playerId ? `/player?id=${encodeURIComponent(playerId)}` : challenge ? `/c/${challenge}` : "/leaderboard";
  const name = params.get("name") ?? copy.you.noName;
  const router = useRouter();
  const { cue } = useApp();
  const toast = useToast();
  const t = copy.reporting;
  const [reason, setReason] = useState<PlayerReportReason | null>(null);
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      const r = { reason, note: note.trim(), block };
      if (challenge) await api.reportChallenge(challenge, r);
      else await api.reportPlayer(playerId, r);
      cue("success");
      toast(copy.social.reported);
      router.push(block ? "/leaderboard" : backHref);
    } catch {
      cue("gentle-no");
      toast(copy.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow">
      <TopBar title={t.reportTitle(name)} backHref={backHref} />
      <p className="page-lead">{copy.social.reportBody}</p>
      <fieldset className="report-reasons">
        <legend className="row-label">{t.reportWhat}</legend>
        <div className="report-chips">
          {PLAYER_REPORT_REASONS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} className={`report-chip${reason === r ? " on" : ""}`} onClick={() => setReason(r)}>
              {reason === r ? <Icon name="check" size={18} /> : null}
              {copy.social.reasons[r]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="report-note">{t.reportMore}</label>
        <div className="field-box">
          <textarea id="report-note" rows={4} maxLength={500} placeholder={t.reportPlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="card list">
        <Switch icon="block" label={t.alsoBlock(name)} hint={copy.social.alsoBlockHint} checked={block} onChange={setBlock} />
      </div>
      <Button block disabled={!reason} loading={busy} onClick={() => void send()}>
        {t.sendReport}
      </Button>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="page-skeleton" aria-busy="true" />}>
      <Report />
    </Suspense>
  );
}
