import type { Express, Request, RequestHandler, Response } from "express";
import multer from "multer";
import type { PoolClient } from "pg";
import { getSessionUser } from "./auth";
import { pool } from "./db";

// Keep byte-for-byte identical to migrations/20261106_user_profiles.sql. Bundling
// this constant avoids relying on a migration file being copied into dist/.
export const PROFILE_SCHEMA_SQL = `BEGIN;

-- Serialize this additive migration when multiple app instances start together.
SELECT pg_advisory_xact_lock(20261106, 1);

-- Auth IDs remain opaque: legacy UUIDs and better-auth:<id> are independent.
-- There is deliberately no FK to public.users and no email-based linking.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id varchar PRIMARY KEY,
  username varchar(40),
  user_type varchar(20) NOT NULL DEFAULT 'audience',
  avatar_data text,
  avatar_mime varchar(10),
  avatar_updated_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_username_valid CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_.-]{3,40}$'),
  CONSTRAINT user_profiles_user_type_valid CHECK (user_type IN ('guest', 'audience', 'artist', 'advertiser', 'supplier', 'venue')),
  CONSTRAINT user_profiles_avatar_mime_valid CHECK (avatar_mime IS NULL OR avatar_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT user_profiles_avatar_complete CHECK (
    (avatar_data IS NULL AND avatar_mime IS NULL AND avatar_updated_at IS NULL)
    OR (avatar_data IS NOT NULL AND avatar_mime IS NOT NULL AND avatar_updated_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_unique
  ON public.user_profiles (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_favourites (
  user_id varchar NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT user_favourites_pkey PRIMARY KEY (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS user_favourites_product_id_idx ON public.user_favourites (product_id);

-- Tickets are issued by trusted server-side fulfilment only, not profile clients.
CREATE TABLE IF NOT EXISTS public.user_tickets (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  event_id integer REFERENCES public.events(id) ON DELETE SET NULL,
  label varchar(255) NOT NULL,
  ticket_reference varchar(255),
  status varchar(32) NOT NULL DEFAULT 'issued',
  issued_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_tickets_user_id_idx ON public.user_tickets (user_id);
CREATE INDEX IF NOT EXISTS user_tickets_event_id_idx ON public.user_tickets (event_id);

-- Existing/unowned orders stay untouched; only checkout may set new ownership.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS owner_user_id varchar;
CREATE INDEX IF NOT EXISTS orders_owner_user_id_idx
  ON public.orders (owner_user_id) WHERE owner_user_id IS NOT NULL;

COMMIT;
`;

export async function initializeProfileStorage(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(PROFILE_SCHEMA_SQL);
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error("Profile storage initialization failed.");
  } finally {
    client.release();
  }
}

type ProfileUser = { id: string; username?: string | null; email?: string | null };
type ProfileRequest = Request & { user?: ProfileUser };
type Queryable = Pick<PoolClient, "query">;
const MAX_FAVOURITES = 500;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const PRIVATE_AVATAR_URL = "/api/profile/avatar";

class ProfileError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function owner(req: Request): ProfileUser {
  const user = (req as ProfileRequest).user;
  if (!user?.id) throw new ProfileError(401, "Unauthorized");
  return user;
}

const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    if (!user?.id) { res.status(401).json({ message: "Unauthorized" }); return; }
    (req as ProfileRequest).user = user;
    next();
  } catch {
    res.status(503).json({ message: "Profile service unavailable" });
  }
};

const privateHeaders: RequestHandler = (_req, res, next) => {
  res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  next();
};

function parseOrigin(raw: string, allowPath: boolean): string | null {
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    if (!allowPath && (url.pathname !== "/" || url.search || url.hash)) return null;
    return url.origin;
  } catch { return null; }
}

