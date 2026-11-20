import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { ZodType } from "zod";
import { getAuth } from "./auth";
import type { AppEnv } from "./env";

/** Looks up the session on the server for every request. The client never tells us who it is. */
export const loadSession = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", null);
  // Skip the database lookup entirely when no session cookie was sent.
  if (/(^|;\s*)(__Secure-)?bq\.session_token=/.test(c.req.header("cookie") ?? "")) {
    const session = await getAuth(c.env).api.getSession({ headers: c.req.raw.headers });
    const user = session?.user as { id: string; name: string; email: string; role?: string | null; status?: string | null } | undefined;
    if (user && user.status !== "disabled") {
      c.set("user", { id: user.id, name: user.name, email: user.email, isAdmin: user.role === "admin" });
    }
  }
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) return c.json({ error: "Please log in to continue." }, 401);
  await next();
});

/** Admin status comes from the database row loaded with the session, never from the request. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Please log in to continue." }, 401);
  // 404 rather than 403 so the existence of the admin API is not advertised.
  if (!user.isAdmin) return c.json({ error: "Not found" }, 404);
  await next();
});

/**
 * CSRF defence for our own endpoints (Better Auth protects /api/auth/* itself):
 * state-changing requests must come from this site's own pages. Combined with
 * SameSite=Lax session cookies.
 */
export const sameOriginOnly = createMiddleware<AppEnv>(async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = c.req.header("origin");
    const site = c.req.header("sec-fetch-site");
    const expected = new URL(c.req.url).origin;
    const allowed = origin ? origin === expected || origin === c.env.APP_URL : site === "same-origin";
    if (!allowed) return c.json({ error: "Request blocked." }, 403);
  }
  await next();
});

export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Cache-Control", c.res.headers.get("Cache-Control") ?? "no-store");
});

/** Read and validate a JSON body with a size cap. Returns a Response on failure. */
export async function readJson<T>(c: Context<AppEnv>, schema: ZodType<T>, maxBytes: number): Promise<T | Response> {
  if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return c.json({ error: "Expected JSON." }, 415);
  }
  const declared = Number(c.req.header("content-length") ?? "0");
  if (declared > maxBytes) return c.json({ error: "That is too large to save." }, 413);
  const raw = await c.req.text();
  if (raw.length > maxBytes) return c.json({ error: "That is too large to save." }, 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return c.json({ error: "Invalid request." }, 400);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) return c.json({ error: "Some of the information entered is not valid." }, 400);
  return result.data;
}
