# Neon profile storage

The app uses its existing `DATABASE_URL`; no new database account or provider-specific SDK is needed.

| Table | Purpose |
| --- | --- |
| `public.user_profiles` | Display username, membership type, private avatar bytes/MIME and timestamps, keyed by authenticated user ID. |
| `public.user_favourites` | Account-owned product favourites, unique per account/product. |
| `public.user_tickets` | Tickets explicitly linked to an account by trusted fulfilment. |
| `public.orders.owner_user_id` | Nullable authenticated owner on new checkout orders. Existing orders are unchanged. |

`/api/profile` reads only the current account. Username saves and avatar uploads persist immediately through private authenticated endpoints. A profile username is separate from the existing login username. Membership types are display metadata, not admin/security roles; users cannot change them through profile edits. Email comes from the authenticated account; password hashes are never placed in profile data.

Signed-in shop hearts sync with the database. Guest favourites remain browser-local; the profile offers an explicit import button rather than silently claiming shared-device data. Avatars accept JPEG/PNG/WebP, limit files to 5 MB, validate MIME/signature and use private, no-store retrieval. Successful uploads have a short cooldown.

New Stripe/PayPal checkout records take ownership from the server session, never from a submitted user ID or email. Unowned historical orders are not automatically claimed. Purchase payment status continues to use the existing payment integration; this change does not redesign or certify payment fulfilment. The tickets section reads account-linked ticket rows; automatic ticket issuance/QR validation still needs its separate fulfilment integration.

Email/password change and reset controls remain disabled until a verified authentication/recovery flow is configured. No existing passwords, roles or admin login credentials are changed.

The additive migration is `migrations/20261106_user_profiles.sql`, also embedded in `server/profile.ts` for idempotent startup initialization. It creates only the new tables/indexes and adds the nullable order-owner column. Before this update, a new Neon safety snapshot was attempted but refused because the snapshot limit was full; no previous snapshots were deleted.

Local tests: `AUTH_TEST_DATABASE_URL` must point to a disposable localhost PostgreSQL database ending `_test`; `PROFILE_TEST_URL` must point to the local test app. Run `node --import tsx script/profile-smoke.test.ts`. The test creates/removes only its fixtures in that disposable database; never use production credentials.

For another HTTPS app origin, configure `PROFILE_ALLOWED_ORIGINS` as an exact comma-separated allowlist on the server. The live Railway origin is included when Better Auth's base URL is not yet configured. Do not use wildcard origins or expose DB owner/auth signing credentials in the browser.
