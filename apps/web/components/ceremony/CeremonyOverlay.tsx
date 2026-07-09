"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Confetti } from "@/components/ui/Confetti";
import { Mascot } from "@/components/ui/Mascot";
import { IconBadge } from "@/components/ui/IconBadge";
import { LazyLottie } from "@/components/motion/LazyLottie";
import { popIn, softSpring } from "@/core/motion/variants";

type CeremonyVariant = "lesson" | "graduation" | "exam";

/**
 * Full-screen ceremony moment — graduation sheet, lesson complete, exam pass.
 * Lottie loads in a later batch; SVG + Framer Motion per MOTION.md fallbacks.
 */
export function CeremonyOverlay({
  open,
  variant,
  title,
  subtitle,
  badge,
  children,
  onDismiss,
}: {
  open: boolean;
  variant: CeremonyVariant;
  title: string;
  subtitle?: string;
  badge?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
}) {
  useEffect(() => {
    if (!open || !onDismiss) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  const confettiCount = variant === "graduation" ? 48 : variant === "exam" ? 36 : 28;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <Confetti count={confettiCount} />
          {onDismiss && (
            <button
              type="button"
              aria-label="Close"
              className="bg-ink/40 absolute inset-0 backdrop-blur-sm"
              onClick={onDismiss}
            />
          )}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={popIn}
            initial="initial"
            animate="enter"
            exit="exit"
            className="border-hairline bg-surface-card relative w-full max-w-md rounded-t-3xl border p-6 sm:rounded-3xl sm:[box-shadow:var(--shadow-pop)]"
          >
            <div className="mx-auto mb-4 flex flex-col items-center gap-3 text-center">
              {variant === "graduation" ? (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={softSpring}
                  className="relative flex h-28 w-28 items-center justify-center"
                >
                  <LazyLottie
                    asset="class-graduate"
                    className="absolute inset-0 h-full w-full"
                  >
                    <span className="bg-brand/10 flex h-28 w-28 items-center justify-center rounded-full">
                      <IconBadge
                        name="cap"
                        size="xl"
                        tone="gold"
                        className="h-20 w-20 rounded-full"
                      />
                    </span>
                  </LazyLottie>
                  <motion.span
                    className="absolute -top-1 -right-1"
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ ...softSpring, delay: 0.12 }}
                  >
                    <IconBadge name="celebrate" size="md" tone="accent" />
                  </motion.span>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={softSpring}
                  className="relative flex h-28 w-28 items-center justify-center"
                >
                  <LazyLottie
                    asset="lesson-complete"
                    className="absolute inset-0 h-full w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/svg/ceremony/lesson-complete-badge.svg"
                      alt=""
                      width={112}
                      height={112}
                      className="h-28 w-28"
                    />
                  </LazyLottie>
                </motion.div>
              )}

              {badge && (
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-pill bg-gold/20 text-warning px-3 py-1 text-[11px] font-extrabold tracking-wide uppercase"
                >
                  {badge}
                </motion.span>
              )}

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="text-ink text-2xl font-extrabold sm:text-3xl"
              >
                {title}
              </motion.h1>

              {subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="text-ink-500 max-w-sm text-sm font-semibold"
                >
                  {subtitle}
                </motion.p>
              )}

              {variant === "lesson" && (
                <Mascot expression="cheer" size={96} float={false} className="-mt-2" />
              )}
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
