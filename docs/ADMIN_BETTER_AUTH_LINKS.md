# Existing admins through farm Better Auth

The app can explicitly map a verified farm OIDC subject to an existing Neon `users.id`. This preserves the original profile, purchases, username and current admin/superadmin role. Authentication passwords remain on the farm. Authorization remains in Neon. Roles are not accepted from OIDC claims, and matching email addresses never automatically grant admin access.

## Account setup — Ferris/operator

1. Ensure Cory/admin and Supervan have separate verified Better Auth accounts on the live farm, using the **same email address recorded on each existing Neon user**. If an account already exists, reuse it. Let each person create/reset their own farm password using Resend, or sign in with their verified Google account. Do not send passwords or copy Neon bcrypt hashes: these are different password systems. The normal farm password flow uses email, not the old username; display usernames remain unchanged in Nakedapp.
2. Obtain the stable farm `user.id` / OIDC `sub` and verified email for each account, confirming the value is the actual OIDC subject, not a session/account-provider ID. Do not delete/recreate identities or alter their verification status merely to bypass verification.
3. Obtain the original Neon `users.id`, email and role for the existing accounts (read-only query below). Explicitly confirm which is Cory/admin and which is Supervan/superadmin. Do not promote a newly created farm-only user or merge other farm profile records automatically.

```sql
SELECT id, username, email, role FROM public.users
WHERE role IN ('admin', 'superadmin')
ORDER BY role, username;
```

4. On **Nakedapp's existing deployment**, set `OIDC_ACCOUNT_LINKS` to a JSON array of these confirmed pairs:

```json
[
  {"subject":"CORY_FARM_OIDC_SUB","email":"CORY_EXISTING_NEON_EMAIL","userId":"CORY_ORIGINAL_NEON_USERS_ID"},
  {"subject":"SUPERVAN_FARM_OIDC_SUB","email":"SUPERVAN_EXISTING_NEON_EMAIL","userId":"SUPERVAN_ORIGINAL_NEON_USERS_ID"}
]
```

Use real confirmed values, not these placeholders. Keep the existing exact `OIDC_ISSUER` unchanged. IDs/emails are identity metadata, not passwords/API keys; the mapping is operator-managed server configuration, not a public editable site setting. No new shared farm secret is needed. Malformed/duplicate mappings fail closed. No mappings means existing behavior is unchanged. A linked account's email must match the verified farm email and current Neon email; changed email must be intentionally reconciled. Deleted Neon users cannot authenticate via the link. Roles are reread from Neon on each authenticated request, so demotions take effect immediately. Existing OIDC signature, issuer, nonce, PKCE and session lifetime checks stay intact.

## Test before hiding

Redeploy with the mappings while **leaving `LEGACY_LOGIN_HIDDEN` unset/false**. In private browser windows, test both accounts through **Sign in / Create account**. Confirm each profile is its original profile and each sees the expected admin tools; Supervan must retain superadmin-only access. Ordinary accounts must not see admin tools. Use logout or a fresh private window when switching from a legacy login: the bridge deliberately refuses to mix identities in one session.

Only after both pass, set `LEGACY_LOGIN_HIDDEN=true` and redeploy Nakedapp. `/login` then displays only farm sign-in when OIDC is enabled. The old form is still available at:

`https://nakedapp.up.railway.app/login?legacy=1`

The original `POST /api/login` and stored legacy credentials are unchanged. This is visual hiding, **not endpoint removal or security hardening**. Do not publish the recovery link in navigation. Bookmark it privately; to restore the visible form set `LEGACY_LOGIN_HIDDEN=false`. If farm OIDC is disabled, the legacy form is shown automatically. The recovery URL remains usable even if login-options loading fails.

No database migration, account deletion, farm redeployment or live email send is required by the app code changes. Live account setup and mapping activation are still required; local tests cannot prove each person's live Google/password login or email delivery.

## Checks

`node --import tsx --test script/oidc-account-links.test.ts` covers stable ID preservation, hash exclusion, current roles/demotion, no automatic email matching, issuer/email mismatch, missing users and invalid/duplicate configuration. The production build and mocked browser tests cover ordinary/hidden/recovery login states, error display and unchanged old login submission. Tests do not contact Neon or send email.
