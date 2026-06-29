import { getCatalog } from "@/features/school/catalog.server";
import { PlanClient } from "@/components/plan/PlanClient";

export const revalidate = 3600;

export default async function PlanPage() {
  const catalog = await getCatalog();
  return <PlanClient catalog={catalog} />;
}
