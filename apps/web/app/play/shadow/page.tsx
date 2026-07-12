import { EnrollGate } from "@/components/auth/EnrollGate";
import { ShadowGamePicker } from "@/features/play/ShadowGamePicker";

export default function ShadowPage() {
  return (
    <EnrollGate next="/play/shadow">
      <ShadowGamePicker />
    </EnrollGate>
  );
}
