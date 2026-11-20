import { Hono } from "hono";
import { eventSchema } from "../../shared/schemas";
import type { AppEnv, Env } from "../env";
import { readJson } from "../middleware";

/**
 * First-party, privacy-conscious usage counting.
 * - Only daily aggregate counters are kept (analytics_daily).
 * - No IP address or user agent is stored. A keyed hash that changes every day is used
 *   to count approximate unique visitors and to rate-limit; it is deleted after the day ends.
 */
export const analytics = new Hono<AppEnv>();

/** Events accepted per visitor per day; anything beyond this is ignored. */
const DAILY_EVENT_CAP = 300;
/** Aggregate rows are kept for this many days. */
export const RETENTION_DAYS = 400;

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|pingdom|curl|wget|python|httpclient|axios|node-fetch|go-http|java\/|scrapy|phantom|facebookexternalhit|whatsapp|telegram/i;

/** Calendar day in the Philippines (UTC+8, no daylight saving). */
export function manilaDay(now = Date.now(), offsetDays = 0): string {
  return new Date(now + 8 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function visitorHash(env: Env, day: string, ip: string, userAgent: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.BETTER_AUTH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`visitor|${day}|${ip}|${userAgent}`));
  // 16 bytes is plenty to tell a day's visitors apart.
  return Array.from(new Uint8Array(signature).slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bump(env: Env, day: string, metric: string) {
  return env.DB.prepare(
    "insert into analytics_daily (day, metric, count) values (?, ?, 1) on conflict (day, metric) do update set count = count + 1",
  ).bind(day, metric);
}

analytics.post("/", async (c) => {
  const body = await readJson(c, eventSchema, 256);
  if (body instanceof Response) return body;

  const userAgent = c.req.header("user-agent") ?? "";
  // Bots and scripted clients are answered politely but not counted.
  if (!userAgent || BOT_PATTERN.test(userAgent)) return c.body(null, 204);

  const day = manilaDay();
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const hash = await visitorHash(c.env, day, ip, userAgent);

  const seen = await c.env.DB.prepare(
    `insert into analytics_visitors (day, visitor_hash, hits) values (?, ?, 1)
     on conflict (day, visitor_hash) do update set hits = hits + 1
     returning hits`,
  )
    .bind(day, hash)
    .first<{ hits: number }>();
  const hits = seen?.hits ?? 1;
  if (hits > DAILY_EVENT_CAP) return c.body(null, 204);

  const isGuest = c.get("user") === null;
  const statements = [];
  if (hits === 1) statements.push(bump(c.env, day, "unique_visitors"));
  if (body.type === "page_view") statements.push(bump(c.env, day, "page_views"));
  if (body.type === "pdf_download") {
    statements.push(bump(c.env, day, "pdf_downloads"));
    if (isGuest) statements.push(bump(c.env, day, "guest_pdf_downloads"));
  }
  if (body.type === "quote_started" && isGuest) statements.push(bump(c.env, day, "guest_quotes_started"));

  // Housekeeping without a scheduled job: the first event of each visitor's day
  // occasionally clears out expired rows.
  if (hits === 1 && Math.random() < 0.05) {
    statements.push(c.env.DB.prepare("delete from analytics_visitors where day < ?").bind(day));
    statements.push(c.env.DB.prepare("delete from analytics_daily where day < ?").bind(manilaDay(Date.now(), -RETENTION_DAYS)));
  }
  if (statements.length) await c.env.DB.batch(statements);
  return c.body(null, 204);
});
