import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import session from "express-session";
import { createOidcAuthBridge } from "../server/oidc-auth";

// No DB, email, real provider, global fetch patch, or external network. The app
// uses loopback HTTP + MemoryStore; injected discovery/token/JWKS are in-memory.
const origin = "https://app.example.test";
const issuer = "https://farm.example.test/farm/api/better-auth/oidc";
const clientId = "public-music-events";
const callback = `${origin}/api/auth/oidc/callback`;
const secret = "disposable-oidc-memory-session-secret-at-least-32-characters";
const env = { NODE_ENV: "test", OIDC_ENABLED: "true", OIDC_ISSUER: issuer, OIDC_APP_ORIGIN: origin, OIDC_CLIENT_ID: clientId, SESSION_SECRET: secret };
const accessToken = "opaque-access-token-must-never-persist";
const refreshToken = "opaque-refresh-token-must-never-persist";
const providerSecret = "private-provider-error-never-reflect";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const badKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "test-rsa-key", use: "sig", alg: "RS256" };
function jwt(claims: Record<string, unknown>, invalidSignature = false, algorithm = "RS256", extraHeader: Record<string, unknown> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: algorithm, kid: jwk.kid, typ: "JWT", ...extraHeader })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const body = `${header}.${payload}`;
  return `${body}.${sign("RSA-SHA256", Buffer.from(body), invalidSignature ? badKeys.privateKey : keys.privateKey).toString("base64url")}`;
}
function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
}
function metadata() {
  return {
    issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`,
    response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
    code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
  };
}
function loopbackFetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<Response> {
  assert.equal(new URL(url).hostname, "127.0.0.1", "Browser simulation is loopback only");
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, init, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("error", reject);
      res.on("end", () => {
        const headers = new Headers();
        for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }));
      });
    });
    req.on("error", reject);
    req.end(init.body);
  });
}
type Call = { url: URL; init: RequestInit; headers: Headers; body: URLSearchParams };
type Handler = (call: Call) => Response | Promise<Response> | undefined;
type IdentityOptions = { claims?: Record<string, unknown>; badSignature?: boolean; algorithm?: string; header?: Record<string, unknown>; noIdToken?: boolean; tokenStatus?: number };
async function fixture(overrides: Record<string, string | undefined> = {}, options: IdentityOptions = {}, handler?: Handler) {
  const calls: Call[] = [];
  const tokens: string[] = [];
  let auth: URL | undefined;
  let currentHandler = handler;
  const bridge = createOidcAuthBridge({ ...env, ...overrides }, async (input, init = {}) => {
    const url = new URL(String(input));
    assert.equal(url.origin, new URL(issuer).origin, "No real provider or external network");
    assert(url.pathname.startsWith(new URL(issuer).pathname + "/"));
    assert.equal(init.redirect, "manual");
    assert.equal(init.credentials, "omit");
    assert(init.signal, "Every outbound request is time-bounded");
    const headers = new Headers(init.headers);
    for (const name of ["cookie", "x-forwarded-for", "forwarded", "x-real-ip", "x-mvt-auth-ip", "origin", "referer"]) assert.equal(headers.get(name), null, name);
    assert.equal(headers.get("authorization"), url.pathname.endsWith("/userinfo") ? `Bearer ${accessToken}` : null);
    const body = new URLSearchParams(init.body ? String(init.body) : "");
    const call = { url, init, headers, body };
    calls.push(call);
    const special = currentHandler?.(call);
    if (special) return special;
    if (url.pathname.endsWith("/.well-known/openid-configuration")) return json(metadata());
    if (url.pathname.endsWith("/jwks")) return json({ keys: [jwk] });
    if (url.pathname.endsWith("/token")) {
      assert(auth, "Token exchange has an authorization flow");
      assert.equal(init.method, "POST");
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.equal(body.get("client_id"), clientId);
      assert.equal(body.get("redirect_uri"), callback);
      assert.equal(body.get("client_secret"), null);
      assert.equal(body.get("client_assertion"), null);
      const verifier = body.get("code_verifier");
      assert(verifier && /^[A-Za-z0-9._~-]{43,128}$/.test(verifier));
      assert.equal(createHash("sha256").update(verifier).digest("base64url"), auth.searchParams.get("code_challenge"));
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: issuer, aud: clientId, sub: "public-farm-subject", iat: now, exp: now + 3600,
        nonce: auth.searchParams.get("nonce"), email: "admin@example.test", email_verified: true,
        name: "Verified Reader", given_name: "Reader", family_name: "Person", picture: "javascript:alert(1)",
        role: "superadmin", root_session_token: providerSecret, ...options.claims,
      };
      const idToken = jwt(claims, options.badSignature, options.algorithm, options.header);
      tokens.push(idToken);
      return json({ access_token: accessToken, refresh_token: refreshToken, token_type: "Bearer", expires_in: 3600, ...(options.noIdToken ? {} : { id_token: idToken }) }, options.tokenStatus || 200, { "Set-Cookie": `farm-root=${providerSecret}; HttpOnly`, "set-auth-token": accessToken });
    }
    throw new Error("Unexpected mocked endpoint");
  });
  const store = new session.MemoryStore();
  const app = express();
  app.use(session({ secret, store, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: "lax", secure: false } }));
  app.use(express.json());
  app.post("/test/seed", (req, res) => {
    Object.assign(req.session, { marker: "old-session-data" });
    if (req.body.legacy) Object.assign(req.session, { userId: "legacy-superadmin" });
    if (req.body.farm) Object.assign(req.session, { farmAuth: { encryptedToken: "existing-farm-credential", subject: "old-farm-subject", issuer, expiresAt: new Date(Date.now() + 3600_000).toISOString() } });
    req.session.save(() => res.json({ ok: true }));
  });
  app.get("/test/user", async (req, res) => res.json(await bridge.getOidcAuthUser(req)));
  app.get("/test/session", (req, res) => res.json({ userId: (req.session as typeof req.session & { userId?: string }).userId, marker: (req.session as typeof req.session & { marker?: string }).marker }));
  app.post("/test/logout", async (req, res) => { await bridge.signOutOidcAuth(req); res.json({ ok: true }); });
  bridge.mountOidcAuth(app);
  app.use((_req, res) => res.status(200).send("Legacy SPA still starts"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = "";
  async function request(path: string, body?: unknown, headers: Record<string, string> = {}, explicitCookie?: string) {
    const response = await loopbackFetch(`${base}${path.startsWith("/test/") ? "" : "/api/auth/oidc"}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers, ...(explicitCookie !== undefined ? { Cookie: explicitCookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.text();
    for (const token of [accessToken, refreshToken, providerSecret, ...tokens]) {
      assert(!value.includes(token), "No provider secrets/tokens in browser body");
      assert(!JSON.stringify(Array.from(response.headers.entries())).includes(token), "No provider secrets/tokens in browser headers");
    }
    assert.equal(response.headers.get("set-auth-token"), null);
    if (!path.startsWith("/test/")) {
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    }
    const setCookie = response.headers.getSetCookie();
    if (setCookie.length && explicitCookie === undefined) cookie = setCookie.map((entry) => entry.split(";")[0]).join("; ");
    return { status: response.status, headers: response.headers, text: value, json: () => JSON.parse(value) };
  }
  async function sessions(): Promise<Record<string, session.SessionData>> {
    return new Promise((resolve, reject) => store.all((error, data) => error ? reject(error) : resolve((data || {}) as Record<string, session.SessionData>)));
  }
  async function mutate(fn: (value: session.SessionData) => void) {
    const entries = Object.entries(await sessions());
    assert.equal(entries.length, 1);
    const [id, value] = entries[0];
    fn(value);
    await new Promise<void>((resolve, reject) => store.set(id, value, (error) => error ? reject(error) : resolve()));
  }
  async function start(headers: Record<string, string> = {}) {
    const response = await request("/start", undefined, headers);
    assert.equal(response.status, 302, response.text);
    auth = new URL(response.headers.get("location")!);
    return auth;
  }
  function callbackPath(query: Record<string, string> = {}) {
    assert(auth);
    return `/callback?${new URLSearchParams({ code: "single-use-authorization-code", state: auth.searchParams.get("state")!, iss: issuer, ...query })}`;
  }
  return {
    bridge, calls, tokens, request, sessions, mutate, start, callbackPath,
    getCookie: () => cookie, setCookie: (next: string) => { cookie = next; }, mock: (next: Handler) => { currentHandler = next; },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await new Promise<void>((resolve) => store.clear(() => resolve()));
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function withFixture(run: (f: Fixture) => Promise<void>, overrides: Record<string, string | undefined> = {}, options: IdentityOptions = {}, handler?: Handler) {
  const f = await fixture(overrides, options, handler);
  try { await run(f); } finally { await f.close(); }
}
async function login(f: Fixture) {
  await f.start();
  const response = await f.request(f.callbackPath());
  assert.equal(response.status, 302, response.text);
  assert.equal(response.headers.get("location"), `${origin}/profile`);
}
function assertNoStoredTokens(f: Fixture, data: unknown) {
  const serialized = JSON.stringify(data);
  for (const token of [accessToken, refreshToken, providerSecret, ...f.tokens]) assert(!serialized.includes(token), "No provider token/secret in MemoryStore");
  for (const name of ["id_token", "access_token", "refresh_token", "encryptedToken", "root_session_token"]) assert(!serialized.includes(name), name);
}

test("strict opt-in/configuration/strong secret, canonical full issuer, loopback test-only HTTP", async () => {
  assert.equal(createOidcAuthBridge({}).getOidcAuthStatus().enabled, false);
  for (const key of ["OIDC_ISSUER", "OIDC_APP_ORIGIN", "OIDC_CLIENT_ID", "SESSION_SECRET"]) assert.equal(createOidcAuthBridge({ ...env, [key]: undefined }).getOidcAuthStatus().configured, false);
  for (const OIDC_ISSUER of ["http://farm.test/farm", "https://user:pass@farm.test/farm", "https://farm.test", "https://farm.test/", "https://farm.test/farm?x=1", "https://farm.test/farm#", "https://farm.test/farm\\evil", "https://farm.test/farm/../evil", "https://farm.test/farm/%2e%2e/evil", "https://farm.test/farm/.well-known/openid-configuration", " https://farm.test/farm"]) assert.equal(createOidcAuthBridge({ ...env, OIDC_ISSUER }).getOidcAuthStatus().configured, false, OIDC_ISSUER);
  for (const OIDC_APP_ORIGIN of ["https://app.test/", "https://app.test/profile", "https://app.test?", "https://app.test:443", "https://user@app.test", "http://app.test"]) assert.equal(createOidcAuthBridge({ ...env, OIDC_APP_ORIGIN }).getOidcAuthStatus().configured, false, OIDC_APP_ORIGIN);
  assert.equal(createOidcAuthBridge({ ...env, SESSION_SECRET: "x".repeat(31) }).getOidcAuthStatus().configured, false);
  assert.equal(createOidcAuthBridge({ ...env, OIDC_ENABLED: "TRUE" }).getOidcAuthStatus().enabled, false);
  assert.equal(createOidcAuthBridge({ ...env, OIDC_ISSUER: "http://localhost:4567/farm/oidc", OIDC_APP_ORIGIN: "http://127.0.0.1:4568" }).getOidcAuthStatus().enabled, true);
  assert.equal(createOidcAuthBridge({ ...env, NODE_ENV: "production", OIDC_ISSUER: "http://localhost:4567/farm/oidc" }).getOidcAuthStatus().configured, false);
  assert.equal(createOidcAuthBridge({ ...env, NODE_ENV: "development", OIDC_ISSUER: "http://localhost:4567/farm/oidc" }).getOidcAuthStatus().configured, false);
  await withFixture(async (f) => {
    assert.equal(f.bridge.getOidcAuthStatus().configured, true);
    assert.equal((await f.request("/start")).status, 503);
    assert.equal((await f.request("/callback?error=private-provider-error")).status, 503);
    assert.equal((await f.request("/test/session")).status, 200);
    assert.equal(f.calls.length, 0);
  }, { OIDC_ENABLED: undefined });
});

test("lazy discovery; successful public PKCE/state/nonce, real JWKS signature, fixed subject role and minimal TTL identity", async () => {
  await withFixture(async (f) => {
    assert.equal(f.calls.length, 0);
    assert.equal(f.bridge.getOidcAuthStatus().ready, false);
    await f.request("/test/seed", {});
    const originalCookie = f.getCookie();
    const auth = await f.start({ Origin: origin, Cookie: originalCookie, Authorization: "Bearer inbound-evil", "X-Forwarded-For": "198.51.100.1", "X-Real-IP": "198.51.100.1" });
    assert.notEqual(f.getCookie(), originalCookie, "Start regenerates session SID");
    assert.equal(auth.origin, new URL(issuer).origin);
    assert.equal(auth.pathname, `${new URL(issuer).pathname}/authorize`);
    assert.equal(auth.searchParams.get("response_type"), "code");
    assert.equal(auth.searchParams.get("response_mode"), "query");
    assert.equal(auth.searchParams.get("scope"), "openid email profile");
    assert.equal(auth.searchParams.get("client_id"), clientId);
    assert.equal(auth.searchParams.get("redirect_uri"), callback);
    assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
    assert(auth.searchParams.get("state")!.length >= 32);
    assert(auth.searchParams.get("nonce")!.length >= 32);
    const pending = Object.values(await f.sessions())[0];
    assert(pending.oidcFlow);
    assert.equal(pending.oidcFlow.state, auth.searchParams.get("state"));
    assert.equal(pending.oidcFlow.nonce, auth.searchParams.get("nonce"));
    assert(pending.oidcFlow.expiresAt <= Date.now() + 5 * 60_000);
    assert(!auth.searchParams.has("code_verifier"));
    const pendingCookie = f.getCookie();
    const response = await f.request(f.callbackPath(), undefined, { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", "Sec-Fetch-Site": "cross-site", Origin: "https://farm.example.test" });
    assert.equal(response.status, 302, response.text);
    assert.equal(response.headers.get("location"), `${origin}/profile`);
    assert.notEqual(f.getCookie(), pendingCookie, "Callback regenerates session SID");
    const data = await f.sessions();
    assert.equal(Object.keys(data).length, 1, "Old sessions are destroyed");
    const value = Object.values(data)[0];
    assert.equal(value.oidcFlow, undefined);
    assert.equal((value as typeof value & { marker?: string }).marker, undefined);
    assert(value.oidcAuth);
    assert.deepEqual(Object.keys(value.oidcAuth).sort(), ["expiresAt", "issuer", "subject", "user"]);
    assert.equal(value.oidcAuth.subject, "public-farm-subject");
    assert.equal(value.oidcAuth.user.id, "farm-auth:public-farm-subject");
    assert.equal(value.oidcAuth.user.role, "user", "Admin email/provider role never grants privileges");
    assert.equal(value.oidcAuth.user.profileImageUrl, null);
    assert(Date.parse(value.oidcAuth.expiresAt) <= Date.now() + 15 * 60_000);
    assertNoStoredTokens(f, data);
    assert(f.calls.some((call) => call.url.pathname.endsWith("/jwks")), "ID token signature verified against real JWKS");
    const count = f.calls.length;
    const user = (await f.request("/test/user")).json();
    assert.equal(user.id, "farm-auth:public-farm-subject");
    assert.equal(user.role, "user");
    assert.equal(f.calls.length, count, "Reading local identity never refreshes/contacts provider");
    assert.equal((await f.request(f.callbackPath())).status, 401, "Callback replay rejected with new SID");
    const old = await f.request(f.callbackPath(), undefined, {}, pendingCookie);
    assert(old.status >= 400, "Old pre-auth cookie cannot replay");
    const stale = await f.request("/test/user", undefined, {}, originalCookie);
    assert.equal(stale.json(), null, "Fixated SID is unauthenticated");
  });
});

test("local session expiry is capped at validated ID token expiry", async () => {
  const exp = Math.floor(Date.now() / 1000) + 90;
  await withFixture(async (f) => {
    await login(f);
    assert.equal(Date.parse(Object.values(await f.sessions())[0].oidcAuth!.expiresAt), exp * 1000);
  }, {}, { claims: { exp } });
});

test("legacy and farm identities are preserved with 409 at start/callback; no email linking", async () => {
  for (const identity of ["legacy", "farm"]) {
    await withFixture(async (f) => {
      await f.request("/test/seed", { [identity]: true });
      const before = JSON.stringify(await f.sessions());
      const cookie = f.getCookie();
      assert.equal((await f.request("/start")).status, 409);
      assert.equal((await f.request("/callback?code=x&state=x")).status, 409);
      assert.equal(f.getCookie(), cookie);
      assert.equal(JSON.stringify(await f.sessions()), before);
      assert.equal(f.calls.length, 0);
    });
    await withFixture(async (f) => {
      await f.start();
      await f.request("/test/seed", { [identity]: true });
      const before = Object.values(await f.sessions())[0];
      assert.equal((await f.request(f.callbackPath())).status, 409);
      const after = Object.values(await f.sessions())[0];
      const { cookie: _beforeCookie, ...beforeIdentity } = before;
      const { cookie: _afterCookie, ...afterIdentity } = after;
      assert.deepEqual(afterIdentity, beforeIdentity);
      assert.equal(f.calls.filter((call) => call.url.pathname.endsWith("/token")).length, 0);
    });
  }
});

test("callback strict query and navigation gates; no dynamic redirect/provider input", async () => {
  await withFixture(async (f) => {
    for (const query of ["?returnTo=https://evil.test", "?redirect_uri=https://evil.test", "?issuer=https://evil.test"]) assert.equal((await f.request(`/start${query}`)).status, 400);
    assert.equal(f.calls.length, 0);
    await f.start();
    for (const suffix of ["&code=duplicate", "&state=duplicate", "&iss=duplicate", "&redirect_uri=https://evil.test", "&provider=https://evil.test", "&access_token=evil", "&code%5B%5D=evil", "&unknown=evil", "&error=one&error=two", "&unknown=%GG"]) assert.equal((await f.request(f.callbackPath() + suffix)).status, 400, suffix);
    const rejectedHeaders: Record<string, string>[] = [{ "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" }, { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "iframe" }, { "Sec-Fetch-Mode": "navigate" }, { "Sec-Fetch-Dest": "document" }];
    for (const headers of rejectedHeaders) assert.equal((await f.request(f.callbackPath(), undefined, headers)).status, 403);
    assert.equal(f.calls.filter((call) => call.url.pathname.endsWith("/token")).length, 0);
    assert.equal((await f.request(f.callbackPath({ state: "wrong-state" }))).status, 401);
    assert.equal((await f.request(f.callbackPath())).status, 302, "Valid flow remains after rejected untrusted requests");
    assert.equal((await f.request("/start", {})).status, 404);
    assert.equal((await f.request("/unknown")).status, 404);
  });
});

test("start rejects cross-site/fetch requests and incorrect Origin/Referer", async () => {
  await withFixture(async (f) => {
    const rejectedHeaders: Record<string, string>[] = [{ Origin: "https://evil.test" }, { Referer: "https://evil.test/profile" }, { Referer: "not-a-url" }, { "Sec-Fetch-Site": "cross-site" }, { "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" }];
    for (const headers of rejectedHeaders) assert.equal((await f.request("/start", undefined, headers)).status, 403);
    assert.equal(f.calls.length, 0);
  });
});

test("provider error and issuer mix-up consume flow without exposing error descriptions/URIs", async () => {
  const rejectedQueries: Record<string, string>[] = [{ iss: "https://evil.test/issuer" }, { error: providerSecret, error_description: providerSecret, error_uri: "https://evil.test/private" }];
  for (const query of rejectedQueries) {
    await withFixture(async (f) => {
      await f.start();
      assert.equal((await f.request(f.callbackPath(query))).status, 401);
      assert.equal(Object.values(await f.sessions())[0].oidcFlow, undefined);
      assert.equal((await f.request(f.callbackPath())).status, 401);
      assert.equal(f.calls.filter((call) => call.url.pathname.endsWith("/token")).length, 0);
    });
  }
});

test("unverified/missing email, wrong issuer/audience/nonce, expired ID token, no ID token, and invalid signature all fail closed", async () => {
  const cases: IdentityOptions[] = [
    { claims: { email_verified: false } }, { claims: { email_verified: "true" } }, { claims: { email_verified: undefined } },
    { claims: { email: undefined } }, { claims: { email: "bad-email" } },
    { claims: { iss: "https://evil.test/issuer" } }, { claims: { aud: "different-client" } }, { claims: { aud: [clientId, "evil"], azp: "evil" } },
    { claims: { nonce: "wrong-nonce" } }, { claims: { nonce: undefined } }, { claims: { exp: Math.floor(Date.now() / 1000) - 1 } },
    { claims: { nbf: Math.floor(Date.now() / 1000) + 3600 } }, { claims: { sub: "" } }, { noIdToken: true }, { badSignature: true }, { algorithm: "none" },
  ];
  for (const options of cases) {
    await withFixture(async (f) => {
      await f.start();
      assert((await f.request(f.callbackPath())).status >= 400, JSON.stringify(options));
      assert.equal((await f.request("/test/user")).json(), null);
      const stored = await f.sessions();
      assert.equal(Object.values(stored)[0]?.oidcAuth, undefined);
      assert.equal(Object.values(stored)[0]?.oidcFlow, undefined);
      assertNoStoredTokens(f, stored);
      const calls = f.calls.length;
      assert((await f.request(f.callbackPath())).status >= 400);
      assert.equal(f.calls.length, calls, "Failed proof cannot be replayed");
    }, {}, options);
  }
});

test("expired/issuer-mismatched PKCE flows do not exchange code", async () => {
  for (const mutateFlow of [(flow: NonNullable<session.SessionData["oidcFlow"]>) => { flow.expiresAt = Date.now() - 1; }, (flow: NonNullable<session.SessionData["oidcFlow"]>) => { flow.expiresAt = Date.now() + 6 * 60_000; }, (flow: NonNullable<session.SessionData["oidcFlow"]>) => { flow.issuer = "https://evil.test/oidc"; }]) {
    await withFixture(async (f) => {
      await f.start();
      await f.mutate((data) => mutateFlow(data.oidcFlow!));
      assert.equal((await f.request(f.callbackPath())).status, 401);
      assert.equal(f.calls.filter((call) => call.url.pathname.endsWith("/token")).length, 0);
    });
  }
});

test("discovery strictly pins every provider endpoint to configured HTTPS farm origin and prefix", async () => {
  const patches = [
    { issuer: "https://evil.test/issuer" }, { token_endpoint: "https://evil.test/token" }, { jwks_uri: "https://evil.test/jwks" },
    { authorization_endpoint: "https://evil.test/authorize" }, { token_endpoint: "http://farm.example.test/farm/api/better-auth/oidc/token" },
    { token_endpoint: "https://farm.example.test/farm/api/better-auth/oidc-evil/token" }, { token_endpoint: "https://farm.example.test/other/token" },
    { token_endpoint: `${issuer}/%2e%2e/token` }, { token_endpoint: `${issuer}/../token` }, { token_endpoint: `${issuer}/token?target=evil` },
    { userinfo_endpoint: "https://evil.test/userinfo" }, { registration_endpoint: "https://evil.test/register" },
    { mtls_endpoint_aliases: { token_endpoint: "https://evil.test/token" } }, { id_token_signing_alg_values_supported: ["none", "HS256"] },
    { code_challenge_methods_supported: ["plain"] }, { token_endpoint_auth_methods_supported: ["client_secret_basic"] }, { response_types_supported: ["token"] },
  ];
  for (const patch of patches) {
    await withFixture(async (f) => {
      assert.equal((await f.request("/start")).status, 503, JSON.stringify(patch));
      assert.equal(f.calls.length, 1);
      assert.equal(f.bridge.getOidcAuthStatus().ready, false);
      assert.equal(Object.values(await f.sessions())[0]?.oidcFlow, undefined);
    }, {}, {}, () => json({ ...metadata(), ...patch }));
  }
});

test("redirects, oversized bodies/streams, unexpected response URLs, malformed JSON, and outages never leak or follow", async () => {
  const responses = [
    () => new Response(providerSecret, { status: 302, headers: { Location: "https://evil.test/steal" } }),
    () => json(metadata(), 200, { "content-length": "65537" }),
    () => new Response("x".repeat(65537), { headers: { "Content-Type": "application/json" } }),
    () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); controller.close(); } }), { headers: { "Content-Type": "application/json" } }),
    () => new Response("not-json", { headers: { "Content-Type": "application/json" } }),
    () => json({ message: providerSecret }, 503),
    () => { const response = json(metadata()); Object.defineProperty(response, "url", { value: "https://evil.test/discovery" }); return response; },
  ];
  for (const response of responses) {
    await withFixture(async (f) => {
      assert.equal((await f.request("/start")).status, 503);
      assert.equal(f.calls.length, 1);
      assert.equal((await f.request("/start")).status, 503);
      assert.equal(f.calls.length, 1, "Outage cooldown avoids discovery floods");
      assert.equal((await f.request("/test/session")).status, 200, "Legacy app startup/routes are independent");
    }, {}, {}, response);
  }
  await withFixture(async (f) => {
    await f.start();
    f.mock((call) => call.url.pathname.endsWith("/token") ? new Response(providerSecret, { status: 307, headers: { Location: "https://evil.test/token" } }) : undefined);
    assert.equal((await f.request(f.callbackPath())).status, 503);
    assert.equal((await f.request("/test/user")).json(), null);
    assert.equal(Object.values(await f.sessions())[0].oidcFlow, undefined);
  });
});

test("bounded discovery timeout even when injected fetch ignores AbortSignal", async () => {
  await withFixture(async (f) => {
    const started = Date.now();
    assert.equal((await f.request("/start")).status, 503);
    assert(Date.now() - started < 6500);
    assert(f.calls[0].init.signal!.aborted);
    assert.equal(f.bridge.getOidcAuthStatus().ready, false);
  }, {}, {}, () => new Promise<Response>(() => {}));
});

test("token response body timeout consumes flow and cannot be replayed", async () => {
  await withFixture(async (f) => {
    await f.start();
    f.mock((call) => call.url.pathname.endsWith("/token") ? new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"access_token":')); } }), { headers: { "Content-Type": "application/json" } }) : undefined);
    const started = Date.now();
    assert.equal((await f.request(f.callbackPath())).status, 503);
    assert(Date.now() - started < 6500);
    assert.equal(Object.values(await f.sessions())[0].oidcFlow, undefined);
    const calls = f.calls.length;
    assert.equal((await f.request(f.callbackPath())).status, 401);
    assert.equal(f.calls.length, calls);
    assertNoStoredTokens(f, await f.sessions());
  });
});

test("concurrent callback claims are single-use; only one token exchange and one authenticated session", async () => {
  await withFixture(async (f) => {
    await f.start();
    const cookie = f.getCookie();
    const results = await Promise.all([f.request(f.callbackPath(), undefined, {}, cookie), f.request(f.callbackPath(), undefined, {}, cookie)]);
    assert.equal(results.filter((response) => response.status === 302).length, 1);
    assert.equal(f.calls.filter((call) => call.url.pathname.endsWith("/token")).length, 1);
    assert.equal(Object.values(await f.sessions()).filter((value) => value.oidcAuth).length, 1);
  });
});

test("rate limits separate start/callback IP buckets and reject before provider work", async () => {
  await withFixture(async (f) => {
    for (let i = 0; i < 10; i++) assert.equal((await f.request("/start?bad=1")).status, 400);
    const response = await f.request("/start");
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
    for (let i = 0; i < 20; i++) assert.equal((await f.request("/callback?unknown=1")).status, 400);
    assert.equal((await f.request("/callback?code=x&state=y")).status, 429);
    assert.equal(f.calls.length, 0);
  });
});

test("each user read validates local TTL/configured issuer/role; never refreshes", async () => {
  const mutations = [
    (data: session.SessionData) => { data.oidcAuth!.expiresAt = new Date(Date.now() - 1).toISOString(); },
    (data: session.SessionData) => { data.oidcAuth!.expiresAt = new Date(Date.now() + 16 * 60_000).toISOString(); },
    (data: session.SessionData) => { data.oidcAuth!.issuer = "https://evil.test/oidc"; },
    (data: session.SessionData) => { Object.assign(data.oidcAuth!.user, { role: "superadmin" }); },
    (data: session.SessionData) => { Object.assign(data.oidcAuth!.user, { emailVerified: false }); },
    (data: session.SessionData) => { data.oidcAuth!.user.id = "different-account"; },
    (data: session.SessionData) => { Object.assign(data, { userId: "legacy-superadmin" }); },
  ];
  for (const mutation of mutations) {
    await withFixture(async (f) => {
      await login(f);
      await f.mutate(mutation);
      const calls = f.calls.length;
      assert.equal((await f.request("/test/user")).json(), null);
      assert.equal(f.calls.length, calls);
      assert.equal(Object.values(await f.sessions())[0].oidcAuth, undefined);
    });
  }
});

test("logout clears only local OIDC identity/flow and leaves legacy/farm session and remote farm session alone", async () => {
  await withFixture(async (f) => {
    await login(f);
    const calls = f.calls.length;
    assert.equal((await f.request("/test/logout", {})).status, 200);
    assert.equal((await f.request("/test/user")).json(), null);
    assert.equal(f.calls.length, calls, "No OP logout/refresh request or logout token");
    assert.equal(Object.values(await f.sessions())[0].oidcAuth, undefined);
  });
  await withFixture(async (f) => {
    await f.start();
    await f.request("/test/logout", {});
    assert.equal((await f.request(f.callbackPath())).status, 401);
    assert.equal(f.calls.filter((call) => call.url.pathname.endsWith("/token")).length, 0);
  });
  await withFixture(async (f) => {
    await f.request("/test/seed", { legacy: true, farm: true });
    const before = JSON.stringify(await f.sessions());
    await f.request("/test/logout", {});
    assert.equal(JSON.stringify(await f.sessions()), before);
    assert.equal(f.calls.length, 0);
  });
});

test("JOSE jku/x5u/embedded jwk cannot override configured keyset", async () => {
  const header = {
    jku: "https://evil.test/keys", x5u: "https://evil.test/certificate",
    jwk: { ...badKeys.publicKey.export({ format: "jwk" }), kid: jwk.kid, alg: "RS256" },
  };
  await withFixture(async (f) => {
    await f.start();
    assert((await f.request(f.callbackPath())).status >= 400, "Attacker key cannot validate signature");
    assert(f.calls.some((call) => call.url.href === `${issuer}/jwks`));
    assertNoStoredTokens(f, await f.sessions());
  }, {}, { badSignature: true, header });
  await withFixture(async (f) => {
    await login(f);
    assert(f.calls.some((call) => call.url.href === `${issuer}/jwks`), "Pinned JWKS used even with untrusted header URLs");
  }, {}, { header });
});

test("JWKS redirect/oversize/wrong keys are bounded and fail closed without accepting token claims", async () => {
  const mocks: Handler[] = [
    (call) => call.url.pathname.endsWith("/jwks") ? new Response(providerSecret, { status: 302, headers: { Location: "https://evil.test/jwks" } }) : undefined,
    (call) => call.url.pathname.endsWith("/jwks") ? json({ keys: [jwk] }, 200, { "Content-Length": "65537" }) : undefined,
    (call) => call.url.pathname.endsWith("/jwks") ? json({ keys: [{ ...badKeys.publicKey.export({ format: "jwk" }), kid: jwk.kid, alg: "RS256" }] }) : undefined,
  ];
  for (const mock of mocks) {
    await withFixture(async (f) => {
      await f.start();
      f.mock(mock);
      assert((await f.request(f.callbackPath())).status >= 400);
      assert.equal((await f.request("/test/user")).json(), null);
      assert.equal(Object.values(await f.sessions())[0].oidcFlow, undefined);
      assertNoStoredTokens(f, await f.sessions());
    });
  }
});

test("JWKS body timeout is bounded just like discovery and token response timeout", async () => {
  await withFixture(async (f) => {
    await f.start();
    f.mock((call) => call.url.pathname.endsWith("/jwks") ? new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"keys":[')); } }), { headers: { "Content-Type": "application/json" } }) : undefined);
    const started = Date.now();
    assert.equal((await f.request(f.callbackPath())).status, 503);
    assert(Date.now() - started < 6500);
    assert.equal((await f.request("/test/user")).json(), null);
    assert.equal(f.bridge.getOidcAuthStatus().ready, false);
    assertNoStoredTokens(f, await f.sessions());
  });
});

test("legacy privilege established during token exchange wins and is never silently replaced", async () => {
  await withFixture(async (f) => {
    await f.start();
    let announce: (() => void) | undefined;
    let resume: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => { announce = resolve; });
    const held = new Promise<void>((resolve) => { resume = resolve; });
    // Flow nonce exists only before callback consumption; capture it locally in
    // this test to construct a genuine provider token.
    const nonce = Object.values(await f.sessions())[0].oidcFlow!.nonce;
    f.mock(async (call) => {
      if (call.url.pathname.endsWith("/jwks")) return json({ keys: [jwk] });
      if (!call.url.pathname.endsWith("/token")) return json(metadata());
      announce!();
      await held;
      return json({ access_token: accessToken, token_type: "Bearer", id_token: jwt({
        iss: issuer, aud: clientId, sub: "public-farm-subject", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300,
        nonce, email: "admin@example.test", email_verified: true,
      }) });
    });
    const result = f.request(f.callbackPath());
    await entered;
    await f.mutate((data) => Object.assign(data, { userId: "legacy-superadmin", marker: "legacy-data-preserved" }));
    resume!();
    assert.equal((await result).status, 409);
    const data = Object.values(await f.sessions())[0] as session.SessionData & { userId?: string; marker?: string };
    assert.equal(data.userId, "legacy-superadmin");
    assert.equal(data.marker, "legacy-data-preserved");
    assert.equal(data.oidcAuth, undefined);
    assert.equal(data.oidcFlow, undefined);
  });
});

test("logout during token exchange cancels local sign-in and cannot revive identity", async () => {
  await withFixture(async (f) => {
    await f.start();
    const nonce = Object.values(await f.sessions())[0].oidcFlow!.nonce;
    let announce: (() => void) | undefined;
    let resume: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => { announce = resolve; });
    const held = new Promise<void>((resolve) => { resume = resolve; });
    f.mock(async (call) => {
      if (call.url.pathname.endsWith("/jwks")) return json({ keys: [jwk] });
      if (!call.url.pathname.endsWith("/token")) return json(metadata());
      announce!();
      await held;
      return json({ access_token: accessToken, token_type: "Bearer", id_token: jwt({
        iss: issuer, aud: clientId, sub: "public-farm-subject", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300,
        nonce, email: "reader@example.test", email_verified: true,
      }) });
    });
    const result = f.request(f.callbackPath());
    await entered;
    await f.request("/test/logout", {});
    resume!();
    assert.equal((await result).status, 401);
    assert.equal((await f.request("/test/user")).json(), null);
    assert.equal(Object.values(await f.sessions())[0].oidcAuth, undefined);
  });
});

test("browser-document callback errors redirect only to fixed app login with a safe generic code", async () => {
  const headers = { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", "Sec-Fetch-Site": "cross-site" };
  await withFixture(async (f) => {
    await f.start();
    const response = await f.request(f.callbackPath({ error: providerSecret, error_description: providerSecret, error_uri: "https://evil.test/error" }), undefined, headers);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), `${origin}/login?error=oidc_auth`);
    assert.equal(Object.values(await f.sessions())[0].oidcFlow, undefined);
  });
  await withFixture(async (f) => {
    await f.request("/test/seed", { legacy: true });
    const response = await f.request("/callback?code=wrong&state=wrong", undefined, headers);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), `${origin}/login?error=oidc_auth`);
    assert.equal((await f.request("/test/session")).json().userId, "legacy-superadmin");
    assert.equal(f.calls.length, 0);
  });
  await withFixture(async (f) => {
    const response = await f.request("/callback?error=private", undefined, headers);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), `${origin}/login?error=oidc_auth`);
    assert.equal(f.calls.length, 0);
  }, { OIDC_ENABLED: undefined });
});

