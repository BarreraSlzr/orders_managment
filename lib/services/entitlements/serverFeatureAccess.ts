import "server-only";

import { getAuthConfig } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";
import type { FeatureKey } from "@/lib/sql/types";
import { cookies } from "next/headers";
import { peekFeatureAccess } from "./featureGateService";

export async function getFeatureAccessForCurrentSession(params: {
  features: FeatureKey[];
  fallback?: boolean;
}): Promise<Partial<Record<FeatureKey, boolean>>> {
  const fallback = params.fallback ?? true;
  const result: Partial<Record<FeatureKey, boolean>> = {};

  for (const feature of params.features) {
    result[feature] = fallback;
  }

  try {
    const { cookieName } = getAuthConfig();
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(cookieName)?.value;

    if (!sessionToken) {
      return result;
    }

    const session = await verifySessionToken(sessionToken);
    const tenantId = session?.tenant_id;
    if (!tenantId) {
      return result;
    }

    const access = await Promise.all(
      params.features.map(async (feature) => {
        const enabled = await peekFeatureAccess({
          tenantId,
          feature,
        });
        return [feature, enabled] as const;
      }),
    );

    for (const [feature, enabled] of access) {
      result[feature] = enabled;
    }

    return result;
  } catch {
    return result;
  }
}
