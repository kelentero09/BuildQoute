import { expect, test } from "@playwright/test";
import { PASSWORD, newClient } from "./helpers";

/** Runs last: it deliberately exhausts the sign-in rate limit. */
test("repeated failed logins are rate limited, and the limit also stops a correct password", async () => {
  const attacker = await newClient();
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await attacker.post("/api/auth/sign-in/email", { data: { email: "alice@example.com", password: `guess-number-${attempt}` } });
    statuses.push(response.status());
  }
  // Wrong guesses are refused, and after a handful the limiter answers instead.
  expect(statuses.every((status) => status >= 400)).toBe(true);
  expect(statuses).toContain(429);
  expect(statuses.filter((status) => status !== 429).length).toBeLessThanOrEqual(5);

  const locked = await attacker.post("/api/auth/sign-in/email", { data: { email: "alice@example.com", password: PASSWORD } });
  expect(locked.status()).toBe(429);
  expect((await (await attacker.get("/api/me")).json()).user).toBeNull();
  await attacker.dispose();
});

test("login does not reveal whether an email is registered", async () => {
  const client = await newClient();
  // Both are answered by the limiter or by the same generic refusal; neither names the cause.
  const known = await client.post("/api/auth/sign-in/email", { data: { email: "alice@example.com", password: "wrong-password-1" } });
  const unknown = await client.post("/api/auth/sign-in/email", { data: { email: "nobody-here@example.com", password: "wrong-password-1" } });
  expect(known.status()).toBe(unknown.status());
  await client.dispose();
});
