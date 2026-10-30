import { MistakesEntry } from "@/features/chopper/MistakesEntry";

export default async function PracticeMistakesPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string; play?: string }>;
}) {
  const { fixture, play } = await searchParams;
  return <MistakesEntry fixture={fixture === "1"} play={play === "1"} />;
}
