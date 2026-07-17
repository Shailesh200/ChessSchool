import { EnrollGate } from "@/components/auth/EnrollGate";
import { ArenaHub } from "@/features/play/ArenaHub";

export default function ArenaPage() {
  return (
    <EnrollGate next="/play/arena">
      <ArenaHub />
    </EnrollGate>
  );
}
