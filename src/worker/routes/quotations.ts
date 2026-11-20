import { Hono } from "hono";
import { computeTotals } from "../../shared/quotation";
import { LIMITS, quotationSchema } from "../../shared/schemas";
import type { Quotation, SavedQuotationSummary } from "../../shared/types";
import type { AppEnv } from "../env";
import { readJson, requireUser } from "../middleware";

/** Saved quotations. Every query is scoped to the signed-in user's id. */
export const quotations = new Hono<AppEnv>();
quotations.use("*", requireUser);

interface Row {
  id: string;
  quotation_number: string;
  quotation_data: string;
  total_amount: number;
  updated_at: number;
}

quotations.get("/", async (c) => {
  const userId = c.get("user")!.id;
  const { results } = await c.env.DB.prepare(
    `select id, quotation_number, total_amount, updated_at,
            json_extract(quotation_data, '$.projectName') as project_name,
            json_extract(quotation_data, '$.clientName') as client_name
       from quotations where user_id = ? order by updated_at desc limit ?`,
  )
    .bind(userId, LIMITS.quotationsPerUser)
    .all<{ id: string; quotation_number: string; total_amount: number; updated_at: number; project_name: string | null; client_name: string | null }>();
  const list: SavedQuotationSummary[] = results.map((row) => ({
    id: row.id,
    number: row.quotation_number,
    projectName: row.project_name ?? "",
    clientName: row.client_name ?? "",
    totalAmount: row.total_amount,
    updatedAt: row.updated_at,
  }));
  return c.json({ quotations: list });
});

quotations.get("/:id", async (c) => {
  const row = await c.env.DB.prepare("select id, quotation_data from quotations where id = ? and user_id = ?")
    .bind(c.req.param("id"), c.get("user")!.id)
    .first<Pick<Row, "id" | "quotation_data">>();
  if (!row) return c.json({ error: "Quotation not found." }, 404);
  const quotation = { ...(JSON.parse(row.quotation_data) as Quotation), id: row.id };
  return c.json({ quotation });
});

quotations.post("/", async (c) => {
  const userId = c.get("user")!.id;
  const body = await readJson(c, quotationSchema, LIMITS.quotationBodyBytes);
  if (body instanceof Response) return body;

  const count = await c.env.DB.prepare("select count(*) as n from quotations where user_id = ?").bind(userId).first<{ n: number }>();
  if ((count?.n ?? 0) >= LIMITS.quotationsPerUser) {
    return c.json({ error: `You have reached the limit of ${LIMITS.quotationsPerUser} saved quotations. Delete some to save more.` }, 409);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  await c.env.DB.prepare(
    "insert into quotations (id, user_id, quotation_number, quotation_data, total_amount, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, userId, body.number, JSON.stringify(body), computeTotals(body).total, now, now)
    .run();
  return c.json({ id, updatedAt: now }, 201);
});

quotations.put("/:id", async (c) => {
  const body = await readJson(c, quotationSchema, LIMITS.quotationBodyBytes);
  if (body instanceof Response) return body;
  const now = Date.now();
  const result = await c.env.DB.prepare(
    "update quotations set quotation_number = ?, quotation_data = ?, total_amount = ?, updated_at = ? where id = ? and user_id = ?",
  )
    .bind(body.number, JSON.stringify(body), computeTotals(body).total, now, c.req.param("id"), c.get("user")!.id)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "Quotation not found." }, 404);
  return c.json({ id: c.req.param("id"), updatedAt: now });
});

quotations.delete("/:id", async (c) => {
  const result = await c.env.DB.prepare("delete from quotations where id = ? and user_id = ?")
    .bind(c.req.param("id"), c.get("user")!.id)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "Quotation not found." }, 404);
  return c.json({ ok: true });
});
