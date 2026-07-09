"use client";

import { create } from "zustand";
import type { IconName } from "@/components/ui/Icon";
import type { LottieAsset } from "@/components/motion/LazyLottie";

export type ToastTone = "default" | "success" | "danger";

export interface ToastItem {
  id: number;
  message: string;
  description?: string;
  icon?: IconName;
  tone: ToastTone;
  lottie?: LottieAsset;
  /** optional inline action button (e.g. "Reload") */
  action?: { label: string; onClick: () => void };
  /** sticky toasts stay until dismissed/actioned (no auto-timeout) */
  sticky?: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-3) }));
    if (typeof window !== "undefined" && !t.sticky) {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
      }, 2600);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Fire a toast from anywhere. */
export function toast(
  message: string,
  opts: {
    description?: string;
    icon?: IconName;
    tone?: ToastTone;
    lottie?: LottieAsset;
    action?: ToastItem["action"];
    sticky?: boolean;
  } = {},
): void {
  useToasts.getState().push({
    message,
    description: opts.description,
    icon: opts.icon,
    tone: opts.tone ?? "default",
    lottie: opts.lottie,
    action: opts.action,
    sticky: opts.sticky,
  });
}
