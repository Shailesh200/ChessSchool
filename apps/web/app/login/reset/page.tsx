import { Suspense } from "react";
import { PremiumResetPasswordScreen } from "@/features/premium-ui/screens/PremiumResetPasswordScreen";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <PremiumResetPasswordScreen />
    </Suspense>
  );
}
