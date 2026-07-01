/**
 * Lesson data has moved to the constants/content layer (`@/content/lessons`) so
 * it is backend-swappable. This module re-exports it for existing imports.
 */
export { LESSONS, getLesson } from "@/content/lessons";
