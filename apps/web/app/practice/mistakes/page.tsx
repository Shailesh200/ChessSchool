import { MistakesEntry } from "@/features/review/MistakesEntry";
import { rejectProductionPreview } from "@/lib/devPreview";

export default async function PracticeMistakesPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string; play?: string }>;
}) {
  const { fixture, play } = await searchParams;
  rejectProductionPreview(Boolean(fixture));
  return <MistakesEntry fixture={fixture === "1"} play={play === "1"} />;
}
