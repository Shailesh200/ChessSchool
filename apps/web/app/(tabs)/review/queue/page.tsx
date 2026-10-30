import { ReviewEntry } from "@/features/chopper/ReviewEntry";

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const { fixture } = await searchParams;
  return <ReviewEntry queue fixture={fixture === "1"} />;
}
