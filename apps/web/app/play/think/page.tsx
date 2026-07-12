import { EnrollGate } from "@/components/auth/EnrollGate";
import { CalculationTrainer } from "@/features/play/CalculationTrainer";

export default function ThinkPage() {
  return (
    <EnrollGate next="/play/think">
      <CalculationTrainer />
    </EnrollGate>
  );
}
