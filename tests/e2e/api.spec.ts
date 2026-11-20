import { expect, test, type APIRequestContext } from "@playwright/test";
import { BROWSER_UA, PASSWORD, TINY_PNG, newClient, register, sampleQuotation, sql } from "./helpers";

/**
 * Security and API tests against the real Worker and a local D1 database.
 * Tests in this file build on each other and run in order.
 */
test.describe.configure({ mode: "serial" });

let guest: APIRequestContext;
let alice: APIRequestContext;
let bob: APIRequestContext;
let aliceQuoteId = "";

test.beforeAll(async () => {
  guest = await newClient();
  alice = await newClient();
  bob = await newClient();
});

test.afterAll(async () => {
  await Promise.all([guest.dispose(), alice.dispose(), bob.dispose()]);
});

test.describe("guests and invalid sessions", () => {
  test("account endpoints require a session", async () => {
    for (const path of ["/api/quotations", "/api/quotations/anything", "/api/settings", "/api/settings/assets/logo", "/api/settings/assets/signature"]) {
      expect((await guest.get(path)).status(), path).toBe(401);
    }
    expect((await guest.post("/api/quotations", { data: sampleQuotation() })).status()).toBe(401);
    expect((await guest.put("/api/settings/assets/signature", { data: TINY_PNG, headers: { "Content-Type": "image/png" } })).status()).toBe(401);
  });

  test("admin endpoints require a session", async () => {
    expect((await guest.get("/api/admin/stats")).status()).toBe(401);
    expect((await guest.get("/api/admin/users")).status()).toBe(401);
  });

  test("a forged or garbage session cookie is rejected", async () => {
    const forged = await newClient();
    for (const cookie of ["bq.session_token=not-a-real-token", "bq.session_token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb%3D"]) {
      expect((await forged.get("/api/quotations", { headers: { Cookie: cookie } })).status()).toBe(401);
      expect((await forged.get("/api/admin/stats", { headers: { Cookie: cookie } })).status()).toBe(401);
      const me = await (await forged.get("/api/me", { headers: { Cookie: cookie } })).json();
      expect(me.user).toBeNull();
    }
    await forged.dispose();
  });

  test("/api/me reports no user for a guest", async () => {
    expect((await (await guest.get("/api/me")).json()).user).toBeNull();
  });
});

test.describe("registration", () => {
  test("rejects weak passwords and invalid emails", async () => {
    const client = await newClient();
    expect((await client.post("/api/auth/sign-up/email", { data: { name: "X", email: "weak@example.com", password: "short" } })).ok()).toBe(false);
    expect((await client.post("/api/auth/sign-up/email", { data: { name: "X", email: "not-an-email", password: PASSWORD } })).ok()).toBe(false);
    await client.dispose();
  });

  test("creates accounts with an HttpOnly, SameSite session cookie", async () => {
    const response = await register(alice, "Alice Santos", "alice@example.com");
    expect(response.status()).toBe(200);
    const cookie = response.headers()["set-cookie"] ?? "";
    expect(cookie).toContain("bq.session_token=");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect((await register(bob, "Bob Reyes", "bob@example.com")).status()).toBe(200);
  });

  test("a user cannot make themselves an administrator at sign-up", async () => {
    const client = await newClient();
    const response = await register(client, "Mallory", "mallory@example.com", { role: "admin", status: "active", isAdmin: true });
    // Either the extra fields are refused outright or they are ignored; both are safe.
    if (response.ok()) {
      const me = await (await client.get("/api/me")).json();
      expect(me.user.isAdmin).toBe(false);
      expect((await client.get("/api/admin/stats")).status()).toBe(404);
    }
    await client.dispose();
  });

  test("a user cannot promote themselves through the profile update endpoint", async () => {
    await alice.post("/api/auth/update-user", { data: { name: "Alice Santos", role: "admin" } });
    const me = await (await alice.get("/api/me")).json();
    expect(me.user.isAdmin).toBe(false);
    expect((await alice.get("/api/admin/stats")).status()).toBe(404);
    expect((await alice.get("/api/admin/users")).status()).toBe(404);
  });

  test("the same email cannot be registered twice", async () => {
    const client = await newClient();
    expect((await register(client, "Alice Again", "alice@example.com")).ok()).toBe(false);
    await client.dispose();
  });

  test("passwords are stored hashed, never in plain text", async () => {
    // Read straight from the database through the admin-only SQL path used for provisioning.
    const { execSync } = await import("node:child_process");
    const { TEST_STATE_DIR } = await import("../../playwright.config");
    const output = execSync(
      `npx wrangler d1 execute buildquote --local --persist-to ${TEST_STATE_DIR} --json --command "select password from account where providerId = 'credential'"`,
      { env: { ...process.env, CI: "1" } },
    ).toString();
    expect(output).not.toContain(PASSWORD);
    const rows = JSON.parse(output)[0].results as { password: string }[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) expect(row.password).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/); // salt:scrypt key
  });
});

