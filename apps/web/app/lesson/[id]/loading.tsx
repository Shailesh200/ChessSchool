import { KitRouteLoader } from "@/components/motion/KitRouteLoader";

export default function LessonRouteLoading() {
  return (
    <div className="bg-surface flex min-h-dvh items-center justify-center px-6">
      <KitRouteLoader label="Loading lesson…" />
    </div>
  );
}
