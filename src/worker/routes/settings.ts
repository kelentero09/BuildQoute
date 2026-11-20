import { Hono } from "hono";
import { sniffImageType } from "../../shared/imageType";
import { LIMITS, preferencesSchema, settingsSchema } from "../../shared/schemas";
import { DEFAULT_PREFERENCES, type Preferences } from "../../shared/types";
import type { AppEnv } from "../env";
import { readJson, requireUser } from "../middleware";

/** Company details, preferences, and the private logo/signature images. */
export const settings = new Hono<AppEnv>();
settings.use("*", requireUser);

const KINDS = ["logo", "signature"] as const;
type Kind = (typeof KINDS)[number];

function parseKind(value: string): Kind | null {
  return (KINDS as readonly string[]).includes(value) ? (value as Kind) : null;
}

function parsePreferences(raw: string | null | undefined): Preferences {
  try {
    const result = preferencesSchema.safeParse(JSON.parse(raw ?? "{}"));
    return result.success ? result.data : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

settings.get("/", async (c) => {
  const userId = c.get("user")!.id;
  const [row, assets] = await c.env.DB.batch([
    c.env.DB.prepare(
      "select company_name, company_address, contact_number, signatory_name, signatory_position, preferences from user_settings where user_id = ?",
    ).bind(userId),
    c.env.DB.prepare("select kind, updated_at from user_assets where user_id = ?").bind(userId),
  ]);
  const s = row?.results[0] as Record<string, string> | undefined;
  const found = (assets?.results ?? []) as { kind: Kind; updated_at: number }[];
  const version = (kind: Kind) => found.find((asset) => asset.kind === kind)?.updated_at ?? null;
  return c.json({
    companyName: s?.company_name ?? "",
    companyAddress: s?.company_address ?? "",
    contactNumber: s?.contact_number ?? "",
    signatoryName: s?.signatory_name ?? "",
    signatoryPosition: s?.signatory_position ?? "",
    preferences: parsePreferences(s?.preferences),
    // Non-null when an image exists; the value changes whenever the image is replaced.
    logoVersion: version("logo"),
    signatureVersion: version("signature"),
  });
});

settings.put("/", async (c) => {
  const body = await readJson(c, settingsSchema, 16 * 1024);
  if (body instanceof Response) return body;
  await c.env.DB.prepare(
    `insert into user_settings (user_id, company_name, company_address, contact_number, signatory_name, signatory_position, preferences, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (user_id) do update set
       company_name = excluded.company_name, company_address = excluded.company_address,
       contact_number = excluded.contact_number, signatory_name = excluded.signatory_name,
       signatory_position = excluded.signatory_position, preferences = excluded.preferences,
       updated_at = excluded.updated_at`,
  )
    .bind(
      c.get("user")!.id,
      body.companyName,
      body.companyAddress,
      body.contactNumber,
      body.signatoryName,
      body.signatoryPosition,
      JSON.stringify(body.preferences),
      Date.now(),
    )
    .run();
  return c.json({ ok: true });
});

settings.get("/assets/:kind", async (c) => {
  const kind = parseKind(c.req.param("kind"));
  if (!kind) return c.json({ error: "Not found" }, 404);
  const row = await c.env.DB.prepare("select mime, data from user_assets where user_id = ? and kind = ?")
    .bind(c.get("user")!.id, kind)
    .first<{ mime: string; data: ArrayBuffer | number[] }>();
  if (!row) return c.json({ error: "Not found" }, 404);
  const bytes = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : Uint8Array.from(row.data);
  return new Response(bytes, {
    headers: {
      "Content-Type": row.mime,
      // Private to this user: never stored by shared caches.
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});

settings.put("/assets/:kind", async (c) => {
  const kind = parseKind(c.req.param("kind"));
  if (!kind) return c.json({ error: "Not found" }, 404);
  if (Number(c.req.header("content-length") ?? "0") > LIMITS.assetBytes) {
    return c.json({ error: "That image is too large." }, 413);
  }
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > LIMITS.assetBytes) {
    return c.json({ error: "That image is too large." }, 413);
  }
  // The stored type comes from the file's content, not from what the client claims.
  const mime = sniffImageType(bytes);
  if (!mime) return c.json({ error: "Please upload a PNG, JPG or WebP image." }, 415);

  const now = Date.now();
  await c.env.DB.prepare(
    `insert into user_assets (user_id, kind, mime, data, updated_at) values (?, ?, ?, ?, ?)
     on conflict (user_id, kind) do update set mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`,
  )
    .bind(c.get("user")!.id, kind, mime, bytes, now)
    .run();
  return c.json({ version: now });
});

settings.delete("/assets/:kind", async (c) => {
  const kind = parseKind(c.req.param("kind"));
  if (!kind) return c.json({ error: "Not found" }, 404);
  await c.env.DB.prepare("delete from user_assets where user_id = ? and kind = ?").bind(c.get("user")!.id, kind).run();
  return c.json({ ok: true });
});
