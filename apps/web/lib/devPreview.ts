import { notFound } from "next/navigation";

/** Design fixture query params are for local dev and tests. Production 404s. */
export function rejectProductionPreview(requested: boolean) {
  if (requested && process.env.NODE_ENV === "production") notFound();
}
