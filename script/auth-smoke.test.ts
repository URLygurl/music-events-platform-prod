import assert from "node:assert/strict";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { createBetterAuth, readAuthConfig } from "../server/better-auth-config";

// Explicit opt-in; never use DATABASE_URL implicitly for a destructive test.
const testURL = process.env.AUTH_TEST_DATABASE_URL;
if (!testURL || !["localhost", "127.0.0.1"].includes(new URL(testURL).hostname) || !new URL(testURL).pathname.endsWith("_test")) {
  throw new Error("Set AUTH_TEST_DATABASE_URL to a disposable LOCAL database ending in _test.");
}
const pool = new Pool({ connectionString: testURL });
const baseURL = "https://auth.example.test";
const env = {
  NODE_ENV: "production", BETTER_AUTH_SECRET: "local-test-secret-that-is-at-least-32-characters",
  BETTER_AUTH_URL: baseURL, RESEND_API_KEY: "re_local_test_only", AUTH_EMAIL_FROM: "login@example.test",
  AUTH_EMAIL_DOMAIN_VERIFIED: "true", AUTH_EMAIL_LOGIN_ENABLED: "true",
};
const sent: { to: string[]; text: string }[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  assert.equal(new URL(url).hostname, "api.resend.com", "No unmocked network requests permitted");
  const payload = JSON.parse(String(init?.body));
  sent.push(payload);
  return new Response(JSON.stringify({ id: `mock-${sent.length}` }), { headers: { "Content-Type": "application/json" } });
};
function cookie(res: Response) {
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}
async function request(auth: ReturnType<typeof createBetterAuth>, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return auth.handler(new Request(`${baseURL}/api/better-auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Origin: baseURL, "Content-Type": "application/json", "x-mvt-auth-ip": "127.0.0.1", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
try {
  assert.equal(readAuthConfig({}).requested, false);
  assert.equal(readAuthConfig({}).emailLoginEnabled, false);
  assert.equal(readAuthConfig({ ...env, AUTH_EMAIL_DOMAIN_VERIFIED: "false" }).emailLoginEnabled, false);
  assert.equal(readAuthConfig({ ...env, AUTH_EMAIL_FROM: "onboarding@resend.dev" }).emailLoginEnabled, false);
  assert.equal(readAuthConfig({ ...env, BETTER_AUTH_URL: "http://auth.example.test" }).configured, false);
  assert.equal(readAuthConfig({ ...env, BETTER_AUTH_SECRET: "short" }).configured, false);
  const auth = createBetterAuth(pool, env);
  await auth.$context;
  // Only touches the isolated test authentication schema.
  await pool.query('TRUNCATE app_auth."verification", app_auth."session", app_auth."account", app_auth."user", app_auth."rateLimit" CASCADE');
  const migration = await getMigrations(auth.options);
  assert.equal((await migration.compileMigrations()).replace(/;/g, "").trim(), "");
  let res = await request(auth, "/sign-in/magic-link", { email: "link@example.test", callbackURL: "/" });
  assert.equal(res.status, 200, await res.text());
  const linkText = sent.at(-1)!.text;
  const magicURL = new URL(linkText.match(/https:\/\/\S+/)![0]);
  const token = magicURL.searchParams.get("token")!;
  let records = await pool.query('SELECT identifier, value FROM app_auth."verification"');
  assert(!JSON.stringify(records.rows).includes(token), "Magic-link token must not be stored in plain text");
  res = await auth.handler(new Request(magicURL));
  assert.equal(res.status, 302);
  assert(res.headers.getSetCookie().some((v) => v.includes("HttpOnly") && v.includes("Secure")));
  const linkCookie = cookie(res);
  assert(linkCookie.includes("mvt-better-auth"));
  res = await request(auth, "/get-session", undefined, { Cookie: linkCookie });
  assert.equal((await res.json()).user.email, "link@example.test");
  res = await auth.handler(new Request(magicURL));
  assert((res.headers.get("location") || "").includes("error="), "Magic links must be single use");
  res = await request(auth, "/email-otp/send-verification-otp", { email: "otp@example.test", type: "sign-in" });
  assert.equal(res.status, 200, await res.text());
  const otp = sent.at(-1)!.text.match(/code is (\d{6})/)![1];
  records = await pool.query('SELECT identifier, value FROM app_auth."verification"');
  assert(!JSON.stringify(records.rows).includes(otp), "OTP must not be stored in plain text");
  res = await request(auth, "/sign-in/email-otp", { email: "otp@example.test", otp: "not-valid" });
  assert.notEqual(res.status, 200);
  res = await request(auth, "/sign-in/email-otp", { email: "otp@example.test", otp });
  assert.equal(res.status, 200, await res.text());
  const otpCookie = cookie(res);
  res = await request(auth, "/sign-in/email-otp", { email: "otp@example.test", otp });
  assert.notEqual(res.status, 200, "OTP must be single use");
  res = await request(auth, "/sign-out", {}, { Cookie: otpCookie });
  assert.equal(res.status, 200);
  res = await request(auth, "/get-session", undefined, { Cookie: otpCookie });
  assert.equal(await res.json(), null);
  res = await request(auth, "/sign-in/magic-link", { email: "evil@example.test", callbackURL: "https://evil.example.test" });
  assert.notEqual(res.status, 200, "Untrusted callbacks must be rejected");
  const before = sent.length;
  for (let i = 0; i < 5; i++) res = await request(auth, "/sign-in/magic-link", { email: "limit@example.test" });
  assert.equal(res!.status, 429);
  assert(sent.length - before <= 3, "Send rate limits must stop email delivery");
  console.log("PASS: safe defaults, migration idempotence, mocked Resend, magic link and OTP sign-in/single-use, hashed tokens, secure cookies, session/logout, trusted callbacks, send rate limiting.");
} finally {
  globalThis.fetch = originalFetch;
  await pool.end();
}