function ownOrigins(req: Request): Set<string> {
  // The existing server-configured auth URL is authoritative if present. Never
  // derive trusted origins from Host, X-Forwarded-Host or X-Forwarded-Proto.
  const configured = process.env.BETTER_AUTH_URL;
  const result = new Set<string>();
  if (configured) {
    const origin = parseOrigin(configured, false);
    if (origin && (origin.startsWith("https://") || process.env.NODE_ENV !== "production")) result.add(origin);
  } else {
    result.add("https://deadsounds.live");
    result.add("https://www.deadsounds.live");
    result.add("https://music-events-platform-prod-production.up.railway.app");
    result.add("https://nakedapp.up.railway.app");
  }
  // Optional, explicit server-owned comma-separated exact origins. This never
  // uses request Host/forwarded headers or supports wildcard/suffix matching.
  for (const entry of (process.env.PROFILE_ALLOWED_ORIGINS || "").split(",")) {
    const origin = parseOrigin(entry.trim(), false);
    if (origin && (origin.startsWith("https://") || process.env.NODE_ENV !== "production")) result.add(origin);
  }
  if (process.env.NODE_ENV !== "production") {
    const port = req.socket.localPort;
    if (port) {
      result.add(`http://localhost:${port}`);
      result.add(`http://127.0.0.1:${port}`);
      result.add(`http://[::1]:${port}`);
    }
  }
  return result;
}

const sameOriginMutation: RequestHandler = (req, res, next) => {
  const fetchSite = req.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    res.status(403).json({ message: "Cross-site profile changes are not allowed" }); return;
  }
  const originHeader = req.get("origin");
  const refererHeader = req.get("referer");
  const allowed = ownOrigins(req);
  // Missing both headers is permitted only for unmarked non-browser clients.
  // Browser-marked requests must supply at least one verifiable origin header.
  // Any supplied header must be trusted, even Referer when Origin is present.
  if ((fetchSite !== undefined && originHeader === undefined && refererHeader === undefined) ||
      (originHeader !== undefined && !allowed.has(parseOrigin(originHeader, false) || "")) ||
      (refererHeader !== undefined && !allowed.has(parseOrigin(refererHeader, true) || ""))) {
    res.status(403).json({ message: "Cross-site profile changes are not allowed" }); return;
  }
  next();
};

function route(action: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return async (req, res) => {
    try { await action(req, res); }
    catch (error) {
      if (res.headersSent) return;
      if (error instanceof ProfileError) {
        if (error.status === 429) res.set("Retry-After", "3");
        res.status(error.status).json({ message: error.message });
      } else if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        res.status(409).json({ message: "Username is already taken" });
      } else {
        // Never log SQL errors, user identifiers, uploaded bytes or credentials.
        res.status(500).json({ message: "Unable to complete profile request" });
      }
    }
  };
}

function strictObject(body: unknown, keys: string[]): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProfileError(400, "Invalid request body");
  const value = body as Record<string, unknown>;
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new ProfileError(400, `Only ${keys.join(", ")} may be supplied`);
  }
  return value;
}

function productId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 2147483647) {
    throw new ProfileError(400, "productId must be a positive integer");
  }
  return value;
}

async function ensureProfile(userId: string, db: Queryable = pool): Promise<void> {
  // Do not copy auth.username: existing auth names need not be unique.
  await db.query("INSERT INTO public.user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [userId]);
}

async function favourites(userId: string, db: Queryable = pool) {
  const { rows } = await db.query(`SELECT p.id, p.name, p.image_url AS "imageUrl", p.price, p.currency
    FROM public.user_favourites f JOIN public.products p ON p.id = f.product_id
    WHERE f.user_id = $1 AND p.active IS TRUE ORDER BY p.sort_order ASC NULLS LAST, p.id ASC`, [userId]);
  return rows;
}

function avatarUrl(userId: string, updatedAt: Date | string | null): string {
  const version = updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt ?? "");
  // Query values only version the browser image; the endpoint ignores them and
  // selects exclusively by the authenticated owner, never by a client user ID.
  return `${PRIVATE_AVATAR_URL}?userId=${encodeURIComponent(userId)}&v=${encodeURIComponent(version)}`;
}

