# Music & Events Platform

## Overview
A responsive wireframe web app for a music/events platform. Black and white design with placeholder image areas — intended as a functional frame the client can "dress" with their own images, fonts, and branding via a built-in admin dashboard.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js API
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect SSO)
- **Routing**: wouter (client-side)
- **File Uploads**: multer (images saved to /client/public/uploads, fonts saved to /client/public/uploads)

## Key Pages
1. **Login** — SSO login page with provider button (reads welcome text, subtitle, header image, wallpaper from settings)
2. **Landing** — Event name, search, 2x2 artist tile grid, media player, animation boxes, enquiry form, social links, share button, banner (reads heading, search placeholder, banner image, enquiry title, wallpaper from settings)
3. **Artist Detail** — Hero image, description, contact info, promoter image, share button
4. **Artists Directory** — List view with search/filter (reads page title, wallpaper from settings)
5. **Events** — Card-based event listing (reads page title, wallpaper from settings)
6. **Event Detail** — Full event info with Google Maps, times, ticket link, share button
7. **DS** — Client profile section with rich fields (images, bio, origin, members, links, visibility controls) + page settings (title, content text, image, wallpaper)
8. **Profile** — User profile with logout
9. **Admin** — Dashboard with 13 walkthrough sections for customizing all content + Integrations button
10. **Integrations** (/admin/integrations) — Toggle cards for Google Drive, Sheets, Docs, Gmail, YouTube, YouTube Music, Bandcamp, DistroKid, AI Assistant (BYOK), Stripe (dormant), Donations
11. **Donate** (/donate) — Donation form with configurable amounts, title, description

## Navigation
- Bottom nav bar with 5 buttons: Home, Artists, Events, DS, Profile (labels from settings)
- Top ribbon with company name banner + logo/image area + hamburger menu (reads from settings)
- Hamburger menu opens a sheet with nav links + Donate + Admin + Integrations + user info + logout

## Data Models
- **artists**: id, name, genre, description, imageUrl, email, phone, socialLinks, timeSlot, featured, promoterImageUrl, origin, members, bio, website, imageUrl2, songLink1/2, videoLink1/2, customLink1-5, visibleFields
- **events**: id, name, description, imageUrl, date, venue, time, endDate, endTime, address, googleMapsUrl, ticketUrl, visibleFields
- **enquiries**: id, name, email, message, createdAt
- **site_settings**: id, key (unique), value, type (text/image/color/font/toggle), section, label
- **media_items**: id, title, url, type (youtube/bandcamp/soundcloud/audio), embedUrl, order
- **donations**: id, name, email, amount, message, status, createdAt
- **ds_clients**: id, name, genre, description, imageUrl, email, phone, socialLinks, timeSlot, promoterImageUrl, origin, members, bio, website, imageUrl2, songLink1/2, videoLink1/2, customLink1-5, visibleFields (mirrors artist schema)
- **users**: Managed by Replit Auth (id, email, firstName, lastName, profileImageUrl)

## API Routes
- `GET /api/artists` — List all artists
- `GET /api/artists/:id` — Single artist
- `POST /api/artists` — Create artist
- `PATCH /api/artists/:id` — Update artist
- `DELETE /api/artists/:id` — Delete artist
- `GET /api/artists/export/csv` — Export all artists as CSV
- `POST /api/artists/import/csv` — Import artists from CSV file (multipart upload)
- `GET /api/events` — List all events
- `POST /api/events` — Create event
- `PATCH /api/events/:id` — Update event
- `DELETE /api/events/:id` — Delete event
- `POST /api/enquiries` — Submit enquiry form
- `GET /api/enquiries` — List enquiries
- `GET /api/settings` — List all settings
- `PUT /api/settings` — Upsert settings array
- `POST /api/upload` — Upload image file (returns URL)
- `POST /api/upload/font` — Upload font file (.ttf, .otf, .woff, .woff2) (returns URL + filename)
- `GET /api/media` — List media items
- `POST /api/media` — Create media item (URL validated against allow-list)
- `PATCH /api/media/:id` — Update media item
- `DELETE /api/media/:id` — Delete media item
- `POST /api/donations` — Submit donation
- `GET /api/donations` — List donations
- `GET /api/ds-clients` — List all DS client profiles
- `GET /api/ds-clients/:id` — Single DS client
- `POST /api/ds-clients` — Create DS client
- `PATCH /api/ds-clients/:id` — Update DS client
- `DELETE /api/ds-clients/:id` — Delete DS client
- `GET /api/users` — List all users (admin only)
- `PATCH /api/users/:id/role` — Update user role (admin only)
- `POST /api/ai/chat` — AI chat proxy (OpenAI/Anthropic, BYOK)
- `GET /api/auth/user` — Current authenticated user
- `GET /api/login` — Begin SSO login
- `GET /api/logout` — Logout

## Admin Dashboard
- 13 sections: Global Branding, Style Guide, Wallpapers, Social Media, Animations, Login Page, Landing Page, Manage Artists, Manage Events, Artists Directory, Events Page, DS Page, Navigation
- Tab-based navigation between sections + Previous/Next buttons
- Settings sections: text inputs, color pickers, font selectors, image uploads, toggle switches
- Style Guide includes Custom Font Upload card (upload .ttf/.otf/.woff/.woff2, auto-sets font name)
- Wallpapers section: upload background images for each page (landing, artists, events, DS, login)
- Social Media section: URLs for Instagram, Facebook, X, TikTok, YouTube, SoundCloud, Spotify, Bandcamp, website, email
- Animations section: 3 configurable animation boxes with text, style selector (fade-in/slide-up/slide-left/slide-right/zoom-in/bounce/pulse), and background image
- Artists section: inline editing with add/save/delete + CSV import/export card
- Events section: full inline editing with add/save/delete
- Navigation section: button labels + menu item visibility toggles (menu_show_*)
- User Roles section: list all users, toggle admin role on/off per user (cannot demote yourself)
- Changes saved per section, reflected immediately on public pages

