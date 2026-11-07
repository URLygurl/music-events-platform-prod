# Nakedapp → dedicated farm Better Auth

The farm runs Better Auth, its own PostgreSQL `app_auth` schema, Resend delivery and the `dash()` infrastructure plugin. Nakedapp keeps its content/profile data in Neon and its existing username/password login. No users or passwords are migrated or linked by matching email.

## Connection design

The browser calls Nakedapp at `/api/farm-auth`. Nakedapp calls the fixed farm endpoint using bearer authentication. After a successful login, it verifies the farm session and stores the bearer credential encrypted in its existing server-side session store. The browser receives only an HttpOnly Nakedapp session cookie. No bearer token is placed in localStorage, browser response JSON, URLs, public settings or the frontend bundle.

Farm identities use `farm-auth:<user-id>` with ordinary `user` access. Existing profile tables accept these separate identities without a migration. Profile user-type pills are not authorization grants. Existing admins must continue using their old login until explicit, reviewed account linking and role rules are implemented.

## Nakedapp server settings

Set these in Railway or your future host's server environment, not in public site settings:

```dotenv
FARM_AUTH_URL=https://pve.taild066b2.ts.net/nakedapp-auth
FARM_AUTH_APP_ORIGIN=https://nakedapp.up.railway.app
FARM_AUTH_ENABLED=true
FARM_AUTH_EMAIL_LOGIN_ENABLED=false
FARM_AUTH_MAGIC_LINK_ENABLED=false
BETTER_AUTH_ENABLED=false
```

`SESSION_SECRET` must be a strong, private random secret of at least 32 characters. The connector refuses configuration with a missing/short secret; the previous login is not replaced. The farm's `BETTER_AUTH_SECRET`, infrastructure API key, Resend key and Postgres password are **not** copied into Nakedapp.

`FARM_AUTH_URL` is the base URL above; Nakedapp appends `/api/better-auth` and an explicitly allowed endpoint. Production requires HTTPS. Redirects are not followed. Credentials are bound to the configured farm URL and user identity. Changing the farm URL or session secret invalidates existing bridge credentials; coordinate changes carefully.

Open **Admin → Authentication / Resend** (`/admin/authentication`) to inspect safe connector configuration flags and open Better Auth's hosted management dashboard. The in-app status page does not enumerate farm users and its flags are not a live health check or proof of email delivery. The optional in-app Better Auth tables/counters remain separate from the farm.

## Ferris: farm settings

- Keep `magicLink`, `emailOTP`, `dash()` and `bearer()` on the farm. Signed bearer tokens are preferred with `bearer({ requireSignature: true })`. Nakedapp treats the credential as opaque and verifies it with the farm's `/get-session` endpoint; it does not need the signing secret.
- Keep `https://nakedapp.up.railway.app` in `TRUSTED_ORIGINS`. If using browser-to-farm calls separately, restrict CORS to that exact origin, allow `Authorization`/`Content-Type` and relevant Sentinel headers, and expose `set-auth-token`. Nakedapp's connector uses server-to-server calls and does not rely on cross-site cookies.
- Ensure the configured app origin is permitted for `/profile` and `/login` callback URLs. The connector never accepts a user-supplied return destination.
- The farm must be publicly reachable over HTTPS from Nakedapp's hosting environment. The supplied health address is `https://pve.taild066b2.ts.net/nakedapp-auth/api/better-auth/ok`.
- Do not trust arbitrary client-supplied forwarding/IP headers. Proxying concentrates requests at Nakedapp's outgoing IP; review the farm's current per-IP rate limits before a public launch. Nakedapp adds its own per-client limits, but does not forward an untrusted browser IP header to defeat the farm's limits.

### Magic-link email routing — required before enabling links

A link that verifies directly on the farm cannot set a Nakedapp cookie. Ferris must rewrite the URL in the farm's `sendMagicLink` email callback so the email points to:

```text
https://nakedapp.up.railway.app/api/farm-auth/magic-link/verify?token=<verification-token>
```

