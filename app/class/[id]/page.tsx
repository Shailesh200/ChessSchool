import { AppShell } from "@/components/layout/AppShell";
import { JourneyView } from "@/features/school/JourneyView";
import { ALL_CLASSES } from "@/features/school/structure";

export function generateStaticParams() {
  return ALL_CLASSES.map((c) => ({ id: c.id }));
}

export default async function ClassJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <JourneyView classId={id} />
    </AppShell>
  );
}
