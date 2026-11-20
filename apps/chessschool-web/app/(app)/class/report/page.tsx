"use client";

import { copy, PLAYER_REPORT_REASONS, type PlayerReportReason } from "@chessschool/design";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Switch, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

const CLASS_REASONS = ["name", "behaviour", "other"] as const;

function Report() {
  const params = useSearchParams();
  const classId = params.get("class") ?? "";
  const memberId = params.get("member") ?? "";
  // Also reports any player (`player`) or whoever sent a challenge link (`challenge`).
  const playerId = params.get("player") ?? "";
  const challenge = params.get("challenge") ?? "";
  const social = !memberId;
  const reasons: readonly PlayerReportReason[] = social ? PLAYER_REPORT_REASONS : CLASS_REASONS;
  const label = (r: PlayerReportReason) => (social ? copy.social.reasons[r] : copy.classroom.reasons[r as (typeof CLASS_REASONS)[number]]);
  const backHref = social ? (playerId ? `/player?id=${encodeURIComponent(playerId)}` : challenge ? `/c/${challenge}` : "/leaderboard") : "/class";
  const name = params.get("name") ?? copy.you.noName;
  const router = useRouter();
  const { cue } = useApp();
  const toast = useToast();
  const t = copy.classroom;
  const [reason, setReason] = useState<PlayerReportReason | null>(null);
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      const r = { reason, note: note.trim(), block };
      if (!social) await api.reportMember(classId, memberId, { ...r, reason: reason as (typeof CLASS_REASONS)[number] });
      else if (challenge) await api.reportChallenge(challenge, r);
      else await api.reportPlayer(playerId, r);
      cue("success");
      toast(social ? copy.social.reported : t.reported);
      router.push(social ? (block ? "/leaderboard" : backHref) : "/class");
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
      <p className="page-lead">{social ? copy.social.reportBody : t.reportSub}</p>
      <fieldset className="report-reasons">
        <legend className="row-label">{t.reportWhat}</legend>
        <div className="report-chips">
          {reasons.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} className={`report-chip${reason === r ? " on" : ""}`} onClick={() => setReason(r)}>
              {reason === r ? <Icon name="check" size={18} /> : null}
              {label(r)}
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
        <Switch icon="block" label={t.alsoBlock(name)} hint={social ? copy.social.alsoBlockHint : t.alsoBlockHint} checked={block} onChange={setBlock} />
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
