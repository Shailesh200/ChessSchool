"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { exportToFile, importAll, storageEstimateKB } from "@/core/backup/backup";
import { audio } from "@/core/audio/audioEngine";
import { toast } from "@/core/store/toast.store";

/** Data ownership + trust panel (#72/#84/#86). */
export function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<number | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    storageEstimateKB().then(setStorage);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((r) => setOfflineReady(Boolean(r?.active)));
    }
  }, []);

  async function onImport(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const preview = await importAll(parsed);
      if (!preview.ok) {
        setMsg(`⚠️ ${preview.reason}`);
        audio.play("fail");
        return;
      }
      if (
        confirm(
          `Import ${preview.games} games and ${preview.journal} journal entries? This replaces current local data.`,
        )
      ) {
        audio.play("success");
        location.reload();
      }
    } catch {
      setMsg("⚠️ Could not read that file.");
      audio.play("fail");
    }
  }

  function resetAll() {
    if (!confirm("Reset ALL progress and data? This cannot be undone.")) return;
    [
      "duochess.settings",
      "duochess.progression",
      "chessschool.plan",
      "chessschool.activematch",
      "chessschool.install.dismissed",
    ].forEach((k) => localStorage.removeItem(k));
    indexedDB.deleteDatabase("duochess");
    location.reload();
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm font-extrabold text-ink">Your data</p>

      {/* Trust strip */}
      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
        <span className="rounded-pill bg-success/15 px-2 py-1 text-success-600">✓ All changes saved</span>
        <span className={`rounded-pill px-2 py-1 ${offlineReady ? "bg-brand-50 text-brand" : "bg-surface-sunken text-ink-500"}`}>
          {offlineReady ? "📡 Offline ready" : "📡 Preparing offline…"}
        </span>
        {storage != null && (
          <span className="rounded-pill bg-surface-sunken px-2 py-1 text-ink-500">
            💾 {storage < 1024 ? `${storage} KB` : `${(storage / 1024).toFixed(1)} MB`} stored
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-ink-500">
        Everything lives on this device — no account, no servers. Export a backup anytime.
      </p>

      {msg && <p className="text-xs font-bold text-danger">{msg}</p>}

      <div className="flex gap-2">
        <Button
          block
          variant="outline"
          size="sm"
          onClick={() => exportToFile().then(() => toast("Backup exported", { icon: "check", tone: "success" }))}
        >
          Export backup
        </Button>
        <Button block variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          ⬆︎ Import
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImport(f);
          e.target.value = "";
        }}
      />

      <Button variant="danger" size="sm" onClick={resetAll}>
        Reset all data
      </Button>
    </Card>
  );
}
