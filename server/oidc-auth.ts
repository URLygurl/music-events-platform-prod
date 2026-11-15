import type { Express, Request, Response } from "express";
import type {} from "express-session";
import * as oidc from "openid-client";

/** The issuer is an explicit full farm issuer, not a farm host or discovery URL. */
type Environment = Readonly<Record<string, string | undefined>>;
type Fetch = typeof globalThis.fetch;
interface OidcUser {
  id: string;
  email: string;
  emailVerified: true;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: "user";
}
interface OidcIdentity {
  issuer: string;
  subject: string;
  expiresAt: string;
  user: OidcUser;
}
interface OidcFlow {
  issuer: string;
  state: string;
  nonce: string;
  verifier: string;
  expiresAt: number;
}
declare module "express-session" {
  interface SessionData {
    oidcAuth?: OidcIdentity;
    oidcFlow?: OidcFlow;
  }
}

const PREFIX = "/api/auth/oidc";
const FLOW_TTL = 5 * 60_000;
const USER_TTL = 15 * 60_000;
const TIMEOUT = 4000;
const MAX_BODY = 64 * 1024;
const ASYMMETRIC_ALGS = ["RS256", "ES256", "PS256", "EdDSA", "Ed25519", "ES384", "PS384", "RS384", "ES512", "PS512", "RS512"];
const EMAIL = /^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/;
function text(value: unknown, max = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function configuredURL(value: unknown, localTest: boolean, originOnly = false): URL | null {
  if (!text(value, 2048) || /[?#\\\s%]/.test(value)) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== "https:" && !(localTest && local && url.protocol === "http:"))) return null;
    if (originOnly ? value !== url.origin : value !== url.href) return null;
    if (url.pathname.includes("//")) return null;
    return url;
  } catch { return null; }
}
function optionalName(value: unknown): string | null {
  return text(value, 200) ? value : null;
}
function safeImage(value: unknown): string | null {
  // Images are never fetched by the bridge. No data/javascript/HTTP URLs.
  return configuredURL(value, false)?.href || null;
}
function save(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) return reject(new Error("Session unavailable"));
    req.session.save((error) => error ? reject(new Error("Session unavailable")) : resolve());
  });
}
function regenerate(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(new Error("Session unavailable")) : resolve()));
}
function reload(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.reload((error) => error ? reject(new Error("Session unavailable")) : resolve()));
}
function conflict(req: Request): boolean {
  // Never inherit a legacy database role or silently email-link another account.
  const existing = req.session as (typeof req.session & { userId?: string; farmAuth?: unknown }) | undefined;
  return !!(existing?.userId || existing?.farmAuth);
}
function navigation(req: Request): boolean {
  const mode = req.get("Sec-Fetch-Mode");
  const dest = req.get("Sec-Fetch-Dest");
  return mode === undefined && dest === undefined || mode === "navigate" && dest === "document";
}

/**
 * Mount after express-session. No discovery at import, creation, mount, or status.
 * Only local short-lived identity is retained; no access/ID/refresh/root tokens.
 * Public client authentication is explicitly None. Fetch injection is transport
 * only: discovery, token validation, and JWKS signature verification remain real.
 */
