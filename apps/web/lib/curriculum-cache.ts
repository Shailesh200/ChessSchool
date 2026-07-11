import "server-only";
import { updateTag } from "next/cache";
import { CURRICULUM_CACHE_TAG } from "@/features/school/curriculum-skeleton.server";

/** Bust curriculum + placement caches after admin CMS edits. */
export function invalidateCurriculumCache(): void {
  updateTag(CURRICULUM_CACHE_TAG);
}
