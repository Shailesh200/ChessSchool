import type { Variants, Transition } from "framer-motion";

/** Shared spring — the signature ChessSchool "bouncy but controlled" feel. */
export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 28,
  mass: 0.8,
};

export const softSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 24,
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  enter: { opacity: 1, y: 0, transition: { ...softSpring, when: "beforeChildren" } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.18 } },
};

export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.82 },
  enter: { opacity: 1, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.14 } },
};

export const listContainer: Variants = {
  enter: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 14 },
  enter: { opacity: 1, y: 0, transition: softSpring },
};

export const coachEntrance: Variants = {
  initial: { opacity: 0, x: -28, scale: 0.9 },
  enter: { opacity: 1, x: 0, scale: 1, transition: { ...spring, delay: 0.05 } },
  exit: { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.16 } },
};

export const rewardBurst: Variants = {
  initial: { scale: 0, rotate: -12, opacity: 0 },
  enter: {
    scale: [0, 1.18, 1],
    rotate: [-12, 4, 0],
    opacity: 1,
    transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
  },
};

export const tap = { scale: 0.94 };
export const hoverLift = { y: -2 };
