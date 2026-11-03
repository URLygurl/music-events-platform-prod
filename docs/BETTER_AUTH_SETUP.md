# Better Auth + Resend: staged integration

Better Auth runs inside the existing Express app; Resend provides hosted email delivery. No separate auth service, dashboard server, Docker, or Railway-only dependency is required. Use Node.js 22+, PostgreSQL, the existing build/start commands, and an HTTPS app origin on any host.

## What is available now

Open **Admin → Authentication / Resend**, or `/admin/authentication`, using your existing admin login. The self-hosted dashboard shows configuration status and, after activation, recent Better Auth users and active sessions. It is read-only; no role editing, permission rules, account deletion, impersonation, or session mutations are exposed. Its Resend button opens Resend's hosted dashboard.

Existing username/email + password admin login remains unchanged. Better Auth's API is separate at `/api/better-auth`. Email login is hidden and rejected until explicitly enabled. Password hashes are omitted from `/api/auth/user`, and API response bodies are no longer logged.

## Server environment variables

Keep all secrets in your host's environment/secret manager, never in public site settings or Git.

| Variable | Purpose/default |
| --- | --- |
| `DATABASE_URL` | Existing PostgreSQL database connection. |
| `BETTER_AUTH_ENABLED` | `false` by default. Set `true` only after the auth schema is migrated and configuration is ready. |
| `BETTER_AUTH_SECRET` | Separate random secret, at least 32 characters. Do not reuse a sample or the legacy session secret. |
| `BETTER_AUTH_URL` | Exact HTTPS app origin, e.g. `https://nakedapp.up.railway.app`, with no path/query. Does not have to match the email sender domain. |
| `RESEND_API_KEY` | Resend sending API key; keep server-side. |
| `AUTH_EMAIL_FROM` | Bare sender address on your verified domain, e.g. `login@mail.example.com`. Not `resend.dev`. |
| `AUTH_EMAIL_DOMAIN_VERIFIED` | Default `false`. Set `true` only after verifying the sender domain in Resend. This flag records an operator check; it does not perform DNS verification. |
| `AUTH_EMAIL_LOGIN_ENABLED` | Default `false`. Keep false throughout setup/testing; set true only after real email delivery is verified. |
| `AUTH_TRUST_PROXY` | Default `false`. Set `true` only behind an enforced, trusted single-hop reverse proxy that sanitizes forwarding headers and prevents direct origin access. Otherwise new auth rate limits use the socket IP conservatively. |

For local development only, an HTTP localhost origin is permitted. Production requires HTTPS. Changing environment configuration requires a restart/redeployment. Missing keys, an invalid origin, or missing auth tables leaves Better Auth unavailable without replacing existing login.

Generate a secret locally with `openssl rand -base64 48`, then put the output directly in the host's secret manager. Do not paste it into chat or commit it.

## Safe activation sequence

1. Back up the correct production database and confirm the backup is usable. The attempted pre-integration Neon snapshot was refused because the snapshot limit was full; no existing backup was deleted. No live `app_auth` migration was applied during preparation.
2. Test on a disposable PostgreSQL database or separate Neon branch first. Set its `DATABASE_URL`, a separate `BETTER_AUTH_SECRET`, and its `BETTER_AUTH_URL`.
3. Run `npm run auth:migrate` to **preview** SQL. Confirm every table/index targets the separate `app_auth` schema. It creates Better Auth user, session, account, verification and rate-limit tables, never the content tables or managed `neon_auth` schema.
4. After review and backup, run `npm run auth:migrate -- --apply` on the intended database. This is an explicit operator action, **not** part of startup. Repeating it reports that storage is already current.
5. Set `BETTER_AUTH_ENABLED=true`, restart, and inspect `/admin/authentication`. Keep `AUTH_EMAIL_LOGIN_ENABLED=false` while waiting for Cory's domain.
6. Verify the sender domain's DNS records in Resend, configure the key/from address, and test actual delivery on staging. Mocked local tests do not establish inbox deliverability.
7. Only then set `AUTH_EMAIL_DOMAIN_VERIFIED=true` and `AUTH_EMAIL_LOGIN_ENABLED=true` and restart. `/login` will retain the old form and add magic-link and six-digit email-code options. Test on mobile and desktop; also recheck Cory's existing login.

The existing `start.sh` still pushes the content schema with Drizzle. Its configuration now explicitly filters to `public`, leaving `app_auth` alone. Review content schema changes independently; never run a push against the wrong database. On self-hosted production, use your own deployment migration process if preferred, then run `NODE_ENV=production node dist/index.js`.

## Identity and later roles

Existing users/passwords/roles are not migrated or linked by matching email. Better Auth sessions require verified email and currently expose a separate `better-auth:<id>` identity with only `user` access. Logging in through a link to an existing admin's email **does not** grant admin access; use existing admin login for the dashboard. Cross-system account linking, persistent app-profile/ownership mapping, and Better Auth roles/permissions are intentionally deferred and must be designed before exposing features that write user-owned records.

Magic links and codes expire after five minutes, are single use, use hashed verification storage, and have send/attempt limits. Email OTP is passwordless sign-in, not automatically two-factor authentication. Trust only the configured app origin for callbacks. Auth cookies use HttpOnly, Secure in production, and SameSite=Lax. No credentials or session tokens are exposed by the dashboard.

## Local validation

`npm run build` produces an ESM server at `dist/index.js` and frontend at `dist/public`. Local production-bundle tests covered old admin login, the protected dashboard endpoint, hidden email login, and missing-storage fail-safe behavior.

For repeatable passwordless tests, create/migrate a **disposable localhost** PostgreSQL database whose name ends in `_test`, then run:

```bash
AUTH_TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/DISPOSABLE_test \
  node --import tsx script/auth-smoke.test.ts
```

The script truncates only that test database's `app_auth` tables. It refuses remote hosts, mocks Resend network calls, and tests configuration gates, migration idempotence, magic-link/OTP sign-in and single-use behavior, hashed tokens, secure cookies, session/logout, callback rejection, and rate limiting. It sends no real emails.

Official references: [Better Auth Express](https://better-auth.com/docs/integrations/express), [PostgreSQL](https://better-auth.com/docs/adapters/postgresql), [Magic link](https://better-auth.com/docs/plugins/magic-link), [Email OTP](https://better-auth.com/docs/plugins/email-otp), [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).
