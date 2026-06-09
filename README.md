# Music Events Platform Production

This repository contains the production build for the **Deadsounds / MVT Guide music events platform**. The application is a full-stack TypeScript project with a React frontend, an Express API server, PostgreSQL data storage through Drizzle ORM, and Railway-ready deployment configuration. It supports public event and artist browsing, admin content management, enquiries, media embeds, shop products, Stripe checkout, donations, Google Sheets logging, AI concierge tooling, and database-backed admin authentication.

> **Production URL:** https://music-events-platform-prod-production.up.railway.app/
>
> **Current admin login behavior:** the login endpoint supports both the original Railway environment-variable superadmin account and per-user database-backed admin accounts stored in Neon/PostgreSQL.

## Project Overview

The platform is designed as a single deployable web service. The production server serves the compiled React single-page application and exposes the API from the same Express process. This keeps Railway deployment simple while allowing the admin panel, public pages, API routes, session handling, and database migrations to stay in one repository.

| Area | Implementation |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Radix UI components, TanStack Query, Wouter routing |
| Backend | Express 5, TypeScript, server-side sessions, REST-style API routes |
| Database | PostgreSQL via Drizzle ORM and `pg`; production database is expected through `DATABASE_URL` |
| Auth | Cookie-backed sessions stored in PostgreSQL; admin and superadmin authorization middleware |
| Deployment | Railway/Nixpacks using `npm install --legacy-peer-deps`, `npm run build`, and `npm start` |
| Payments | Stripe checkout, orders, donations, webhook support, and optional Afterpay settings |
| Integrations | Google Sheets service-account integration, AI concierge settings, Hermes routes, and file uploads |

## Main Features

The public site includes landing, artist directory, artist detail pages, event listings, event detail pages, DS/MVT content, donation pages, shop pages, and profile/login routes. The admin side provides controls for site branding, wallpapers, navigation labels, landing content, artists, events, DS clients, products, orders, submissions, users, activity logs, and integrations.

| Feature | Notes |
| --- | --- |
| Artists and service providers | Public directory with searchable cards and admin CRUD support. Artist records include images, genres, descriptions, origin, members, bio, links, contact fields, music/video links, and custom links. |
| Events | Public event listing and event detail pages with date, time, venue, address, map URL, ticket URL, and configurable visible fields. |
| Enquiries | Public enquiry form stores submissions in PostgreSQL and can append rows to a configured Google Sheet. |
| Media | Admin-managed media items support approved embed hosts such as YouTube, Bandcamp, SoundCloud, Spotify, and Apple Music. |
| Shop and orders | Product CRUD, cart flow, Stripe hosted checkout, order persistence, and admin order views. |
| Donations | Public donation capture with Stripe checkout and optional Google Sheets logging. |
| Integrations panel | Admin UI for Google service account JSON, AI concierge provider/model/API settings, Stripe keys, donation toggles, webhook values, and sheet mappings. |
| AI concierge | Configurable assistant behavior that can use current artists/events, optional context URLs, skill instructions, and protected admin context when enabled. |
| Hermes | Additional authenticated routes and specialist messaging tables for internal/agent-style workflows. |

## Repository Structure

The codebase follows a compact monorepo layout. Shared schema definitions live alongside the client and server so the same data contracts are available to both sides of the application.

| Path | Purpose |
| --- | --- |
| `client/src` | React application, pages, components, hooks, UI library wrappers, and frontend utilities. |
| `server` | Express entrypoint, routes, authentication, database setup, storage layer, integrations, and production static serving. |
| `shared` | Drizzle schema, auth model definitions, insert schemas, and shared TypeScript types. |
| `script/build.ts` | Production build script that compiles the Vite frontend and bundles the server into `dist/index.cjs`. |
| `drizzle.config.ts` | Drizzle Kit configuration using `shared/schema.ts` and `DATABASE_URL`. |
| `nixpacks.toml` | Railway/Nixpacks install, build, and start configuration. |
| `start.sh` | Production startup script that runs `drizzle-kit push` before starting `node dist/index.cjs`. |

## Local Development

Use a recent Node.js runtime compatible with the project dependencies. The deployed build currently uses the standard Node/NPM workflow configured in Nixpacks.

```bash
npm install --legacy-peer-deps
npm run dev
```

The development server uses `NODE_ENV=development tsx server/index.ts`. By default, the Express server listens on `PORT` or `5000`, and in development it wires in Vite middleware rather than serving the compiled static bundle.

## Environment Variables

Create local environment values before running the server. Never commit `.env` files or production secrets to this repository.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string for Drizzle, sessions, content, users, products, orders, and settings. |
| `SESSION_SECRET` | Strongly recommended | Secret used to sign session cookies. If omitted, the app has a fallback that should not be used for production. |
| `PORT` | Railway-provided or optional locally | Port the Express server binds to. Defaults to `5000` locally. |
| `NODE_ENV` | Production/development | Controls production cookie behavior and static serving. |
| `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` | Optional production admin path | Railway environment-variable superadmin login. |
| `SUPERADMIN_EMAIL` | Optional | Email attached to the environment-variable superadmin user. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Optional legacy naming | Backward-compatible alternative to the `SUPERADMIN_*` variables. |
| `ADMIN_EMAIL` | Optional legacy naming | Backward-compatible email for the environment-variable admin user. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Optional | Fallback Google Sheets service account JSON. The admin Integrations panel can also store this in database settings. |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Optional | Stripe values may also be managed through the database-backed Integrations panel. |
| `HERMES_SECRET` | Optional | Secret used for Hermes token signing and verification. |
| `PUBLIC_OBJECT_SEARCH_PATHS` / `PRIVATE_OBJECT_DIR` | Optional | Object/file storage paths used by upload-related helpers when configured. |
| `ISSUER_URL` / `REPL_ID` | Legacy/optional | Present for compatibility with older auth or deployment paths where needed. |

