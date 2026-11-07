import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import type {} from "express-session";

interface FarmCredential {
  encryptedToken: string;
  subject: string;
  expiresAt: string;
  issuer: string;
}

declare module "express-session" {
  interface SessionData { farmAuth?: FarmCredential; }
}

type Environment = Readonly<Record<string, string | undefined>>;
type Fetch = typeof globalThis.fetch;
const PREFIX = "/api/farm-auth";
const MAX_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const MAX_RESPONSE = 64 * 1024;
const TIMEOUT = 4000;
const EMAIL = /^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/;
const PATHS = new Set([
  "POST /sign-in/magic-link", "POST /email-otp/send-verification-otp",
  "POST /sign-in/email-otp", "GET /magic-link/verify", "GET /get-session",
  "POST /sign-out", "GET /ok",
]);

function configuredURL(value: string | undefined, test: boolean, originOnly = false): URL | null {
  if (!value || value !== value.trim() || /[?#\\\s]/.test(value)) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== "https:" && !(test && local && url.protocol === "http:"))) return null;
    if (originOnly && value !== url.origin) return null;
    return url;
  } catch { return null; }
}

function text(value: unknown, max = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
}
function email(value: unknown): value is string {
  return text(value, 254) && EMAIL.test(value);
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function signedBearer(value: string | null): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const decoded = decodeURIComponent(value);
    // Farm bearer signatures are verified by get-session, never trusted locally.
    return /^[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_+/-]{32,128}={0,2}$/.test(decoded) ? decoded : null;
  } catch { return null; }
}
function date(value: unknown): Date | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const result = new Date(value);
  return Number.isFinite(result.getTime()) ? result : null;
}
function safeImage(value: unknown): string | null {
  if (!text(value, 2048)) return null;
  const url = configuredURL(value, false);
  return url?.protocol === "https:" ? url.href : null;
}
function verifiedSession(body: unknown) {
  if (!record(body) || !record(body.user) || !record(body.session)) return null;
  const { user, session } = body;
  const expiry = date(session.expiresAt);
  if (!text(user.id) || !email(user.email) || user.emailVerified !== true ||
      session.userId !== user.id || !text(session.id) || !expiry || expiry.getTime() <= Date.now()) return null;
  return {
    subject: user.id,
    expiresAt: expiry.getTime(),
    sessionId: session.id,
    user: {
      id: `farm-auth:${user.id}`, email: user.email, emailVerified: true as const,
      firstName: typeof user.name === "string" && user.name.length <= 200 ? user.name : null,
      lastName: null, profileImageUrl: safeImage(user.image), role: "user" as const,
      username: null, createdAt: date(user.createdAt), updatedAt: date(user.updatedAt),
    },
  };
}
function save(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) return reject(new Error("Session unavailable"));
    req.session.save((error) => error ? reject(new Error("Session unavailable")) : resolve());
  });
}
function legacy(req: Request) {
  return !!(req.session as (typeof req.session & { userId?: string }) | undefined)?.userId;
}

