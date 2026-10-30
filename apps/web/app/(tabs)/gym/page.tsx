import { GymEntry } from "@/features/chopper/GymEntry";

export default async function GymPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string; sheet?: string }>;
}) {
  const { fixture, sheet } = await searchParams;
  return <GymEntry fixture={fixture === "1"} sheet={sheet} />;
}
