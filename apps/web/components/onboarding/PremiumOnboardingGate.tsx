"use client";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { PremiumOnboardingWizard } from "@/features/premium-ui/screens/PremiumOnboardingWizard";
import { usePremiumUi } from "@/features/premium-ui/usePremiumUi";

export function PremiumOnboardingGate({ name }: { name: string }) {
  const premium = usePremiumUi();
  if (premium) return <PremiumOnboardingWizard name={name} />;
  return <OnboardingWizard name={name} />;
}