async function profileResponse(user: ProfileUser) {
  await ensureProfile(user.id);
  const [profile, favouriteItems, purchases, tickets] = await Promise.all([
    pool.query(`SELECT username, user_type AS "userType", avatar_data IS NOT NULL AS "hasAvatar",
      avatar_updated_at AS "avatarUpdatedAt", updated_at AS "updatedAt" FROM public.user_profiles WHERE user_id = $1`, [user.id]),
    favourites(user.id),
    pool.query(`SELECT id, amount_total AS "amountTotal", currency, status, items, created_at AS "createdAt"
      FROM public.orders WHERE owner_user_id = $1 ORDER BY created_at DESC NULLS LAST, id DESC`, [user.id]),
    pool.query(`SELECT id, label, event_id AS "eventId", ticket_reference AS "ticketReference", status, issued_at AS "issuedAt"
      FROM public.user_tickets WHERE user_id = $1 ORDER BY issued_at DESC, id DESC`, [user.id]),
  ]);
  const stored = profile.rows[0];
  if (!stored) throw new ProfileError(503, "Profile service unavailable");
  return {
    username: stored.username ?? user.username ?? null,
    userType: stored.userType,
    avatarUrl: stored.hasAvatar ? avatarUrl(user.id, stored.avatarUpdatedAt) : null,
    email: user.email ?? null,
    favourites: favouriteItems,
    purchases: purchases.rows.map((purchase) => {
      let items: unknown = [];
      try { items = typeof purchase.items === "string" ? JSON.parse(purchase.items) : purchase.items; } catch { /* Old malformed snapshots are empty. */ }
      return { ...purchase, items: Array.isArray(items) ? items : [] };
    }),
    tickets: tickets.rows,
    updatedAt: stored.updatedAt,
  };
}

function sniffAvatar(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const receiveAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1, fields: 0, parts: 1, headerPairs: 100 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new ProfileError(415, "Avatar must be a JPEG, PNG or WebP image")); return;
    }
    callback(null, true);
  },
}).single("file");

const avatarUpload: RequestHandler = (req, res, next) => {
  receiveAvatar(req, res, (error: unknown) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ message: "Avatar must not exceed 5 MB" });
      } else if (error instanceof ProfileError) {
        res.status(error.status).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Supply exactly one file field and no other fields" });
      }
      return;
    }
    next();
  });
};

async function mergeFavourites(userId: string, ids: number[], strictSingle: boolean) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureProfile(userId, client);
    // Serialize additions/deletions for this owner, including multiple servers.
    await client.query("SELECT user_id FROM public.user_profiles WHERE user_id = $1 FOR UPDATE", [userId]);
    const active = await client.query(`SELECT id FROM public.products WHERE id = ANY($1::integer[]) AND active IS TRUE
      ORDER BY id FOR SHARE`, [ids]);
    if (strictSingle && active.rows.length === 0) throw new ProfileError(404, "Active product not found");
    const existing = await client.query("SELECT product_id FROM public.user_favourites WHERE user_id = $1", [userId]);
    const saved = new Set<number>(existing.rows.map((row) => row.product_id));
    const additions: number[] = active.rows.map((row) => row.id).filter((id) => !saved.has(id));
    if (saved.size + additions.length > MAX_FAVOURITES) throw new ProfileError(409, "A profile may have at most 500 favourites");
    if (additions.length) {
      await client.query(`INSERT INTO public.user_favourites (user_id, product_id)
        SELECT $1, unnest($2::integer[]) ON CONFLICT (user_id, product_id) DO NOTHING`, [userId, additions]);
      await client.query("UPDATE public.user_profiles SET updated_at = now() WHERE user_id = $1", [userId]);
    }
    const items = await favourites(userId, client);
    await client.query("COMMIT");
    return items;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

