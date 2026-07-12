export type ToastTone = "default" | "success" | "danger";

export type ToastItem = {
  id: number;
  message: string;
  description?: string;
  tone: ToastTone;
  duration?: number;
};

type ToastState = {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
};

let counter = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export const toastStore = {
  get: () => toasts,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  push: (t: Omit<ToastItem, "id">) => {
    const id = ++counter;
    toasts = [...toasts, { ...t, id }].slice(-3);
    emit();
    const ms = t.duration ?? 2600;
    setTimeout(() => toastStore.dismiss(id), ms);
  },
  dismiss: (id: number) => {
    toasts = toasts.filter((x) => x.id !== id);
    emit();
  },
};

export function toast(
  message: string,
  opts: { description?: string; tone?: ToastTone; duration?: number } = {},
): void {
  toastStore.push({
    message,
    description: opts.description,
    tone: opts.tone ?? "default",
    duration: opts.duration,
  });
}
