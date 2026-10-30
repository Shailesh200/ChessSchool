import { ReviewEntry } from "@/features/chopper/ReviewEntry";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const { fixture } = await searchParams;
  return <ReviewEntry fixture={fixture === "1"} />;
}
