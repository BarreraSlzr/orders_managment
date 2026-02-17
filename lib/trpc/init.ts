/**
 * tRPC server initialization — creates reusable procedure builders with
 * auth-aware context and superjson transformer.
 */
import { getAdminConfig, hasAdminApiKey } from "@/lib/auth/admin";
import { parseUserRole } from "@/lib/auth/roles";
import { verifySessionToken, type SessionPayload } from "@/lib/auth/session";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

export interface TRPCContext {
  session: SessionPayload | null;
  isAdmin: boolean;
}

export async function createTRPCContext(params: {
  headers: Headers;
  cookies: Record<string, string>;
}): Promise<TRPCContext> {
  let session: SessionPayload | null = null;
  let isAdmin = false;

  // Session auth — validate the actual token from cookies
  const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
  const sessionToken = params.cookies[cookieName];
  if (sessionToken) {
    try {
      session = await verifySessionToken(sessionToken);
    } catch {
      // invalid token → no session
    }
  }

  // Admin API key — validate bearer token or cookie against the real key
  try {
    const adminConfig = getAdminConfig();
    isAdmin = hasAdminApiKey({
      authorizationHeader: params.headers.get("authorization"),
      cookieValue: params.cookies[adminConfig.cookieName],
      apiKey: adminConfig.apiKey,
    });
  } catch {
    // admin config not set → not admin
  }

  // Dev-only fallback: when auth infrastructure is not configured,
  // synthesise a dev session so procedures still work locally.
  // This is the ONLY place dev bypass lives — procedures always
  // validate ctx.session / ctx.isAdmin without shortcuts.
  if (!session && !process.env.AUTH_SECRET) {
    const now = Math.floor(Date.now() / 1000);
    session = { sub: "dev", iat: now, exp: now + 86_400 };
    isAdmin = true;
  }

  return { session, isAdmin };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/**
 * Authenticated procedure — requires a valid session in ctx.
 * Always enforced; dev bypass is handled in createTRPCContext.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * Tenant-scoped procedure — requires session + tenant_id in ctx.
 */
export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  const tenantId = ctx.session?.tenant_id;
  if (!tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, tenantId } });
});

/**
 * Manager-scoped procedure — requires session role manager/admin.
 */
export const managerProcedure = tenantProcedure.use(({ ctx, next }) => {
  const role = parseUserRole(ctx.session?.role);
  if (role !== "manager" && role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

/**
 * Admin procedure — requires a validated admin API key in ctx.
 * Always enforced; dev bypass is handled in createTRPCContext.
 */
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});
