/**
 * Portable auth — replaces Replit Auth.
 *
 * Strategy:
 *  - Sessions stored in the existing `sessions` Postgres table (connect-pg-simple)
 *  - Login: POST /api/login  { username, password }
 *    Supports multiple users stored in the `users` table with bcrypt-hashed passwords.
 *    Built-in accounts (Supervan + deadsounds) are seeded on startup from env vars.
 *  - GET  /api/auth/user  — returns current user or 401
 *  - GET  /api/logout     — destroys session
 *
 * Roles:
 *  - superadmin: Full access including activity log and build oversight (Supervan)
 *  - admin: Client-level access — manages their own content (deadsounds)
 *  - user: Regular visitor
 */

import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import type { Express, RequestHandler } from "express";
import { db } from "./db";
import { users, activityLog } from "@shared/models/auth";
import { eq, or } from "drizzle-orm";

// ─── Session setup ────────────────────────────────────────────────────────────

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const PgStore = connectPg(session);
  const store = new PgStore({
    conString: process.env.DATABASE_URL!,
    createTableIfMissing: true,
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

// ─── Activity logging helper ──────────────────────────────────────────────────

export async function logActivity(
  userId: string,
  action: string,
  opts: {
    resource?: string;
    resourceId?: string | number;
    description?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userEmail?: string;
    userName?: string;
    userRole?: string;
  } = {}
) {
  try {
    await db.insert(activityLog).values({
      userId,
      action,
      resource: opts.resource,
      resourceId: opts.resourceId != null ? String(opts.resourceId) : undefined,
      description: opts.description,
      metadata: opts.metadata as any,
      ipAddress: opts.ipAddress,
      userEmail: opts.userEmail,
      userName: opts.userName,
      userRole: opts.userRole,
    });
  } catch (err) {
    // Non-fatal — log to console but don't break the request
    console.error("Activity log error:", err);
  }
}

// ─── Seed built-in accounts ──────────────────────────────────────────────────

async function seedBuiltInUsers() {
  const supervanUsername = process.env.SUPERADMIN_USERNAME || "Supervan";
  const supervanPassword = process.env.SUPERADMIN_PASSWORD || "Testthemoonsgravity26!";
  const supervanEmail = process.env.SUPERADMIN_EMAIL || "melbazpeach@gmail.com";

  const dsUsername = process.env.ADMIN_USERNAME || "deadsounds";
  const dsPassword = process.env.ADMIN_PASSWORD || "Tropicalcowboy80!";
  const dsEmail = process.env.ADMIN_EMAIL || "deadsoundnz@gmail.com";

  // Upsert Supervan
  const [existingSupervan] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, supervanEmail), eq(users.username, supervanUsername)));

  if (!existingSupervan) {
    const hash = await bcrypt.hash(supervanPassword, 10);
    await db.insert(users).values({
      email: supervanEmail,
      username: supervanUsername,
      passwordHash: hash,
      firstName: "Supervan",
      role: "superadmin",
    });
    console.log("[auth] Created Supervan (superadmin) account");
  } else {
    // Always ensure role and password are up to date
    const hash = await bcrypt.hash(supervanPassword, 10);
    await db.update(users)
      .set({ username: supervanUsername, passwordHash: hash, role: "superadmin" })
      .where(eq(users.id, existingSupervan.id));
    console.log("[auth] Updated Supervan account");
  }

  // Upsert deadsounds admin
  const [existingDs] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, dsEmail), eq(users.username, dsUsername)));

  if (!existingDs) {
    const hash = await bcrypt.hash(dsPassword, 10);
    await db.insert(users).values({
      email: dsEmail,
      username: dsUsername,
      passwordHash: hash,
      firstName: "Dead Sounds",
      role: "admin",
    });
    console.log("[auth] Created deadsounds (admin) account");
  } else {
    // Always ensure role and password are up to date
    const hash = await bcrypt.hash(dsPassword, 10);
    await db.update(users)
      .set({ username: dsUsername, passwordHash: hash, role: "admin" })
      .where(eq(users.id, existingDs.id));
    console.log("[auth] Updated deadsounds account");
  }
}

// ─── Auth setup (call once at startup) ───────────────────────────────────────

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Seed built-in accounts on startup
  await seedBuiltInUsers().catch((err) =>
    console.error("[auth] Failed to seed built-in users:", err)
  );

  // POST /api/login
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Look up user by username or email
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, username)));

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    let passwordValid = false;
    if (user.passwordHash) {
      passwordValid = await bcrypt.compare(password, user.passwordHash);
    }

    if (!passwordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.userId = user.id;
    req.session.save(async (err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ message: "Session error" });
      }

      // Log the login activity
      await logActivity(user.id, "login", {
        description: `${user.firstName || user.username || user.email} logged in`,
        userEmail: user.email || undefined,
        userName: user.firstName || user.username || undefined,
        userRole: user.role,
        ipAddress: req.ip || req.socket?.remoteAddress,
      });

      res.json({ message: "Logged in", userId: user.id, role: user.role });
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
    // Don't expose passwordHash to client
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  });

  // GET /api/logout
  app.get("/api/logout", async (req, res) => {
    if (req.session.userId) {
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId)).catch(() => [null]);
      if (user) {
        await logActivity(user.id, "logout", {
          description: `${user.firstName || user.username || user.email} logged out`,
          userEmail: user.email || undefined,
          userName: user.firstName || user.username || undefined,
          userRole: user.role,
        });
      }
    }
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

// Stub for registerAuthRoutes
export function registerAuthRoutes(_app: Express) {}
