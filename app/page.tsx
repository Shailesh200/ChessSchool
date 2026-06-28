import { getCatalog } from "@/features/school/catalog.server";
import { HomeClient } from "@/components/home/HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await getCatalog();
  return <HomeClient catalog={catalog} />;
}
