import { z } from "zod";

export const ADMIN_SEMESTER_STAGES = [
  "preschool",
  "elementary",
  "middle",
  "high",
] as const;

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a #RRGGBB hex value.");

export const adminSemesterFieldsSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(120),
  blurb: z.string().max(2000),
  color: hexColor,
  stage: z.enum(ADMIN_SEMESTER_STAGES),
});

export type AdminSemesterFields = z.infer<typeof adminSemesterFieldsSchema>;

export function parseAdminSemesterFields(raw: {
  title: string;
  blurb: string;
  color: string;
  stage: string;
}): { ok: true; data: AdminSemesterFields } | { error: string } {
  const parsed = adminSemesterFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Invalid semester fields." };
  }
  return { ok: true, data: parsed.data };
}
