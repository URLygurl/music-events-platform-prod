# Music & Events Platform

## Overview
A responsive wireframe web app for a music/events platform. Black and white design with placeholder image areas — intended as a functional frame the client can "dress" with their own images, fonts, and branding.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js API
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect SSO)
- **Routing**: wouter (client-side)

## Key Pages
1. **Login** — SSO login page with provider button
2. **Landing** — Event name, search, 2x2 artist tile grid, enquiry form, banner
3. **Artist Detail** — Hero image, description, contact info, promoter image
4. **Artists Directory** — List view with search/filter
5. **Events** — Card-based event listing
6. **DS** — Placeholder content page
7. **Profile** — User profile with logout

## Navigation
- Bottom nav bar with 5 buttons: Home, Artists, Events, DS, Profile
- Top ribbon with company name banner + logo/image area + hamburger menu
- Hamburger menu opens a sheet with nav links + user info + logout

## Data Models
- **artists**: id, name, genre, description, imageUrl, email, phone, socialLinks, timeSlot, featured, promoterImageUrl
- **events**: id, name, description, imageUrl, date, venue
- **enquiries**: id, name, email, message, createdAt
- **users**: Managed by Replit Auth (id, email, firstName, lastName, profileImageUrl)

## API Routes
- `GET /api/artists` — List all artists
- `GET /api/artists/:id` — Single artist
- `GET /api/events` — List all events
- `POST /api/enquiries` — Submit enquiry form
- `GET /api/auth/user` — Current authenticated user
- `GET /api/login` — Begin SSO login
- `GET /api/logout` — Logout

## Design Philosophy
- Black and white wireframe — no custom colors, images, or fonts
- All image areas use dashed-border placeholders with labels
- Client will later customise branding, images, fonts, and colors
- Mobile-first layout (max-w-lg centered)

## Recent Changes
- Initial build: Feb 7, 2026
