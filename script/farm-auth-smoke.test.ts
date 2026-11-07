import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createDecipheriv, hkdfSync } from "node:crypto";
import { request as httpRequest } from "node:http";
import express from "express";
import session from "express-session";
import type { AddressInfo } from "node:net";
import { createFarmAuthBridge } from "../server/farm-auth";

// ONLY loopback HTTP + mocked farm fetch. No auth/db module, DB connection, email or real farm request.
const origin = "https://nakedapp.example.test";
const farm = "https://pve.taild066b2.ts.net/nakedapp-auth/api/better-auth";
const secret = "disposable-memory-store-test-secret-at-least-32-characters";
const bearer = `farmTokenOnly.${"a".repeat(43)}`;
const rotated = `rotatedFarmOnly.${"b".repeat(43)}`;
const link = "opaque-email-link-token-0123456789";
const env = {
  NODE_ENV: "test", FARM_AUTH_URL: "https://pve.taild066b2.ts.net/nakedapp-auth",
  FARM_AUTH_APP_ORIGIN: origin, SESSION_SECRET: secret, FARM_AUTH_ENABLED: "true",
  FARM_AUTH_EMAIL_LOGIN_ENABLED: "true", FARM_AUTH_MAGIC_LINK_ENABLED: "true",
};
function localFetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<Response> {
  assert.equal(new URL(url).hostname, "127.0.0.1", "Test HTTP transport is loopback only");
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
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}
function farmSession() {
  return {
    user: { id: "farm-subject", email: "reader@example.test", emailVerified: true, name: "Reader", role: "superadmin", image: "javascript:alert(1)", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    session: { id: "safe-session-id", userId: "farm-subject", expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(), token: bearer },
    token: bearer,
  };
}
type Call = { url: URL; init: RequestInit; headers: Headers; body: Record<string, unknown> | undefined };
type Handler = (call: Call) => Promise<Response> | Response;
async function fixture(overrides: Record<string, string | undefined> = {}, handler?: Handler) {
  const calls: Call[] = [];
  let current = handler;
  const bridge = createFarmAuthBridge({ ...env, ...overrides }, async (input, init = {}) => {
    const url = new URL(String(input));
    assert.equal(url.origin, new URL(farm).origin, "No unmocked farm or external network requests");
    assert(url.pathname.startsWith("/nakedapp-auth/api/better-auth/"));
    assert.equal(init.redirect, "manual");
    assert.equal(init.credentials, "omit");
    assert(init.signal);
    const headers = new Headers(init.headers);
    assert.equal(headers.get("origin"), overrides.FARM_AUTH_APP_ORIGIN || origin);
    for (const forbidden of ["cookie", "x-forwarded-for", "forwarded", "x-real-ip", "x-mvt-auth-ip"]) assert.equal(headers.get(forbidden), null);
    const call = { url, init, headers, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    if (current) return current(call);
    if (url.pathname.endsWith("/get-session")) {
      assert([`Bearer ${bearer}`, `Bearer ${rotated}`].includes(headers.get("authorization")!));
      return json(farmSession());
    }
    if (url.pathname.endsWith("/sign-in/email-otp")) return json({ token: bearer, user: { role: "superadmin" }, error: "provider-secret" }, 200, { "set-auth-token": bearer, "set-cookie": `farm_session=${bearer}; HttpOnly` });
    if (url.pathname.endsWith("/magic-link/verify")) return new Response(bearer, { status: 302, headers: { "set-auth-token": bearer, Location: `${origin}/profile`, "set-cookie": `farm_session=${bearer}` } });
    return json({ token: bearer, error: "provider-secret" });
  });
  const store = new session.MemoryStore();
  const app = express();
  app.set("trust proxy", 1); // Match the app's explicit, sanitized one-hop ingress contract.
  app.use(session({ secret, store, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: "lax", secure: false } }));
  app.use(express.json({ limit: "8kb", strict: false }));
  app.post("/test/seed", (req, res) => {
    if (req.body.legacy) Object.assign(req.session, { userId: "legacy-admin" });
    Object.assign(req.session, { marker: "legacy-data-must-survive-failure" });
    req.session.save(() => res.json({ ok: true }));
  });
  app.get("/test/legacy", (req, res) => res.json({ userId: (req.session as typeof req.session & { userId?: string }).userId, marker: (req.session as typeof req.session & { marker?: string }).marker }));
  app.get("/test/user", async (req, res) => res.json(await bridge.getFarmAuthUser(req)));
  app.post("/test/logout", async (req, res) => { await bridge.signOutFarmAuth(req); res.json({ ok: true }); });
  bridge.mountFarmAuth(app);
  app.use((_req, res) => res.status(200).send("SPA fallback"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = "";
  const outputs: string[] = [];
  async function request(path: string, body?: unknown, headers: Record<string, string> = {}, includeOrigin = true) {
    const response = await localFetch(`${base}${path.startsWith("/test/") ? "" : "/api/farm-auth"}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(includeOrigin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const bodyText = await response.text();
    for (const raw of [bearer, rotated, "provider-secret", "farm_session="]) {
      assert(!bodyText.includes(raw), `No credential or provider error in browser body: ${path}`);
      assert(!JSON.stringify([...response.headers]).includes(raw), `No credential or provider cookie in browser headers: ${path}`);
    }
    assert.equal(response.headers.get("set-auth-token"), null);
    assert.equal(response.headers.get("access-control-expose-headers"), null);
    if (!path.startsWith("/test/")) {
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    const cookies = response.headers.getSetCookie();
    if (cookies.length) cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    outputs.push(bodyText);
    return { status: response.status, headers: response.headers, text: bodyText, json: () => JSON.parse(bodyText) };
  }
  function sessions(): Promise<Record<string, session.SessionData>> {
    return new Promise((resolve, reject) => store.all((error, data) => error ? reject(error) : resolve((data || {}) as Record<string, session.SessionData>)));
  }
  async function mutate(fn: (value: session.SessionData) => void) {
    const entries = Object.entries(await sessions());
    assert.equal(entries.length, 1);
    const [id, value] = entries[0];
    fn(value);
    await new Promise<void>((resolve, reject) => store.set(id, value, (error) => error ? reject(error) : resolve()));
  }
  return {
    bridge, calls, outputs, request, sessions, mutate, getCookie: () => cookie,
    mock: (next: Handler) => { current = next; },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await new Promise<void>((resolve) => store.clear(() => resolve()));
    },
  };
}
async function withFixture(run: (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>, overrides: Record<string, string | undefined> = {}, handler?: Handler) {
  const f = await fixture(overrides, handler);
  try { await run(f); } finally { await f.close(); }
}
async function login(f: Awaited<ReturnType<typeof fixture>>) {
  const response = await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" });
  assert.equal(response.status, 200, response.text);
  return response;
}

test("configuration is disabled by default, strictly validated and independent of legacy secret fallback", async () => {
  const status = createFarmAuthBridge({}).getFarmAuthStatus();
  assert.deepEqual(Object.keys(status).sort(), ["configured", "emailLoginEnabled", "enabled", "magicLinkEnabled", "reason"]);
  assert.equal(status.enabled, false);
  for (const FARM_AUTH_URL of ["http://farm.test/nakedapp-auth", "https://user:password@farm.test", "https://farm.test/?x=1", "https://farm.test/#", "https://farm.test?", "https://farm.test\\evil", "https://farm.test/ "]) {
    assert.equal(createFarmAuthBridge({ ...env, FARM_AUTH_URL }).getFarmAuthStatus().configured, false);
  }
  for (const FARM_AUTH_APP_ORIGIN of ["https://app.test/", "https://app.test/profile", "https://app.test?", "https://user@app.test", "null", "http://app.test", "https://app.test:443"]) {
    assert.equal(createFarmAuthBridge({ ...env, FARM_AUTH_APP_ORIGIN }).getFarmAuthStatus().configured, false);
  }
  for (const SESSION_SECRET of [undefined, "short", "x".repeat(31)]) assert.equal(createFarmAuthBridge({ ...env, SESSION_SECRET }).getFarmAuthStatus().configured, false);
  assert.equal(createFarmAuthBridge({ ...env, FARM_AUTH_URL: "http://localhost:4321/nakedapp-auth", FARM_AUTH_APP_ORIGIN: "http://127.0.0.1:4322" }).getFarmAuthStatus().enabled, true);
  assert.equal(createFarmAuthBridge({ ...env, NODE_ENV: "production", FARM_AUTH_URL: "http://localhost:4321" }).getFarmAuthStatus().configured, false);
  assert.equal(createFarmAuthBridge({ ...env, FARM_AUTH_ENABLED: undefined }).getFarmAuthStatus().enabled, false);
  assert.equal(createFarmAuthBridge({ ...env, FARM_AUTH_EMAIL_LOGIN_ENABLED: undefined }).getFarmAuthStatus().magicLinkEnabled, false);
  assert.equal(createFarmAuthBridge({ ...env, FARM_AUTH_MAGIC_LINK_ENABLED: undefined }).getFarmAuthStatus().magicLinkEnabled, false);
  assert.equal(createFarmAuthBridge({ ...env, FARM_AUTH_ENABLED: "TRUE" }).getFarmAuthStatus().enabled, false);
  await withFixture(async (f) => {
    assert.equal((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" })).status, 503);
    assert.equal((await f.request("/get-session")).status, 503);
    assert.equal(f.calls.length, 0);
  }, { FARM_AUTH_ENABLED: undefined });
});

test("email and magic links require separate explicit opt-ins", async () => {
  await withFixture(async (f) => {
    assert.equal((await f.request("/ok")).status, 200);
    assert.equal((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" })).status, 403);
    assert.equal((await f.request("/sign-in/magic-link", { email: "reader@example.test" })).status, 403);
    assert.equal(f.calls.length, 0);
  }, { FARM_AUTH_EMAIL_LOGIN_ENABLED: undefined });
  await withFixture(async (f) => {
    assert.equal((await f.request("/sign-in/magic-link", { email: "reader@example.test" })).status, 403);
    assert.equal((await f.request(`/magic-link/verify?token=${link}`)).headers.get("location"), `${origin}/login?error=farm_auth`);
    assert.equal(f.calls.length, 0);
    await login(f);
  }, { FARM_AUTH_MAGIC_LINK_ENABLED: undefined });
});

test("OTP sign-in verifies upstream, prevents fixation, encrypts bearer and maps a non-admin safe user", async () => {
  await withFixture(async (f) => {
    await f.request("/test/seed", {});
    const oldCookie = f.getCookie();
    const oldIds = Object.keys(await f.sessions());
    const response = await login(f);
    assert.notEqual(f.getCookie(), oldCookie);
    const entries = Object.entries(await f.sessions());
    assert.equal(entries.length, 1);
    assert.notEqual(entries[0][0], oldIds[0]);
    const stored = entries[0][1].farmAuth!;
    assert.deepEqual(Object.keys(stored).sort(), ["encryptedToken", "expiresAt", "issuer", "subject"]);
    assert.equal(stored.issuer, farm);
    assert.equal(stored.subject, "farm-subject");
    assert(!JSON.stringify(entries).includes(bearer));
    const [, iv, tag, ciphertext] = stored.encryptedToken.split(".");
    const key = Buffer.from(hkdfSync("sha256", secret, "farm-auth-bridge-v1", "session-bearer", 32));
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(JSON.stringify([stored.subject, stored.issuer])));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    assert.equal(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString(), bearer);
    assert(Date.parse(stored.expiresAt) <= Date.now() + 7 * 24 * 3600_000);
    const data = response.json();
    assert.equal(data.user.id, "farm-auth:farm-subject");
    assert.equal(data.user.role, "user");
    assert.equal(data.user.emailVerified, true);
    assert.equal(data.user.username, null);
    assert.equal(data.user.profileImageUrl, null);
    assert.deepEqual(Object.keys(data.session).sort(), ["expiresAt", "id"]);
    assert(response.headers.get("set-cookie")!.includes("HttpOnly"));
    assert(response.headers.get("set-cookie")!.includes("SameSite=Lax"));
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[0].headers.get("authorization"), null);
    assert.equal(f.calls[1].headers.get("authorization"), `Bearer ${bearer}`);
    assert.equal((await f.request("/get-session")).json().user.role, "user");
    assert.equal((await f.request("/test/user")).json().id, "farm-auth:farm-subject");
    assert.equal(f.calls.length, 4, "Every auth read remotely validates; no cached-user fallback");
  });
});

test("email send endpoints whitelist input and discard provider bodies/headers", async () => {
  await withFixture(async (f) => {
    assert.equal((await f.request("/sign-in/magic-link", { email: "reader@example.test" })).status, 200);
    assert.deepEqual(f.calls[0].body, { email: "reader@example.test", callbackURL: `${origin}/profile`, errorCallbackURL: `${origin}/login` });
    assert.equal(f.calls[0].url.search, "");
    assert.equal((await f.request("/email-otp/send-verification-otp", { email: "reader@example.test", type: "sign-in" })).status, 200);
    assert.deepEqual(f.calls[1].body, { email: "reader@example.test", type: "sign-in" });
    assert.deepEqual((await f.request("/email-otp/send-verification-otp", { email: "reader@example.test", type: "forget-password" })).json(), { message: "Farm authentication request failed" });
    assert.equal(f.calls.length, 2);
    assert.equal(Object.keys(await f.sessions()).length, 0);
  });
  await withFixture(async (f) => {
    for (const body of [null, {}, { email: "bad" }, { email: "reader@example.test", otp: 123456 }, { email: "reader@example.test", otp: "12345" }, { email: "reader@example.test", otp: "123456", callbackURL: "https://evil.test" }, { email: "r\neader@example.test", otp: "123456" }]) {
      assert.equal((await f.request("/sign-in/email-otp", body)).status, 400);
    }
    assert.equal(f.calls.length, 0);
  });
  await withFixture(async (f) => {
    assert.equal((await f.request("/sign-in/magic-link", { email: "reader@example.test", callbackURL: `${origin}/profile` })).status, 400);
    assert.equal((await f.request("/sign-in/magic-link", { email: "reader@example.test", errorCallbackURL: "https://evil.test" })).status, 400);
    assert.equal(f.calls.length, 0);
  });
});

test("CSRF rejects foreign/missing origins, spoofed fetch metadata and never forwards browser credentials/IP", async () => {
  await withFixture(async (f) => {
    for (const headers of [{ Origin: "https://evil.test" }, { Origin: "null" }, { Origin: `${origin}/` }, { "Sec-Fetch-Site": "cross-site" }, { Origin: "https://evil.test", Referer: `${origin}/login` }] as Record<string, string>[]) {
      assert.equal((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" }, headers)).status, 403);
    }
    assert.equal((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" }, {}, false)).status, 403);
    assert.equal((await f.request("/sign-out", {}, {}, false)).status, 403);
    assert.equal((await f.request("/get-session", undefined, {}, false)).status, 403);
    assert.equal((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" }, { Referer: "https://evil.test" }, false)).status, 403);
    assert.equal(f.calls.length, 0);
    assert.equal((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" }, {
      Referer: `${origin}/login`, Authorization: "Bearer incoming-attacker", Cookie: "attacker_cookie=secret",
      "x-forwarded-for": "192.0.2.7", "x-real-ip": "192.0.2.8", "x-mvt-auth-ip": "spoof", Forwarded: "for=192.0.2.9",
    }, false)).status, 200);
    assert.equal(f.calls[0].headers.get("authorization"), null);
    assert.equal((await f.request("/sign-out", {}, { Origin: "https://evil.test" })).status, 403);
    assert((Object.values(await f.sessions())[0]).farmAuth, "Rejected logout preserves farm session");
  });
});

test("magic links verify manually, accept only token, store encrypted credentials and use fixed callbacks", async () => {
  await withFixture(async (f) => {
    await f.request("/test/seed", {});
    const before = f.getCookie();
    const response = await f.request(`/magic-link/verify?token=${link}`, undefined, { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", "Sec-Fetch-Site": "none" }, false);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), `${origin}/profile`);
    assert.notEqual(f.getCookie(), before);
    assert.equal(f.calls.length, 2);
    assert.deepEqual(Object.fromEntries(f.calls[0].url.searchParams), { token: link, callbackURL: `${origin}/profile`, errorCallbackURL: `${origin}/login` });
    assert.equal(f.calls[0].headers.get("authorization"), null);
    assert.equal((await f.request("/get-session")).json().user.id, "farm-auth:farm-subject");
  });
  await withFixture(async (f) => {
    for (const query of ["", `?token=${link}&token=${link}`, `?token=${link}&callbackURL=https://evil.test`, `?token=${link}&errorCallbackURL=${origin}/login`, "?token=short", "?token=https%3A%2F%2Fevil.test", "?token=%0d%0aInjected", "?other=value"]) {
      const response = await f.request(`/magic-link/verify${query}`);
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), `${origin}/login?error=farm_auth`);
    }
    assert.equal(f.calls.length, 0);
  });
  await withFixture(async (f) => {
    for (const headers of [{ "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" }, { "Sec-Fetch-Mode": "same-origin", "Sec-Fetch-Dest": "document" }, { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "iframe" }] as Record<string, string>[]) {
      assert.equal((await f.request(`/magic-link/verify?token=${link}`, undefined, headers, false)).headers.get("location"), `${origin}/login?error=farm_auth`);
    }
    assert.equal(f.calls.length, 0);
  });
});

