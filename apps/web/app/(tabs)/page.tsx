import { getCatalog } from "@/features/school/catalog.server";
import { HomeClient } from "@/components/home/HomeClient";

// Catalog is cached (tag "curriculum"); the page can be prefetched + revalidated
// instead of re-rendered from scratch on every navigation.
export const revalidate = 3600;

export default async function HomePage() {
  const catalog = await getCatalog();
  return <HomeClient catalog={catalog} />;
}
