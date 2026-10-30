import { Suspense } from "react";
import { PremiumResetPasswordScreen } from "@/features/premium-ui/screens/passwordResetPremiumScreens";

export const metadata = {
  title: "Reset password",
  description: "Choose a new password for your ChessSchool account.",
  robots: { index: false, follow: true },
};

export default function LoginResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <PremiumResetPasswordScreen />
    </Suspense>
  );
}
