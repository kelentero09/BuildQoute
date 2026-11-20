import { Hono } from "hono";
import type { AppEnv } from "../env";
import { requireAdmin } from "../middleware";
import { manilaDay, RETENTION_DAYS } from "./analytics";

/** Read-only administrator API. Every route requires an admin session checked on the server. */
export const admin = new Hono<AppEnv>();
admin.use("*", requireAdmin);

const PAGE_SIZE = 20;
const MANILA_OFFSET_MS = 8 * 3_600_000;

/** UTC instant (ISO) at which the given Manila calendar day starts. */
function manilaDayStartIso(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - MANILA_OFFSET_MS).toISOString();
}

function lastDays(count: number): string[] {
  return Array.from({ length: count }, (_, index) => manilaDay(Date.now(), index - (count - 1)));
}

admin.get("/stats", async (c) => {
  const db = c.env.DB;
  const days = lastDays(30);
  const today = days[29]!;
  const since30 = days[0]!;
  const since7 = days[23]!;

  const [daily, totals, users, registrations, quotes] = await db.batch([
    db.prepare("select day, metric, count from analytics_daily where day >= ?").bind(since30),
    db.prepare("select metric, sum(count) as total from analytics_daily group by metric"),
    db
      .prepare(
        `select count(*) as total,
                sum(case when "createdAt" >= ?1 then 1 else 0 end) as today,
                sum(case when "createdAt" >= ?2 then 1 else 0 end) as week,
                sum(case when "createdAt" >= ?3 then 1 else 0 end) as month
           from "user"`,
      )
      .bind(manilaDayStartIso(today), manilaDayStartIso(since7), manilaDayStartIso(since30)),
    // Registration dates shifted to Manila time before grouping by day.
    db
      .prepare(
        `select date("createdAt", '+8 hours') as day, count(*) as count
           from "user" where "createdAt" >= ? group by day`,
      )
      .bind(manilaDayStartIso(since30)),
    db.prepare("select count(*) as total from quotations"),
  ]);

  const dailyRows = (daily?.results ?? []) as { day: string; metric: string; count: number }[];
  const valueOn = (day: string, metric: string) => dailyRows.find((row) => row.day === day && row.metric === metric)?.count ?? 0;
  const sumSince = (metric: string, since: string) =>
    dailyRows.filter((row) => row.metric === metric && row.day >= since).reduce((sum, row) => sum + row.count, 0);
  const allTime = (metric: string) =>
    ((totals?.results ?? []) as { metric: string; total: number }[]).find((row) => row.metric === metric)?.total ?? 0;
  const userRow = (users?.results[0] ?? {}) as { total?: number; today?: number; week?: number; month?: number };
  const registrationRows = (registrations?.results ?? []) as { day: string; count: number }[];

  return c.json({
    generatedAt: Date.now(),
    retentionDays: RETENTION_DAYS,
    traffic: {
      pageViewsTotal: allTime("page_views"),
      visitorsTotal: allTime("unique_visitors"),
      visitorsToday: valueOn(today, "unique_visitors"),
      visitors7d: sumSince("unique_visitors", since7),
      visitors30d: sumSince("unique_visitors", since30),
    },
    users: {
      total: userRow.total ?? 0,
      today: userRow.today ?? 0,
      week: userRow.week ?? 0,
      month: userRow.month ?? 0,
    },
    usage: {
      savedQuotations: ((quotes?.results[0] ?? {}) as { total?: number }).total ?? 0,
      pdfDownloads: allTime("pdf_downloads"),
      guestPdfDownloads: allTime("guest_pdf_downloads"),
      guestQuotesStarted: allTime("guest_quotes_started"),
    },
    series: days.map((day) => ({
      day,
      visitors: valueOn(day, "unique_visitors"),
      pageViews: valueOn(day, "page_views"),
      registrations: registrationRows.find((row) => row.day === day)?.count ?? 0,
    })),
  });
});

admin.get("/users", async (c) => {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(c.req.query("page") ?? "1", 10) || 1));
  const search = (c.req.query("search") ?? "").trim().slice(0, 100);
  // Escape LIKE wildcards so the search text is matched literally.
  const pattern = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const where = search ? `where name like ?1 escape '\\' or email like ?1 escape '\\'` : "";
  const params = search ? [pattern] : [];

  const [list, count] = await c.env.DB.batch([
    c.env.DB.prepare(
      `select u.id, u.name, u.email, u."createdAt" as created_at, coalesce(u.status, 'active') as status,
              coalesce(u.role, 'user') as role,
              (select count(*) from quotations q where q.user_id = u.id) as quotations
         from "user" u ${where}
        order by u."createdAt" desc limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    ).bind(...params),
    c.env.DB.prepare(`select count(*) as total from "user" ${where}`).bind(...params),
  ]);

  const total = ((count?.results[0] ?? {}) as { total?: number }).total ?? 0;
  return c.json({
    users: (list?.results ?? []).map((row) => {
      const r = row as { id: string; name: string; email: string; created_at: string; status: string; role: string; quotations: number };
      return { id: r.id, name: r.name, email: r.email, createdAt: r.created_at, status: r.status, role: r.role, quotations: r.quotations };
    }),
    page,
    pageSize: PAGE_SIZE,
    total,
  });
});
