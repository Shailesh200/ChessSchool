"use client";

import { ApiError, copy, type SafetyAction, type SafetyReport, type SupportMessage } from "@chessschool/design";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Segmented, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";

type Load = { state: "loading" | "signin" | "forbidden" | "error" } | { state: "ok"; reports: SafetyReport[]; support: SupportMessage[] };
const ago = (at: number) => {
  const m = Math.round((Date.now() - at) / 60_000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const REASON: Record<string, string> = { ...copy.reporting.reasons, ...copy.social.reasons };

/** Admin safety queue: class and player reports (dismiss, hide name or photo, suspend) and "Contact us" messages. ADMIN_EMAILS only. */
export default function SafetyPage() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [view, setView] = useState<"open" | "all" | "support">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const fetchAll = useCallback(() => {
    api
      .adminSafety()
      .then((r) => setLoad({ state: "ok", ...r }))
      .catch((err) => setLoad({ state: err instanceof ApiError && err.status === 401 ? "signin" : err instanceof ApiError && err.status === 403 ? "forbidden" : "error" }));
  }, []);
  useEffect(fetchAll, [fetchAll]);

  if (load.state !== "ok") {
    const msg = { loading: "Loading…", signin: "Sign in with the admin account to see this page.", forbidden: "This account can't open the admin page.", error: "Couldn't load the queue. Try again." }[load.state];
    return (
      <div className="page page-narrow">
        <TopBar title="Safety" backHref="/admin" />
        <p className="page-lead" aria-live="polite">
          {msg}
        </p>
        {load.state === "signin" ? <Button href="/login">Sign in</Button> : null}
        {load.state === "error" ? <Button onClick={fetchAll}>Try again</Button> : null}
      </div>
    );
  }

  const act = async (r: SafetyReport, action: SafetyAction) => {
    if ((action === "suspend" || action === "hide_name") && !window.confirm(action === "suspend" ? `Suspend ${r.reported || "this account"}? They are signed out and can't sign in.` : `Clear the name "${r.reported}"?`)) return;
    setBusy(`${r.id}:${action}`);
    try {
      await api.safetyAction(r.id, action);
      fetchAll();
    } catch {
      toast(copy.auth.errors.generic);
    } finally {
      setBusy(null);
    }
  };
  const open = load.reports.filter((r) => r.status === "open");
  const shown = view === "open" ? open : load.reports;
  const btn = (r: SafetyReport, action: SafetyAction, label: string, variant: "secondary" | "ghost" | "danger" = "secondary") => (
    <Button variant={variant} loading={busy === `${r.id}:${action}`} disabled={Boolean(busy)} onClick={() => void act(r, action)}>
      {label}
    </Button>
  );

  return (
    <div className="page admin">
      <TopBar title="Safety" backHref="/admin" />
      <div className="admin-head">
        <p className="page-lead">
          {open.length} open {open.length === 1 ? "report" : "reports"} · {load.support.length} support messages
        </p>
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: "Open" },
            { value: "all", label: "All reports" },
            { value: "support", label: "Support" },
          ]}
        />
      </div>

      {view === "support" ? (
        <Card>
          {load.support.length ? (
            <ul className="admin-report-list">
              {load.support.map((m) => (
                <li key={m.id} className="admin-report">
                  <div className="admin-report-meta">
                    <span className="chip">{m.topic}</span>
                    <span className="muted">
                      {m.account || "Guest"} · {m.platform} {m.version} · {ago(m.createdAt)}
                    </span>
                  </div>
                  <p className="safety-message">{m.message}</p>
                  {m.email ? (
                    <a className="btn btn-secondary" href={`mailto:${m.email}?subject=${encodeURIComponent("Your ChessSchool message")}`}>
                      Reply to {m.email}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No messages yet.</p>
          )}
        </Card>
      ) : (
        <Card>
          {shown.length ? (
            <ul className="admin-report-list">
              {shown.map((r) => (
                <li key={r.id} className="admin-report">
                  <div className="admin-report-meta">
                    <span className={`chip ${r.reason === "name" || r.reason === "photo" ? "chip-accent" : r.reason === "behaviour" || r.reason === "cheating" ? "chip-gold" : ""}`}>{REASON[r.reason] ?? r.reason}</span>
                    <span className="muted">
                      {r.className ?? (r.className === null && r.note.startsWith("[challenge") ? "Challenge link" : "Player report")} · {ago(r.createdAt)} · {r.status}
                    </span>
                  </div>
                  <div className="safety-who">
                    {r.reportedPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.reportedPhoto} alt={`Photo of ${r.reported || "the reported account"}`} width={56} height={56} className="safety-photo" />
                    ) : null}
                    <p>
                      <strong>{r.reported || "(no name)"}</strong>
                      {r.reportedSuspended ? <span className="chip chip-accent"> suspended</span> : null}
                      <span className="muted">
                        {" "}
                        reported by {r.reporter || "a deleted account"} · {r.openAboutThem} open about them
                      </span>
                    </p>
                  </div>
                  {r.note ? <p className="safety-message">“{r.note}”</p> : null}
                  <div className="safety-actions">
                    {r.status === "open" ? btn(r, "dismiss", "Dismiss", "ghost") : btn(r, "reopen", "Reopen", "ghost")}
                    {r.reported ? btn(r, "hide_name", "Clear name") : null}
                    {r.reportedPhoto ? btn(r, "hide_photo", "Remove photo") : null}
                    {r.reportedSuspended ? btn(r, "unsuspend", "Lift suspension") : btn(r, "suspend", "Suspend", "danger")}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing waiting.</p>
          )}
        </Card>
      )}
    </div>
  );
}
