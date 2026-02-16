/**
 * tRPC server initialization — creates reusable procedure builders with
 * auth-aware context and superjson transformer.
 */
import { getAdminConfig, hasAdminApiKey } from "@/lib/auth/admin";
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

  // Session auth
  const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
  const sessionToken = params.cookies[cookieName];
  if (sessionToken) {
    try {
      session = await verifySessionToken(sessionToken);
    } catch {
      // invalid token → no session
    }
  }

  // Admin API key
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

  return { session, isAdmin };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/**
 * Authenticated procedure — requires a valid session.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * Admin procedure — requires admin API key (bearer or cookie).
 */
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});
