import { getFeatureAccessForCurrentSession } from "@/lib/services/entitlements/serverFeatureAccess";
import OnboardingRunnerPageClient from "./OnboardingRunnerPageClient";

export default async function OnboardingRunnerPage() {
  const featureAccess = await getFeatureAccessForCurrentSession({
    features: ["multi_manager_users"],
    fallback: true,
  });
  const canManageMultipleManagers =
    featureAccess.multi_manager_users ?? true;

  return (
    <OnboardingRunnerPageClient
      canManageMultipleManagers={canManageMultipleManagers}
    />
  );
}
