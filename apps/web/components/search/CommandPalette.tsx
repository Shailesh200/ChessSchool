"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/components/ui/cn";
import type { SearchResult } from "@/lib/search-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setActive(0);
  }, [onOpenChange]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      const q = query.trim();
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results?: SearchResult[] }) => {
          if (cancelled) return;
          setResults(d.results ?? []);
          setActive(0);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, qDebounce(query));
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && results[active]) {
        e.preventDefault();
        go(results[active]!.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, close, go]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close search"
            className="bg-ink/45 absolute inset-0 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={{ scale: 0.96, y: -8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="rounded-card border-hairline bg-surface-card relative w-full max-w-lg overflow-hidden border [box-shadow:var(--shadow-pop)]"
          >
            <div className="border-hairline flex items-center gap-3 border-b px-4 py-3">
              <Icon name="search" size={20} className="text-ink-500 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search lessons, classes, actions…"
                className="text-ink placeholder:text-ink-300 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                aria-controls={listId}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="text-ink-300 border-hairline hidden rounded border px-1.5 py-0.5 text-[10px] font-bold sm:inline">
                Esc
              </kbd>
            </div>
            <ul
              id={listId}
              role="listbox"
              className="max-h-[min(50vh,360px)] overflow-y-auto overscroll-contain py-2"
            >
              {results.length === 0 && !loading && (
                <li className="text-ink-500 px-4 py-6 text-center text-sm font-semibold">
                  No matches
                </li>
              )}
              {results.map((item, i) => (
                <li
                  key={`${item.type}-${item.id}`}
                  role="option"
                  aria-selected={i === active}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      i === active
                        ? "bg-brand-50 text-brand"
                        : "text-ink hover:bg-surface-sunken",
                    )}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item.href)}
                  >
                    <span className="bg-surface-sunken text-ink-500 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm">
                      {item.emoji ?? typeGlyph(item.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="text-ink-500 block truncate text-xs font-semibold">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    <span className="text-ink-300 shrink-0 text-[10px] font-bold uppercase">
                      {item.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const OPEN_SEARCH_EVENT = "chessschool:open-search";

/** Open the command palette from outside (e.g. sidebar Search button). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

/** Global ⌘/Ctrl+K host — mount once in ClientProviders. */
export function CommandPaletteHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  return <CommandPalette open={open} onOpenChange={setOpen} />;
}

function typeGlyph(type: SearchResult["type"]): string {
  if (type === "class") return "🏫";
  if (type === "lesson") return "♟";
  return "→";
}

function qDebounce(query: string): number {
  return query.trim() ? 120 : 0;
}
