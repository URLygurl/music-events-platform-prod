import { betterAuth } from "better-auth";
import { magicLink, emailOTP } from "better-auth/plugins";
import { PostgresDialect } from "kysely";
import type { Pool } from "pg";
import { Resend } from "resend";

export type AuthEnvironment = Record<string, string | undefined>;

export function readAuthConfig(env: AuthEnvironment = process.env) {
  const secret = env.BETTER_AUTH_SECRET || "";
  const rawURL = env.BETTER_AUTH_URL || "";
  let baseURL = "";
  try {
    const url = new URL(rawURL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol === "https:" || (env.NODE_ENV !== "production" && local && url.protocol === "http:")) &&
        !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) {
      baseURL = url.origin;
    }
  } catch { /* Unconfigured integrations stay disabled. */ }
  const from = (env.AUTH_EMAIL_FROM || "").trim();
  const senderValid = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from) && !from.toLowerCase().endsWith("@resend.dev");
  const emailReady = !!env.RESEND_API_KEY && senderValid && env.AUTH_EMAIL_DOMAIN_VERIFIED === "true";
  return {
    requested: env.BETTER_AUTH_ENABLED === "true",
    configured: secret.length >= 32 && !!baseURL,
    secret,
    baseURL,
    from,
    emailReady,
    emailLoginRequested: env.AUTH_EMAIL_LOGIN_ENABLED === "true",
    emailLoginEnabled: env.AUTH_EMAIL_LOGIN_ENABLED === "true" && emailReady,
    resendConfigured: !!env.RESEND_API_KEY,
    senderConfigured: senderValid,
    domainVerified: env.AUTH_EMAIL_DOMAIN_VERIFIED === "true",
  };
}

// The existing app remains on Drizzle; Better Auth uses its native PostgreSQL
// adapter in a separate schema. No upgrades or changes to content tables needed.
export function createBetterAuth(pool: Pool, env: AuthEnvironment = process.env) {
  const config = readAuthConfig(env);
  if (!config.configured) throw new Error("Better Auth needs a 32+ character secret and a valid app origin.");
  const resend = config.resendConfigured ? new Resend(env.RESEND_API_KEY) : null;
  async function sendEmail(email: string, subject: string, text: string) {
    if (!config.emailLoginEnabled || !resend) throw new Error("Email sign-in is not enabled.");
    const { data, error } = await resend.emails.send({ from: config.from, to: email, subject, text });
    if (error || !data?.id) {
      // Never log provider responses: they may contain user addresses or tokens.
      throw new Error("Unable to send authentication email.");
    }
  }
  return betterAuth({
    appName: "Music Events Platform",
    baseURL: config.baseURL,
    basePath: "/api/better-auth",
    secret: config.secret,
    database: { dialect: new PostgresDialect({ pool }), type: "postgres", schemaName: "app_auth" },
    trustedOrigins: [config.baseURL],
    emailAndPassword: { enabled: false },
    socialProviders: {},
    account: { accountLinking: { enabled: false } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: {
      cookiePrefix: "mvt-better-auth",
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      // Our Express wrapper overwrites this header with the proxy-resolved IP.
      ipAddress: { ipAddressHeaders: ["x-mvt-auth-ip"] },
    },
    telemetry: { enabled: false },
    logger: { disabled: true },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/magic-link": { window: 60, max: 3 },
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 5 },
      },
    },
    plugins: [
      magicLink({
        expiresIn: 300,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          await sendEmail(email, "Your sign-in link", `Use this link to sign in:\n\n${url}\n\nIt expires in 5 minutes and can only be used once. If you did not request it, ignore this email.`);
        },
      }),
      emailOTP({
        expiresIn: 300,
        otpLength: 6,
        allowedAttempts: 3,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in") throw new Error("Only sign-in codes are enabled.");
          await sendEmail(email, "Your sign-in code", `Your sign-in code is ${otp}.\n\nIt expires in 5 minutes and can only be used once. If you did not request it, ignore this email.`);
        },
      }),
    ],
  });
}