// Better Auth uses minimal ID tokens; email claims are resolved through UserInfo.
test("minimal signed ID token uses pinned, verified subject-matched UserInfo", async () => {
  await withFixture(async f => {
    await login(f);
    const user = (await f.request("/test/user")).json();
    assert.equal(user.email, "reader@example.test");
    assert.equal(user.id, "farm-auth:public-farm-subject");
    assert.equal(user.role, "user");
    assert.equal(f.calls.filter(c => c.url.pathname.endsWith("/userinfo")).length, 1);
    assertNoStoredTokens(f, await f.sessions());
  }, {}, { claims: { email: undefined, email_verified: undefined } }, call => {
    if (call.url.pathname.endsWith("/.well-known/openid-configuration")) return json({ ...metadata(), userinfo_endpoint: `${issuer}/userinfo` });
    if (call.url.pathname.endsWith("/userinfo")) return json({ sub: "public-farm-subject", email: "reader@example.test", email_verified: true, name: "Reader", role: "admin" });
  });
});
for (const [label, profile] of [
  ["unverified email", { sub: "public-farm-subject", email: "reader@example.test", email_verified: false }],
  ["different subject", { sub: "someone-else", email: "reader@example.test", email_verified: true }],
] as const) test(`minimal ID token rejects UserInfo with ${label}`, async () => {
  await withFixture(async f => {
    await f.start();
    assert.notEqual((await f.request(f.callbackPath())).status, 302);
    assert.equal((await f.request("/test/user")).json(), null);
    assertNoStoredTokens(f, await f.sessions());
  }, {}, { claims: { email: undefined, email_verified: undefined } }, call => {
    if (call.url.pathname.endsWith("/.well-known/openid-configuration")) return json({ ...metadata(), userinfo_endpoint: `${issuer}/userinfo` });
    if (call.url.pathname.endsWith("/userinfo")) return json(profile);
  });
});
