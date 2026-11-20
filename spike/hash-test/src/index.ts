/**
 * Throwaway Worker: measures whether secure password hashing fits the Workers Free
 * CPU limit. Deploy, run ../run.mjs against it, then delete the Worker.
 * Not part of the application.
 */
import { hashPassword, verifyPassword } from "better-auth/crypto";

interface Env {
  TEST_TOKEN: string;
}

const PASSWORD = "correct horse battery staple";

async function pbkdf2(iterations: number): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(PASSWORD), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return String(new Uint8Array(bits)[0]);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!env.TEST_TOKEN || url.searchParams.get("token") !== env.TEST_TOKEN) return new Response("Not found", { status: 404 });

    switch (url.pathname) {
      case "/noop":
        return Response.json({ ok: true });
      case "/scrypt-hash": {
        // What registration costs with Better Auth's default hasher.
        const hash = await hashPassword(PASSWORD);
        return Response.json({ ok: true, length: hash.length });
      }
      case "/scrypt-verify": {
        // What login costs: one verification of a stored hash.
        const stored = url.searchParams.get("hash") ?? "";
        return Response.json({ ok: await verifyPassword({ hash: stored, password: PASSWORD }) });
      }
      case "/make-hash":
        return Response.json({ hash: await hashPassword(PASSWORD) });
      case "/pbkdf2-100k":
        return Response.json({ ok: true, v: await pbkdf2(100_000) });
      default:
        return new Response("Not found", { status: 404 });
    }
  },
};
