# Nakedapp + farm Better Auth: standard OIDC

## What runs where

Nakedapp redirects the browser to the farm's Better Auth login page. The farm handles signup, email codes, magic links, verification and consent; Resend delivers the emails. The app completes standard OpenID Connect authorization-code login with S256 PKCE, state, nonce and public-key signature verification. It keeps only a minimal verified identity in its own short session, not farm session, access, ID or refresh tokens. Neither browser localStorage nor a shared OAuth client secret is used.

Authentication accounts and private signing keys stay in farm Postgres. Profiles, favourites, purchases, tickets and content remain in Neon. Stable `farm-auth:<subject>` IDs keep the existing farm profile namespace; identities are never linked to legacy accounts by matching email, and new users always receive ordinary `user` access. User-type/permission management is a later task.

## Farm contract

The prepared farm work is in `URLygurl/nakedapp-auth` on the review branch `feature/nakedapp-oidc`; Ferris must review/deploy it. Existing farm `dev` and the running service are not automatically changed by the app deployment.

For the existing reverse-proxy address, the exact public URLs are:

```text
Farm public root: https://pve.taild066b2.ts.net/nakedapp-auth
Issuer: https://pve.taild066b2.ts.net/nakedapp-auth/api/better-auth
Discovery: https://pve.taild066b2.ts.net/nakedapp-auth/api/better-auth/.well-known/openid-configuration
App callback: https://nakedapp.up.railway.app/api/auth/oidc/callback
Client ID: nakedapp
Scopes: openid email profile
Client authentication: none (public client, mandatory S256 PKCE)
```

Only the exact Nakedapp callback is registered. No `offline_access`, automatic email account linking, dynamic public client registration or admin role assignment is enabled. Farm login and consent pages carry only the provider-signed authorization request. Magic links must be opened in the browser where Nakedapp sign-in started; the app's PKCE/state session is browser-bound.

Set on the **farm**, not Railway:

```dotenv
AUTH_OIDC_ENABLED=true
AUTH_PUBLIC_URL=https://pve.taild066b2.ts.net/nakedapp-auth
AUTH_OIDC_CLIENT_ID=nakedapp
AUTH_OIDC_REDIRECT_URI=https://nakedapp.up.railway.app/api/auth/oidc/callback
AUTH_EMAIL_DOMAIN_VERIFIED=false
AUTH_EMAIL_LOGIN_ENABLED=false
```

Keep the existing strong `BETTER_AUTH_SECRET`, farm `DATABASE_URL`, Better Auth dashboard API key, and Resend API key on the farm. Set `AUTH_EMAIL_FROM` to a real sender after Resend domain verification. Only then change both email flags to `true`. This slice implements passwordless signup/login; change-email and password reset are not implemented while email/password login is disabled.

The farm review branch includes hosted login assets, an additive preview-first auth migration and an idempotent fixed-client registration command. Use its `docs/FERRIS_OIDC_SETUP.md` for package versions, backup, build, proxy-prefix, migration and registration instructions. Never apply the farm migration through Nakedapp's Drizzle schema push. Back up farm Postgres first; no migration runs automatically on server startup.

## Nakedapp settings

The OIDC bridge is **off by default**. Set these server environment variables on Railway or the replacement app host after the farm is ready:

```dotenv
OIDC_ENABLED=false
OIDC_ISSUER=https://pve.taild066b2.ts.net/nakedapp-auth/api/better-auth
OIDC_CLIENT_ID=nakedapp
OIDC_APP_ORIGIN=https://nakedapp.up.railway.app
BETTER_AUTH_ENABLED=false
FARM_AUTH_ENABLED=false
FARM_AUTH_EMAIL_LOGIN_ENABLED=false
FARM_AUTH_MAGIC_LINK_ENABLED=false
```

The existing app `SESSION_SECRET` must be strong and at least 32 characters. This is an app cookie-signing secret, not a farm auth key. The app also still needs its existing Neon connection credentials. Do not copy farm DB credentials, private signing keys, Resend keys or dashboard keys into the app.

The client uses a normal full-page link to `/api/auth/oidc/start`. Its callback is handled by Express, then redirects to `/profile`. The existing `/api/auth/user`, profile, menu and legacy admin form remain usable. Selecting `OIDC_ENABLED=true` suppresses the old farm bearer relay and optional in-app passwordless API, even if the OIDC configuration is invalid. Existing legacy admin login remains active throughout the transition.

