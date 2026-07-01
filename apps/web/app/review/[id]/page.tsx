import { AppShell } from "@/components/layout/AppShell";
import { GameReplay } from "@/features/review/GameReplay";

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <GameReplay id={id} />
    </AppShell>
  );
}
