import { GymEntry } from "@/features/gym/GymEntry";
import { rejectProductionPreview } from "@/lib/devPreview";

export default async function GymPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string; sheet?: string }>;
}) {
  const { fixture, sheet } = await searchParams;
  rejectProductionPreview(Boolean(fixture || sheet));
  return <GymEntry fixture={fixture === "1"} sheet={sheet} />;
}
