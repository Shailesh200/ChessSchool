"use client";

import { copy, type ReportReason } from "@chessschool/design";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Switch, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

const REASONS: ReportReason[] = ["name", "behaviour", "other"];

function Report() {
  const params = useSearchParams();
  const classId = params.get("class") ?? "";
  const memberId = params.get("member") ?? "";
  const name = params.get("name") ?? copy.you.noName;
  const router = useRouter();
  const { cue } = useApp();
  const toast = useToast();
  const t = copy.classroom;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await api.reportMember(classId, memberId, { reason, note: note.trim(), block });
      cue("success");
      toast(t.reported);
      router.push("/class");
    } catch {
      cue("gentle-no");
      toast(copy.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow">
      <TopBar title={t.reportTitle(name)} backHref="/class" />
      <p className="page-lead">{t.reportSub}</p>
      <fieldset className="report-reasons">
        <legend className="row-label">{t.reportWhat}</legend>
        <div className="report-chips">
          {REASONS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} className={`report-chip${reason === r ? " on" : ""}`} onClick={() => setReason(r)}>
              {reason === r ? <Icon name="check" size={18} /> : null}
              {t.reasons[r]}
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
        <Switch icon="block" label={t.alsoBlock(name)} hint={t.alsoBlockHint} checked={block} onChange={setBlock} />
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
