# Login screen editor

Open **Admin → Login screen** (`/admin/login-screen`). Available to existing app admins and superadmins; the server checks the role for all private editor reads/writes. Regular users cannot edit.

Choose **Left panel** or **Right panel**. Each has independent copy, a built-in font preset, heading/body sizes, colours and background image upload. The left also has brand/logo settings; the right has separate sign-in and sign-up headings, descriptions and button labels. Form field rules, security messages, OAuth credentials, permissions and redirect URLs are not editable.

Use sign-in/sign-up and desktop/mobile preview controls. Google is shown for styling only; the farm still decides whether its credentials are configured. Fonts are system presets, not external font uploads. Images are public raster assets (JPG, PNG, WebP, GIF), up to 5 MB.

**Save draft** persists to Neon without changing the public login screen. **Publish** saves the draft and published theme. **Restore defaults** resets only the editor; publish to apply it. A failed save leaves local edits visible. Storage uses existing `site_settings` JSON rows, so no database migration is needed.

Only validated published settings are exposed at `/api/login-design`. Generic site-settings reads omit the two editor rows, and generic writes cannot bypass validation. No secrets or private auth/user data are included in the theme.

## Ferris handoff

Deploy the accompanying `nakedapp-auth` branch and follow its `docs/LOGIN_DESIGN.md`. The farm polls public settings about once a minute, retains the last valid theme and copies uploaded raster images onto the farm's persistent cache. Login must continue with last-saved design or safe defaults if Nakedapp is unavailable. Configure a writable persistent cache directory; no Neon credentials or new private shared keys are needed on the farm for design delivery.

The Nakedapp commit deploys the editor. The actual hosted login does not apply these settings until Ferris deploys the farm renderer. Neither update changes login methods, accounts, roles, passwords or Resend configuration.

Checks: production build; no new editor type errors relative to existing app errors; mocked API tests for role guards, CSRF, validation, public/draft separation and defaults; mocked browser tests for independent fields/uploads, save/publish/reload and responsive preview. No production data changes or real auth emails are part of testing.