test.describe("saved quotations", () => {
  test("save, list and load", async () => {
    const created = await alice.post("/api/quotations", { data: sampleQuotation() });
    expect(created.status()).toBe(201);
    aliceQuoteId = (await created.json()).id;

    const list = (await (await alice.get("/api/quotations")).json()).quotations;
    expect(list).toHaveLength(1);
    // 12.5 x 850.75 = 10,634.38; + 3,600.00 = 14,234.38; less 10% (1,423.44) = 12,810.94
    expect(list[0]).toMatchObject({ id: aliceQuoteId, number: "BQ-20261120-TEST", projectName: "Test Project", totalAmount: 1_281_094 });

    const loaded = (await (await alice.get(`/api/quotations/${aliceQuoteId}`)).json()).quotation;
    expect(loaded.items).toHaveLength(2);
    expect(loaded.id).toBe(aliceQuoteId);
  });

  test("the total is computed on the server, not taken from the client", async () => {
    const response = await alice.post("/api/quotations", { data: { ...sampleQuotation({ number: "BQ-20261120-TOT2" }), total_amount: 1, totalAmount: 1 } });
    expect(response.status()).toBe(201);
    const list = (await (await alice.get("/api/quotations")).json()).quotations as { number: string; totalAmount: number }[];
    expect(list.find((q) => q.number === "BQ-20261120-TOT2")?.totalAmount).toBe(1_281_094);
  });

  test("edit updates the stored quotation", async () => {
    const response = await alice.put(`/api/quotations/${aliceQuoteId}`, { data: sampleQuotation({ projectName: "Renamed", discountValue: "" }) });
    expect(response.status()).toBe(200);
    const list = (await (await alice.get("/api/quotations")).json()).quotations as { id: string; projectName: string; totalAmount: number }[];
    expect(list.find((q) => q.id === aliceQuoteId)).toMatchObject({ projectName: "Renamed", totalAmount: 1_423_438 });
  });

  test("another user cannot read, change or delete it", async () => {
    expect((await (await bob.get("/api/quotations")).json()).quotations).toEqual([]);
    expect((await bob.get(`/api/quotations/${aliceQuoteId}`)).status()).toBe(404);
    expect((await bob.put(`/api/quotations/${aliceQuoteId}`, { data: sampleQuotation({ projectName: "Hijacked" }) })).status()).toBe(404);
    expect((await bob.delete(`/api/quotations/${aliceQuoteId}`)).status()).toBe(404);
    // Still intact for its owner.
    const loaded = (await (await alice.get(`/api/quotations/${aliceQuoteId}`)).json()).quotation;
    expect(loaded.projectName).toBe("Renamed");
  });

  test("a client-supplied user id is ignored", async () => {
    const response = await bob.post("/api/quotations", { data: { ...sampleQuotation({ number: "BQ-20261120-BOB1" }), user_id: "someone-else", userId: "someone-else" } });
    expect(response.status()).toBe(201);
    expect((await (await bob.get("/api/quotations")).json()).quotations).toHaveLength(1);
    expect((await (await alice.get("/api/quotations")).json()).quotations).toHaveLength(2);
  });

  test("invalid payloads are rejected", async () => {
    const bad: Record<string, unknown>[] = [
      sampleQuotation({ items: [] }),
      sampleQuotation({ items: Array.from({ length: 201 }, (_, i) => ({ id: String(i), description: "x", amount: "1", quantity: "1", unit: "", unitPrice: "1" })) }),
      sampleQuotation({ items: [{ id: "a", description: "x".repeat(501), amount: "1", quantity: "1", unit: "", unitPrice: "1" }] }),
      sampleQuotation({ projectName: "x".repeat(151) }),
      sampleQuotation({ mode: "advanced" }),
      sampleQuotation({ template: "../../etc/passwd" }),
      sampleQuotation({ date: "20 Nov 2026" }),
      sampleQuotation({ number: "<script>" }),
      sampleQuotation({ items: "not-an-array" }),
      { projectName: "only this" },
    ];
    for (const data of bad) expect((await alice.post("/api/quotations", { data })).status()).toBe(400);
    expect((await alice.post("/api/quotations", { data: "{not json", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
    expect((await alice.post("/api/quotations", { data: "a=b", headers: { "Content-Type": "application/x-www-form-urlencoded" } })).status()).toBe(415);
  });

  test("oversized payloads are rejected", async () => {
    const response = await alice.post("/api/quotations", {
      data: JSON.stringify({ ...sampleQuotation(), padding: "x".repeat(300 * 1024) }),
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(413);
  });

  test("malicious text is stored and returned as plain data", async () => {
    const xss = `<img src=x onerror=alert(1)><script>alert(document.cookie)</script>`;
    const sqli = `Robert'); DROP TABLE quotations;-- " OR ""="`;
    const created = await alice.post("/api/quotations", {
      data: sampleQuotation({ number: "BQ-20261120-EVIL", projectName: xss, clientName: sqli, remarks: `${sqli}\n${xss}` }),
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();

    const response = await alice.get(`/api/quotations/${id}`);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    const loaded = (await response.json()).quotation;
    expect(loaded.projectName).toBe(xss);
    expect(loaded.clientName).toBe(sqli);

    // The table survived and SQL metacharacters in the id are harmless.
    expect((await alice.get("/api/quotations/' OR '1'='1")).status()).toBe(404);
    expect((await (await alice.get("/api/quotations")).json()).quotations.length).toBe(3);
    expect((await alice.delete(`/api/quotations/${id}`)).status()).toBe(200);
  });

  test("delete removes only the owner's quotation", async () => {
    const created = await alice.post("/api/quotations", { data: sampleQuotation({ number: "BQ-20261120-DEL1" }) });
    const { id } = await created.json();
    expect((await alice.delete(`/api/quotations/${id}`)).status()).toBe(200);
    expect((await alice.get(`/api/quotations/${id}`)).status()).toBe(404);
    expect((await alice.delete(`/api/quotations/${id}`)).status()).toBe(404);
  });
});

test.describe("settings and private images", () => {
  test("settings are saved per user", async () => {
    const data = {
      companyName: "Alice Builders",
      companyAddress: "Makati",
      contactNumber: "0917",
      signatoryName: "Alice",
      signatoryPosition: "Engineer",
      preferences: { defaultTemplate: "corporate", validityDays: 45 },
    };
    expect((await alice.put("/api/settings", { data })).status()).toBe(200);
    expect(await (await alice.get("/api/settings")).json()).toMatchObject(data);
    expect((await (await bob.get("/api/settings")).json()).companyName).toBe("");
  });

  test("invalid settings are rejected", async () => {
    const base = { companyName: "", companyAddress: "", contactNumber: "", signatoryName: "", signatoryPosition: "" };
    expect((await alice.put("/api/settings", { data: { ...base, preferences: { defaultTemplate: "modern", validityDays: 0 } } })).status()).toBe(400);
    expect((await alice.put("/api/settings", { data: { ...base, preferences: { defaultTemplate: "nope", validityDays: 30 } } })).status()).toBe(400);
    expect((await alice.put("/api/settings", { data: { ...base, companyName: "x".repeat(151), preferences: { defaultTemplate: "modern", validityDays: 30 } } })).status()).toBe(400);
  });

  test("logo and signature upload, and are served back only to their owner", async () => {
    for (const kind of ["logo", "signature"]) {
      const put = await alice.put(`/api/settings/assets/${kind}`, { data: TINY_PNG, headers: { "Content-Type": "image/png" } });
      expect(put.status(), kind).toBe(200);

      const own = await alice.get(`/api/settings/assets/${kind}`);
      expect(own.status()).toBe(200);
      expect(own.headers()["content-type"]).toBe("image/png");
      expect(own.headers()["cache-control"]).toContain("private");
      expect(own.headers()["cache-control"]).toContain("no-store");
      expect(Buffer.compare(await own.body(), TINY_PNG)).toBe(0);

      // Other users and guests cannot fetch it; there is no public URL for it.
      expect((await bob.get(`/api/settings/assets/${kind}`)).status()).toBe(404);
      expect((await guest.get(`/api/settings/assets/${kind}`)).status()).toBe(401);
    }
    const settings = await (await alice.get("/api/settings")).json();
    expect(settings.logoVersion).toBeTruthy();
    expect(settings.signatureVersion).toBeTruthy();
  });

  test("invalid image formats are rejected whatever type the client claims", async () => {
    const samples: [string, Buffer][] = [
      ["svg", Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>`)],
      ["gif", Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "binary")],
      ["html", Buffer.from("<html><script>alert(1)</script></html>")],
      ["exe", Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "binary")],
    ];
    for (const [name, data] of samples) {
      const response = await alice.put("/api/settings/assets/logo", { data, headers: { "Content-Type": "image/png" } });
      expect(response.status(), name).toBe(415);
    }
    expect((await alice.put("/api/settings/assets/logo", { data: Buffer.alloc(0), headers: { "Content-Type": "image/png" } })).status()).toBe(413);
    expect((await alice.put("/api/settings/assets/avatar", { data: TINY_PNG, headers: { "Content-Type": "image/png" } })).status()).toBe(404);
    // The earlier valid logo is untouched.
    expect(Buffer.compare(await (await alice.get("/api/settings/assets/logo")).body(), TINY_PNG)).toBe(0);
  });

  test("oversized images are rejected", async () => {
    const big = Buffer.concat([TINY_PNG, Buffer.alloc(700 * 1024, 1)]);
    const response = await alice.put("/api/settings/assets/logo", { data: big, headers: { "Content-Type": "image/png" } });
    expect(response.status()).toBe(413);
  });

  test("an image can be removed", async () => {
    expect((await alice.delete("/api/settings/assets/logo")).status()).toBe(200);
    expect((await alice.get("/api/settings/assets/logo")).status()).toBe(404);
  });
});

test.describe("cross-site request forgery", () => {
  test("state-changing requests from another origin are blocked", async () => {
    const evil = { Origin: "https://evil.example" };
    expect((await alice.post("/api/quotations", { data: sampleQuotation(), headers: evil })).status()).toBe(403);
    expect((await alice.delete(`/api/quotations/${aliceQuoteId}`, { headers: evil })).status()).toBe(403);
    expect((await alice.put("/api/settings/assets/signature", { data: TINY_PNG, headers: { ...evil, "Content-Type": "image/png" } })).status()).toBe(403);
    expect((await alice.get(`/api/quotations/${aliceQuoteId}`)).status()).toBe(200);
  });

  test("requests with no Origin and no same-origin fetch metadata are blocked", async () => {
    const bare = await newClient(null);
    expect((await bare.post("/api/events", { data: { type: "page_view" } })).status()).toBe(403);
    await bare.dispose();
  });

  test("the auth endpoints refuse cross-origin sign-in", async () => {
    const response = await guest.post("/api/auth/sign-in/email", {
      data: { email: "alice@example.com", password: PASSWORD },
      headers: { Origin: "https://evil.example", Cookie: "bq.session_token=x" },
    });
    expect(response.ok()).toBe(false);
  });
});

test.describe("usage counting", () => {
  test("counts page views and downloads, ignores bots and unknown events", async () => {
    const visitor = await newClient();
    expect((await visitor.post("/api/events", { data: { type: "page_view" } })).status()).toBe(204);
    expect((await visitor.post("/api/events", { data: { type: "page_view" } })).status()).toBe(204);
    expect((await visitor.post("/api/events", { data: { type: "pdf_download" } })).status()).toBe(204);
    expect((await visitor.post("/api/events", { data: { type: "quote_started" } })).status()).toBe(204);
    expect((await visitor.post("/api/events", { data: { type: "made_up" } })).status()).toBe(400);
    expect((await visitor.post("/api/events", { data: { type: "page_view", extra: "x".repeat(1000) } })).status()).toBe(413);
    // Bots get a polite answer but are not counted.
    for (let i = 0; i < 5; i++) {
      expect((await visitor.post("/api/events", { data: { type: "page_view" }, headers: { "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" } })).status()).toBe(204);
    }
    await visitor.dispose();
  });
});

test.describe("administrator", () => {
  let adminClient: APIRequestContext;

  test.beforeAll(async () => {
    adminClient = await newClient();
    expect((await register(adminClient, "Site Admin", "admin@example.com")).status()).toBe(200);
  });
  test.afterAll(async () => adminClient.dispose());

  test("a newly registered account is not an administrator", async () => {
    expect((await adminClient.get("/api/admin/stats")).status()).toBe(404);
  });

  test("an administrator is provisioned from the command line and takes effect on the server", async () => {
    sql(`update user set role = 'admin' where email = 'admin@example.com'`);
    const me = await (await adminClient.get("/api/me")).json();
    expect(me.user.isAdmin).toBe(true);
    expect((await adminClient.get("/api/admin/stats")).status()).toBe(200);
  });

  test("ordinary users still cannot reach admin data", async () => {
    for (const client of [alice, bob]) {
      expect((await client.get("/api/admin/stats")).status()).toBe(404);
      expect((await client.get("/api/admin/users")).status()).toBe(404);
    }
  });

  test("statistics reflect what actually happened", async () => {
    const stats = await (await adminClient.get("/api/admin/stats")).json();
    expect(stats.users.total).toBeGreaterThanOrEqual(3);
    expect(stats.users.today).toBe(stats.users.total);
    expect(stats.usage.savedQuotations).toBe(3); // Alice 2, Bob 1
    expect(stats.traffic.pageViewsTotal).toBe(2); // the 5 bot requests were not counted
    expect(stats.traffic.visitorsToday).toBe(1);
    expect(stats.usage.pdfDownloads).toBe(1);
    expect(stats.usage.guestPdfDownloads).toBe(1);
    expect(stats.usage.guestQuotesStarted).toBe(1);
    expect(stats.series).toHaveLength(30);
    const today = stats.series[29];
    expect(today.pageViews).toBe(2);
    expect(today.registrations).toBe(stats.users.total);
  });

  test("user list supports search and pagination and exposes no secrets", async () => {
    const all = await (await adminClient.get("/api/admin/users")).json();
    expect(all.total).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(all)).not.toMatch(/password|token|hash/i);

    const found = await (await adminClient.get("/api/admin/users?search=alice")).json();
    expect(found.users.map((u: { email: string }) => u.email)).toEqual(["alice@example.com"]);
    expect(found.users[0]).toMatchObject({ name: "Alice Santos", status: "active", quotations: 2 });

    // LIKE wildcards and SQL in the search box are treated as plain text.
    expect((await (await adminClient.get("/api/admin/users?search=%25")).json()).total).toBe(0);
    expect((await (await adminClient.get(`/api/admin/users?search=${encodeURIComponent("' OR 1=1 --")}`)).json()).total).toBe(0);
    expect((await (await adminClient.get("/api/admin/users?page=999")).json()).users).toEqual([]);
  });

  test("a disabled account loses access immediately", async () => {
    sql(`update user set status = 'disabled' where email = 'bob@example.com'`);
    expect((await bob.get("/api/quotations")).status()).toBe(401);
    sql(`update user set status = 'active' where email = 'bob@example.com'`);
    expect((await bob.get("/api/quotations")).status()).toBe(200);
  });
});

test.describe("sessions", () => {
  test("logging out invalidates the session on the server", async () => {
    const client = await newClient();
    await register(client, "Temp User", "temp@example.com");
    const state = await client.storageState();
    const token = state.cookies.find((cookie) => cookie.name.includes("session_token"))?.value ?? "";
    expect(token).not.toBe("");
    expect((await client.get("/api/quotations")).status()).toBe(200);

    expect((await client.post("/api/auth/sign-out", { data: {} })).ok()).toBe(true);
    // Replaying the old cookie no longer works.
    const replay = await newClient();
    expect((await replay.get("/api/quotations", { headers: { Cookie: `bq.session_token=${token}` } })).status()).toBe(401);
    await Promise.all([client.dispose(), replay.dispose()]);
  });

  test("responses carry security headers and are not cached", async () => {
    const response = await alice.get("/api/quotations");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cache-control"]).toContain("no-store");
    expect(BROWSER_UA).toBeTruthy();
  });

  test("errors do not leak internals", async () => {
    const response = await guest.get("/api/does-not-exist");
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toMatch(/stack|at .*\(|sqlite|D1_/i);
  });
});
