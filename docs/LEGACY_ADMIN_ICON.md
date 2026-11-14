# Legacy admin login

When OIDC is enabled, the public login page shows the farm login only. The old username/password form is hidden, not deleted.

Use the small shield icon in the title strip to open `/login?legacy=1`. It opens the existing admin login directly. The server still validates the existing username/password and Neon role exactly as before.

Rollback: set `LEGACY_LOGIN_HIDDEN=false` if the legacy form should also be visible below the public login. No account, password or database changes are required.
