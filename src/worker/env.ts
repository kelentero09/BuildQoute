import type { SessionUser } from "../shared/types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Secret, at least 32 characters. Set with `wrangler secret put BETTER_AUTH_SECRET`. */
  BETTER_AUTH_SECRET: string;
  /** Public origin of the site in production, e.g. https://buildquote.example.com */
  APP_URL?: string;
  /** Public Cloudflare Web Analytics site token (optional). */
  CF_WEB_ANALYTICS_TOKEN?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    /** Set by the session middleware; null for guests. */
    user: SessionUser | null;
  };
};
