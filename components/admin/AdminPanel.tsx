"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import {
  createSemester,
  createClass,
  createLesson,
  deleteLesson,
} from "@/lib/admin-actions";

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
    <div className="min-h-dvh bg-surface px-5 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/library" className="rounded-pill border-2 border-hairline px-4 py-1.5 text-sm font-bold text-ink-700">
            View library
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-ink">Curriculum Admin</h1>
          <p className="text-sm font-semibold text-ink-500">Signed in as {adminName} · add content; it appears in the library instantly.</p>
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
            <Input name="coach" label="Coach prompt" placeholder="Capture the undefended rook!" />
            <Input name="fen" label="FEN" placeholder="k7/8/8/8/3r4/8/8/3R3K w - - 0 1" mono />
            <Input name="solution" label="Solution (from:to)" placeholder="d1:d4" mono />
            <p className="text-xs font-semibold text-ink-500">The FEN + move are validated with chess.js before saving.</p>
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

        {/* Recent admin lessons */}
        {recent.length > 0 && (
          <Section title="Recently added">
            <div className="flex flex-col gap-2">
              {recent.map((l) => (
                <Card key={l.id} className="flex items-center gap-2 p-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{l.title}</span>
                  <Link href={`/library/lesson/${l.id}`} className="text-xs font-bold text-brand">
                    preview
                  </Link>
                  <button
                    onClick={() => deleteLesson(l.id)}
                    aria-label="Delete lesson"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 hover:bg-danger/10 hover:text-danger"
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
    <div className="rounded-card border border-hairline bg-surface-card p-3 text-center">
      <div className="text-xl font-extrabold tabular-nums text-ink">{value.toLocaleString()}</div>
      <div className="text-[10px] font-semibold text-ink-500">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function FormBlock({
  action,
  submit,
  children,
}: {
  action: (prev: { error?: string; ok?: boolean } | undefined, fd: FormData) => Promise<{ error?: string; ok?: boolean }>;
  submit: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-3">
        {children}
        {state?.error && <p className="text-xs font-bold text-danger">{state.error}</p>}
        {state?.ok && <p className="text-xs font-bold text-success">✓ Saved — live in the library.</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : submit}
        </Button>
      </form>
    </Card>
  );
}

function Input({ name, label, placeholder, mono }: { name: string; label: string; placeholder?: string; mono?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold text-ink-700">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        className={`h-11 rounded-card border border-hairline bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-brand ${mono ? "font-mono text-xs" : ""}`}
      />
    </label>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: Opt[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold text-ink-700">{label}</span>
      <select name={name} className="h-11 rounded-card border border-hairline bg-surface px-3 text-sm font-semibold text-ink">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </select>
    </label>
  );
}