A minimal local `.env` normally looks like this:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
SESSION_SECRET=replace-with-a-long-random-string
PORT=5000
NODE_ENV=development
```

## Database and Startup Behavior

The application uses Drizzle ORM with PostgreSQL. On startup, `start.sh` runs `npx drizzle-kit push --config=drizzle.config.ts` and then starts the compiled server. The server also runs an idempotent seeding/self-healing step that adds expected columns and creates important tables when missing, including user login fields, products, orders, activity logs, and related site settings.

| Table/Area | Used For |
| --- | --- |
| `users` | Admin users, superadmin users, database-backed login usernames, roles, and password hashes. |
| `sessions` | Server-side session storage for logged-in users. |
| `artists` and `events` | Public directory and event-management content. |
| `site_settings` | Branding, page copy, navigation labels, integration settings, style controls, and feature toggles. |
| `enquiries` and `donations` | Public form submissions and donation records. |
| `products` and `orders` | Shop catalog and checkout results. |
| `media_items` | Public media embed content. |
| `activity_log` | Admin/system activity records. |
| `hermes_squad` and `hermes_messages` | Hermes specialist and message data. |

## Authentication and Admin Access

The production login route is `POST /api/login` with a JSON body containing `username` and `password`. Sessions are stored in the PostgreSQL `sessions` table and are read by `/api/auth/user`, admin middleware, and superadmin middleware.

The current production behavior supports two login paths. First, the configured Railway superadmin account can log in through `SUPERADMIN_USERNAME`/`SUPERADMIN_PASSWORD` or the older `ADMIN_USERNAME`/`ADMIN_PASSWORD` variables. Second, individual users in the `users` table can log in with their database `username` or `email` and a bcrypt value stored in `password_hash`. This second path is required for database-backed admin accounts such as Cory’s account.

| Role | Access |
| --- | --- |
| `user` | Authenticated account without admin panel permissions. |
| `admin` | Can access admin-protected content management routes and the visible Admin navigation item. |
| `superadmin` | Has admin access plus superadmin-protected areas when used by those routes. |

If a database-backed admin cannot log in, check the following in order: confirm the user exists in the same production database used by Railway, confirm the user has `role = 'admin'` or `role = 'superadmin'`, confirm `username` or `email` matches what the user is entering, confirm `password_hash` is populated with a bcrypt hash, and confirm Railway has deployed the latest commit containing database-backed login support.

## Build and Deployment

The production build compiles the frontend into `dist/public` and bundles the Express server into `dist/index.cjs`. Railway uses Nixpacks according to `nixpacks.toml`.

```bash
npm install --legacy-peer-deps
npm run build
npm start
```

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `NODE_ENV=development tsx server/index.ts` | Runs the development server with Vite middleware. |
| `build` | `tsx script/build.ts` | Builds the Vite client and bundles the server for production. |
| `start` | `bash start.sh` | Runs database push/migration then starts the production server. |
| `check` | `tsc` | Runs the TypeScript compiler check. |
| `db:push` | `drizzle-kit push` | Pushes schema changes to the configured PostgreSQL database. |

Railway should be configured with the production environment variables, especially `DATABASE_URL`, `SESSION_SECRET`, and any admin/integration keys required for the live site. For the current production deployment, use this URL for live verification:

```text
https://music-events-platform-prod-production.up.railway.app/login
```

## Admin Operations

Most operational changes should be made through the admin UI rather than by editing source code. The Admin page manages content, layout, site copy, branding, users, artists, events, shop content, orders, and submissions. The Integrations page manages Google Sheets, Stripe, AI concierge behavior, donation settings, and related configuration.

| Task | Recommended Place |
| --- | --- |
| Update artists or service providers | Admin → Artists |
| Update events | Admin → Events |
| Change homepage or navigation text | Admin → Branding / Landing / Navigation sections |
| Configure Stripe keys and webhooks | Admin → Integrations |
| Configure Google Sheets logging | Admin → Integrations |
| Configure AI concierge provider and model | Admin → Integrations |
| Review enquiries, donations, orders, and activity | Admin dashboard sections |

## Security Notes

Production secrets must remain in Railway variables or protected database settings, not in Git. Passwords should never be stored in plain text in the database. Database-backed users should use bcrypt hashes in `users.password_hash`, and the Railway superadmin password should be treated as a secret credential. The fallback session secret in code is only a safety net for local development and should be replaced by a strong `SESSION_SECRET` in production.

The media embed allowlist is intentionally limited to known providers, including YouTube, Bandcamp, SoundCloud, Spotify, and Apple Music. If additional embed hosts are needed, update the allowlist in `server/routes.ts` and review the security impact before deploying.

## Recent Production Fix

The latest login fix added support for database-backed admin users. Before this change, the production login flow only accepted the single Railway environment-variable admin login. As a result, a user could be correctly marked as `admin` in Neon/PostgreSQL and still be rejected by the login form. The current implementation preserves the Railway superadmin login while also allowing users such as Cory to log in with their database username/email and bcrypt-backed password.

| Commit | Purpose |
| --- | --- |
| `7cc759f` | `Fix database-backed admin login` |

## References

[1]: https://react.dev/ "React Documentation"
[2]: https://vite.dev/ "Vite Documentation"
[3]: https://expressjs.com/ "Express Documentation"
[4]: https://orm.drizzle.team/ "Drizzle ORM Documentation"
[5]: https://docs.railway.com/ "Railway Documentation"
[6]: https://neon.com/docs "Neon Documentation"
[7]: https://docs.stripe.com/checkout "Stripe Checkout Documentation"
