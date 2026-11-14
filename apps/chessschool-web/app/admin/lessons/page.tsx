"use client";

import type { Step } from "@chessschool/chess";
import { ApiError, type AdminCourse, type AdminCourseVersion, type AdminLesson } from "@chessschool/design";
import { Component, useCallback, useEffect, useState } from "react";
import { LessonPlayer } from "@/components/LessonPlayer";
import { Button, Card, Chip, Segmented, TextField, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";

type Load = { state: "loading" } | { state: "signin" } | { state: "forbidden" } | { state: "error" } | { state: "ok"; course: AdminCourse; versions: AdminCourseVersion[] };
type Check = { ok: boolean; errors: string[] } | null;

const pretty = (v: unknown) => JSON.stringify(v, null, 2);
function parse(text: string): AdminLesson | null {
  try {
    const v = JSON.parse(text) as AdminLesson;
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
type Level = "beginner" | "intermediate" | "advanced";
const LEVELS: { value: Level; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
const when = (at: number) => new Date(at).toLocaleString();

/** A broken step should break the preview, not the editor. */
class PreviewBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p className="field-error">The preview can&apos;t play these steps. Validate to see why.</p> : this.props.children;
  }
}

/** Internal lesson editor: edit a lesson in the database, preview it with the real player, validate, draft, publish, roll back. */
export default function LessonEditorPage() {
  const toast = useToast();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [id, setId] = useState<string | null>(null);
  const [live, setLive] = useState<AdminLesson | null>(null);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [check, setCheck] = useState<Check>(null);
  const [busy, setBusy] = useState<null | "validate" | "draft" | "publish" | "rollback" | "ai">(null);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("beginner");

  const fetchAll = useCallback(() => {
    Promise.all([api.adminCourse(), api.courseVersions()])
      .then(([course, v]) => setLoad({ state: "ok", course, versions: v.versions }))
      .catch((err) => setLoad({ state: err instanceof ApiError && err.status === 401 ? "signin" : err instanceof ApiError && err.status === 403 ? "forbidden" : "error" }));
  }, []);
  useEffect(fetchAll, [fetchAll]);

  const open = async (lessonId: string) => {
    setId(lessonId);
    setCheck(null);
    try {
      const r = await api.adminLesson(lessonId);
      setLive(r.lesson);
      setText(pretty(r.draft?.lesson ?? r.lesson));
      setDraftNote(r.draft ? `Draft saved by ${r.draft.updatedBy}, ${when(r.draft.updatedAt)}` : null);
    } catch {
      toast("Couldn't open that lesson.");
    }
  };

  if (load.state !== "ok") {
    const msg = { loading: "Loading…", signin: "Sign in with the admin account to see this page.", forbidden: "This account can't open the admin page.", error: "Couldn't load the course. Try again." }[load.state];
    return (
      <div className="page page-narrow">
        <TopBar title="Lesson editor" backHref="/admin" />
        <p className="page-lead" aria-live="polite">
          {msg}
        </p>
        {load.state === "signin" ? <Button href="/login">Sign in</Button> : null}
        {load.state === "error" ? <Button onClick={fetchAll}>Try again</Button> : null}
      </div>
    );
  }

  const lesson = parse(text);
  const steps = lesson && Array.isArray(lesson.steps) && lesson.steps.length ? (lesson.steps as unknown as Step[]) : null;
  const field = (key: "title" | "sub" | "minutes" | "xp", value: string) => {
    if (!lesson) return;
    setText(pretty({ ...lesson, [key]: key === "minutes" || key === "xp" ? Number(value) : value }));
    setCheck(null);
  };

  const run = async (kind: NonNullable<typeof busy>, task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } catch {
      toast("That didn't work. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };
  const validate = () => run("validate", async () => setCheck(await api.validateLesson(lesson)));
  const saveDraft = () =>
    run("draft", async () => {
      await api.saveLessonDraft(id!, lesson);
      setDraftNote(`Draft saved, ${when(Date.now())}`);
      toast("Draft saved. It isn't live yet.");
      fetchAll();
    });
  const discard = () =>
    run("draft", async () => {
      await api.discardLessonDraft(id!);
      setDraftNote(null);
      setText(pretty(live));
      fetchAll();
    });
  const publish = () =>
    run("publish", async () => {
      const result = await api.validateLesson(lesson);
      setCheck(result);
      if (!result.ok) return;
      if (!window.confirm(`Publish "${lesson?.title}" to every learner?`)) return;
      const { version } = await api.publishLesson(lesson);
      toast(`Published as ${version}.`);
      setDraftNote(null);
      setLive(lesson);
      fetchAll();
    });
  const draftWithAi = () =>
    run("ai", async () => {
      if (draftNote && !window.confirm("Replace the saved draft with a new AI draft?")) return;
      const r = await api.draftLessonWithAi(id!, { topic: topic.trim(), level });
      setText(pretty(r.lesson));
      setCheck({ ok: r.errors.length === 0, errors: r.errors });
      setDraftNote(`AI draft saved, ${when(Date.now())}. Check it, edit it and publish by hand.`);
      toast(r.errors.length ? "AI draft saved, but it still fails some checks." : "AI draft saved. It isn't live yet.");
      fetchAll();
    });
  const rollback = (v: AdminCourseVersion) =>
    run("rollback", async () => {
      if (!window.confirm(`Roll the whole course back to ${v.version} (${v.note})?`)) return;
      const { version } = await api.rollbackCourse(v.id);
      toast(`Rolled back. Live version is now ${version}.`);
      fetchAll();
      if (id) await open(id);
    });

  return (
    <div className="page admin">
      <TopBar title="Lesson editor" backHref="/admin" />
      <p className="page-lead">
        Live course <strong>{load.course.version}</strong>. Drafts stay private until you publish. English text only: translations are seeded separately.
      </p>

      <div className="admin-editor">
        <Card className="admin-units">
          <h2 className="card-title">Units</h2>
          {load.course.units.map((u) => (
            <details key={u.id} open={u.lessons.some((l) => l.id === id)}>
              <summary>{u.title}</summary>
              <ul>
                {u.lessons.map((l) => (
                  <li key={l.id}>
                    <button type="button" className={`admin-lesson-link${l.id === id ? " is-on" : ""}`} aria-current={l.id === id || undefined} onClick={() => void open(l.id)}>
                      <span>{l.title}</span>
                      {l.draft ? (
                        <Chip tone="gold" label="Has a draft">
                          Draft
                        </Chip>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </Card>

        {id ? (
          <div className="admin-edit">
            <Card>
              <h2 className="card-title">Draft with AI</h2>
              <p className="muted">
                Describe the lesson for this slot ({load.course.units.find((u) => u.lessons.some((l) => l.id === id))?.title}). The language model writes it, the course checks run on it, and it is saved as this lesson&apos;s draft. Nothing goes live until you publish.
              </p>
              <div className="field">
                <label htmlFor="ai-topic">Topic</label>
                <textarea id="ai-topic" rows={3} maxLength={1000} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Knight forks on the king and queen, with two practice positions" />
              </div>
              <Segmented label="Level" value={level} options={LEVELS} onChange={setLevel} />
              <div className="admin-actions">
                <Button variant="secondary" onClick={draftWithAi} loading={busy === "ai"} disabled={!topic.trim() || Boolean(busy)}>
                  Draft with AI
                </Button>
              </div>
            </Card>
            <Card>
              <h2 className="card-title">
                {live?.title ?? id} <span className="muted">({id})</span>
              </h2>
              {draftNote ? <p className="muted">{draftNote}</p> : null}
              <div className="admin-fields">
                <TextField label="Title" value={lesson?.title ?? ""} disabled={!lesson} onChange={(e) => field("title", e.target.value)} />
                <TextField label="Subtitle" value={lesson?.sub ?? ""} disabled={!lesson} onChange={(e) => field("sub", e.target.value)} />
                <TextField label="Minutes" type="number" min={1} max={60} value={lesson?.minutes ?? ""} disabled={!lesson} onChange={(e) => field("minutes", e.target.value)} />
                <TextField label="XP" type="number" min={1} max={100} value={lesson?.xp ?? ""} disabled={!lesson} onChange={(e) => field("xp", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="lesson-json">Lesson JSON</label>
                <textarea
                  id="lesson-json"
                  className="admin-json"
                  rows={20}
                  spellCheck={false}
                  value={text}
                  aria-invalid={lesson ? undefined : true}
                  onChange={(e) => {
                    setText(e.target.value);
                    setCheck(null);
                  }}
                />
                {lesson ? null : (
                  <p className="field-error" role="alert">
                    This isn&apos;t valid JSON yet.
                  </p>
                )}
              </div>
              <div className="admin-actions">
                <Button variant="secondary" onClick={validate} loading={busy === "validate"} disabled={!lesson || Boolean(busy)}>
                  Validate
                </Button>
                <Button variant="secondary" onClick={saveDraft} loading={busy === "draft"} disabled={!lesson || Boolean(busy)}>
                  Save draft
                </Button>
                {draftNote ? (
                  <Button variant="ghost" onClick={discard} disabled={Boolean(busy)}>
                    Discard draft
                  </Button>
                ) : null}
                <Button onClick={publish} loading={busy === "publish"} disabled={!lesson || Boolean(busy)}>
                  Publish
                </Button>
              </div>
              <div aria-live="polite">
                {check?.ok ? <p className="admin-check-ok">Valid: the course passes every check with this lesson.</p> : null}
                {check && !check.ok ? (
                  <ul className="admin-check-errors">
                    {check.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Card>

            <Card>
              <h2 className="card-title">Preview</h2>
              <div className="admin-preview">
                {steps ? (
                  <PreviewBoundary key={text}>
                    <LessonPlayer steps={steps} closeHref="/admin/lessons" onFinished={() => {}} done={<p>Lesson finished.</p>} />
                  </PreviewBoundary>
                ) : (
                  <p className="muted">Add steps to see the preview.</p>
                )}
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <p className="muted">Pick a lesson to edit it.</p>
          </Card>
        )}
      </div>

      <Card>
        <h2 className="card-title">Published versions</h2>
        {load.versions.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Change</th>
                  <th>By</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {load.versions.map((v) => (
                  <tr key={v.id}>
                    <td>{v.version}</td>
                    <td>{v.note}</td>
                    <td>{v.createdBy}</td>
                    <td>{when(v.createdAt)}</td>
                    <td>
                      {v.version === load.course.version ? (
                        <span className="muted">Live</span>
                      ) : (
                        <button type="button" className="link" disabled={Boolean(busy)} onClick={() => void rollback(v)}>
                          Roll back
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Nothing published from the editor yet.</p>
        )}
      </Card>
    </div>
  );
}
