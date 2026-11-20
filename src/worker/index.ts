import { Hono } from "hono";
import { getAuth } from "./auth";
import type { AppEnv } from "./env";
import { loadSession, sameOriginOnly, securityHeaders } from "./middleware";
import { admin } from "./routes/admin";
import { analytics } from "./routes/analytics";
import { quotations } from "./routes/quotations";
import { settings } from "./routes/settings";

/**
 * Only /api/* reaches this Worker (see wrangler.jsonc). Pages and static files are
 * served directly by Workers Static Assets and do not use Worker requests' CPU budget.
 */
const app = new Hono<AppEnv>().basePath("/api");

app.use("*", securityHeaders);

// Better Auth handles its own CSRF/origin checks, rate limiting and cookies.
app.on(["GET", "POST"], "/auth/*", (c) => getAuth(c.env).handler(c.req.raw));

app.use("*", sameOriginOnly);
app.use("*", loadSession);

app.get("/health", (c) => c.json({ ok: true }));

/** Who is signed in, plus public configuration the page needs. */
app.get("/me", (c) => c.json({ user: c.get("user"), analyticsToken: c.env.CF_WEB_ANALYTICS_TOKEN || null }));

app.route("/quotations", quotations);
app.route("/settings", settings);
app.route("/events", analytics);
app.route("/admin", admin);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((error, c) => {
  // Details go to the log only; the client gets a generic message.
  console.error(error);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

export default app;