## Activation order

1. Ferris reviews the farm branch, backs up the auth DB, installs/builds the pinned packages, reviews/applies the additive `app_auth` migration and registers the exact public client.
2. Ferris confirms public HTTPS login/assets, prefix-safe discovery, issuer and JWKS are reachable, including outside the tailnet if the app is intended for public users. The reverse proxy must strip `/nakedapp-auth` exactly once; generated public URLs retain it.
3. Verify the Resend sender domain; enable the two farm email flags. The hosted login should then send codes/links without involving Nakedapp's email APIs.
4. Add the non-secret Nakedapp OIDC settings above, leaving `OIDC_ENABLED=false` until checks pass. Do not change existing admin credentials or migrate accounts.
5. Set `OIDC_ENABLED=true`, redeploy the app and test one new-user signup → email verification → consent → profile save/reload → logout. Use an isolated account/browser, not the existing admin session. Starting OIDC while signed in through a legacy account is refused rather than silently switching or inheriting permissions.
6. Inspect **Admin → Authentication / Resend**. Its flags describe app configuration, not a guarantee of live farm health or inbox delivery. The hosted Better Auth dashboard manages the farm and is not an authentication relay.

## Limits and rollback

An OIDC flow expires after five minutes. The verified app session lasts at most fifteen minutes and never outlives the accepted ID token. It is checked locally on every authenticated request; no farm refresh token is stored. Logging out clears Nakedapp's session but deliberately leaves the farm browser session signed in, so a later sign-in may reuse farm SSO. Farm logout/account switching is a separate feature, not claimed here. A farm revocation is not instantly reflected in an already-issued app session; its short expiry bounds that window.

This separates farm credentials from the app host. It does **not** protect Nakedapp data or authorization checks if its own runtime/served JavaScript/Neon credentials are compromised. App session IDs remain sensitive. Migration away from Railway is still needed to remove that hosting trust.

To roll back, set `OIDC_ENABLED=false`; legacy admin login and data remain unchanged. Keep the old bearer/in-app integrations disabled unless intentionally returning to those flows. No tables or user records need deleting. In multi-replica deployments, the shared session store and farm's single-use code checks are required; process-local rate limits are not a global abuse-control service. The app's trusted reverse proxy must sanitize forwarded IP headers.

## Local checks

```bash
node --import tsx --test script/oidc-auth-smoke.test.ts
npm run build
```

The smoke tests use real OIDC cryptography with mocked transport, not production. For full browser E2E, `script/oidc-e2e-fixture.ts` requires an explicit disposable localhost `AUTH_TEST_DATABASE_URL` ending in `_test` and a local farm checkout supplied by `AUTH_FARM_REPO`. It mocks Resend and models the prefix-stripping proxy. `script/oidc-e2e-browser.py` intercepts the production-looking Nakedapp hostname and forwards it only to the separate local test app on port 4195; it blocks other external requests. Never run either fixture against production data.

References: [Better Auth OAuth/OIDC provider](https://better-auth.com/docs/plugins/oauth-provider), [openid-client](https://github.com/panva/openid-client), [Better Auth Infrastructure](https://better-auth.com/docs/infrastructure/getting-started).

## Verified-email resolution and acceptance

The farm emits minimal ID tokens without email/profile claims. Nakedapp first verifies the signed ID token, then, if needed, calls the fixed same-provider UserInfo endpoint with the transient scoped access token. It requires the exact ID-token subject, valid email and boolean `email_verified=true`; the token is never saved, sent to the browser or used as a farm root-session credential. Some credential material necessarily passes transiently through the app's code exchange/UserInfo calls; no static farm key or long-lived farm session is copied there.

Local acceptance passed: 26 app OIDC/security tests, five farm provider tests, mobile/desktop login/dashboard checks, actual existing-superadmin login with OIDC selected, and real email-code plus magic-link signup → verification → consent → profile save/reload → local logout against separate disposable databases with Resend mocked. The test proxy uses HTTPS ingress headers and intercepts redirects; DNS is restricted to loopback so browser requests cannot leave localhost.
