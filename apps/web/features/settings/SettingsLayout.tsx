"use client";

import { cn } from "@/components/ui/cn";

export type SettingsSectionId =
  "sound" | "accessibility" | "learning" | "advanced" | "privacy" | "data";

export const SETTINGS_SECTIONS: {
  id: SettingsSectionId;
  label: string;
  adminOnly?: boolean;
  authOnly?: boolean;
}[] = [
  { id: "sound", label: "Sound & Feel" },
  { id: "accessibility", label: "Accessibility" },
  { id: "learning", label: "Learning & Board" },
  { id: "advanced", label: "Advanced", adminOnly: true },
  { id: "privacy", label: "Privacy" },
  { id: "data", label: "Your data", authOnly: true },
];

/** Desktop settings nav — sticky left rail per BREAKPOINTS.md / mockups. */
export function SettingsNav({
  active,
  onSelect,
  isAdmin,
  authed,
  className,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
  isAdmin: boolean;
  authed: boolean;
  className?: string;
}) {
  const items = SETTINGS_SECTIONS.filter(
    (s) => (!s.adminOnly || isAdmin) && (!s.authOnly || authed),
  );

  return (
    <nav
      className={cn("hidden flex-col gap-1 lg:sticky lg:top-6 lg:flex", className)}
      aria-label="Settings sections"
    >
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={cn(
            "rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors",
            active === s.id
              ? "bg-brand-50 text-brand"
              : "text-ink-500 hover:bg-surface-sunken/80 hover:text-ink",
          )}
          aria-current={active === s.id ? "true" : undefined}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

export function SettingsPanel({
  id,
  title,
  activeSection,
  children,
}: {
  id: SettingsSectionId;
  title: string;
  activeSection: SettingsSectionId;
  children: React.ReactNode;
}) {
  return (
    <div
      id={`settings-${id}`}
      className={cn(
        "rounded-card border-hairline bg-surface-card divide-hairline divide-y border py-0 [box-shadow:var(--shadow-card)]",
        activeSection !== id && "lg:hidden",
      )}
    >
      <p className="text-ink-300 px-5 pt-4 text-xs font-extrabold tracking-wide uppercase">
        {title}
      </p>
      <div className="px-5">{children}</div>
    </div>
  );
}
