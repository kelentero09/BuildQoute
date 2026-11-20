# BuildQuote

A lightweight construction quotation generator. Guests can create, preview and download a
professional A4 quotation PDF without signing up. Registered users can also save quotations
and their company branding. One private administrator dashboard shows usage.

**Simple input. Smart calculations. Premium output.**

## What it is made of

| Part | Technology |
|---|---|
| Frontend | React, TypeScript (strict), Vite, Tailwind CSS, Lucide icons |
| Hosting | Cloudflare Workers Static Assets |
| API | Cloudflare Worker (Hono), only for `/api/*` |
| Database | Cloudflare D1 (SQLite) |
| Login | Better Auth (email + password, HTTP-only session cookies) |
| PDF | `@react-pdf/renderer`, generated in the browser; preview drawn with `pdf.js` |
| Analytics | First-party daily counters in D1, plus optional Cloudflare Web Analytics |

No R2, no paid services, no scheduled jobs. Logos and signatures are stored in D1.

```
src/
  client/    React app (routes, builder components, PDF templates)
  shared/    Money maths, quotation logic and validation used by both sides
  worker/    API: auth, quotations, settings + private images, analytics, admin
migrations/  D1 schema
tests/       unit tests (Vitest) and end-to-end/security tests (Playwright)
spike/       throwaway Worker used to measure password hashing on the free plan
```

## Run it locally

Requires Node.js 22 or newer.

```bash
npm install
cp .dev.vars.example .dev.vars        # then put a random 32+ character secret in it
npm run db:migrate:local              # creates the local database
npm run dev                           # http://localhost:5173
```

Commands:

| Command | What it does |
|---|---|
| `npm run dev` | Local site with a local Worker and local D1 |
| `npm run typecheck` | TypeScript, strict mode, client and Worker |
| `npm test` | Unit tests (money, totals, discounts, validation, image checks) |
| `npm run test:e2e` | Browser + API security tests against a throwaway local database |
| `npm run build` | Production build into `dist/` |

The first `npm run test:e2e` needs the test browser: `npx playwright install chromium`.

## Free-tier facts (checked against Cloudflare's docs, November 2026)

| Limit on the free plan | Value | What it means here |
|---|---|---|
| Worker requests | 100,000 / day | Only `/api/*` calls count; pages and files are static assets |
| Worker CPU time | 10 ms / request | Fine for everything except password hashing (see below) |
| D1 rows read | 5 million / day | |
| D1 rows written | 100,000 / day | A page view writes 2–3 rows, so roughly 30,000 counted page views a day |
| D1 storage | 500 MB per database, 5 GB total | |
| D1 max row / BLOB | 2 MB | Images are capped at 600 KB on the server |

When a daily D1 limit is reached, database queries fail until 00:00 UTC. The guest builder and
PDF download keep working because they do not use the database.

### Password hashing and the 10 ms CPU limit — measured

Secure password hashing is deliberately slow. Better Auth's default (scrypt) was measured on a
real free-plan Worker using `spike/hash-test`:

| Test | Result |
|---|---|
| Ordinary requests | Always succeeded, including while hashing requests were being rejected |
| scrypt, fresh start, back to back | About 59 succeeded, then rejected with error 1102 (CPU limit) |
| scrypt, after a short pause | 13 more succeeded, then rejected again |
| PBKDF2 100,000 rounds, after a 4 minute rest | 11 succeeded, then 189 of 200 rejected |

Conclusion: Cloudflare tolerates a burst of over-limit requests and then enforces the limit
until the allowance refills. No secure setting fits under sustained load, and weakening the
hash was not accepted as a solution.

**Decision taken:** keep the secure default hashing and launch on the free plan. At low volume,
logins and sign-ups work. During a rush, some fail and the site shows "The service is busy right
now. Please wait a minute and try again." Everything else keeps working. Sessions last 30 days,
so each user hashes rarely.

**When traffic grows:** switch the account to Workers Paid (US$5/month). No code change is
needed. To re-measure, deploy `spike/hash-test` with a `TEST_TOKEN` variable, run
`node spike/hash-test/run.mjs <url> <token>`, then delete that Worker.

### Not included, and why

- **Password reset.** It needs outbound email, and no email provider is part of the free
  setup. An insecure reset was not built. Users are told to store their password safely.
  Signed-in users can change their password in Settings.
- **Changing the account email.** Same reason: it should be confirmed by email.
- **Repeating table header on every PDF page.** The PDF library cannot repeat a header only on
  pages the table reaches. Rows never split across pages, and every page carries the quotation
  number and page count.

## Deploying to Cloudflare

Nothing in this repository deploys automatically. These are the steps to run yourself.

### 1. Cloudflare account

Create a free account at <https://dash.cloudflare.com>, then sign in from the project folder:

```bash
npx wrangler login
```

### 2. Create the D1 database

```bash
npx wrangler d1 create buildquote
```

Copy the `database_id` it prints.

### 3. Worker configuration

Open `wrangler.jsonc` and:

- replace the placeholder `database_id` with yours;
- set `APP_URL` under `vars` to the site's public address
  (for example `https://buildquote.<your-subdomain>.workers.dev` or your own domain).

### 4. Database bindings and migrations

The binding is named `DB` and is already declared in `wrangler.jsonc`. Create the tables:

```bash
npm run db:migrate:remote
```

Future schema changes go in new numbered files in `migrations/` and are applied the same way.
If the auth configuration in `src/worker/auth.ts` changes, regenerate the auth tables with
Better Auth's `getMigrations(...).compileMigrations()` and add the difference as a new migration.

