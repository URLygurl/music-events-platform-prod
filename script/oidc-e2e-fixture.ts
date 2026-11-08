import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";

// Explicit local-only test DB and farm checkout; never infer production DATABASE_URL.
const raw = process.env.AUTH_TEST_DATABASE_URL;
if (!raw || !["localhost", "127.0.0.1"].includes(new URL(raw).hostname) || !new URL(raw).pathname.endsWith("_test")) throw new Error("Select an explicit disposable localhost AUTH_TEST_DATABASE_URL ending _test.");
const farmRepo = resolve(process.env.AUTH_FARM_REPO || "/home/ubuntu/nakedapp-auth");
const requireFarm = createRequire(resolve(farmRepo, "package.json"));
const { createFarmApp } = await import(pathToFileURL(resolve(farmRepo, "src/app.ts")).href);
const { getMigrations } = await import(pathToFileURL(requireFarm.resolve("better-auth/db/migration")).href);
const { registerFixedClient, requireLocalDatabase } = await import(pathToFileURL(resolve(farmRepo, "script/register-oidc-client.ts")).href);
requireLocalDatabase(raw, true);
const pool = new Pool({ connectionString: raw });
const wrapper = express();
const server = createServer(wrapper);
await new Promise<void>((resolve) => server.listen(4194, "127.0.0.1", resolve));
const farmRoot = "http://127.0.0.1:4194/nakedapp-auth";
const mail: { to: string; text: string; subject: string }[] = [];
const { app, auth, config } = createFarmApp({ pool, env: {
  NODE_ENV: "test", BETTER_AUTH_ENABLED: "true", BETTER_AUTH_SECRET: "disposable-farm-signing-secret-at-least-32-characters",
  AUTH_OIDC_ENABLED: "true", AUTH_PUBLIC_URL: farmRoot,
  AUTH_OIDC_CLIENT_ID: "nakedapp", AUTH_OIDC_REDIRECT_URI: "https://nakedapp.up.railway.app/api/auth/oidc/callback",
  TRUSTED_ORIGINS: "https://nakedapp.up.railway.app", RESEND_API_KEY: "mock-only",
  AUTH_EMAIL_FROM: "login@example.test", AUTH_EMAIL_DOMAIN_VERIFIED: "true", AUTH_EMAIL_LOGIN_ENABLED: "true",
}, dependencies: { sendEmail: async (message: { to: string; text: string; subject: string }) => { mail.push(message); } } });
await pool.query('CREATE SCHEMA IF NOT EXISTS "app_auth"');
const migration = await getMigrations(auth.options);
const sql = await migration.compileMigrations();
assert(!/\bDROP\b|\bTRUNCATE\b|"public"\./i.test(sql), "Only additive app_auth schema is allowed");
if (sql.replace(/;/g, "").trim()) await migration.runMigrations();
await registerFixedClient(pool, true);
assert.equal(await registerFixedClient(pool, true), "unchanged");
const realHandler = auth.handler;
auth.handler = async (request: Request) => {
  const response = await realHandler(request);
  if (new URL(request.url).pathname.endsWith("/oauth2/token") && response.ok) {
    const result = await response.clone().json();
    const claims = JSON.parse(Buffer.from(result.id_token.split(".")[1], "base64url").toString());
    console.log("Token-free ID-claim diagnostics", JSON.stringify({ keys: Object.keys(claims), emailPresent: !!claims.email,
      emailVerified: claims.email_verified, noncePresent: !!claims.nonce, issuerMatches: claims.iss === config.issuer, expiresInFuture: claims.exp * 1000 > Date.now() }));
  }
  return response;
};
// Model the real reverse proxy removing the public prefix exactly once.
wrapper.use((req, _res, next) => {
  if (req.url === "/nakedapp-auth" || req.url.startsWith("/nakedapp-auth/")) {
    req.url = req.url.slice("/nakedapp-auth".length) || "/";
    req.originalUrl = req.url;
  }
  next();
});
wrapper.get("/__test/mail", (_req, res) => res.json(mail)); // Mock fixture only; never present in deployed farm.
wrapper.use(app);
const metadata = await fetch(`${config.issuer}/.well-known/openid-configuration`).then(r => r.json());
assert.equal(metadata.issuer, config.issuer);
assert(metadata.authorization_endpoint.startsWith(config.issuer));
assert(metadata.jwks_uri.startsWith(config.issuer));
console.log("Local farm OIDC fixture ready; issuer", config.issuer, "(mocked email; disposable local DB only)");
async function close() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", close); process.on("SIGTERM", close);
