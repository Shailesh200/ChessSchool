import { ReviewEntry } from "@/features/review/ReviewEntry";
import { rejectProductionPreview } from "@/lib/devPreview";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const { fixture } = await searchParams;
  rejectProductionPreview(Boolean(fixture));
  return <ReviewEntry fixture={fixture === "1"} />;
}