### 5. Authentication secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
npx wrangler secret put BETTER_AUTH_SECRET     # paste the value when asked
```

Never put this value in `wrangler.jsonc` or commit it. `.dev.vars` is git-ignored.
Changing the secret later signs everyone out.

### 6. R2 (not needed)

BuildQuote does not use R2. Logos and signatures are small (shrunk in the browser, capped at
600 KB) and stored privately in D1. If larger files are ever required, add a private R2 bucket
binding and move `src/worker/routes/settings.ts`'s asset routes to it; keep serving them only
through the authenticated endpoint.

### 7. Analytics

- **Built in:** nothing to configure. The admin dashboard reads daily counters from D1.
- **Cloudflare Web Analytics (optional):** in the dashboard go to *Analytics & Logs → Web
  Analytics*, add the site, copy the site token, and set `CF_WEB_ANALYTICS_TOKEN` under `vars`
  in `wrangler.jsonc`. The beacon then loads on every page and reports appear in Cloudflare's
  own dashboard. Cloudflare does expose this data through its GraphQL Analytics API, but
  free-plan access to it for this dashboard was not confirmed, so the admin page does not
  depend on it.

How the built-in counting works:

- It records page views, approximate unique visitors per day, PDF downloads, guest PDF
  downloads and guest quotations started. Registrations and saved quotations are counted from
  the database tables directly.
- No IP address, user agent or cookie is stored. A keyed hash of IP + browser + date is kept
  for the current day only, to count each visitor once and to cap events at 300 per visitor per
  day. It changes every day and is deleted afterwards.
- Known bots and scripted clients are not counted.
- Daily totals are kept for 400 days, then deleted.
- "Visitors, 7 days" and "30 days" are sums of daily visitors, so a person who returns on
  three days counts three times. The dashboard says so.

### 8. Administrator provisioning

There is no way to become an administrator from the website or the API. An administrator is an
ordinary registered account whose `role` is set from the command line by someone with access to
the Cloudflare account:

```bash
# 1. Register normally on the site, then:
npx wrangler d1 execute buildquote --remote --command "update user set role = 'admin' where email = 'you@example.com'"

# Remove admin rights:
npx wrangler d1 execute buildquote --remote --command "update user set role = 'user' where email = 'you@example.com'"

# Disable or re-enable an account (takes effect on the next request):
npx wrangler d1 execute buildquote --remote --command "update user set status = 'disabled' where email = 'someone@example.com'"
npx wrangler d1 execute buildquote --remote --command "update user set status = 'active' where email = 'someone@example.com'"
```

The admin then sees an **Admin** link in the header and can open `/admin`.

### 9. Deploy

```bash
npm run typecheck && npm test && npm run test:e2e
npm run deploy          # builds, then runs `wrangler deploy`
```

### 10. Production verification

After deploying, check on the live address:

1. `/` loads; create a quotation as a guest, preview it, download the PDF, open it and check the
   ₱ amounts, logo and page numbers.
2. Repeat on a phone.
3. `/api/health` returns `{"ok":true}`.
4. Register, save a quotation, log out, log in, open it again.
5. In Settings, upload a logo and signature. In the builder, confirm "Include Signature in PDF"
   is off until you tick it.
6. Open `/admin` while logged out and as a normal user: both show "Page not found".
7. Promote your account (step 8), reload, and confirm the dashboard shows the registration and
   page views you just made.
8. In browser dev tools, confirm the session cookie is `HttpOnly`, `Secure` and `SameSite=Lax`,
   and that the page response has a `Content-Security-Policy` header.
9. In the Cloudflare dashboard, look at the Worker's logs for errors, in particular
   "exceeded CPU time limit" on `/api/auth/*`.

## Security summary

- Passwords: hashed with scrypt by Better Auth; never stored or logged in plain text.
- Sessions: random tokens in HTTP-only, SameSite=Lax cookies (Secure on HTTPS), checked against
  the database on every request; logging out deletes the session on the server.
- CSRF: Better Auth checks the request origin on its endpoints; every other state-changing
  endpoint requires a same-origin request.
- Rate limiting: sign-in 5 per minute, sign-up 10 per hour, per IP address, stored in D1.
- Authorisation: every query for user data includes the user id from the server-side session.
  Administrator status is read from the database, never from the request.
- Input: all request bodies are validated with shared schemas and size limits; SQL is always
  parameterised; React escapes all user text.
- Images: type checked by content in the browser and again on the server; re-encoded in the
  browser; stored privately and served only to their owner with `no-store`.
- Headers: CSP, `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies
  (`public/_headers` for pages, `src/worker/middleware.ts` for the API).
- Errors: details go to the Worker log; clients receive generic messages.

## Tests

- **Unit (39):** money parsing and rounding, totals, discounts, mode switching, validation,
  reference numbers, image type and size checks.
- **API and security (38):** guests and forged sessions, registration rules, self-promotion
  attempts, cross-user access to quotations and images, payload validation, malicious input,
  upload format and size checks, CSRF, analytics counting and bot filtering, admin gating and
  provisioning, disabled accounts, logout.
- **Browser (14):** the guest flow at phone, tablet and desktop sizes including a real PDF
  download; validation messages; item editing; mode switching; draft persistence; uploads;
  script-injection attempts; registered-user save, load, duplicate and delete; logout.
- **Abuse (2):** sign-in rate limiting.
