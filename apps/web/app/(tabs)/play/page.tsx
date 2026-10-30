import { PlayScreen } from "@/features/chopper/PlayScreen";

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  const { scene } = await searchParams;
  return <PlayScreen scene={scene} />;
}
