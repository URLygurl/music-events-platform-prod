import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { insertEnquirySchema, insertArtistSchema, insertEventSchema, insertMediaItemSchema, insertDonationSchema, insertDsClientSchema, insertProductSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated, isAdmin, isSuperAdmin, logActivity, getSessionUser } from "./auth";
import { db } from "./db";
import { activityLog } from "@shared/models/auth";
import { desc } from "drizzle-orm";
import Stripe from "stripe";
import { appendToSheet, isGoogleSheetsConnected, testGoogleSheetsConnection } from "./google-sheets";
import { getConciergeSettings, buildSystemPrompt, callConciergeAI, generateArtistData } from "./concierge";
import multer from "multer";
import path from "path";
import Papa from "papaparse";

// ─── Hermes token helpers (module-level) ─────────────────────────────────────

function getHermesSecret(): string {
  return process.env.HERMES_SECRET || "hermes-dev-secret-change-in-production";
}

function signHermesToken(payload: object): string {
  const secret = getHermesSecret();
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return Buffer.from(JSON.stringify({ data, sig })).toString("base64url");
}

function verifyHermesToken(token: string): { valid: boolean; payload?: any } {
  try {
    const secret = getHermesSecret();
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    const expected = crypto.createHmac("sha256", secret).update(decoded.data).digest("hex");
    if (expected !== decoded.sig) return { valid: false };
    const payload = JSON.parse(decoded.data);
    if (payload.exp && Date.now() > payload.exp) return { valid: false };
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

// Helper: get Stripe instance from DB settings
async function getStripe(): Promise<Stripe | null> {
  const setting = await storage.getSetting("stripe_secret_key");
  const key = setting?.value?.trim();
  if (!key || !key.startsWith("sk_")) return null;
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" as any });
}

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const FONT_MIMES = ["font/ttf", "font/otf", "font/woff", "font/woff2", "application/font-woff", "application/font-woff2", "application/x-font-ttf", "application/x-font-otf", "application/octet-stream"];

const ALLOWED_EMBED_HOSTS = [
  "youtube.com", "www.youtube.com", "youtu.be",
  "bandcamp.com",
  "soundcloud.com", "w.soundcloud.com",
  "open.spotify.com", "embed.spotify.com",
  "embed.music.apple.com", "music.apple.com",
];

function isValidEmbedUrl(url: string | undefined | null): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return ALLOWED_EMBED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

async function tryAppendToSheet(sheetSettingKey: string, values: string[][]) {
  try {
    const setting = await storage.getSetting(sheetSettingKey);
    if (!setting?.value) return;
    const connected = await isGoogleSheetsConnected();
    if (!connected) return;
    const parts = setting.value.split("|");
    const spreadsheetId = parts[0]?.trim();
    const sheetName = parts[1]?.trim() || "Sheet1";
    if (!spreadsheetId) return;
    await appendToSheet(spreadsheetId, sheetName, values);
  } catch (error) {
    console.error(`Failed to append to Google Sheet (${sheetSettingKey}):`, error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/bootstrap-admin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const existingAdmins = await storage.getAllUsers();
      const hasSuperAdmin = existingAdmins.some((u: any) => u.role === "superadmin");
      if (hasSuperAdmin) {
        return res.status(403).json({ message: "Superadmin already exists" });
      }
      await storage.updateUserRole(userId, "superadmin");
      res.json({ message: "You are now superadmin. Refresh the page." });
    } catch (error) {
      console.error("Bootstrap admin error:", error);
      res.status(500).json({ message: "Failed to bootstrap admin" });
    }
  });

  app.get("/api/artists", async (_req, res) => {
    try {
      const artists = await storage.getArtists();
      res.json(artists);
    } catch (error) {
      console.error("Error fetching artists:", error);
      res.status(500).json({ message: "Failed to fetch artists" });
    }
  });

  app.get("/api/artists/export/csv", isAdmin, async (_req, res) => {
    try {
      const allArtists = await storage.getArtists();
      const csvData = allArtists.map((a) => ({
        name: a.name,
        genre: a.genre,
        description: a.description,
        origin: a.origin || "",
        members: a.members || "",
        bio: a.bio || "",
        website: a.website || "",
        email: a.email || "",
        phone: a.phone || "",
        socialLinks: a.socialLinks || "",
        timeSlot: a.timeSlot || "",
        featured: a.featured ? "true" : "false",
        imageUrl: a.imageUrl || "",
        imageUrl2: a.imageUrl2 || "",
        promoterImageUrl: a.promoterImageUrl || "",
        songLink1: a.songLink1 || "",
        songLink2: a.songLink2 || "",
        videoLink1: a.videoLink1 || "",
        videoLink2: a.videoLink2 || "",
        customLink1: a.customLink1 || "",
        customLink2: a.customLink2 || "",
        customLink3: a.customLink3 || "",
        customLink4: a.customLink4 || "",
        customLink5: a.customLink5 || "",
      }));
      const csv = Papa.unparse(csvData);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=artists.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting artists:", error);
      res.status(500).json({ message: "Failed to export artists" });
    }
  });

  app.post("/api/artists/import/csv", isAdmin, csvUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const csvText = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) {
        return res.status(400).json({ message: "CSV parsing errors", errors: parsed.errors.slice(0, 5) });
      }
      const rows = parsed.data;
      if (rows.length === 0) {
        return res.status(400).json({ message: "CSV file is empty" });
      }
      let imported = 0;
      let skipped = 0;
      const g = (row: Record<string, string>, ...keys: string[]) => {
        for (const k of keys) { if (row[k]?.trim()) return row[k].trim(); }
        return "";
      };
      for (const row of rows) {
        const name = g(row, "name", "Name");
        if (!name) { skipped++; continue; }
        await storage.createArtist({
          name,
          genre: g(row, "genre", "Genre") || "Uncategorized",
          description: g(row, "description", "Description") || "",
          imageUrl: g(row, "imageUrl", "image_url", "ImageUrl"),
          imageUrl2: g(row, "imageUrl2", "image_url_2") || null,
          email: g(row, "email", "Email") || null,
          phone: g(row, "phone", "Phone") || null,
          socialLinks: g(row, "socialLinks", "social_links", "SocialLinks") || null,
          timeSlot: g(row, "timeSlot", "time_slot", "TimeSlot") || null,
          featured: ["true", "yes", "1"].includes(g(row, "featured", "Featured").toLowerCase()),
          promoterImageUrl: g(row, "promoterImageUrl", "promoter_image_url") || null,
          origin: g(row, "origin", "Origin") || null,
          members: g(row, "members", "Members") || null,
          bio: g(row, "bio", "Bio") || null,
          website: g(row, "website", "Website") || null,
          songLink1: g(row, "songLink1", "song_link_1") || null,
          songLink2: g(row, "songLink2", "song_link_2") || null,
          videoLink1: g(row, "videoLink1", "video_link_1") || null,
          videoLink2: g(row, "videoLink2", "video_link_2") || null,
          customLink1: g(row, "customLink1", "custom_link_1") || null,
          customLink2: g(row, "customLink2", "custom_link_2") || null,
          customLink3: g(row, "customLink3", "custom_link_3") || null,
          customLink4: g(row, "customLink4", "custom_link_4") || null,
          customLink5: g(row, "customLink5", "custom_link_5") || null,
        });
        imported++;
      }
      res.json({ message: `Imported ${imported} artists${skipped > 0 ? `, skipped ${skipped} rows (missing name)` : ""}`, imported, skipped });
    } catch (error) {
      console.error("Error importing artists:", error);
      res.status(500).json({ message: "Failed to import artists" });
    }
  });

  app.get("/api/artists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid artist ID" });
      const artist = await storage.getArtist(id);
      if (!artist) return res.status(404).json({ message: "Artist not found" });
      res.json(artist);
    } catch (error) {
      console.error("Error fetching artist:", error);
      res.status(500).json({ message: "Failed to fetch artist" });
    }
  });

  app.post("/api/artists", isAdmin, async (req, res) => {
    try {
      const parsed = insertArtistSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const artist = await storage.createArtist(parsed.data);
      res.status(201).json(artist);
    } catch (error) {
      console.error("Error creating artist:", error);
      res.status(500).json({ message: "Failed to create artist" });
    }
  });

  app.patch("/api/artists/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid artist ID" });
      const artist = await storage.updateArtist(id, req.body);
      if (!artist) return res.status(404).json({ message: "Artist not found" });
      res.json(artist);
    } catch (error) {
      console.error("Error updating artist:", error);
      res.status(500).json({ message: "Failed to update artist" });
    }
  });

  app.delete("/api/artists/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid artist ID" });
      await storage.deleteArtist(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting artist:", error);
      res.status(500).json({ message: "Failed to delete artist" });
    }
  });

  app.get("/api/events", async (_req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const event = await storage.getEvent(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", isAdmin, async (req, res) => {
    try {
      const parsed = insertEventSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const event = await storage.createEvent(parsed.data);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.patch("/api/events/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const event = await storage.updateEvent(id, req.body);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      await storage.deleteEvent(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  app.post("/api/enquiries", async (req, res) => {
    try {
      const parsed = insertEnquirySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid enquiry data", errors: parsed.error.errors });
      const enquiry = await storage.createEnquiry(parsed.data);
      res.status(201).json(enquiry);

      tryAppendToSheet("google_sheet_enquiries", [
        [parsed.data.name, parsed.data.email, (parsed.data as any).phone || "", (parsed.data as any).subject || "", parsed.data.message || "", new Date().toISOString()],
      ]);
    } catch (error) {
      console.error("Error creating enquiry:", error);
      res.status(500).json({ message: "Failed to submit enquiry" });
    }
  });

  app.get("/api/enquiries", isAdmin, async (_req, res) => {
    try {
      const enquiries = await storage.getEnquiries();
      res.json(enquiries);
    } catch (error) {
      console.error("Error fetching enquiries:", error);
      res.status(500).json({ message: "Failed to fetch enquiries" });
    }
  });

  app.get("/api/enquiries/export/csv", isAdmin, async (_req, res) => {
    try {
      const rows = await storage.getEnquiries();
      const header = "ID,Name,Email,Phone,Subject,Message,Date\n";
      const csv = rows.map((r: any) =>
        [r.id, r.name, r.email, r.phone || "", r.subject || "", (r.message || "").replace(/\n/g, " "), r.createdAt ? new Date(r.createdAt).toISOString() : ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="enquiries-${Date.now()}.csv"`);
      res.send(header + csv);
    } catch (error) {
      res.status(500).json({ message: "Export failed" });
    }
  });

  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", isAdmin, async (req, res) => {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings)) return res.status(400).json({ message: "settings must be an array" });
      await storage.upsertManySettings(settings);
      const all = await storage.getAllSettings();
      res.json(all);
    } catch (error) {
      console.error("Error saving settings:", error);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  const memUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"));
      }
    },
  });

  app.post("/api/upload", isAdmin, memUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const base64 = req.file.buffer.toString("base64");
      const saved = await storage.createUploadedFile({
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        data: base64,
      });
      const url = `/api/files/${saved.id}`;
      res.json({ url });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  const fontMemUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if ([".ttf", ".otf", ".woff", ".woff2"].includes(ext) || FONT_MIMES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only font files (.ttf, .otf, .woff, .woff2) are allowed"));
      }
    },
  });

  app.post("/api/upload/font", isAdmin, fontMemUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const base64 = req.file.buffer.toString("base64");
      const saved = await storage.createUploadedFile({
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        data: base64,
      });
      const url = `/api/files/${saved.id}`;
      res.json({ url, filename: req.file.originalname });
    } catch (error) {
      console.error("Error uploading font:", error);
      res.status(500).json({ message: "Failed to upload font" });
    }
  });

  app.get("/api/files/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid file ID" });
      const file = await storage.getUploadedFile(id);
      if (!file) return res.status(404).json({ message: "File not found" });
      const buffer = Buffer.from(file.data, "base64");
      res.set({
        "Content-Type": file.mimeType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      res.send(buffer);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  app.get("/api/media", async (_req, res) => {
    try {
      const items = await storage.getMediaItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ message: "Failed to fetch media" });
    }
  });

  app.post("/api/media", isAdmin, async (req, res) => {
    try {
      const parsed = insertMediaItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      if (!isValidEmbedUrl(parsed.data.url) || !isValidEmbedUrl(parsed.data.embedUrl)) {
        return res.status(400).json({ message: "URL must be from an allowed platform (YouTube, Bandcamp, SoundCloud, Spotify)" });
      }
      const item = await storage.createMediaItem(parsed.data);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating media item:", error);
      res.status(500).json({ message: "Failed to create media item" });
    }
  });

  app.patch("/api/media/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid media ID" });
      const { title, url, type, embedUrl, order } = req.body;
      if (!isValidEmbedUrl(url) || !isValidEmbedUrl(embedUrl)) {
        return res.status(400).json({ message: "URL must be from an allowed platform (YouTube, Bandcamp, SoundCloud, Spotify)" });
      }
      const item = await storage.updateMediaItem(id, { title, url, type, embedUrl, order });
      if (!item) return res.status(404).json({ message: "Media item not found" });
      res.json(item);
    } catch (error) {
      console.error("Error updating media item:", error);
      res.status(500).json({ message: "Failed to update media item" });
    }
  });

  app.delete("/api/media/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid media ID" });
      await storage.deleteMediaItem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting media item:", error);
      res.status(500).json({ message: "Failed to delete media item" });
    }
  });

  app.get("/api/donations", isAdmin, async (_req, res) => {
    try {
      const all = await storage.getDonations();
      res.json(all);
    } catch (error) {
      console.error("Error fetching donations:", error);
      res.status(500).json({ message: "Failed to fetch donations" });
    }
  });

  app.get("/api/donations/export/csv", isAdmin, async (_req, res) => {
    try {
      const rows = await storage.getDonations();
      const header = "ID,Name,Email,Amount,Message,Date\n";
      const csv = rows.map((r: any) =>
        [r.id, r.name, r.email, r.amount, (r.message || "").replace(/\n/g, " "), r.createdAt ? new Date(r.createdAt).toISOString() : ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="donations-${Date.now()}.csv"`);
      res.send(header + csv);
    } catch (error) {
      res.status(500).json({ message: "Export failed" });
    }
  });

  app.post("/api/donations", async (req, res) => {
    try {
      const parsed = insertDonationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const donation = await storage.createDonation(parsed.data);
      res.status(201).json(donation);

      tryAppendToSheet("google_sheet_donations", [
        [parsed.data.name, parsed.data.email, parsed.data.amount, parsed.data.message || "", new Date().toISOString()],
      ]);
    } catch (error) {
      console.error("Error creating donation:", error);
      res.status(500).json({ message: "Failed to submit donation" });
    }
  });

  app.get("/api/ds-clients", async (_req, res) => {
    try {
      const all = await storage.getDsClients();
      res.json(all);
    } catch (error) {
      console.error("Error fetching DS clients:", error);
      res.status(500).json({ message: "Failed to fetch DS clients" });
    }
  });

  app.get("/api/ds-clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getDsClient(id);
      if (!client) return res.status(404).json({ message: "DS client not found" });
      res.json(client);
    } catch (error) {
      console.error("Error fetching DS client:", error);
      res.status(500).json({ message: "Failed to fetch DS client" });
    }
  });

  app.post("/api/ds-clients", isAdmin, async (req, res) => {
    try {
      const parsed = insertDsClientSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const client = await storage.createDsClient(parsed.data);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating DS client:", error);
      res.status(500).json({ message: "Failed to create DS client" });
    }
  });

  app.patch("/api/ds-clients/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateDsClient(id, req.body);
      if (!updated) return res.status(404).json({ message: "DS client not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating DS client:", error);
      res.status(500).json({ message: "Failed to update DS client" });
    }
  });

  app.delete("/api/ds-clients/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDsClient(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting DS client:", error);
      res.status(500).json({ message: "Failed to delete DS client" });
    }
  });

  app.get("/api/users", isSuperAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id/role", isSuperAdmin, async (req: any, res) => {
    try {
      const { role } = req.body;
      if (!role || !["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Role must be 'user' or 'admin'" });
      }
      const currentUserId = (req as any).user?.id;
      if (currentUserId && currentUserId === req.params.id) {
        return res.status(403).json({ message: "You cannot change your own role" });
      }
      const updated = await storage.updateUserRole(req.params.id, role);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.post("/api/ai/chat", isAdmin, async (req, res) => {
    try {
      const { message, provider, apiKey } = req.body;
      if (!message || !apiKey) return res.status(400).json({ message: "Message and API key required" });

      const p = provider || "openai";
      let baseUrl = "https://api.openai.com/v1";
      if (p === "anthropic") baseUrl = "https://api.anthropic.com/v1";

      if (p === "anthropic") {
        const resp = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            messages: [{ role: "user", content: message }],
          }),
        });
        if (!resp.ok) {
          const err = await resp.text();
          return res.status(resp.status).json({ message: `AI API error: ${err}` });
        }
        const data = await resp.json();
        res.json({ reply: data.content?.[0]?.text || "No response" });
      } else {
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: message }],
            max_tokens: 1024,
          }),
        });
        if (!resp.ok) {
          const err = await resp.text();
          return res.status(resp.status).json({ message: `AI API error: ${err}` });
        }
        const data = await resp.json();
        res.json({ reply: data.choices?.[0]?.message?.content || "No response" });
      }
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ message: "AI request failed" });
    }
  });

  // GET /api/concierge/settings — public: get concierge config for the frontend
  app.get("/api/concierge/settings", async (_req, res) => {
    try {
      const settings = await getConciergeSettings();
      // Only expose non-sensitive settings to the frontend
      res.json({
        enabled: settings.enabled,
        publicAccess: settings.publicAccess,
        name: settings.name,
        triviaFrequencyMins: settings.triviaFrequencyMins,
        hasApiKey: !!settings.apiKey,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get concierge settings" });
    }
  });

  // POST /api/concierge/chat — chat with the AI concierge
  app.post("/api/concierge/chat", async (req: any, res) => {
    try {
      const settings = await getConciergeSettings();
      if (!settings.enabled) return res.status(403).json({ message: "Concierge is not enabled" });
      if (!settings.apiKey) return res.status(400).json({ message: "No API key configured" });

      const isUserAdmin = req.user?.role === "admin" || req.user?.role === "superadmin";
      const isPublic = settings.publicAccess;
      const isLoggedIn = !!req.user;

      if (!isPublic && !isLoggedIn) {
        return res.status(401).json({ message: "Please log in to use the concierge" });
      }

      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "Messages array required" });
      }

      const systemPrompt = await buildSystemPrompt(isUserAdmin);
      const reply = await callConciergeAI(messages, systemPrompt, settings);
      res.json({ reply });
    } catch (error: any) {
      console.error("Concierge chat error:", error);
      res.status(500).json({ message: error.message || "Concierge request failed" });
    }
  });

  // POST /api/concierge/trivia — get a trivia fact about a playing artist
  app.post("/api/concierge/trivia", async (req: any, res) => {
    try {
      const settings = await getConciergeSettings();
      if (!settings.enabled || !settings.apiKey) {
        return res.status(403).json({ message: "Concierge not configured" });
      }
      const isPublic = settings.publicAccess;
      const isLoggedIn = !!req.user;
      if (!isPublic && !isLoggedIn) {
        return res.status(401).json({ message: "Please log in" });
      }
      const systemPrompt = await buildSystemPrompt(false);
      const reply = await callConciergeAI(
        [{ role: "user", content: "Give me one interesting trivia fact about one of the artists playing at this event. Keep it to 2-3 sentences." }],
        systemPrompt,
        settings
      );
      res.json({ trivia: reply });
    } catch (error: any) {
      console.error("Concierge trivia error:", error);
      res.status(500).json({ message: error.message || "Trivia request failed" });
    }
  });

  // POST /api/concierge/generate-artist — admin only: generate artist data using AI
  app.post("/api/concierge/generate-artist", isAdmin, async (req, res) => {
    try {
      const settings = await getConciergeSettings();
      if (!settings.apiKey) return res.status(400).json({ message: "No concierge API key configured" });
      const { artistName } = req.body;
      if (!artistName) return res.status(400).json({ message: "artistName required" });
      const data = await generateArtistData(artistName, settings);
      res.json(data);
    } catch (error: any) {
      console.error("Generate artist error:", error);
      res.status(500).json({ message: error.message || "Artist generation failed" });
    }
  });

  // POST /api/google/test-connection — admin only: test Google Service Account connection
  app.post("/api/google/test-connection", isAdmin, async (_req, res) => {
    try {
      const result = await testGoogleSheetsConnection();
      res.json(result);
    } catch (error) {
      console.error("Error testing Google connection:", error);
      res.status(500).json({ ok: false, error: "Connection test failed" });
    }
  });

  // GET /api/activity-log — super admin only: view all admin activity
  app.get("/api/activity-log", isSuperAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || "100")), 500);
      const logs = await db
        .select()
        .from(activityLog)
        .orderBy(desc(activityLog.createdAt))
        .limit(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity log:", error);
      res.status(500).json({ message: "Failed to fetch activity log" });
    }
  });

  // ============================================================
  // PRODUCTS API
  // ============================================================
  app.get("/api/products", async (_req, res) => {
    try {
      const all = await storage.getProducts();
      res.json(all.filter((p: any) => p.active));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/products/all", isAdmin, async (_req, res) => {
    try {
      res.json(await storage.getProducts());
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product || !product.active) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/products", isAdmin, async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      await logActivity(req, "create_product", `Created product: ${product.name}`);
      res.json(product);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.put("/api/products/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.updateProduct(id, req.body);
      if (!product) return res.status(404).json({ message: "Product not found" });
      await logActivity(req, "update_product", `Updated product: ${product.name}`);
      res.json(product);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/products/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      await logActivity(req, "delete_product", `Deleted product id: ${id}`);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ============================================================
  // STRIPE CHECKOUT
  // ============================================================

  // GET /api/stripe/config — public: get publishable key for frontend
  app.get("/api/stripe/config", async (_req, res) => {
    try {
      const setting = await storage.getSetting("stripe_publishable_key");
      const key = setting?.value?.trim();
      res.json({ publishableKey: key && key.startsWith("pk_") ? key : null });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/stripe/checkout — create a Stripe Hosted Checkout session for products
  app.post("/api/stripe/checkout", async (req: Request, res: Response) => {
    try {
      const stripe = await getStripe();
      if (!stripe) return res.status(400).json({ message: "Stripe is not configured. Please add your Stripe Secret Key in the Integrations panel." });

      const { items, successUrl, cancelUrl, customerEmail, metadata } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "No items provided" });
      }

      const lineItems = items.map((item: any) => ({
        price_data: {
          currency: (item.currency || "nzd").toLowerCase(),
          product_data: {
            name: item.name,
            description: item.description || undefined,
            images: item.imageUrl ? [item.imageUrl] : undefined,
          },
          unit_amount: Math.round(item.price),
        },
        quantity: item.quantity || 1,
      }));

      const origin = (req.headers.origin as string) || "https://deadsounds.live";
      const afterpaySetting = await storage.getSetting("stripe_afterpay_enabled");
      const afterpayEnabled = afterpaySetting?.value === "true";
      const paymentMethodTypes: string[] = ["card"];
      if (afterpayEnabled) paymentMethodTypes.push("afterpay_clearpay");
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: paymentMethodTypes as any,
        line_items: lineItems,
        customer_email: customerEmail || undefined,
        success_url: successUrl || `${origin}/shop?success=1`,
        cancel_url: cancelUrl || `${origin}/shop?cancelled=1`,
        metadata: metadata || {},
      });

      await storage.createOrder({
        stripeSessionId: session.id,
        customerEmail: customerEmail || null,
        amountTotal: session.amount_total,
        currency: session.currency,
        status: "pending",
        items: JSON.stringify(items),
        metadata: JSON.stringify(metadata || {}),
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (e: any) {
      console.error("Stripe checkout error:", e);
      res.status(500).json({ message: e.message || "Checkout failed" });
    }
  });

  // POST /api/stripe/checkout-donation — Stripe Hosted Checkout for donations
  app.post("/api/stripe/checkout-donation", async (req: Request, res: Response) => {
    try {
      const stripe = await getStripe();
      if (!stripe) return res.status(400).json({ message: "Stripe is not configured. Please add your Stripe Secret Key in the Integrations panel." });

      const { amount, currency, name, email, message, successUrl, cancelUrl } = req.body;
      if (!amount || amount < 100) return res.status(400).json({ message: "Minimum donation is $1.00" });

      const origin = (req.headers.origin as string) || "https://deadsounds.live";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency: (currency || "nzd").toLowerCase(),
            product_data: { name: "Donation", description: message || "Thank you for your support!" },
            unit_amount: Math.round(amount),
          },
          quantity: 1,
        }],
        customer_email: email || undefined,
        success_url: successUrl || `${origin}/donate?success=1`,
        cancel_url: cancelUrl || `${origin}/donate?cancelled=1`,
        metadata: { type: "donation", donorName: name || "", message: message || "" },
      });

      await storage.createOrder({
        stripeSessionId: session.id,
        customerEmail: email || null,
        customerName: name || null,
        amountTotal: Math.round(amount),
        currency: (currency || "nzd").toLowerCase(),
        status: "pending",
        items: JSON.stringify([{ name: "Donation", price: amount, quantity: 1 }]),
        metadata: JSON.stringify({ type: "donation", message }),
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (e: any) {
      console.error("Stripe donation error:", e);
      res.status(500).json({ message: e.message || "Donation checkout failed" });
    }
  });

  // POST /api/stripe/webhook — Stripe webhook handler
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    try {
      const stripe = await getStripe();
      if (!stripe) return res.status(400).send("Stripe not configured");

      const webhookSecretSetting = await storage.getSetting("stripe_webhook_secret");
      const webhookSecret = webhookSecretSetting?.value?.trim();

      let event: Stripe.Event;
      if (webhookSecret && req.headers["stripe-signature"]) {
        const sig = req.headers["stripe-signature"] as string;
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }
      } else {
        try {
          const raw = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
          event = JSON.parse(raw) as Stripe.Event;
        } catch {
          return res.status(400).send("Invalid JSON");
        }
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const order = await storage.getOrderBySessionId(session.id);
        if (order) await storage.updateOrderStatus(order.id, "paid");
      } else if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        const order = await storage.getOrderBySessionId(session.id);
        if (order) await storage.updateOrderStatus(order.id, "failed");
      }

      res.json({ received: true });
    } catch (e: any) {
      console.error("Webhook error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ============================================================
  // PAYPAL CHECKOUT
  // ============================================================
  // GET /api/paypal/config — public: check if PayPal is configured
  app.get("/api/paypal/config", async (_req, res) => {
    try {
      const setting = await storage.getSetting("paypal_client_id");
      const clientId = setting?.value?.trim();
      res.json({ clientId: clientId && clientId.length > 10 ? clientId : null });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/paypal/checkout — create a PayPal order and return approval URL
  app.post("/api/paypal/checkout", async (req: Request, res: Response) => {
    try {
      const clientIdSetting = await storage.getSetting("paypal_client_id");
      const secretSetting = await storage.getSetting("paypal_secret");
      const clientId = clientIdSetting?.value?.trim();
      const secret = secretSetting?.value?.trim();
      if (!clientId || !secret) {
        return res.status(400).json({ message: "PayPal is not configured. Please add your PayPal Client ID and Secret in the Integrations panel." });
      }
      const { items, customerEmail, currency } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "No items provided" });
      }
      const modeSetting = await storage.getSetting("paypal_mode");
      const mode = modeSetting?.value?.trim() === "live" ? "live" : "sandbox";
      const baseUrl = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      // Get access token
      const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({})) as any;
        return res.status(400).json({ message: `PayPal auth failed: ${JSON.stringify(err)}` });
      }
      const { access_token } = await tokenRes.json() as any;
      const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * (item.quantity || 1)), 0);
      const cur = (currency || "NZD").toUpperCase();
      const origin = (req.headers.origin as string) || "https://deadsounds.live";
      // Create PayPal order
      const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: {
              currency_code: cur,
              value: (totalAmount / 100).toFixed(2),
              breakdown: { item_total: { currency_code: cur, value: (totalAmount / 100).toFixed(2) } },
            },
            items: items.map((item: any) => ({
              name: item.name,
              quantity: String(item.quantity || 1),
              unit_amount: { currency_code: cur, value: (item.price / 100).toFixed(2) },
            })),
          }],
          application_context: {
            return_url: `${origin}/shop?paypal=success`,
            cancel_url: `${origin}/shop?paypal=cancelled`,
            user_action: "PAY_NOW",
          },
        }),
      });
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({})) as any;
        return res.status(400).json({ message: `PayPal order creation failed: ${JSON.stringify(err)}` });
      }
      const ppOrder = await orderRes.json() as any;
      const approveLink = ppOrder.links?.find((l: any) => l.rel === "approve")?.href;
      await storage.createOrder({
        stripeSessionId: `paypal_${ppOrder.id}`,
        customerEmail: customerEmail || null,
        amountTotal: totalAmount,
        currency: cur.toLowerCase(),
        status: "pending",
        items: JSON.stringify(items),
        metadata: JSON.stringify({ provider: "paypal", paypalOrderId: ppOrder.id }),
      });
      res.json({ url: approveLink, orderId: ppOrder.id });
    } catch (e: any) {
      console.error("PayPal checkout error:", e);
      res.status(500).json({ message: e.message || "PayPal checkout failed" });
    }
  });

  // GET /api/orders — admin only: view all orders
  app.get("/api/orders", isAdmin, async (_req, res) => {
    try {
      res.json(await storage.getOrders());
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ============================================================
  // HERMES BACKEND DASHBOARD API
  // ============================================================
  //
  // Auth model:
  //   POST /api/hermes/login  — accepts HERMES_SECRET from env, returns a signed token
  //   All other /api/hermes/* routes require either:
  //     a) A valid hermes_token (Bearer header) — full access (superadmin-equivalent)
  //     b) A valid main-app session with role admin/superadmin — read-only access
  //
  // The token is a simple HMAC-SHA256 signed payload (no external JWT library needed).

  // Middleware: accept hermes token OR admin/superadmin session
  const hermesAuth: RequestHandler = async (req: any, res: any, next: any) => {
    // Check Bearer token first
    const authHeader = req.headers["authorization"] || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { valid, payload } = verifyHermesToken(token);
      if (valid) {
        req.hermesUser = { role: "superadmin", via: "token", ...payload };
        return next();
      }
    }
    // Fall back to session-based admin check (read-only path)
    const user = await getSessionUser(req);
    if (user && (user.role === "admin" || user.role === "superadmin")) {
      req.hermesUser = { role: user.role, via: "session", email: user.email };
      return next();
    }
    return res.status(401).json({ message: "Hermes: unauthorized" });
  };

  // Middleware: require full hermes token (superadmin-only operations)
  const hermesTokenRequired: RequestHandler = async (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"] || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { valid, payload } = verifyHermesToken(token);
      if (valid) {
        req.hermesUser = { role: "superadmin", via: "token", ...payload };
        return next();
      }
    }
    return res.status(403).json({ message: "Hermes: superadmin token required" });
  };

  // POST /api/hermes/login — exchange HERMES_SECRET for a token
  app.post("/api/hermes/login", async (req: any, res: any) => {
    try {
      const { secret } = req.body;
      if (!secret) return res.status(400).json({ message: "secret required" });
      const expected = getHermesSecret();
      if (secret !== expected) {
        return res.status(401).json({ message: "Invalid Hermes secret" });
      }
      const payload = { iat: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000, role: "superadmin" };
      const token = signHermesToken(payload);
      res.json({ token, expiresAt: payload.exp });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/hermes/me — return current hermes identity
  app.get("/api/hermes/me", hermesAuth, async (req: any, res: any) => {
    res.json({ hermesUser: req.hermesUser });
  });

  // GET /api/hermes/ping — check connectivity to external container
  app.get("/api/hermes/ping", hermesAuth, async (req: any, res: any) => {
    try {
      const containerUrlSetting = await storage.getSetting("hermes_container_url");
      const containerUrl = containerUrlSetting?.value?.trim();
      if (!containerUrl) {
        return res.json({ status: "unconfigured", message: "No container URL configured" });
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const pingUrl = containerUrl.replace(/\/$/, "") + "/health";
        const response = await fetch(pingUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (response.ok) {
          const body = await response.json().catch(() => ({}));
          return res.json({ status: "connected", url: containerUrl, body });
        }
        return res.json({ status: "error", url: containerUrl, httpStatus: response.status });
      } catch (err: any) {
        clearTimeout(timeout);
        return res.json({ status: "unreachable", url: containerUrl, error: err.message });
      }
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/hermes/stats — dashboard stats (activity counts, user counts, etc.)
  app.get("/api/hermes/stats", hermesAuth, async (req: any, res: any) => {
    try {
      const [artists, events, dsClients, products, orders, users] = await Promise.all([
        storage.getArtists(),
        storage.getEvents(),
        storage.getDsClients(),
        storage.getProducts(),
        storage.getOrders(),
        req.hermesUser.via === "token" || req.hermesUser.role === "superadmin"
          ? storage.getAllUsers()
          : Promise.resolve([]),
      ]);
      const recentLogs = await db
        .select()
        .from(activityLog)
        .orderBy(desc(activityLog.createdAt))
        .limit(20);
      res.json({
        counts: {
          artists: artists.length,
          events: events.length,
          dsClients: dsClients.length,
          products: products.length,
          orders: orders.length,
          users: users.length,
        },
        recentActivity: recentLogs,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/hermes/activity — full activity log (paginated)
  app.get("/api/hermes/activity", hermesAuth, async (req: any, res: any) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || "50")), 200);
      const logs = await db
        .select()
        .from(activityLog)
        .orderBy(desc(activityLog.createdAt))
        .limit(limit);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/hermes/settings — get hermes-specific settings (superadmin token required)
  app.get("/api/hermes/settings", hermesTokenRequired, async (req: any, res: any) => {
    try {
      const keys = [
        "hermes_container_url",
        "hermes_notifications_enabled",
        "hermes_chat_enabled",
        // Visibility toggles — control what admin (session) users can see
        "hermes_admin_visible",    // show Hermes dashboard to admin users
        "hermes_squad_visible",    // show Squad tab to admin users
        "hermes_chat_visible",     // show Chat tab to admin users
      ];
      const settings: Record<string, string> = {};
      for (const key of keys) {
        const s = await storage.getSetting(key);
        settings[key] = s?.value || "";
      }
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/hermes/visibility — public visibility check (used by top-ribbon and dashboard guard)
  // Returns only the visibility flags so admin sessions can self-check without a token
  app.get("/api/hermes/visibility", async (req: any, res: any) => {
    try {
      const user = await getSessionUser(req);
      const isSuperAdminSession = user?.role === "superadmin";
      // Check Bearer token too
      const authHeader = req.headers["authorization"] || "";
      let hasToken = false;
      if (authHeader.startsWith("Bearer ")) {
        const { valid } = verifyHermesToken(authHeader.slice(7));
        hasToken = valid;
      }
      const [adminVisible, squadVisible, chatVisible] = await Promise.all([
        storage.getSetting("hermes_admin_visible"),
        storage.getSetting("hermes_squad_visible"),
        storage.getSetting("hermes_chat_visible"),
      ]);
      res.json({
        // Superadmin (token or session) always has full access
        isSuperAdmin: hasToken || isSuperAdminSession,
        adminVisible: adminVisible?.value === "true",
        squadVisible: squadVisible?.value === "true",
        chatVisible: chatVisible?.value !== "false", // default true
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PUT /api/hermes/settings — save hermes settings (superadmin token required)
  app.put("/api/hermes/settings", hermesTokenRequired, async (req: any, res: any) => {
    try {
      const allowed = [
        "hermes_container_url",
        "hermes_notifications_enabled",
        "hermes_chat_enabled",
        "hermes_admin_visible",
        "hermes_squad_visible",
        "hermes_chat_visible",
      ];
      const updates = req.body as Record<string, string>;
      for (const [key, value] of Object.entries(updates)) {
        if (!allowed.includes(key)) continue;
        await storage.upsertSetting({ key, value, type: "text", section: "hermes", label: key });
      }
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/hermes/chat — send a message to a squad specialist (hermesAuth required)
  // Body: { messages: [{role, content}], specialist?: "HERMES" | "NEIL" | "DIME" etc }
  app.post("/api/hermes/chat", hermesAuth, async (req: any, res: any) => {
    try {
      if (req.hermesUser?.via === "session") {
        const chatVisible = await storage.getSetting("hermes_chat_visible");
        if (chatVisible?.value === "false") {
          return res.status(403).json({ message: "Chat is not available to admin users" });
        }
      }
      const { messages, specialist } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "messages array required" });
      }
      // Get Hermes container URL
      const containerUrlSetting = await storage.getSetting("hermes_container_url");
      const containerUrl = containerUrlSetting?.value?.trim();
      if (!containerUrl) {
        return res.status(503).json({ message: "Hermes container not configured. Set the container URL in Hermes Settings." });
      }
      // Look up specialist system prompt from DB
      let systemPrompt = `You are Hermes, the backend operations assistant for this music platform. You help the admin team manage the system. Be concise, technical, and helpful.`;
      const handle = (specialist || "HERMES").toUpperCase();
      if (specialist) {
        const member = await (storage as any).getSquadMember(specialist);
        if (member?.intent) systemPrompt = member.intent;
      }
      // Proxy to Hermes container
      const containerRes = await fetch(`${containerUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, systemPrompt, specialist: handle }),
      });
      if (!containerRes.ok) {
        const err = await containerRes.json().catch(() => ({ message: "Container error" }));
        return res.status(containerRes.status).json({ message: err.message || "Hermes container returned an error" });
      }
      const data = await containerRes.json();
      const reply = data.reply || data.content || data.message || "...";
      // Save to message history
      const userEmail = req.hermesUser?.email || "admin";
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        await (storage as any).saveHermesMessage({ specialistHandle: handle, role: last.role, content: last.content, userEmail, isPublic: false });
      }
      await (storage as any).saveHermesMessage({ specialistHandle: handle, role: "assistant", content: reply, userEmail, isPublic: false });
      res.json({ reply, specialist: handle });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Chat failed" });
    }
  });

  // POST /api/hermes/neil — PUBLIC endpoint for the crowd-facing Neil concierge widget
  // No auth required. Injects event context if eventId is provided.
  app.post("/api/hermes/neil", async (req: any, res: any) => {
    try {
      const { messages, eventId, sessionId } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "messages array required" });
      }
      // Get Hermes container URL
      const containerUrlSetting = await storage.getSetting("hermes_container_url");
      const containerUrl = containerUrlSetting?.value?.trim();
      if (!containerUrl) {
        return res.json({ reply: "Hey! I'm Neil 🎟 I'm still getting set up — ask a crew member for help in the meantime!", specialist: "NEIL" });
      }
      // Get Neil's intent from DB
      const neil = await (storage as any).getSquadMember("NEIL");
      let systemPrompt = neil?.intent || `You are Neil, a friendly gig concierge at a live music venue. Help attendees with wayfinding, set times, and local info. Keep answers short and warm — two sentences max.`;
      // Inject event context if eventId provided
      if (eventId) {
        const event = await storage.getEvent(Number(eventId));
        if (event) {
          systemPrompt += `\n\n## Tonight's Event\nEvent: ${event.name}\nVenue: ${(event as any).venue || "TBC"}\nDate: ${(event as any).date || "Today"}\nTime: ${event.time || "TBC"}\nAddress: ${(event as any).address || "See event page"}\nDescription: ${event.description || ""}\n`;
        }
      }
      // Inject artist lineup
      const allArtists = await storage.getArtists();
      if (allArtists.length > 0) {
        const artistList = allArtists.slice(0, 20).map((a: any) => `- ${a.name} (${a.genre || ""})${a.timeSlot ? " at " + a.timeSlot : ""}`).join("\n");
        systemPrompt += `\n## Artists on the Lineup\n${artistList}\n`;
      }
      // Proxy to Hermes container
      const containerRes = await fetch(`${containerUrl}/neil`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, systemPrompt, specialist: "NEIL", eventId }),
      });
      if (!containerRes.ok) {
        return res.json({ reply: "Hey! I'm having a moment — try again in a sec or ask a crew member. 🎟", specialist: "NEIL" });
      }
      const data = await containerRes.json();
      const reply = data.reply || data.content || data.message || "...";
      // Save to DB
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        await (storage as any).saveHermesMessage({ specialistHandle: "NEIL", role: last.role, content: last.content, sessionId: sessionId || null, isPublic: true, eventId: eventId ? Number(eventId) : null });
      }
      await (storage as any).saveHermesMessage({ specialistHandle: "NEIL", role: "assistant", content: reply, sessionId: sessionId || null, isPublic: true, eventId: eventId ? Number(eventId) : null });
      res.json({ reply, specialist: "NEIL" });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Neil is temporarily unavailable" });
    }
  });

  // GET /api/hermes/squad/members — get squad members from DB (hermesAuth)
  app.get("/api/hermes/squad/members", hermesAuth, async (_req: any, res: any) => {
    try {
      const members = await (storage as any).getSquadMembers();
      res.json({ members });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PUT /api/hermes/squad/members/:handle — upsert a squad member (hermesAuth)
  app.put("/api/hermes/squad/members/:handle", hermesAuth, async (req: any, res: any) => {
    try {
      const member = await (storage as any).upsertSquadMember({ ...req.body, handle: req.params.handle });
      res.json({ member });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/hermes/squad/members/:handle — delete a squad member (hermesTokenRequired)
  app.delete("/api/hermes/squad/members/:handle", hermesTokenRequired, async (req: any, res: any) => {
    try {
      await (storage as any).deleteSquadMember(req.params.handle);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/hermes/squad — agent registry + last-seen activity
  // Shape is future-proof: returns an array of agents, currently just Hermes.
  // When you add more agents, register them here and tag their activity log entries with agent: "<name>".
  app.get("/api/hermes/squad", hermesAuth, async (req: any, res: any) => {
    try {
      // Check squad visibility for session-based admin access
      if (req.hermesUser?.via === "session") {
        const squadVisible = await storage.getSetting("hermes_squad_visible");
        if (squadVisible?.value !== "true") {
          return res.status(403).json({ message: "Squad view is not available to admin users" });
        }
      }

      // Agent registry — NAKED // STAFF v.5
      // HERMES orchestrates 13 specialists across 6 tiers.
      // status: "active" | "idle" | "offline"
      // When an agent is integrated, set status to "active" and wire its activity log tagging.
      const AGENT_REGISTRY = [
        // ─── MASTER ─────────────────────────────────────────────────
        { id: "hermes",   name: "HERMES",   alias: "The Anima",          role: "Orchestrator + memory",       tier: "MASTER",       symbol: "◉",  color: "#d94a1f", status: "active" },
        // ─── FRONT OF HOUSE ──────────────────────────────────────
        { id: "neil",     name: "NEIL",     alias: "Gig Concierge",       role: "Crowd-facing attendee help",  tier: "FRONT OF HOUSE", symbol: "🎟",  color: "#2e6b4f", status: "active", isPublic: true },
        // ─── CREATIVE ───────────────────────────────────────────────
        { id: "lemmy",    name: "LEMMY",    alias: "Head of A&R",         role: "Genre + reference vault",     tier: "CREATIVE", symbol: "🤘", color: "#7a2e0d", status: "offline" },
        // ─── STUDIO ──────────────────────────────────────────────────
        { id: "eddie",    name: "EDDIE",    alias: "Producer / Engineer",  role: "Mixing, mastering, recording", tier: "STUDIO",   symbol: "🎚", color: "#3d5a1f", status: "offline" },
        { id: "geddy",    name: "GEDDY",    alias: "Acoustician",          role: "Room design + treatment",     tier: "STUDIO",   symbol: "🏙", color: "#3d5a1f", status: "offline" },
        // ─── LIVE ────────────────────────────────────────────────────
        { id: "slash",    name: "SLASH",    alias: "Live Audio Engineer",  role: "Soundcheck, FOH, monitors",   tier: "LIVE",     symbol: "🎛", color: "#5c3a0e", status: "offline" },
        { id: "halford",  name: "HALFORD",  alias: "Lighting Designer",    role: "Show design + atmosphere",    tier: "LIVE",     symbol: "💡", color: "#5c3a0e", status: "offline" },
        { id: "hetfield", name: "HETFIELD", alias: "Tour Manager",         role: "Stage plots, riders, gig ops", tier: "LIVE",    symbol: "🎤", color: "#5c3a0e", status: "offline" },
        // ─── BUSINESS ───────────────────────────────────────────────
        { id: "gene",     name: "GENE",     alias: "Business / Royalties", role: "Money, contracts, publishing", tier: "BUSINESS", symbol: "💰", color: "#1f3a5c", status: "offline" },
        // ─── CAMPAIGN ───────────────────────────────────────────────
        { id: "nikki",    name: "NIKKI",    alias: "Release Strategist",   role: "Single/EP/album rollout",     tier: "CAMPAIGN", symbol: "📢", color: "#5c1f4a", status: "offline" },
        { id: "gigguide", name: "GIGGUIDE", alias: "NZ Scene Curator",     role: "NZ streetzine + scene history", tier: "CAMPAIGN", symbol: "📰", color: "#d94a1f", status: "offline" },
        // ─── TRADES ──────────────────────────────────────────────────
        { id: "angus",    name: "ANGUS",    alias: "Studio Builder",       role: "Acoustic panels + R-Value",   tier: "TRADES",   symbol: "🔨", color: "#3a3d45", status: "offline" },
        { id: "randy",    name: "RANDY",    alias: "Cabinet Maker",        role: "Speaker cabs + T/S math",     tier: "TRADES",   symbol: "🪚", color: "#3a3d45", status: "offline" },
        { id: "dio",      name: "DIO",      alias: "Stage Electrician",    role: "Show power + rig electrics",  tier: "TRADES",   symbol: "⚡",  color: "#3a3d45", status: "offline" },
        { id: "ozzy",     name: "OZZY",     alias: "Roadie / Build Tech",  role: "Load-in triage + gear repair", tier: "TRADES",  symbol: "🛠",  color: "#3a3d45", status: "offline" },
      ];

      // Get last activity for each agent from the log
      // Activity log entries tagged with agent field (future: filter by details->agent)
      const recentLogs = await db
        .select()
        .from(activityLog)
        .orderBy(desc(activityLog.createdAt))
        .limit(100);

      // Map last-seen activity to each agent
      const agentsWithActivity = AGENT_REGISTRY.map((agent) => {
        // For now, Hermes owns all logged activity
        const agentLogs = agent.id === "hermes" ? recentLogs : [];
        return {
          ...agent,
          lastActivity: agentLogs[0] || null,
          recentActions: agentLogs.slice(0, 5),
          totalActions: agentLogs.length,
        };
      });

      res.json({ agents: agentsWithActivity, updatedAt: new Date().toISOString() });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}
