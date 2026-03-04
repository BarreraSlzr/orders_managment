import { getFeatureAccessForCurrentSession } from "@/lib/services/entitlements/serverFeatureAccess";
import OnboardingsPageClient from "./OnboardingsPageClient";

export default async function OnboardingsPage() {
  const featureAccess = await getFeatureAccessForCurrentSession({
    features: ["multi_manager_users"],
    fallback: true,
  });
  const canManageMultipleManagers =
    featureAccess.multi_manager_users ?? true;

  return (
    <OnboardingsPageClient
      canManageMultipleManagers={canManageMultipleManagers}
    />
  );
}
