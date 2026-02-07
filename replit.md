# Music & Events Platform

## Overview
A responsive wireframe web app for a music/events platform. Black and white design with placeholder image areas — intended as a functional frame the client can "dress" with their own images, fonts, and branding via a built-in admin dashboard.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js API
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect SSO)
- **Routing**: wouter (client-side)
- **File Uploads**: multer (image-only, saved to /client/public/uploads)

## Key Pages
1. **Login** — SSO login page with provider button (reads welcome text, subtitle, header image from settings)
2. **Landing** — Event name, search, 2x2 artist tile grid, enquiry form, banner (reads heading, search placeholder, banner image, enquiry title from settings)
3. **Artist Detail** — Hero image, description, contact info, promoter image
4. **Artists Directory** — List view with search/filter (reads page title from settings)
5. **Events** — Card-based event listing (reads page title from settings)
6. **DS** — Customizable content page (reads title, content text, image from settings)
7. **Profile** — User profile with logout
8. **Admin** — Dashboard with 10 walkthrough sections for customizing all content

## Navigation
- Bottom nav bar with 5 buttons: Home, Artists, Events, DS, Profile (labels from settings)
- Top ribbon with company name banner + logo/image area + hamburger menu (reads from settings)
- Hamburger menu opens a sheet with nav links + Admin link + user info + logout

## Data Models
- **artists**: id, name, genre, description, imageUrl, email, phone, socialLinks, timeSlot, featured, promoterImageUrl
- **events**: id, name, description, imageUrl, date, venue
- **enquiries**: id, name, email, message, createdAt
- **site_settings**: id, key (unique), value, type (text/image/color/font), section, label
- **users**: Managed by Replit Auth (id, email, firstName, lastName, profileImageUrl)

## API Routes
- `GET /api/artists` — List all artists
- `GET /api/artists/:id` — Single artist
- `POST /api/artists` — Create artist
- `PATCH /api/artists/:id` — Update artist
- `DELETE /api/artists/:id` — Delete artist
- `GET /api/events` — List all events
- `POST /api/events` — Create event
- `PATCH /api/events/:id` — Update event
- `DELETE /api/events/:id` — Delete event
- `POST /api/enquiries` — Submit enquiry form
- `GET /api/enquiries` — List enquiries
- `GET /api/settings` — List all settings
- `PUT /api/settings` — Upsert settings array
- `POST /api/upload` — Upload image file (returns URL)
- `GET /api/auth/user` — Current authenticated user
- `GET /api/login` — Begin SSO login
- `GET /api/logout` — Logout

## Admin Dashboard
- 10 sections: Global Branding, Style Guide, Login Page, Landing Page, Manage Artists, Manage Events, Artists Directory, Events Page, DS Page, Navigation
- Tab-based navigation between sections + Previous/Next buttons
- Settings sections: text inputs, color pickers, font selectors, image uploads
- Artists/Events sections: full inline editing with add/save/delete per item
- Changes saved per section, reflected immediately on public pages

## Settings Hook
- `useSettings()` hook in `client/src/hooks/use-settings.ts`
- Provides `get(key, fallback)` to read any setting value
- All public pages use this hook for dynamic content

## Design Philosophy
- Black and white wireframe — no custom colors, images, or fonts by default
- All image areas use dashed-border placeholders with labels
- Client customizes branding, images, fonts, and colors via admin dashboard
- Mobile-first layout (max-w-lg centered)

## User Preferences
- Auth temporarily disabled during development
- Admin dashboard should be intuitive enough for non-technical users

## Recent Changes
- Initial build: Feb 7, 2026
- Added site_settings table, admin dashboard, image upload, settings CRUD, wired all public pages to settings: Feb 7, 2026
