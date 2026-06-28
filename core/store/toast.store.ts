"use client";

import { create } from "zustand";
import type { IconName } from "@/components/ui/Icon";

export type ToastTone = "default" | "success" | "danger";

export interface ToastItem {
  id: number;
  message: string;
  icon?: IconName;
  tone: ToastTone;
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
    if (typeof window !== "undefined") {
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
  opts: { icon?: IconName; tone?: ToastTone } = {},
): void {
  useToasts.getState().push({ message, icon: opts.icon, tone: opts.tone ?? "default" });
}
