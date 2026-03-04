/**
 * Portable auth — replaces Replit Auth.
 *
 * Strategy:
 *  - Sessions stored in the existing `sessions` Postgres table (connect-pg-simple)
 *  - Login: POST /api/login  { username, password }
 *    Credentials are set via env vars ADMIN_USERNAME / ADMIN_PASSWORD.
 *    On success the session gets a `user` object that mirrors the shape
 *    the rest of the app expects (id, email, role).
 *  - The user record in the `users` table is upserted on first login so that
 *    the existing role stored in Neon is respected.
 *  - GET  /api/auth/user  — returns current user or 401
 *  - GET  /api/logout     — destroys session
 *
 * The isAuthenticated / isAdmin / isSuperAdmin middleware are drop-in
 * replacements for the ones that were in replitAuth.ts.
 */

import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

// ─── Session setup ────────────────────────────────────────────────────────────

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const PgStore = connectPg(session);
  const store = new PgStore({
    conString: process.env.DATABASE_URL!,
    createTableIfMissing: false, // table already exists from Replit Auth
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || "deadsounds-fallback-secret-change-me",
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
      maxAge: sessionTtl,
    },
    proxy: true,
  });
}

// ─── Augment express-session types ───────────────────────────────────────────

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// ─── Auth setup (call once at startup) ───────────────────────────────────────

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // POST /api/login
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };

    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return res.status(500).json({ message: "Server not configured: ADMIN_PASSWORD env var missing" });
    }

    if (username !== adminUsername || password !== adminPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Upsert the admin user in the DB so role lookups work
    const adminEmail = process.env.ADMIN_EMAIL || "melbazpeach@gmail.com";

    // Find existing user by email
    const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));

    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      // Create with superadmin role
      const [created] = await db
        .insert(users)
        .values({
          email: adminEmail,
          firstName: "Admin",
          role: "superadmin",
        })
        .returning();
      userId = created.id;
    }

    // If existing user has no role or is just "user", promote to superadmin
    // (only if no other superadmin exists)
    if (existing && existing.role === "user") {
      const [existingSuperAdmin] = await db
        .select()
        .from(users)
        .where(eq(users.role, "superadmin"));
      if (!existingSuperAdmin) {
        await db.update(users).set({ role: "superadmin" }).where(eq(users.id, userId));
      }
    }

    req.session.userId = userId;
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ message: "Session error" });
      }
      res.json({ message: "Logged in", userId });
    });
  });

  // GET /api/auth/user
  app.get("/api/auth/user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(user);
  });

  // GET /api/logout
  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  // GET /api/login — redirect to login page (for compatibility with old Replit Auth links)
  app.get("/api/login", (_req, res) => {
    res.redirect("/login");
  });
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function getSessionUser(req: any) {
  if (!req.session?.userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
  return user || null;
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  (req as any).user = user;
  return next();
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "admin" && user.role !== "superadmin") {
    return res.status(403).json({ message: "Forbidden: admin access required" });
  }
  (req as any).user = user;
  return next();
};

export const isSuperAdmin: RequestHandler = async (req, res, next) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "superadmin") {
    return res.status(403).json({ message: "Forbidden: superadmin access required" });
  }
  (req as any).user = user;
  return next();
};

// Stub for registerAuthRoutes (was a no-op in Replit Auth too, routes are registered in setupAuth)
export function registerAuthRoutes(_app: Express) {}
