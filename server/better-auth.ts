import type { Express, Request } from "express";
import { Pool } from "pg";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { createBetterAuth, readAuthConfig } from "./better-auth-config";
import { getFarmAuthStatus } from "./farm-auth";
import { getOidcAuthStatus } from "./oidc-auth";

const config = readAuthConfig();
let instance: ReturnType<typeof createBetterAuth> | null = null;
let authPool: Pool | null = null;
let reason = config.requested ? "Configuration required" : "Disabled until configuration is ready";

export async function initializeBetterAuth() {
  if (process.env.OIDC_ENABLED === "true") {
    reason = "In-app authentication disabled; the farm handles OIDC login";
    return;
  }
  if (!config.requested) return;
  if (!config.configured) return;
  const candidatePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 });
  try {
    const { rows } = await candidatePool.query(`SELECT
      to_regclass('app_auth.user') IS NOT NULL AND
      to_regclass('app_auth.session') IS NOT NULL AND
      to_regclass('app_auth.account') IS NOT NULL AND
      to_regclass('app_auth.verification') IS NOT NULL AND
      to_regclass('app_auth."rateLimit"') IS NOT NULL AS ready`);
    if (!rows[0]?.ready) {
      reason = "Auth storage migration required; existing login is unaffected";
      await candidatePool.end();
      return;
    }
    instance = createBetterAuth(candidatePool);
    await instance.$context;
    authPool = candidatePool;
    reason = config.emailLoginEnabled ? "Email login enabled" : "Prepared; public email login disabled";
  } catch {
    instance = null;
    reason = "Auth unavailable; existing login remains active";
    await candidatePool.end().catch(() => {});
  }
}

export function getAuthStatus() {
  return {
    enabled: !!instance,
    configured: config.configured,
    requested: config.requested,
    emailLoginEnabled: !!instance && config.emailLoginEnabled,
    resendConfigured: config.resendConfigured,
    senderConfigured: config.senderConfigured,
    domainVerified: config.domainVerified,
    reason,
  };
}

// Mount BEFORE express.json(). Restrict the new API to the agreed MVP scope;
// password/role-management and all unused plugin endpoints stay inaccessible.
export function mountBetterAuth(app: Express) {
  app.get("/api/login-options", (_req, res) => {
    const farm = getFarmAuthStatus();
    const oidc = getOidcAuthStatus();
    const oidcSelected = process.env.OIDC_ENABLED === "true";
    res.set("Cache-Control", "no-store").json({
      emailLoginEnabled: !oidcSelected && !farm.enabled && getAuthStatus().emailLoginEnabled,
      farmEmailLoginEnabled: !oidcSelected && farm.emailLoginEnabled,
      farmMagicLinkEnabled: !oidcSelected && farm.magicLinkEnabled,
      oidcLoginEnabled: oidc.enabled,
    });
  });
  app.all("/api/better-auth/{*path}", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (process.env.OIDC_ENABLED === "true") return res.status(503).json({ message: "Use the secure farm login page." });
    if (!instance) return res.status(503).json({ message: "Email sign-in is not enabled yet." });
    const relative = req.path.slice("/api/better-auth".length);
    const route = `${req.method} ${relative}`;
    const allowed = ["GET /ok", "GET /get-session", "POST /sign-out"];
    if (config.emailLoginEnabled) {
      allowed.push("POST /sign-in/magic-link", "GET /magic-link/verify", "POST /email-otp/send-verification-otp", "POST /sign-in/email-otp");
    }
    if (!allowed.includes(route)) return res.status(403).json({ message: "This authentication action is not enabled." });
    // Prevent a caller-supplied header from bypassing per-IP limits. Express's
    // one-hop proxy setting is used only with explicit deployment opt-in.
    // On a directly exposed server, forwarded headers are never trusted.
    req.headers["x-mvt-auth-ip"] = (process.env.AUTH_TRUST_PROXY === "true" ? req.ip : req.socket.remoteAddress) || "unknown";
    try {
      return await toNodeHandler(instance)(req, res);
    } catch { return next(new Error("Authentication request failed.")); }
  });
}

export async function getBetterAuthUser(req: Request) {
  if (!instance) return null;
  try {
    const session = await instance.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user || !session.user.emailVerified) return null;
    // No linking by email, no migration of existing passwords, and no privilege
    // inheritance. Better Auth roles/permissions will be designed separately.
    return {
      id: `better-auth:${session.user.id}`,
      email: session.user.email,
      firstName: session.user.name,
      lastName: null,
      profileImageUrl: session.user.image || null,
      role: "user",
      username: null,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    };
  } catch { return null; }
}

export async function getAuthDashboard() {
  const status = getAuthStatus();
  const farm = process.env.OIDC_ENABLED === "true"
    ? { ...getFarmAuthStatus(), enabled: false, emailLoginEnabled: false, magicLinkEnabled: false, reason: "Legacy relay disabled by OIDC selection" }
    : getFarmAuthStatus();
  const oidc = getOidcAuthStatus();
  if (!authPool || !instance) return { status, farm, oidc, counts: { users: 0, activeSessions: 0 }, users: [], sessions: [] };
  const [counts, users, sessions] = await Promise.all([
    authPool.query(`SELECT (SELECT count(*)::int FROM app_auth."user") AS users,
      (SELECT count(*)::int FROM app_auth."session" WHERE "expiresAt" > now()) AS "activeSessions"`),
    authPool.query(`SELECT id, name, email, "emailVerified", "createdAt" FROM app_auth."user" ORDER BY "createdAt" DESC LIMIT 50`),
    authPool.query(`SELECT id, "userId", "createdAt", "expiresAt" FROM app_auth."session" WHERE "expiresAt" > now() ORDER BY "createdAt" DESC LIMIT 50`),
  ]);
  return { status, farm, oidc, counts: counts.rows[0], users: users.rows, sessions: sessions.rows };
}

export async function signOutBetterAuth(req: Request, res: import("express").Response) {
  if (!instance) return;
  try {
    const response = await instance.api.signOut({ headers: fromNodeHeaders(req.headers), asResponse: true });
    for (const cookie of response.headers.getSetCookie()) res.append("Set-Cookie", cookie);
  } catch {
    // Even if storage is unavailable, remove our browser cookies. Never touch
    // cookies belonging to the legacy login or another hosted authentication app.
    for (const entry of (req.headers.cookie || "").split(";")) {
      const name = entry.split("=")[0].trim();
      if (name.startsWith("mvt-better-auth.") || name.startsWith("__Secure-mvt-better-auth.")) {
        res.clearCookie(name, { path: "/", secure: process.env.NODE_ENV === "production", httpOnly: true, sameSite: "lax" });
      }
    }
  }
}