test("external mail navigation and metadata-absent navigation can complete only the fixed token callback", async () => {
  for (const headers of [
    { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", "Sec-Fetch-Site": "cross-site", Referer: "https://mail.google.com/mail/u/0/" },
    { Referer: "https://outlook.live.com/mail/0/" },
    {},
  ] as Record<string, string>[]) {
    await withFixture(async (f) => {
      const response = await f.request(`/magic-link/verify?token=${link}`, undefined, headers, false);
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), `${origin}/profile`);
      assert.equal(f.calls.length, 2);
      assert.equal(f.calls[0].headers.get("referer"), null);
      assert.equal(f.calls[0].headers.get("sec-fetch-site"), null);
    });
  }
});

test("magic redirects never follow or forward arbitrary locations and need signed bearer headers", async () => {
  for (const location of ["https://evil.test/profile", `${origin}/profile?token=${bearer}`, `${origin}/profile#secret`, `${origin}/login?error=INVALID_TOKEN`, "/profile", `${origin}/profile/`, "//evil.test/"]) {
    await withFixture(async (f) => {
      f.mock(() => new Response(null, { status: 302, headers: { Location: location, "set-auth-token": bearer } }));
      const response = await f.request(`/magic-link/verify?token=${link}`);
      assert.equal(response.headers.get("location"), `${origin}/login?error=farm_auth`);
      assert.equal(f.calls.length, 1);
      assert.equal(Object.keys(await f.sessions()).length, 0);
    });
  }
  for (const status of [200, 301, 303, 307, 308]) {
    await withFixture(async (f) => {
      f.mock(() => new Response(null, { status, headers: { Location: `${origin}/profile`, "set-auth-token": bearer } }));
      assert.equal((await f.request(`/magic-link/verify?token=${link}`)).headers.get("location"), `${origin}/login?error=farm_auth`);
      assert.equal(f.calls.length, 1);
    });
  }
  for (const token of ["", "unsigned", "bad.signature", "bad.%ZZ", `${bearer},${rotated}`]) {
    await withFixture(async (f) => {
      f.mock(() => new Response(null, { status: 302, headers: { Location: `${origin}/profile`, "set-auth-token": token } }));
      assert.equal((await f.request(`/magic-link/verify?token=${link}`)).headers.get("location"), `${origin}/login?error=farm_auth`);
      assert.equal(f.calls.length, 1);
    });
  }
});