/** No DB, email provider, browser tokens, or global-env mutation. Mount after session + JSON middleware. */
export function createFarmAuthBridge(env: Environment, fetchImpl: Fetch = globalThis.fetch) {
  const base = configuredURL(env.FARM_AUTH_URL, env.NODE_ENV === "test");
  const originURL = configuredURL(env.FARM_AUTH_APP_ORIGIN, env.NODE_ENV === "test", true);
  const secret = env.SESSION_SECRET;
  const configured = !!base && !!originURL && !!secret && secret.length >= 32;
  const enabled = env.FARM_AUTH_ENABLED === "true" && configured;
  const emailLoginEnabled = enabled && env.FARM_AUTH_EMAIL_LOGIN_ENABLED === "true";
  const magicLinkEnabled = emailLoginEnabled && env.FARM_AUTH_MAGIC_LINK_ENABLED === "true";
  const origin = originURL?.origin || "";
  const issuer = base ? `${base.href.replace(/\/+$/, "")}/api/better-auth` : "";
  const key = configured ? Buffer.from(hkdfSync("sha256", secret!, "farm-auth-bridge-v1", "session-bearer", 32)) : null;
  const buckets = new Map<string, { count: number; until: number }>();

  function getFarmAuthStatus() {
    return {
      enabled, configured, emailLoginEnabled, magicLinkEnabled,
      reason: !configured ? "Farm authentication configuration required" : !enabled ? "Farm authentication disabled" :
        !emailLoginEnabled ? "Farm connector ready; email login disabled" : !magicLinkEnabled ? "Farm email OTP enabled; magic links disabled" : "Farm email login enabled",
    };
  }
  function seal(token: string, subject: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key!, iv);
    cipher.setAAD(Buffer.from(JSON.stringify([subject, issuer])));
    const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
  }
  function unseal(stored: FarmCredential): string | null {
    try {
      if (!key || !record(stored) || stored.issuer !== issuer || !text(stored.subject) ||
          !text(stored.encryptedToken, 4096) || !date(stored.expiresAt) || Date.parse(stored.expiresAt) <= Date.now() ||
          Date.parse(stored.expiresAt) > Date.now() + MAX_LIFETIME) return null;
      const parts = stored.encryptedToken.split(".");
      if (parts.length !== 4 || parts[0] !== "v1" || parts.slice(1).some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
      const [iv, tag, ciphertext] = parts.slice(1).map((p) => Buffer.from(p, "base64url"));
      if (iv.length !== 12 || tag.length !== 16) return null;
      const cipher = createDecipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(JSON.stringify([stored.subject, stored.issuer])));
      cipher.setAuthTag(tag);
      return signedBearer(Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString("utf8"));
    } catch { return null; }
  }
  async function clear(req: Request) {
    if (!req.session?.farmAuth) return;
    delete req.session.farmAuth;
    await save(req).catch(() => {});
  }
  async function upstream(path: string, method: "GET" | "POST", body?: object, token?: string, query?: URLSearchParams) {
    // All call sites use compile-time fixed routes. Nothing from inbound headers or URLs is forwarded.
    if (!["/get-session", "/sign-out", "/sign-in/email-otp", "/email-otp/send-verification-otp", "/sign-in/magic-link", "/magic-link/verify"].includes(path)) throw new Error("Invalid farm route");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Farm unavailable")); }, TIMEOUT);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const headers: Record<string, string> = { Origin: origin, Accept: "application/json" };
        if (body) headers["Content-Type"] = "application/json";
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetchImpl(`${issuer}${path}${query ? `?${query}` : ""}`, {
          method, headers, redirect: "manual", credentials: "omit", signal: controller.signal,
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (response.redirected || Number(response.headers.get("content-length")) > MAX_RESPONSE) {
          await response.body?.cancel().catch(() => {});
          throw new Error("Farm unavailable");
        }
        const chunks: Uint8Array[] = [];
        const reader = response.body?.getReader();
        let size = 0;
        if (reader) {
          try {
            for (;;) {
              const chunk = await reader.read();
              if (chunk.done) break;
              size += chunk.value.byteLength;
              if (size > MAX_RESPONSE) throw new Error("Farm unavailable");
              chunks.push(chunk.value);
            }
          } catch {
            void reader.cancel().catch(() => {});
            throw new Error("Farm unavailable");
          } finally { reader.releaseLock(); }
        }
        return { status: response.status, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") };
      })()]);
    } catch { throw new Error("Farm unavailable"); }
    finally { if (timer) clearTimeout(timer); controller.abort(); }
  }
  async function inspect(token: string) {
    const response = await upstream("/get-session", "GET", undefined, token);
    if (response.status === 401 || response.status === 403) return null;
    if (response.status !== 200) throw new Error("Farm unavailable");
    let body: unknown;
    try { body = JSON.parse(response.body); } catch { return null; }
    const checked = verifiedSession(body);
    if (!checked) return null;
    const header = response.headers.get("set-auth-token");
    const rotated = header ? signedBearer(header) : token;
    return rotated ? { ...checked, token: rotated } : null;
  }
  async function readSession(req: Request) {
    const stored = req.session?.farmAuth;
    if (!stored) return null;
    if (!enabled || legacy(req)) { await clear(req); return null; }
    const token = unseal(stored);
    if (!token) { await clear(req); return null; }
    try {
      const checked = await inspect(token);
      if (!checked || checked.subject !== stored.subject) { await clear(req); return null; }
      const expiresAt = new Date(Math.min(checked.expiresAt, Date.parse(stored.expiresAt), Date.now() + MAX_LIFETIME)).toISOString();
      if (checked.token !== token || expiresAt !== stored.expiresAt) {
        req.session.farmAuth = { encryptedToken: seal(checked.token, checked.subject), subject: checked.subject, expiresAt, issuer };
        try { await save(req); } catch { await clear(req); return null; }
      }
      return { user: checked.user, session: { id: checked.sessionId, expiresAt } };
    } catch { return null; } // Outages fail closed, but allow an encrypted credential to recover later.
  }
  async function getFarmAuthUser(req: Request) {
    return (await readSession(req))?.user || null;
  }
  async function signOutFarmAuth(req: Request) {
    const stored = req.session?.farmAuth;
    const token = stored ? unseal(stored) : null;
    await clear(req); // Clear first; remote failure never restores local credentials or touches legacy userId.
    if (enabled && token) await upstream("/sign-out", "POST", {}, token).catch(() => {});
  }
  async function establish(req: Request, token: string, expectedEmail?: string) {
    const checked = await inspect(token);
    if (!checked || (expectedEmail && checked.user.email.toLowerCase() !== expectedEmail.toLowerCase())) throw new Error("Farm sign-in failed");
    if (!req.session || legacy(req)) throw new Error("Session unavailable");
    await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(new Error("Session unavailable")) : resolve()));
    req.session.farmAuth = {
      encryptedToken: seal(checked.token, checked.subject), subject: checked.subject,
      expiresAt: new Date(Math.min(checked.expiresAt, Date.now() + MAX_LIFETIME)).toISOString(), issuer,
    };
    try { await save(req); } catch { await clear(req); throw new Error("Session unavailable"); }
    return { user: checked.user, session: { id: checked.sessionId, expiresAt: req.session.farmAuth!.expiresAt } };
  }
  function sameOrigin(req: Request, magic: boolean) {
    if (magic) {
      // Email clients navigate cross-site. Only this single-use, fixed-callback GET
      // permits that; fetches/iframes are rejected when browser metadata is present.
      const mode = req.get("Sec-Fetch-Mode");
      const dest = req.get("Sec-Fetch-Dest");
      return (!mode || mode === "navigate") && (!dest || dest === "document");
    }
    if (req.get("Sec-Fetch-Site")?.toLowerCase() === "cross-site") return false;
    const requestOrigin = req.get("Origin");
    if (requestOrigin !== undefined) return requestOrigin === origin;
    const referer = req.get("Referer");
    if (referer) {
      try {
        const url = new URL(referer);
        return !url.username && !url.password && url.origin === origin;
      } catch { return false; }
    }
    return false;
  }
  function limited(req: Request, sending: boolean) {
    const now = Date.now();
    for (const [key, bucket] of Array.from(buckets.entries())) if (bucket.until <= now) buckets.delete(key);
    // Respect the app's explicit Express trust-proxy policy; its ingress must
    // sanitize forwarded headers. No caller IP headers are passed to the farm.
    const key = `${sending ? "send" : "login"}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 1024) return true;
      buckets.set(key, { count: 1, until: now + 60_000 });
      return false;
    }
    return ++bucket.count > (sending ? 3 : 10);
  }
  function failure(res: Response, status: number, message = "Farm authentication request failed") {
    return res.status(status).json({ message });
  }
  function mountFarmAuth(app: Express) {
    app.use(PREFIX, async (req, res) => {
      res.set("Cache-Control", "no-store");
      res.set("Referrer-Policy", "no-referrer");
      res.set("X-Content-Type-Options", "nosniff");
      const route = `${req.method} ${req.path}`;
      if (!PATHS.has(route)) return failure(res, 404, "Not found");
      const magic = route === "GET /magic-link/verify";
      const error = (status: number) => magic && origin ? res.redirect(302, `${origin}/login?error=farm_auth`) : failure(res, status);
      if (!enabled) return error(503);
      if (!sameOrigin(req, magic)) return error(403);
      if (route === "GET /ok") return res.json(getFarmAuthStatus());
      const queryIndex = req.originalUrl.indexOf("?");
      const query = new URLSearchParams(queryIndex < 0 ? "" : req.originalUrl.slice(queryIndex + 1));
      if (req.originalUrl.length > 4096 || (!magic && queryIndex >= 0)) return error(400);
      const isLogin = route.includes("/sign-in/") || route.includes("/email-otp/") || magic;
      if (isLogin && (!emailLoginEnabled || ((magic || route.endsWith("/magic-link")) && !magicLinkEnabled))) return error(403);
      if (isLogin && legacy(req)) return magic ? error(409) : failure(res, 409, "Log out of the existing account before farm sign-in");
      const sending = route === "POST /sign-in/magic-link" || route === "POST /email-otp/send-verification-otp";
      if (isLogin && limited(req, sending)) { res.set("Retry-After", "60"); return error(429); }
      try {
        if (route === "GET /get-session") return res.json(await readSession(req) || { user: null, session: null });
        if (route === "POST /sign-out") {
          if (!record(req.body) || Object.keys(req.body).length) return error(400);
          await signOutFarmAuth(req);
          return res.json({ success: true });
        }
        if (magic) {
          const entries = Array.from(query.entries());
          const token = query.get("token");
          if (entries.length !== 1 || entries[0][0] !== "token" || !token || !/^[A-Za-z0-9._~-]{16,512}$/.test(token)) return error(400);
          const fixed = new URLSearchParams({ token, callbackURL: `${origin}/profile`, errorCallbackURL: `${origin}/login` });
          const response = await upstream("/magic-link/verify", "GET", undefined, undefined, fixed);
          // Only the exact successful callback is accepted, never followed or forwarded.
          if (response.status !== 302 || response.headers.get("location") !== `${origin}/profile`) return error(401);
          const bearer = signedBearer(response.headers.get("set-auth-token"));
          if (!bearer) return error(401);
          await establish(req, bearer);
          return res.redirect(302, `${origin}/profile`);
        }
        const body = req.body;
        const allowed = route === "POST /sign-in/email-otp" ? ["email", "otp"] : sending && !route.endsWith("/magic-link") ? ["email", "type"] : ["email"];
        if (!record(body) || Object.keys(body).some((key) => !allowed.includes(key)) || !email(body.email)) return error(400);
        if (route === "POST /sign-in/email-otp") {
          if (typeof body.otp !== "string" || !/^\d{6}$/.test(body.otp)) return error(400);
          const response = await upstream("/sign-in/email-otp", "POST", { email: body.email, otp: body.otp });
          const token = signedBearer(response.headers.get("set-auth-token"));
          if (response.status !== 200 || !token) return error(401);
          return res.json(await establish(req, token, body.email));
        }
        const response = route === "POST /sign-in/magic-link"
          ? await upstream("/sign-in/magic-link", "POST", { email: body.email, callbackURL: `${origin}/profile`, errorCallbackURL: `${origin}/login` })
          : body.type === "sign-in" ? await upstream("/email-otp/send-verification-otp", "POST", { email: body.email, type: "sign-in" }) : null;
        if (!response) return error(400);
        if (response.status !== 200) return error(503);
        // Never reflect provider bodies, headers, cookies, tokens, or errors.
        return res.json({ success: true });
      } catch { return error(503); }
    });
  }
  return { getFarmAuthStatus, mountFarmAuth, getFarmAuthUser, signOutFarmAuth };
}

let defaultBridge: ReturnType<typeof createFarmAuthBridge> | undefined;
function bridge() { return defaultBridge ||= createFarmAuthBridge(process.env); }
export function getFarmAuthStatus() { return bridge().getFarmAuthStatus(); }
export function mountFarmAuth(app: Express) { bridge().mountFarmAuth(app); }
export function getFarmAuthUser(req: Request) { return bridge().getFarmAuthUser(req); }
export function signOutFarmAuth(req: Request) { return bridge().signOutFarmAuth(req); }
