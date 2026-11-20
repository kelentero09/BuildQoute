// Usage: node spike/hash-test/run.mjs https://buildquote-hash-test.<subdomain>.workers.dev <token>
// Calls each endpoint repeatedly and reports how many requests succeeded.
// A Worker that exceeds its CPU limit fails with HTTP 503 / error 1102.
const [base, token] = process.argv.slice(2);
if (!base || !token) {
  console.error("Usage: node run.mjs <worker-url> <token>");
  process.exit(1);
}
const ROUNDS = 40;

async function hit(path, extra = "") {
  const started = performance.now();
  try {
    const response = await fetch(`${base}${path}?token=${encodeURIComponent(token)}${extra}`);
    const text = await response.text();
    return { status: response.status, ms: performance.now() - started, limit: /1102|exceeded/i.test(text) };
  } catch (error) {
    return { status: 0, ms: performance.now() - started, limit: false, error: String(error) };
  }
}

async function series(label, path, extra) {
  const results = [];
  for (let i = 0; i < ROUNDS; i++) results.push(await hit(path, extra));
  const ok = results.filter((r) => r.status === 200).length;
  const limited = results.filter((r) => r.limit).length;
  const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
  const statuses = [...new Set(results.map((r) => r.status))].join(",");
  console.log(
    `${label.padEnd(16)} ok ${String(ok).padStart(2)}/${ROUNDS}  cpu-limit errors ${String(limited).padStart(2)}  ` +
      `median ${sorted[Math.floor(ROUNDS / 2)].toFixed(0)} ms  max ${sorted[ROUNDS - 1].toFixed(0)} ms  statuses ${statuses}`,
  );
}

await series("baseline", "/noop");
await series("scrypt hash", "/scrypt-hash");
const made = await fetch(`${base}/make-hash?token=${encodeURIComponent(token)}`);
if (made.ok) {
  const { hash } = await made.json();
  await series("scrypt verify", "/scrypt-verify", `&hash=${encodeURIComponent(hash)}`);
} else {
  console.log(`scrypt verify    skipped: could not create a hash (HTTP ${made.status})`);
}
await series("pbkdf2 100k", "/pbkdf2-100k");