/** Register after setupAuth() and body parsers; initialize storage before listen. */
export function registerProfileRoutes(app: Express): void {
  app.use("/api/profile", privateHeaders, authenticate);

  app.get("/api/profile", route(async (req, res) => {
    res.json(await profileResponse(owner(req)));
  }));

  app.get("/api/profile/avatar", route(async (req, res) => {
    const { rows } = await pool.query("SELECT avatar_data, avatar_mime FROM public.user_profiles WHERE user_id = $1", [owner(req).id]);
    const stored = rows[0];
    if (!stored?.avatar_data || !stored.avatar_mime) throw new ProfileError(404, "Avatar not found");
    const bytes = Buffer.from(stored.avatar_data, "base64");
    const mime = sniffAvatar(bytes);
    if (!mime || mime !== stored.avatar_mime || bytes.length > MAX_AVATAR_BYTES) throw new ProfileError(404, "Avatar not found");
    res.set({ "Content-Type": mime, "Content-Disposition": "inline", "Cross-Origin-Resource-Policy": "same-origin" });
    res.send(bytes);
  }));

  app.patch("/api/profile", sameOriginMutation, route(async (req, res) => {
    const { username } = strictObject(req.body, ["username"]);
    if (typeof username !== "string") throw new ProfileError(400, "username must be a string");
    const normalized = username.trim();
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(normalized)) throw new ProfileError(400, "Username must be 3–40 letters, numbers, underscores, dots or hyphens");
    const user = owner(req);
    await ensureProfile(user.id);
    await pool.query("UPDATE public.user_profiles SET username = $2, updated_at = now() WHERE user_id = $1", [user.id, normalized]);
    res.json(await profileResponse(user));
  }));

  app.post("/api/profile/avatar", sameOriginMutation, avatarUpload, route(async (req, res) => {
    const file = req.file;
    if (!file?.buffer?.length) throw new ProfileError(400, "An avatar file is required");
    const mime = sniffAvatar(file.buffer);
    if (!mime || mime !== file.mimetype) throw new ProfileError(415, "Avatar content must match its JPEG, PNG or WebP MIME type");
    const user = owner(req);
    await ensureProfile(user.id);
    // Persistent atomic cooldown: at most one successful write every 3 seconds
    // per profile (about 20/minute), shared across sessions and server instances.
    const updated = await pool.query(`UPDATE public.user_profiles SET avatar_data = $2, avatar_mime = $3,
      avatar_updated_at = now(), updated_at = now() WHERE user_id = $1
      AND (avatar_updated_at IS NULL OR avatar_updated_at <= now() - interval '3 seconds')
      RETURNING avatar_updated_at AS "avatarUpdatedAt"`, [user.id, file.buffer.toString("base64"), mime]);
    if (!updated.rowCount) throw new ProfileError(429, "Please wait a few seconds before updating your avatar again");
    res.json({ avatarUrl: avatarUrl(user.id, updated.rows[0].avatarUpdatedAt), updatedAt: updated.rows[0].avatarUpdatedAt });
  }));

  app.post("/api/profile/favourites", sameOriginMutation, route(async (req, res) => {
    const body = strictObject(req.body, ["productId"]);
    res.json({ favourites: await mergeFavourites(owner(req).id, [productId(body.productId)], true) });
  }));

  // Deliberately opt-in. Never automatically upload a shared device's wishlist.
  app.post("/api/profile/favourites/import", sameOriginMutation, route(async (req, res) => {
    const { productIds } = strictObject(req.body, ["productIds"]);
    if (!Array.isArray(productIds) || productIds.length > MAX_FAVOURITES) throw new ProfileError(400, "productIds must be an array of at most 500 product IDs");
    const ids = Array.from(new Set(productIds.map(productId)));
    // Missing/inactive IDs in a saved local list are safely skipped.
    res.json({ favourites: await mergeFavourites(owner(req).id, ids, false) });
  }));

  app.delete("/api/profile/favourites/:productId", sameOriginMutation, route(async (req, res) => {
    const parameter = req.params.productId;
    if (typeof parameter !== "string" || !/^[1-9]\d{0,9}$/.test(parameter)) throw new ProfileError(400, "productId must be a positive integer");
    const id = productId(Number(parameter));
    const user = owner(req);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await ensureProfile(user.id, client);
      await client.query("SELECT user_id FROM public.user_profiles WHERE user_id = $1 FOR UPDATE", [user.id]);
      const deleted = await client.query("DELETE FROM public.user_favourites WHERE user_id = $1 AND product_id = $2", [user.id, id]);
      if (deleted.rowCount) await client.query("UPDATE public.user_profiles SET updated_at = now() WHERE user_id = $1", [user.id]);
      const items = await favourites(user.id, client);
      await client.query("COMMIT");
      res.json({ favourites: items });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }));

  // No client ticket/purchase issuance or arbitrary profile mutation endpoints.
  // Keep unknown profile paths out of the frontend SPA's successful fallback.
  app.use("/api/profile", privateHeaders, (_req, res) => {
    res.status(404).json({ message: "Profile endpoint not found" });
  });
}
