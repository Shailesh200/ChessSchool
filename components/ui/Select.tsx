"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

export interface SelectOption {
  id: string;
  title: string;
}

/**
 * Custom dropdown (#11) — replaces native <select> with a styled, animated
 * listbox. Carries its value via a hidden input so it works inside <form>
 * FormData submissions unchanged.
 */
export function Select({
  name,
  label,
  options,
  defaultValue,
  value: controlled,
  onChange,
  className,
}: {
  name?: string;
  label?: string;
  options: SelectOption[];
  defaultValue?: string;
  /** controlled value (omit for uncontrolled/form usage) */
  value?: string;
  onChange?: (value: string) => void;
  /** extra classes on the root (e.g. a fixed width for inline use) */
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.id ?? "");
  const value = controlled ?? internal;
  const setValue = (v: string) => {
    setInternal(v);
    onChange?.(v);
  };
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const selected = options.find((o) => o.id === value);

  return (
    <div ref={ref} className={cn("relative flex flex-col gap-1", className)}>
      {label && <span className="text-xs font-extrabold text-ink-700">{label}</span>}
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 items-center justify-between gap-2 rounded-card border border-hairline bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-brand"
      >
        <span className="truncate">{selected?.title ?? "Select…"}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={cn("shrink-0 text-ink-500 transition-transform", open && "rotate-180")}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute top-full z-30 mt-1 max-h-60 w-full overflow-auto rounded-card border border-hairline bg-surface-card p-1 [box-shadow:var(--shadow-pop)]"
        >
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              onClick={() => {
                setValue(o.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold",
                o.id === value ? "bg-brand text-white" : "text-ink hover:bg-surface-sunken",
              )}
            >
              {o.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