test("unverified, expired, mismatched, missing or revoked upstream users cannot establish sessions", async () => {
  const invalid: unknown[] = [null, {}, { user: farmSession().user, session: null }];
  for (const mutate of [
    (body: ReturnType<typeof farmSession>) => { body.user.emailVerified = false; },
    (body: ReturnType<typeof farmSession>) => { Object.assign(body.user, { emailVerified: "true" }); },
    (body: ReturnType<typeof farmSession>) => { body.session.userId = "different-subject"; },
    (body: ReturnType<typeof farmSession>) => { body.session.expiresAt = new Date(Date.now() - 1000).toISOString(); },
    (body: ReturnType<typeof farmSession>) => { body.session.expiresAt = "invalid"; },
    (body: ReturnType<typeof farmSession>) => { body.user.email = "other@example.test"; },
  ]) { const body = farmSession(); mutate(body); invalid.push(body); }
  for (const body of invalid) {
    await withFixture(async (f) => {
      await f.request("/test/seed", {});
      const before = f.getCookie();
      f.mock(({ url }) => url.pathname.endsWith("/get-session") ? json(body) : json({ token: bearer }, 200, { "set-auth-token": bearer }));
      assert.notEqual((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" })).status, 200);
      assert.equal(f.getCookie(), before);
      assert.equal((await f.request("/test/legacy")).json().marker, "legacy-data-must-survive-failure");
      assert(!Object.values(await f.sessions())[0].farmAuth);
    });
  }
  await withFixture(async (f) => {
    f.mock(({ url }) => url.pathname.endsWith("/get-session") ? json(null, 401) : json({}, 200, { "set-auth-token": bearer }));
    assert.notEqual((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" })).status, 200);
    assert.equal(Object.keys(await f.sessions()).length, 0);
  });
});

test("every farm user read fails closed on outages and clears invalid/revoked/changed subjects", async () => {
  for (const mode of ["revoked", "unverified", "mismatched", "changed", "expired", "invalid-json", "rotation-invalid"]) {
    await withFixture(async (f) => {
      await login(f);
      f.mock(() => {
        const body = farmSession();
        if (mode === "revoked") return json(null, 401);
        if (mode === "unverified") body.user.emailVerified = false;
        if (mode === "mismatched") body.session.userId = "other";
        if (mode === "changed") { body.user.id = "other"; body.session.userId = "other"; }
        if (mode === "expired") body.session.expiresAt = new Date(Date.now() - 1).toISOString();
        if (mode === "invalid-json") return new Response("not json");
        return json(body, 200, mode === "rotation-invalid" ? { "set-auth-token": "unsigned" } : {});
      });
      assert.equal((await f.request("/test/user")).json(), null);
      assert(!Object.values(await f.sessions())[0].farmAuth, `Clear ${mode}`);
      const count = f.calls.length;
      assert.deepEqual((await f.request("/get-session")).json(), { user: null, session: null });
      assert.equal(f.calls.length, count);
    });
  }
  await withFixture(async (f) => {
    await login(f);
    for (const handler of [() => { throw new Error(`private-error-${bearer}`); }, () => json({ error: "private-error" }, 503)]) {
      f.mock(handler);
      assert.equal((await f.request("/test/user")).json(), null);
      assert.deepEqual((await f.request("/get-session")).json(), { user: null, session: null });
      assert(Object.values(await f.sessions())[0].farmAuth, "Outage retains encrypted credential only, never cached roles");
    }
    f.mock(() => json(farmSession()));
    assert.equal((await f.request("/test/user")).json().role, "user");
  });
});

test("local expiry, issuer/subject/ciphertext tampering and key changes clear credentials without upstream access", async () => {
  for (const mutate of [
    (value: session.SessionData) => { value.farmAuth!.expiresAt = new Date(Date.now() - 1).toISOString(); },
    (value: session.SessionData) => { value.farmAuth!.issuer = "https://evil.test/api/better-auth"; },
    (value: session.SessionData) => { value.farmAuth!.subject = "changed-subject"; },
    (value: session.SessionData) => { value.farmAuth!.encryptedToken = "v1.invalid.invalid.invalid"; },
    (value: session.SessionData) => { value.farmAuth!.expiresAt = new Date(Date.now() + 8 * 24 * 3600_000).toISOString(); },
  ]) {
    await withFixture(async (f) => {
      await login(f);
      await f.mutate(mutate);
      const count = f.calls.length;
      assert.equal((await f.request("/test/user")).json(), null);
      assert.equal(f.calls.length, count);
      assert(!Object.values(await f.sessions())[0].farmAuth);
    });
  }
  await withFixture(async (f) => {
    await login(f);
    const stored = Object.values(await f.sessions())[0].farmAuth!;
    let saves = 0;
    const req = { session: { farmAuth: stored, save: (cb: (error?: Error) => void) => { saves++; cb(); } } };
    const other = createFarmAuthBridge({ ...env, SESSION_SECRET: "a-different-secret-that-is-at-least-32-characters" }, async () => { throw new Error("Must not fetch"); });
    assert.equal(await other.getFarmAuthUser(req as never), null);
    assert.equal(req.session.farmAuth, undefined);
    assert.equal(saves, 1);
  });
});

test("signed and URI-encoded bearer rotation is encrypted, persisted, and used only upstream", async () => {
  await withFixture(async (f) => {
    await login(f);
    const old = Object.values(await f.sessions())[0].farmAuth!;
    f.mock(() => json(farmSession(), 200, { "set-auth-token": encodeURIComponent(rotated) }));
    assert.equal((await f.request("/get-session")).json().user.role, "user");
    const current = Object.values(await f.sessions())[0].farmAuth!;
    assert.notEqual(current.encryptedToken, old.encryptedToken);
    assert.equal(current.expiresAt, old.expiresAt, "Rotation cannot extend local maximum lifetime");
    f.mock(({ headers }) => { assert.equal(headers.get("authorization"), `Bearer ${rotated}`); return json(farmSession()); });
    assert.equal((await f.request("/get-session")).status, 200);
  });
});

test("legacy session rejects farm login and sending with 409, preserving cookie and privileges", async () => {
  await withFixture(async (f) => {
    await f.request("/test/seed", { legacy: true });
    const before = f.getCookie();
    for (const [path, body] of [
      ["/sign-in/email-otp", { email: "reader@example.test", otp: "123456" }],
      ["/sign-in/magic-link", { email: "reader@example.test" }],
      ["/email-otp/send-verification-otp", { email: "reader@example.test", type: "sign-in" }],
    ] as const) assert.equal((await f.request(path, body)).status, 409);
    assert.equal(f.calls.length, 0);
    assert.equal(f.getCookie(), before);
    assert.equal((await f.request("/test/legacy")).json().userId, "legacy-admin");
    assert.equal((await f.request("/sign-out", {})).status, 200);
    assert.equal((await f.request("/test/legacy")).json().userId, "legacy-admin");
    assert.equal(f.getCookie(), before);
  });
});

test("sign-out clears only farm credentials, revokes explicitly and remains safe when farm is down", async () => {
  for (const outage of [false, true]) {
    await withFixture(async (f) => {
      await login(f);
      f.mock(({ url, headers }) => {
        assert.equal(url.href, `${farm}/sign-out`);
        assert.equal(headers.get("authorization"), `Bearer ${bearer}`);
        if (outage) throw new Error("private-error");
        return json({ token: bearer });
      });
      assert.deepEqual((await f.request("/sign-out", {})).json(), { success: true });
      assert(!Object.values(await f.sessions())[0].farmAuth);
      assert.deepEqual((await f.request("/get-session")).json(), { user: null, session: null });
      assert.equal(f.calls.length, 3);
      assert.equal((await f.request("/test/logout", {})).status, 200);
      assert.equal(f.calls.length, 3);
    });
  }
  await withFixture(async (f) => {
    await login(f);
    await f.mutate((value) => Object.assign(value, { userId: "legacy-admin" }));
    assert.equal((await f.request("/test/logout", {})).status, 200);
    assert.equal((await f.request("/test/legacy")).json().userId, "legacy-admin");
  });
});

test("unknown routes/methods are JSON 404 not SPA; query/callback injection cannot proxy", async () => {
  await withFixture(async (f) => {
    for (const path of ["", "/", "/anything", "/sign-in/email-otp", "/sign-in/password", "/admin/list-users", "/%2Fget-session", "/get-session/extra", "/https://evil.test"]) {
      const response = await f.request(path);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get("content-type")?.startsWith("application/json"), true);
      assert.notEqual(response.text, "SPA fallback");
    }
    assert.equal(f.calls.length, 0);
    assert.equal((await f.request("/get-session?token=attacker")).status, 400);
    assert.equal((await f.request("/sign-in/email-otp?callbackURL=https://evil.test", { email: "reader@example.test", otp: "123456" })).status, 400);
    assert.equal((await f.request("/sign-out", { token: "attacker" })).status, 400);
    assert.equal(f.calls.length, 0);
  });
});

test("local limits use proxy-resolved IP, ignore untrusted chain entries, and never forward caller IP headers", async () => {
  await withFixture(async (f) => {
    for (let i = 0; i < 8; i++) {
      const response = await f.request("/email-otp/send-verification-otp", { email: "reader@example.test", type: "sign-in" }, { "x-forwarded-for": `192.0.2.${i + 1}, 198.51.100.7`, "x-mvt-auth-ip": String(i) });
      assert.equal(response.status, i < 3 ? 200 : 429);
      if (i >= 3) assert.equal(response.headers.get("retry-after"), "60");
    }
    assert.equal(f.calls.length, 3);
    assert.equal((await f.request("/sign-in/magic-link", { email: "reader@example.test" }, { "x-forwarded-for": "198.51.100.7" })).status, 429, "Both send routes share a bucket");
    assert.equal((await f.request("/sign-in/magic-link", { email: "reader@example.test" }, { "x-forwarded-for": "198.51.100.8" })).status, 200, "Independent sanitized proxy clients get separate limits");
  });
  await withFixture(async (f) => {
    f.mock(() => json({ error: "invalid OTP" }, 401));
    for (let i = 0; i < 12; i++) assert.equal((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" }, { "x-forwarded-for": `192.0.2.${i + 1}, 198.51.100.7` })).status, i < 10 ? 401 : 429);
    assert.equal(f.calls.length, 10);
  });
});

test("oversized bodies, declared sizes, malformed JSON and timeouts never create sessions or leak errors", async () => {
  for (const handler of [
    () => new Response("x".repeat(65537), { headers: { "set-auth-token": bearer } }),
    () => new Response("{}", { headers: { "set-auth-token": bearer, "content-length": "65537" } }),
    () => { throw new Error(`private-error-${bearer}`); },
    ({ url }: Call) => url.pathname.endsWith("/get-session") ? new Response("invalid json") : json({}, 200, { "set-auth-token": bearer }),
  ]) {
    await withFixture(async (f) => {
      f.mock(handler);
      assert.notEqual((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" })).status, 200);
      assert.equal(Object.keys(await f.sessions()).length, 0);
    });
  }
  await withFixture(async (f) => {
    let signal: AbortSignal | undefined;
    f.mock(({ init }) => { signal = init.signal!; return new Promise<Response>(() => {}); });
    const start = Date.now();
    assert.equal((await f.request("/sign-in/email-otp", { email: "reader@example.test", otp: "123456" })).status, 503);
    assert(Date.now() - start < 6000);
    assert.equal(signal!.aborted, true);
    assert.equal(Object.keys(await f.sessions()).length, 0);
  });
});
