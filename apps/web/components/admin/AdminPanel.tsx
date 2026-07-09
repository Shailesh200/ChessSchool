"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Select as UiSelect } from "@/components/ui/Select";
import {
  createSemester,
  createClass,
  createLesson,
  deleteLesson,
  importContent,
} from "@/lib/admin-actions";

const IMPORT_EXAMPLE = `{
  "semester": { "title": "Semester 7 · Imports", "stage": "middle", "color": "#5b5bd6" },
  "classes": [
    {
      "title": "Imported Tactics", "emoji": "🎯", "blurb": "From file",
      "lessons": [
        {
          "title": "Win the rook", "xp": 20,
          "steps": [
            { "fen": "k7/8/8/8/3r4/8/8/3R3K w - - 0 1", "solution": "d1:d4", "coach": "Take it!" }
          ]
        }
      ]
    }
  ]
}`;

type Opt = { id: string; title: string };

export function AdminPanel({
  adminName,
  stats,
  semesters,
  classes,
  recent,
}: {
  adminName: string;
  stats: { semesters: number; classes: number; lessons: number; users: number };
  semesters: Opt[];
  classes: Opt[];
  recent: { id: string; classId: string; title: string }[];
}) {
  return (
    <div className="bg-surface min-h-dvh px-5 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/library"
            className="rounded-pill border-hairline text-ink-700 border-2 px-4 py-1.5 text-sm font-bold"
          >
            View library
          </Link>
        </div>

        <div>
          <h1 className="text-ink text-2xl font-extrabold">Curriculum Admin</h1>
          <p className="text-ink-500 text-sm font-semibold">
            Signed in as {adminName} · add content; it appears in the library instantly.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Stat label="Lessons" value={stats.lessons} />
          <Stat label="Classes" value={stats.classes} />
          <Stat label="Semesters" value={stats.semesters} />
          <Stat label="Students" value={stats.users} />
        </div>

        {/* New lesson (validated) */}
        <Section title="Add a lesson">
          <FormBlock action={createLesson} submit="Add lesson">
            <Select name="classId" label="Class" options={classes} />
            <Input name="title" label="Title" placeholder="Win the rook" />
            <Input
              name="coach"
              label="Coach prompt"
              placeholder="Capture the undefended rook!"
            />
            <Input
              name="fen"
              label="FEN"
              placeholder="k7/8/8/8/3r4/8/8/3R3K w - - 0 1"
              mono
            />
            <Input
              name="solution"
              label="Solution (from:to)"
              placeholder="d1:d4"
              mono
            />
            <p className="text-ink-500 text-xs font-semibold">
              The FEN + move are validated with chess.js before saving.
            </p>
          </FormBlock>
        </Section>

        {/* New class */}
        <Section title="Add a class">
          <FormBlock action={createClass} submit="Add class">
            <Select name="semesterId" label="Semester" options={semesters} />
            <Input name="title" label="Title" placeholder="Rook Endgames" />
            <Input name="emoji" label="Emoji" placeholder="🏰" />
            <Input name="blurb" label="Blurb" placeholder="Lucena & Philidor" />
          </FormBlock>
        </Section>

        {/* New semester */}
        <Section title="Add a semester">
          <FormBlock action={createSemester} submit="Add semester">
            <Input name="title" label="Title" placeholder="Semester 6 · Strategy" />
            <Input name="blurb" label="Blurb" placeholder="Plans & weak squares" />
            <Input name="color" label="Color" placeholder="#5b5bd6" mono />
          </FormBlock>
        </Section>

        {/* Bulk import (#14) */}
        <ImportSection />

        {/* Recent admin lessons */}
        {recent.length > 0 && (
          <Section title="Recently added">
            <div className="flex flex-col gap-2">
              {recent.map((l) => (
                <Card key={l.id} className="flex items-center gap-2 p-3">
                  <span className="text-ink min-w-0 flex-1 truncate text-sm font-bold">
                    {l.title}
                  </span>
                  <Link
                    href={`/library/lesson/${l.id}`}
                    className="text-brand text-xs font-bold"
                  >
                    preview
                  </Link>
                  <button
                    onClick={() => deleteLesson(l.id)}
                    aria-label="Delete lesson"
                    className="text-ink-300 hover:bg-danger/10 hover:text-danger flex h-8 w-8 items-center justify-center rounded-full"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </Card>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border-hairline bg-surface-card border p-3 text-center">
      <div className="text-ink text-xl font-extrabold tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="text-ink-500 text-[10px] font-semibold">{label}</div>
    </div>
  );
}

function ImportSection() {
  const [state, formAction, pending] = useActionState(importContent, undefined);
  const [json, setJson] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setJson(await file.text());
  }

  return (
    <Section title="Import a class / semester (JSON)">
      <Card>
        <form action={formAction} className="flex flex-col gap-3">
          <p className="text-ink-500 text-xs font-semibold">
            Upload or paste a JSON file. Every FEN + move is validated with chess.js
            before anything is saved.
          </p>
          <input
            type="file"
            accept="application/json,.json,.txt"
            onChange={onFile}
            className="text-ink-700 file:rounded-pill file:bg-surface-sunken file:text-ink-700 text-xs font-semibold file:mr-3 file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-bold"
          />
          <textarea
            name="json"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={8}
            placeholder={IMPORT_EXAMPLE}
            className="rounded-card border-hairline bg-surface text-ink focus:border-brand border px-3 py-2 font-mono text-[11px] leading-relaxed outline-none"
          />
          {state?.error && (
            <p className="text-danger text-xs font-bold">{state.error}</p>
          )}
          {state?.ok && (
            <p className="text-success text-xs font-bold">✓ {state.message}</p>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Importing…" : "Import content"}
          </Button>
          <details className="text-ink-500 text-xs">
            <summary className="cursor-pointer font-bold">Expected format</summary>
            <pre className="rounded-card bg-surface-sunken mt-2 overflow-auto p-2 text-[10px] leading-relaxed">
              {IMPORT_EXAMPLE}
            </pre>
          </details>
        </form>
      </Card>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-ink mb-2 text-sm font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function FormBlock({
  action,
  submit,
  children,
}: {
  action: (
    prev: { error?: string; ok?: boolean } | undefined,
    fd: FormData,
  ) => Promise<{ error?: string; ok?: boolean }>;
  submit: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-3">
        {children}
        {state?.error && <p className="text-danger text-xs font-bold">{state.error}</p>}
        {state?.ok && (
          <p className="text-success text-xs font-bold">
            ✓ Saved — live in the library.
          </p>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : submit}
        </Button>
      </form>
    </Card>
  );
}

function Input({
  name,
  label,
  placeholder,
  mono,
}: {
  name: string;
  label: string;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-700 text-xs font-extrabold">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        className={`rounded-card border-hairline bg-surface text-ink focus:border-brand h-11 border px-3 text-sm font-semibold outline-none ${mono ? "font-mono text-xs" : ""}`}
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: Opt[];
}) {
  return <UiSelect name={name} label={label} options={options} />;
}