Extract only the `token` from Better Auth's generated URL; use URL/URLSearchParams to encode it. Do not include a bearer/session token, arbitrary callback URLs or unrelated query values. Do not change the original generated token or consume it while sending the email. Nakedapp redeems it at the farm, captures the `set-auth-token` response header, verifies the resulting session, sets its own cookie and redirects to the fixed `/profile` page. Verification errors return to `/login?error=farm_auth`.

The link verification token is a short-lived, single-use email credential, not a session bearer token. Keep it out of access logs; the app logs paths without query strings and applies no-store/referrer safeguards. Review reverse-proxy logging on both hosts too. Test links in a fresh browser and reject reused/expired links.

Leave `FARM_AUTH_MAGIC_LINK_ENABLED=false` until this email change and end-to-end testing are complete. Email codes can be enabled first independently of magic links.

## Activation sequence

1. Deploy the dormant connector. Confirm existing login, admin access and profile functions remain unchanged.
2. Configure the Nakedapp server values above and restart. Keep both email flags false. Confirm connector readiness in the protected status page and check farm health from the app host.
3. Verify the Resend sending domain and actual delivery on the farm. Keep all sending credentials there. Until this is done, email signup/login remains off.
4. Enable the farm's email-login configuration and `FARM_AUTH_EMAIL_LOGIN_ENABLED=true` on Nakedapp, first in a controlled test environment. Leave magic links false initially. Test email-code signup → verified farm session → Nakedapp `/profile` → saved profile → logout. Recheck expired/revoked sessions and old admin login.
5. After Ferris configures the magic-link email URL, enable `FARM_AUTH_MAGIC_LINK_ENABLED=true` and repeat the fresh-browser, expiry and single-use tests for links.
6. Enable public signup only after the real delivery, account-isolation, administrator-access and session-lifecycle tests pass. The implementation's mock tests alone do not establish live inbox delivery or a successful production signup.

The local in-app Better Auth implementation remains available for the old staged design, but leave `BETTER_AUTH_ENABLED=false` when the dedicated farm service is authoritative. Do not activate both account stores unintentionally.

## Rollback and operational security

Set `FARM_AUTH_ENABLED=false` and restart to disable the bridge; existing admin login and Neon content remain available. This does not delete farm users, existing profiles or legacy accounts. Public email flows fail closed if the farm is unavailable. Farm sessions are checked remotely rather than trusted from cached browser claims. A farm ban/revocation is enforced on the next authenticated app request.

A separate auth deployment reduces shared secrets and failure scope, but cannot make a compromised app trustworthy. Protect both deployments, the server-side session database and backups. Keep tokens encrypted at rest, rotate secrets carefully, avoid credential logging, and maintain the farm and app independently. Do not build public signup around a development-only farm address without reviewing availability and operations.

Same-site production cookies would require **both** app and auth to use subdomains of the same registrable domain. Moving only auth to Cory's domain while leaving the app on `railway.app` does not make them same-site.

## Local validation

```bash
node --import tsx --test script/farm-auth-smoke.test.ts
npm run build
```

The 17 smoke tests use mocked farm responses and local in-memory sessions, not the production farm, Resend or Neon. They cover session fixation, encrypted credential storage, origin/redirect restrictions, disabled gates, expiry/revocation, unverified identities, token rotation, response limits and timeouts. Browser regression checks cover the gated login controls, profile routing, no localStorage bearer and mobile/desktop layout. A production-bundle smoke test confirms the existing admin login and protected dashboard remain available while the bridge is disabled. These are local checks, not a live deployment or inbox-delivery guarantee.

For the real Better Auth signed-bearer, OTP and magic-link integration test, explicitly select a disposable localhost database ending in `_test`, with the existing `app_auth` test schema already migrated:

```bash
AUTH_TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/DISPOSABLE_test \
  node --import tsx script/farm-auth-integration.test.ts
```

This test uses real Better Auth handlers but mocks email and farm transport. It creates and removes its own test user and never connects to production. Existing passwordless tests remain in `script/auth-smoke.test.ts` and also require an explicitly selected disposable local PostgreSQL test database.

References: [Bearer plugin](https://better-auth.com/docs/plugins/bearer), [Express integration](https://better-auth.com/docs/integrations/express), [Magic-link plugin](https://better-auth.com/docs/plugins/magic-link), [Infrastructure setup](https://better-auth.com/docs/infrastructure/getting-started).
