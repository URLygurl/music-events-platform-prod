import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer, request as httpRequest } from "node:http";
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { createBetterAuth } from "../server/better-auth-config";
import { createFarmAuthBridge } from "../server/farm-auth";

// Explicit local-only database selection; never infer production DATABASE_URL.
const database = process.env.AUTH_TEST_DATABASE_URL;
if (!database || !["localhost", "127.0.0.1"].includes(new URL(database).hostname) || !new URL(database).pathname.endsWith("_test")) {
  throw new Error("Select a disposable LOCAL AUTH_TEST_DATABASE_URL ending in _test.");
}
const pool = new Pool({ connectionString: database });
const originalFetch = globalThis.fetch;
const mail: string[] = [];
const app = express();
const server = createServer(app);
const store = new session.MemoryStore(); // Test only; production uses connect-pg-simple.
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const appOrigin = `http://127.0.0.1:${address.port}`;
const farmOrigin = "https://farm.example.test";
const secret = "disposable-local-session-secret-at-least-32-characters";
let fixtureUser: string | undefined;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  assert.equal(new URL(url).hostname, "api.resend.com", "No external network calls permitted");
  mail.push(JSON.parse(String(init?.body)).text);
  return new Response(JSON.stringify({ id: "mock-email" }), { headers: { "Content-Type": "application/json" } });
};
const configured = createBetterAuth(pool, {
  NODE_ENV: "production", BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: farmOrigin,
  RESEND_API_KEY: "re_mock_only", AUTH_EMAIL_FROM: "login@example.test",
  AUTH_EMAIL_DOMAIN_VERIFIED: "true", AUTH_EMAIL_LOGIN_ENABLED: "true",
});
const farm = betterAuth({
  ...configured.options,
  trustedOrigins: [farmOrigin, appOrigin],
  plugins: [...(configured.options.plugins || []), bearer({ requireSignature: true })],
});
const observations: { path: string; status: number; location: string | null; bearer: boolean }[] = [];
const bridge = createFarmAuthBridge({
  NODE_ENV: "test", FARM_AUTH_ENABLED: "true", FARM_AUTH_EMAIL_LOGIN_ENABLED: "true",
  FARM_AUTH_MAGIC_LINK_ENABLED: "true", FARM_AUTH_URL: farmOrigin,
  FARM_AUTH_APP_ORIGIN: appOrigin, SESSION_SECRET: secret,
}, async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  assert.equal(new URL(url).origin, farmOrigin);
  const response = await farm.handler(new Request(url, init));
  observations.push({ path: new URL(url).pathname, status: response.status,
    location: response.headers.get("location"), bearer: !!response.headers.get("set-auth-token") });
  return response;
});
app.use(express.json());
app.use(session({ secret, store, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: "lax" } }));
bridge.mountFarmAuth(app);
function cookie(response: Response) {
  return response.headers.getSetCookie().map((entry) => entry.split(";")[0]).join("; ");
}
// Undici overwrites Sec-Fetch-Mode with cors; use raw HTTP to model browser navigation.
function navigate(path: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(`${appOrigin}/api/farm-auth${path}`, {
      headers: { "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", Referer: "https://mail.example.test/" },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          for (const item of Array.isArray(value) ? value : value ? [value] : []) headers.append(key, item);
        }
        resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers }));
      });
    });
    request.on("error", reject); request.end();
  });
}
async function request(path: string, body?: object, sessionCookie?: string) {
  return originalFetch(`${appOrigin}/api/farm-auth${path}`, {
    method: body ? "POST" : "GET", redirect: "manual",
    headers: { Origin: appOrigin, "Content-Type": "application/json", ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
try {
  await farm.$context;
  const email = `farm-integration-${Date.now()}@example.test`;
  let response = await request("/email-otp/send-verification-otp", { email, type: "sign-in" });
  assert.equal(response.status, 200, await response.clone().text());
  const otp = mail.at(-1)!.match(/code is (\d{6})/)![1];
  response = await request("/sign-in/email-otp", { email, otp });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("set-auth-token"), null);
  const payload = await response.json();
  assert.equal(payload.user.email, email);
  assert.equal(payload.user.role, "user");
  assert.equal(payload.session.token, undefined);
  fixtureUser = payload.user.id.replace(/^farm-auth:/, "");
  assert(response.headers.getSetCookie().some((entry) => entry.includes("HttpOnly") && entry.includes("SameSite=Lax")));
  const sessionCookie = cookie(response);
  response = await request("/get-session", undefined, sessionCookie);
  assert.equal((await response.json()).user.id, payload.user.id);
  response = await request("/sign-in/email-otp", { email, otp });
  assert.notEqual(response.status, 200, "OTP must be single-use");
  response = await request("/sign-out", {}, sessionCookie);
  assert.equal(response.status, 200);
  response = await request("/get-session", undefined, sessionCookie);
  assert.equal((await response.json()).user, null);

  response = await request("/sign-in/magic-link", { email });
  assert.equal(response.status, 200, await response.clone().text());
  const generated = new URL(mail.at(-1)!.match(/https:\/\/\S+/)![0]);
  // This models Ferris rewriting only the email URL to Nakedapp, not a token migration.
  const token = generated.searchParams.get("token")!;
  const verifyPath = `/magic-link/verify?${new URLSearchParams({ token })}`;
  response = await navigate(verifyPath);
  assert.equal(response.status, 302, await response.clone().text());
  assert.equal(response.headers.get("location"), `${appOrigin}/profile`, JSON.stringify(observations));
  assert.equal(response.headers.get("set-auth-token"), null);
  response = await request("/get-session", undefined, cookie(response));
  assert.equal((await response.json()).user.id, payload.user.id);
  response = await navigate(verifyPath);
  assert.equal(response.headers.get("location"), `${appOrigin}/login?error=farm_auth`, "Link must be single-use");
  await pool.query('DELETE FROM app_auth."session" WHERE "userId" = $1', [fixtureUser]);
  console.log("PASS: real Better Auth signed bearer, OTP signup/verification and single-use, encrypted server session bridge, logout, cross-site email link/redirect and single-use; email mocked, no production access.");
} finally {
  globalThis.fetch = originalFetch;
  if (fixtureUser) {
    await pool.query('DELETE FROM app_auth."session" WHERE "userId" = $1', [fixtureUser]);
    await pool.query('DELETE FROM app_auth."account" WHERE "userId" = $1', [fixtureUser]);
    await pool.query('DELETE FROM app_auth."user" WHERE "id" = $1', [fixtureUser]);
  }
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  store.clear(() => {});
  await pool.end();
}
