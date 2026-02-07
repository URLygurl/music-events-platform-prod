# Music & Events Platform

A responsive, customisable wireframe web app for music and events. Built as a reusable skeleton that clients can personalise through an intuitive admin dashboard — change colours, upload images, set fonts, and write content without touching any code.

---

## What It Does

This platform gives you a ready-made website for promoting events, showcasing artists, and engaging with your audience. Everything is designed to be customised from the admin dashboard — think of it as a "colour and write by numbers" system.

### Pages

| Page | What It Shows |
|------|---------------|
| **Home** | Event name, artist tiles, media player, animation boxes, enquiry form, social links, and a banner |
| **Artists** | Searchable directory of all artists |
| **Artist Detail** | Full artist profile — images, bio, contact info, links, members |
| **Events** | Card-based listing of all events |
| **Event Detail** | Full event info with date/time, venue, Google Maps, and ticket link |
| **DS** | Client profile section with rich fields and visibility controls |
| **Donate** | Donation form with configurable amounts |
| **Profile** | User profile and logout |
| **Login** | SSO sign-in page |

### Key Features

- **Admin Dashboard** — 13 sections to customise every part of the site
- **Artist & Event Management** — Add, edit, delete with per-field visibility toggles
- **CSV Import/Export** — Bulk manage artists via spreadsheet
- **Media Player** — Embed YouTube, Bandcamp, SoundCloud, and Spotify
- **Custom Fonts** — Upload your own .ttf, .otf, .woff, or .woff2 files
- **Wallpaper Backgrounds** — Set background images for any page
- **Animation Boxes** — Scroll-triggered animations with 7 style options
- **Social Media Links** — Instagram, Facebook, X, TikTok, YouTube, SoundCloud, Spotify, Bandcamp
- **Share Button** — Share pages via Facebook, X, WhatsApp, LinkedIn, or copy link
- **Enquiry Form** — Contact form with optional Google Sheets integration
- **Donations** — Configurable donation amounts with Google Sheets logging
- **DS Client Profiles** — Standalone client profiles with the same rich fields as artists
- **SSO Authentication** — Sign in with Google, GitHub, Apple, or email via Replit Auth
- **Integrations** — Toggle cards for Google services, music platforms, AI assistant, and Stripe

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS, shadcn/ui |
| Backend | Express.js |
| Database | PostgreSQL (Drizzle ORM) |
| Auth | Replit Auth (OpenID Connect) |
| Routing | wouter |
| File Uploads | multer |

---

## Project Structure

```
client/
  src/
    components/     UI components (nav, tiles, forms, player, etc.)
    hooks/          Custom hooks (auth, settings, toast)
    lib/            Query client and utilities
    pages/          Page components (landing, admin, artists, etc.)
  public/
    uploads/        Uploaded images and fonts

server/
  routes.ts         API endpoints
  storage.ts        Database operations
  index.ts          Server entry point

shared/
  schema.ts         Database schema and types (shared between frontend and backend)
```

---

## Admin Dashboard Sections

1. **Global Branding** — Company name and logo
2. **Style Guide** — Colours, fonts, custom font upload
3. **Wallpapers** — Background images for each page
4. **Social Media** — Links to all your social platforms
5. **Animations** — 3 configurable scroll-triggered animation boxes
6. **Login Page** — Welcome text, subtitle, header image
7. **Landing Page** — Heading, search placeholder, banner, enquiry title
8. **Manage Artists** — Add/edit/delete artists with visibility toggles + CSV import/export
9. **Manage Events** — Add/edit/delete events with visibility toggles
10. **Artists Directory** — Page title setting
11. **Events Page** — Page title setting
12. **DS Page** — Page settings + client profile management
13. **Navigation** — Button labels and hamburger menu item visibility

---

## API Endpoints

### Artists
- `GET /api/artists` — List all
- `GET /api/artists/:id` — Get one
- `POST /api/artists` — Create
- `PATCH /api/artists/:id` — Update
- `DELETE /api/artists/:id` — Delete
- `GET /api/artists/export/csv` — Export as CSV
- `POST /api/artists/import/csv` — Import from CSV

### Events
- `GET /api/events` — List all
- `POST /api/events` — Create
- `PATCH /api/events/:id` — Update
- `DELETE /api/events/:id` — Delete

### DS Clients
- `GET /api/ds-clients` — List all
- `GET /api/ds-clients/:id` — Get one
- `POST /api/ds-clients` — Create
- `PATCH /api/ds-clients/:id` — Update
- `DELETE /api/ds-clients/:id` — Delete

### Other
- `POST /api/enquiries` — Submit enquiry
- `GET /api/enquiries` — List enquiries
- `GET /api/settings` — Get all settings
- `PUT /api/settings` — Save settings
- `POST /api/upload` — Upload image
- `POST /api/upload/font` — Upload font file
- `GET /api/media` — List media items
- `POST /api/media` — Add media item
- `PATCH /api/media/:id` — Update media item
- `DELETE /api/media/:id` — Delete media item
- `POST /api/donations` — Submit donation
- `GET /api/donations` — List donations
- `POST /api/ai/chat` — AI chat (bring your own API key)

---

## Licence

Made with 🍑 by peachyweb
