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
import bcrypt from "bcryptjs";
import type { Express, RequestHandler } from "express";
import { db } from "./db";
import { users, activityLog } from "@shared/models/auth";
import { eq, sql } from "drizzle-orm";

// ─── Session setup ────────────────────────────────────────────────────────────

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const PgStore = connectPg(session);
  const store = new PgStore({
    conString: process.env.DATABASE_URL!,
    createTableIfMissing: true, // auto-create sessions table if it doesn't exist
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

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Support both SUPERADMIN_* and ADMIN_* env var naming conventions.
    // This preserves Vanessa's original single superadmin login.
    const adminUsername =
      process.env.SUPERADMIN_USERNAME ||
      process.env.ADMIN_USERNAME ||
      "admin";
    const adminPassword =
      process.env.SUPERADMIN_PASSWORD ||
      process.env.ADMIN_PASSWORD;

    let userId: string | null = null;

    if (adminPassword && username === adminUsername && password === adminPassword) {
      // Upsert the superadmin user in the DB so role lookups work.
      const adminEmail =
        process.env.SUPERADMIN_EMAIL ||
        process.env.ADMIN_EMAIL ||
        "melbazpeach@gmail.com";

      const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));

      if (existing) {
        userId = existing.id;
      } else {
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

      // If the configured superadmin exists but still has a normal user role, promote only
      // when there is not already another superadmin.
      if (existing && existing.role === "user") {
        const [existingSuperAdmin] = await db
          .select()
          .from(users)
          .where(eq(users.role, "superadmin"));
        if (!existingSuperAdmin) {
          await db.update(users).set({ role: "superadmin" }).where(eq(users.id, userId));
        }
      }
    } else {
      // Also support per-user database logins. This is required for admin users such
      // as Cory, whose username/password_hash are stored in Neon rather than Railway.
      const [existingUser] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.username}) = lower(${username}) OR lower(${users.email}) = lower(${username})`);

      if (!existingUser?.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const passwordMatches = await bcrypt.compare(password, existingUser.passwordHash);
      if (!passwordMatches) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      userId = existingUser.id;
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

export async function getSessionUser(req: any) {
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

// ─── Activity logging ─────────────────────────────────────────────────────────

/**
 * Log an admin/system action to the activity_log table.
 * Silently swallows errors so a logging failure never breaks a request.
 */
export async function logActivity(
  req: any,
  action: string,
  details?: string,
  entityType?: string,
  entityId?: number,
  agent = "system"
): Promise<void> {
  try {
    const userId = req?.session?.user?.id ?? req?.user?.id ?? null;
    await db.insert(activityLog).values({
      action,
      details: details ?? null,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      userId: userId ? String(userId) : null,
      agent,
    });
  } catch {
    // Never throw — logging should never break a request
  }
}
