import { PlayScreen } from "@/features/play/PlayScreen";
import { rejectProductionPreview } from "@/lib/devPreview";

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  const { scene } = await searchParams;
  rejectProductionPreview(Boolean(scene));
  return <PlayScreen scene={scene} />;
}
