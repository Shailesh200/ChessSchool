import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { AppShell } from "@/components/layout/AppShell";
import { JourneyView } from "@/features/school/JourneyView";
import { getCatalog } from "@/features/school/catalog.server";
import { db } from "@/db";
import { classes as classT, lessons as lessonT } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ClassJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const catalog = await getCatalog();
  const clsRow = (await db.select().from(classT).where(eq(classT.id, id)).limit(1))[0];
  if (!clsRow) notFound();

  const lessonRows = await db
    .select({ id: lessonT.id, title: lessonT.title, subtitle: lessonT.subtitle, emoji: lessonT.emoji, isExam: lessonT.isExam })
    .from(lessonT)
    .where(eq(lessonT.classId, id))
    .orderBy(asc(lessonT.sortOrder));
  const lessons = lessonRows
    .filter((l) => !l.isExam)
    .map((l) => ({ id: l.id, title: l.title, subtitle: l.subtitle, emoji: l.emoji }));

  let examLesson: { id: string; title: string } | null = null;
  if (clsRow.examId) {
    const ex = (
      await db.select({ id: lessonT.id, title: lessonT.title }).from(lessonT).where(eq(lessonT.id, clsRow.examId)).limit(1)
    )[0];
    if (ex) examLesson = ex;
  }

  return (
    <AppShell>
      <JourneyView
        cls={{ id: clsRow.id, title: clsRow.title, emoji: clsRow.emoji, blurb: clsRow.blurb, examId: clsRow.examId ?? undefined }}
        lessons={lessons}
        examLesson={examLesson}
        allClasses={catalog.allClasses}
      />
    </AppShell>
  );
}