export function createOidcAuthBridge(env: Environment, fetchImpl: Fetch = globalThis.fetch) {
  // HTTP is restricted to explicit test mode and literal loopback hosts.
  const localTest = env.NODE_ENV === "test";
  const issuerURL = configuredURL(env.OIDC_ISSUER, localTest);
  const appURL = configuredURL(env.OIDC_APP_ORIGIN, localTest, true);
  const clientId = text(env.OIDC_CLIENT_ID, 256) && !/\s/.test(env.OIDC_CLIENT_ID) ? env.OIDC_CLIENT_ID : null;
  const configured = !!issuerURL && issuerURL.pathname !== "/" && !issuerURL.pathname.includes("/.well-known/") && !!appURL && !!clientId && !!env.SESSION_SECRET && env.SESSION_SECRET.length >= 32;
  const enabled = env.OIDC_ENABLED === "true" && configured;
  const issuer = issuerURL?.href || "";
  const origin = appURL?.origin || "";
  const callback = `${origin}${PREFIX}/callback`;
  const discoveryURL = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const farmPrefix = `${issuerURL?.pathname.replace(/\/$/, "") || ""}/`;
  const outbound = new Map<string, string>([[discoveryURL, "GET"]]);
  const buckets = new Map<string, { count: number; until: number }>();
  // Atomic within this process, including concurrent callbacks with stale session
  // snapshots. Across replicas the provider must also enforce single-use codes;
  // session-store consumption is saved before any token request.
  const consumed = new Map<string, number>();
  const activeSessions = new Set<string>();
  const cancelledSessions = new Set<string>();
  let configuration: oidc.Configuration | undefined;
  let initializing: Promise<oidc.Configuration> | undefined;
  let retryAt = 0;
  let unavailable = false;

  function getOidcAuthStatus() {
    return {
      enabled, configured, ready: enabled && !!configuration && !unavailable,
      reason: !configured ? "OIDC authentication configuration required" : !enabled ? "OIDC authentication disabled" : unavailable ? "OIDC authentication temporarily unavailable" : configuration ? "OIDC authentication ready" : "OIDC authentication enabled; provider not checked",
    };
  }
  function providerEndpoint(value: unknown): value is string {
    const url = configuredURL(value, localTest);
    return !!url && url.origin === issuerURL?.origin && url.pathname.startsWith(farmPrefix);
  }
  const boundedFetch: oidc.CustomFetch = async (url, options) => {
    if (!enabled || outbound.get(url) !== options.method || !providerEndpoint(url)) throw new Error("Provider unavailable");
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Provider unavailable")); }, TIMEOUT);
    });
    try {
      return await Promise.race([deadline, (async () => {
        // Build a fresh allowlist; never copy browser headers/cookies/secrets.
        // Only UserInfo may receive the short-lived scoped access token supplied
        // by openid-client, never a farm root-session bearer or incoming header.
        const headers = new Headers({ Accept: "application/json" });
        const contentType = new Headers(options.headers).get("content-type");
        if (contentType) headers.set("Content-Type", contentType);
        const authorization = new Headers(options.headers).get("authorization");
        if (url === configuration?.serverMetadata().userinfo_endpoint && options.method === "GET") {
          if (!authorization || !/^Bearer [A-Za-z0-9._~+\/=\-]{1,8192}$/.test(authorization)) throw new Error("Provider unavailable");
          headers.set("Authorization", authorization);
        }
        const response = await fetchImpl(url, {
          method: options.method, headers, body: options.body,
          credentials: "omit", redirect: "manual", signal,
        });
        if (response.redirected || (response.url && response.url !== url) || response.status >= 300 && response.status < 400 || Number(response.headers.get("content-length")) > MAX_BODY) {
          void response.body?.cancel().catch(() => {});
          throw new Error("Provider unavailable");
        }
        reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (reader) {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > MAX_BODY) throw new Error("Provider unavailable");
            chunks.push(chunk.value);
          }
        }
        // No upstream Set-Cookie or token headers can escape this transport.
        return new globalThis.Response(Buffer.concat(chunks), {
          status: response.status,
          headers: { "Content-Type": response.headers.get("content-type") || "application/octet-stream" },
        });
      })()]);
    } catch { unavailable = true; throw new Error("Provider unavailable"); }
    finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      if (reader) void reader.cancel().catch(() => {});
    }
  };
  async function initialize(): Promise<oidc.Configuration> {
    if (!enabled) throw new Error("Provider unavailable");
    if (configuration) return configuration;
    if (initializing) return initializing;
    if (retryAt > Date.now()) throw new Error("Provider unavailable");
    initializing = (async () => {
      const discovered = await oidc.discovery(issuerURL!, clientId!, { [oidc.clockTolerance]: 0 }, oidc.None(), {
        [oidc.customFetch]: boundedFetch, timeout: TIMEOUT / 1000,
        execute: localTest ? [oidc.allowInsecureRequests] : [],
      });
      const metadata = discovered.serverMetadata();
      if (metadata.issuer !== issuer) throw new Error("Provider unavailable");
      for (const [key, value] of Object.entries(metadata)) {
        if ((key.endsWith("_endpoint") || key === "jwks_uri") && value !== undefined && !providerEndpoint(value)) throw new Error("Provider unavailable");
      }
      if (metadata.mtls_endpoint_aliases) {
        for (const value of Object.values(metadata.mtls_endpoint_aliases)) if (!providerEndpoint(value)) throw new Error("Provider unavailable");
      }
      if (!providerEndpoint(metadata.authorization_endpoint) || !providerEndpoint(metadata.token_endpoint) || !providerEndpoint(metadata.jwks_uri)) throw new Error("Provider unavailable");
      const algorithms = ASYMMETRIC_ALGS.filter((alg) => metadata.id_token_signing_alg_values_supported?.includes(alg));
      if (!algorithms.length || !metadata.response_types_supported?.includes("code") ||
          metadata.code_challenge_methods_supported && !metadata.code_challenge_methods_supported.includes("S256") ||
          metadata.token_endpoint_auth_methods_supported && !metadata.token_endpoint_auth_methods_supported.includes("none")) throw new Error("Provider unavailable");
      // Rebuild from only relevant validated metadata; no provider-supplied
      // alternate endpoints, dynamic registration, or algorithm downgrades.
      const config = new oidc.Configuration({
        issuer, authorization_endpoint: metadata.authorization_endpoint,
        token_endpoint: metadata.token_endpoint, jwks_uri: metadata.jwks_uri,
        ...(metadata.userinfo_endpoint ? { userinfo_endpoint: metadata.userinfo_endpoint } : {}),
        id_token_signing_alg_values_supported: algorithms,
        authorization_response_iss_parameter_supported: metadata.authorization_response_iss_parameter_supported === true,
      }, clientId!, { [oidc.clockTolerance]: 0 }, oidc.None());
      config[oidc.customFetch] = boundedFetch;
      config.timeout = TIMEOUT / 1000;
      if (localTest) oidc.allowInsecureRequests(config);
      // Code-flow ID tokens require this explicit opt-in for JWKS signature
      // verification in openid-client 6 (TLS/claim checks alone are insufficient).
      oidc.enableNonRepudiationChecks(config);
      outbound.set(metadata.token_endpoint, "POST");
      outbound.set(metadata.jwks_uri, "GET");
      if (metadata.userinfo_endpoint) outbound.set(metadata.userinfo_endpoint, "GET");
      configuration = config;
      unavailable = false;
      return config;
    })();
    try { return await initializing; }
    catch { unavailable = true; retryAt = Date.now() + 10_000; throw new Error("Provider unavailable"); }
    finally { initializing = undefined; }
  }
  async function clearIdentity(req: Request) {
    if (!req.session?.oidcAuth) return;
    delete req.session.oidcAuth;
    await save(req).catch(() => {});
  }
  async function getOidcAuthUser(req: Request) {
    if (req.session?.oidcFlow && (!enabled || req.session.oidcFlow.issuer !== issuer || req.session.oidcFlow.expiresAt <= Date.now())) {
      delete req.session.oidcFlow;
      await save(req).catch(() => {});
    }
    const identity = req.session?.oidcAuth;
    if (!identity) return null;
    const expiry = record(identity) && typeof identity.expiresAt === "string" ? Date.parse(identity.expiresAt) : NaN;
    if (!enabled || conflict(req) || identity.issuer !== issuer || !text(identity.subject) || !Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + USER_TTL ||
        !record(identity.user) || identity.user.id !== `farm-auth:${identity.subject}` || !text(identity.user.email, 254) || !EMAIL.test(identity.user.email) || identity.user.emailVerified !== true || identity.user.role !== "user") {
      await clearIdentity(req);
      return null;
    }
    // Reconstruct an allowlist even when reading a server-side session. Local
    // TTL is checked on every request; this function never contacts/refreshes OP.
    return {
      id: `farm-auth:${identity.subject}`, email: identity.user.email, emailVerified: true as const,
      firstName: optionalName(identity.user.firstName), lastName: optionalName(identity.user.lastName),
      profileImageUrl: safeImage(identity.user.profileImageUrl), role: "user" as const,
      username: null, createdAt: null, updatedAt: null,
    };
  }
  /** Local logout only. The farm browser session remains logged in; no OP logout token is stored. */
  async function signOutOidcAuth(req: Request) {
    if (!req.session) return;
    if (activeSessions.has(req.sessionID)) cancelledSessions.add(req.sessionID);
    const flow = req.session.oidcFlow;
    if (flow && text(flow.state) && flow.expiresAt > Date.now() && consumed.size < 2048) consumed.set(flow.state, flow.expiresAt);
    delete req.session.oidcFlow;
    delete req.session.oidcAuth;
    await save(req);
  }
  function limited(req: Request, start: boolean): boolean {
    const now = Date.now();
    for (const [key, bucket] of Array.from(buckets.entries())) if (bucket.until <= now) buckets.delete(key);
    for (const [state, until] of Array.from(consumed.entries())) if (until <= now) consumed.delete(state);
    // Uses the application's explicit trust-proxy policy. Ingress must sanitize
    // forwarded IP headers; none of them are ever forwarded to the farm.
    const key = `${start ? "start" : "callback"}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 2048) return true;
      buckets.set(key, { count: 1, until: now + 60_000 });
      return false;
    }
    return ++bucket.count > (start ? 10 : 20);
  }
  function jsonFailure(res: Response, status: number) {
    return res.status(status).json({ message: status === 409 ? "Log out of the existing account before OIDC sign-in" : "OIDC sign-in unavailable or unsuccessful" });
  }
  function mountOidcAuth(app: Express) {
    app.use(PREFIX, async (req, res) => {
      res.set("Cache-Control", "no-store");
      res.set("Referrer-Policy", "no-referrer");
      res.set("X-Content-Type-Options", "nosniff");
      const failure = (response: Response, status: number) => {
        // Browser errors go only to a compile-time fixed path on the configured
        // app origin, never an upstream error URI or caller-provided redirect.
        if (origin && req.method === "GET" && req.path === "/callback" && req.get("Sec-Fetch-Mode") === "navigate" && req.get("Sec-Fetch-Dest") === "document") {
          return response.redirect(302, `${origin}/login?error=oidc_auth`);
        }
        return jsonFailure(response, status);
      };
      const start = req.path === "/start";
      if (req.method !== "GET" || !start && req.path !== "/callback") return failure(res, 404);
      if (!enabled) return failure(res, 503);
      if (!navigation(req)) return failure(res, 403);
      if (start) {
        if (req.get("Sec-Fetch-Site") === "cross-site" || req.get("Origin") !== undefined && req.get("Origin") !== origin) return failure(res, 403);
        if (req.get("Referer")) {
          try { if (new URL(req.get("Referer")!).origin !== origin) return failure(res, 403); }
          catch { return failure(res, 403); }
        }
      }
      if (conflict(req)) return failure(res, 409);
      if (!req.session) return failure(res, 503);
      if (limited(req, start)) { res.set("Retry-After", "60"); return failure(res, 429); }
      const index = req.originalUrl.indexOf("?");
      const raw = index < 0 ? "" : req.originalUrl.slice(index + 1);
      if (req.originalUrl.length > 4096 || /%(?![0-9a-f]{2})/i.test(raw) || start && index >= 0) return failure(res, 400);
      const query = new URLSearchParams(raw);
      const entries = Array.from(query.entries());
      const allowed = ["code", "state", "iss", "error", "error_description", "error_uri"];
      if (!start && (entries.some(([key, value]) => !allowed.includes(key) || !text(value, key === "error_description" || key === "error_uri" ? 2048 : 1024)) || new Set(entries.map(([key]) => key)).size !== entries.length)) return failure(res, 400);
      const sessionId = req.sessionID;
      if (activeSessions.has(sessionId)) return failure(res, 409);
      activeSessions.add(sessionId);
      try {
        if (start) {
          const config = await initialize();
          // A session saved by a concurrent legacy login remains authoritative.
          // Unsaved initial sessions need no reload, and cannot contain identity.
          const stored = await new Promise<unknown>((resolve, reject) => req.sessionStore.get(sessionId, (error, data) => error ? reject(new Error("Session unavailable")) : resolve(data)));
          if (stored) await reload(req);
          if (conflict(req)) return failure(res, 409);
          if (cancelledSessions.has(sessionId)) return failure(res, 401);
          const verifier = oidc.randomPKCECodeVerifier();
          const state = oidc.randomState();
          const nonce = oidc.randomNonce();
          const challenge = await oidc.calculatePKCECodeChallenge(verifier);
          await regenerate(req);
          req.session.oidcFlow = { issuer, state, nonce, verifier, expiresAt: Date.now() + FLOW_TTL };
          req.session.cookie.maxAge = FLOW_TTL;
          await save(req);
          const authorization = oidc.buildAuthorizationUrl(config, {
            response_type: "code", response_mode: "query", scope: "openid email profile",
            redirect_uri: callback, code_challenge_method: "S256", code_challenge: challenge, state, nonce,
          });
          return res.redirect(302, authorization.href);
        }
        // Reload before claiming; never rely on a stale Express session snapshot.
        await reload(req);
        if (conflict(req)) return failure(res, 409);
        const flow = req.session.oidcFlow;
        if (!flow || flow.issuer !== issuer || !text(flow.state) || !text(flow.nonce) || !text(flow.verifier) || !Number.isFinite(flow.expiresAt) || flow.expiresAt <= Date.now() || flow.expiresAt > Date.now() + FLOW_TTL) {
          delete req.session.oidcFlow;
          await save(req);
          return failure(res, 401);
        }
        if (query.get("state") !== flow.state || consumed.has(flow.state)) return failure(res, 401);
        if (consumed.size >= 2048) return failure(res, 429);
        consumed.set(flow.state, flow.expiresAt);
        delete req.session.oidcFlow;
        await save(req); // Single-use even on OP errors, timeouts, and failed validation.
        if (query.has("iss") && query.get("iss") !== issuer || query.has("error") || !query.has("code") || query.has("error_description") || query.has("error_uri")) return failure(res, 401);
        const config = await initialize();
        const url = new URL(callback); // Never use Host, forwarded host, or incoming origin.
        url.search = query.toString();
        const tokens = await oidc.authorizationCodeGrant(config, url, {
          expectedState: flow.state, expectedNonce: flow.nonce, pkceCodeVerifier: flow.verifier, idTokenExpected: true,
        });
        const claims = tokens.claims(); // Already library-validated and JWKS signature-verified.
        if (!tokens.id_token || !claims || claims.iss !== issuer || !text(claims.sub) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) return failure(res, 401);
        if (claims.email_verified !== undefined && claims.email_verified !== true) return failure(res, 401);
        let profile: Record<string, unknown> = claims;
        // Standard ID tokens may omit email/profile claims; Better Auth does.
        // Resolve them from the fixed provider, requiring the exact verified sub.
        if (claims.email === undefined || claims.email_verified === undefined) {
          if (!config.serverMetadata().userinfo_endpoint || !text(tokens.access_token, 8192)) return failure(res, 401);
          profile = await oidc.fetchUserInfo(config, tokens.access_token, claims.sub);
          if (profile.sub !== claims.sub || claims.email !== undefined && claims.email !== profile.email) return failure(res, 401);
        }
        if (!text(profile.email, 254) || !EMAIL.test(profile.email) || profile.email_verified !== true) return failure(res, 401);
        const user: OidcUser = {
          id: `farm-auth:${claims.sub}`, email: profile.email, emailVerified: true,
          firstName: optionalName(profile.given_name) || optionalName(profile.name), lastName: optionalName(profile.family_name),
          profileImageUrl: safeImage(profile.picture), role: "user",
        };
        await reload(req);
        if (conflict(req)) return failure(res, 409);
        if (cancelledSessions.has(sessionId)) return failure(res, 401);
        const expiresAt = Math.min(claims.exp * 1000, Date.now() + USER_TTL);
        if (expiresAt <= Date.now()) return failure(res, 401);
        await regenerate(req); // No pre-login SID or unrelated session identity survives.
        req.session.oidcAuth = { issuer, subject: claims.sub, expiresAt: new Date(expiresAt).toISOString(), user };
        req.session.cookie.maxAge = expiresAt - Date.now();
        try { await save(req); }
        catch { delete req.session.oidcAuth; throw new Error("Session unavailable"); }
        unavailable = false;
        return res.redirect(302, `${origin}/profile`);
      } catch { return failure(res, 503); }
      finally { activeSessions.delete(sessionId); cancelledSessions.delete(sessionId); }
    });
  }
  return { mountOidcAuth, getOidcAuthStatus, getOidcAuthUser, signOutOidcAuth };
}

let defaultBridge: ReturnType<typeof createOidcAuthBridge> | undefined;
function bridge() { return defaultBridge ||= createOidcAuthBridge(process.env); }
export function mountOidcAuth(app: Express) { bridge().mountOidcAuth(app); }
export function getOidcAuthStatus() { return bridge().getOidcAuthStatus(); }
export function getOidcAuthUser(req: Request) { return bridge().getOidcAuthUser(req); }
export function signOutOidcAuth(req: Request) { return bridge().signOutOidcAuth(req); }
