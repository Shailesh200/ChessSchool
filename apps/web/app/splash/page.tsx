import type { Metadata } from "next";
import { PremiumSplashScreen } from "@/features/premium-ui/screens/PremiumSplashScreen";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Learn chess with a coach who has your back.",
};

export default function SplashPage() {
  return <PremiumSplashScreen />;
}
