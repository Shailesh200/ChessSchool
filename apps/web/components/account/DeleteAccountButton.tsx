"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";

export function DeleteAccountButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (busy) return;
    const ok = window.confirm(
      "Delete your ChessSchool account permanently?\n\nAll progress, settings, and your student profile will be removed. This cannot be undone.",
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      useProgression.getState().reset();
      useSession.getState().setSession(false, null);
      useSettings.getState().set("targetElo", 600);
      router.replace("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={deleteAccount}
        disabled={busy}
        className="rounded-pill border-2 border-danger-500 px-4 py-2 text-sm font-bold text-danger-500 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete account"}
      </button>
      {error ? <p className="text-center text-xs font-semibold text-danger-500">{error}</p> : null}
    </div>
  );
}
