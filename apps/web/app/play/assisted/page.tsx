import { EnrollGate } from "@/components/auth/EnrollGate";
import { AssistedPlay } from "@/features/play/AssistedPlay";

export default async function AssistedPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const variant = mode === "puzzle" ? "puzzle" : "full";
  const next = `/play/assisted${mode === "puzzle" ? "?mode=puzzle" : ""}`;
  return (
    <EnrollGate next={next}>
      <AssistedPlay variant={variant} />
    </EnrollGate>
  );
}
