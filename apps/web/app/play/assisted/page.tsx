import { AssistedPlay } from "@/features/play/AssistedPlay";

export default async function AssistedPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const variant = mode === "puzzle" ? "puzzle" : "full";
  return <AssistedPlay variant={variant} />;
}