## Components
- **AppLayout** — Main layout wrapper with top ribbon, bottom nav, and optional wallpaper background via `bgKey` prop
- **CustomFontLoader** — Injected in App.tsx, dynamically loads custom font via @font-face from settings
- **ShareButton** — Dropdown with copy link, Facebook, X, WhatsApp, LinkedIn, native share API
- **SocialLinks** — Displays platform social media icons filtered by non-empty setting values
- **AnimationBox/AnimationBoxes** — Scroll-triggered animation containers with IntersectionObserver, 7 animation styles
- **MediaPlayer** — Embeds YouTube/Bandcamp/SoundCloud/Spotify media
- **EnquiryForm** — Contact form with Google Sheets integration
- **ArtistTile** — Artist card for grid display
- **SearchBar** — Search input component
- **ImagePlaceholder** — Dashed border placeholder for empty image areas

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
- Admin dashboard should be intuitive enough for non-technical users

## Roles & Auth
- **Users table** has a `role` column: `"user"` (default), `"admin"`, or `"superadmin"`
- **Standard users**: Can browse all public pages (landing, artists, events, DS), use forms (enquiry/donation submissions), play media, share links — no login required
- **Admin users**: Can access Profile, Donate, Admin Dashboard (13 sections), Integrations, and all CRUD operations
- **Superadmin**: Has all admin privileges plus exclusive access to the User Roles section (section #14) in admin dashboard; only superadmin can view/manage user roles via GET /api/users and PATCH /api/users/:id/role
- **Hidden from non-admins**: Profile page, Donate page, Admin Dashboard, Integrations — removed from bottom nav and hamburger menu
- **Hidden from regular admins**: User Roles section in admin dashboard (only superadmin sees it)
- To become superadmin: `UPDATE users SET role = 'superadmin' WHERE email = 'your@email.com'`
- Superadmin can then promote others to admin (or demote them) via the User Roles UI

## Security Notes
- Media embed URLs validated against allow-list (YouTube, Bandcamp, SoundCloud, Spotify)
- Media PATCH endpoint sanitizes input fields (only title, url, type, embedUrl, order allowed)
- All admin/mutating API routes protected with `isAdmin` middleware (POST/PATCH/DELETE artists, events, media, ds-clients; PUT settings; uploads; CSV import/export; AI chat; GET enquiries/donations)
- User management routes (GET /api/users, PATCH /api/users/:id/role) protected with `isSuperAdmin` middleware — only superadmin can access
- Server-side self-demotion protection: superadmin cannot change their own role via API
- Public read routes remain open: GET artists, events, settings, media, ds-clients; POST enquiries/donations (forms)
- Frontend admin pages gated with useAuth `isAdmin` check — non-admin users see access denied message
- upsertUser intentionally skips `role` field to prevent role escalation via SSO login
- AI endpoint proxies to OpenAI/Anthropic; user brings own API key stored in settings

## Recent Changes
- Initial build: Feb 7, 2026
- Added site_settings table, admin dashboard, image upload, settings CRUD, wired all public pages to settings: Feb 7, 2026
- Added integrations admin page, media player, AI chat endpoint, donation page, media_items/donations tables: Feb 7, 2026
- Added CSV import/export for artists, configurable hamburger menu visibility (toggle settings in admin Navigation section): Feb 7, 2026
- Expanded artist schema: origin, members, bio, website, imageUrl2, songLink1/2, videoLink1/2, customLink1-5, visibleFields JSON: Feb 7, 2026
- Expanded event schema: time, endDate, endTime, address, googleMapsUrl, ticketUrl, visibleFields JSON: Feb 7, 2026
- Added per-field visibility toggles (eye icons) in admin artist/event editors: Feb 7, 2026
- Added event detail page (/events/:id) with Google Maps embed, times, ticket link: Feb 7, 2026
- Updated artist detail page to show all new fields (bio, origin, members badges, links) with visibility controls: Feb 7, 2026
- Google Sheets integration: enquiry/donation submissions append to user-configured sheets, settings in integrations admin: Feb 7, 2026
- CSV export/import updated to handle all new artist fields with flexible column matching: Feb 7, 2026
- Members field uses comma-separated string, rendered as Badge tags with add/remove controls: Feb 7, 2026
- Added wallpaper backgrounds for all pages (landing, artists, events, DS, login) with overlay: Feb 7, 2026
- Added custom font upload endpoint and CustomFontLoader component for dynamic @font-face injection: Feb 7, 2026
- Added ShareButton component (copy link, Facebook, X, WhatsApp, LinkedIn, native share): Feb 7, 2026
- Added SocialLinks component displaying platform social media icons from settings: Feb 7, 2026
- Added AnimationBox component with 7 scroll-triggered animation styles: Feb 7, 2026
- Added 3 new admin sections: Wallpapers, Social Media, Animations: Feb 7, 2026
- Added Font Upload card in Style Guide admin section: Feb 7, 2026
- Integrated social links + share button on landing page, share button on artist/event detail pages: Feb 7, 2026
- Added ds_clients table with full artist-equivalent fields, CRUD API routes, admin editor with visibility toggles, and public DS page client profiles: Feb 7, 2026
- Hardened authentication: added isAuthenticated middleware to all 15+ admin/mutating API routes, frontend auth guards on admin & integrations pages: Feb 7, 2026
- Added role-based access control: users table has role column (user/admin), isAdmin middleware, admin-only routes, hidden nav items for non-admins, frontend guards on profile/donate/admin/integrations pages: Feb 7, 2026
