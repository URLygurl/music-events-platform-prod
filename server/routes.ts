import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEnquirySchema, insertArtistSchema, insertEventSchema, insertMediaItemSchema, insertDonationSchema, insertDsClientSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated, isAdmin, isSuperAdmin } from "./replit_integrations/auth";
import { appendToSheet, isGoogleSheetsConnected } from "./google-sheets";
import multer from "multer";
import path from "path";
import fs from "fs";
import Papa from "papaparse";

const uploadsDir = path.join(process.cwd(), "client", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const FONT_MIMES = ["font/ttf", "font/otf", "font/woff", "font/woff2", "application/font-woff", "application/font-woff2", "application/x-font-ttf", "application/x-font-otf", "application/octet-stream"];

const ALLOWED_EMBED_HOSTS = [
  "youtube.com", "www.youtube.com", "youtu.be",
  "music.youtube.com",
  "bandcamp.com",
  "soundcloud.com", "w.soundcloud.com",
  "open.spotify.com",
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

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

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
      const claims = req.user?.claims;
      if (!claims?.sub) return res.status(401).json({ message: "Not authenticated" });
      const existingAdmins = await storage.getUsers();
      const hasSuperAdmin = existingAdmins.some((u: any) => u.role === "superadmin");
      if (hasSuperAdmin) {
        return res.status(403).json({ message: "Superadmin already exists" });
      }
      await storage.updateUserRole(claims.sub, "superadmin");
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
        [parsed.data.name, parsed.data.email, parsed.data.message || "", new Date().toISOString()],
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

  app.post("/api/upload", isAdmin, upload.single("file"), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  const fontUpload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `font-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, name);
      },
    }),
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

  app.post("/api/upload/font", isAdmin, fontUpload.single("file"), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const url = `/uploads/${req.file.filename}`;
      res.json({ url, filename: req.file.originalname });
    } catch (error) {
      console.error("Error uploading font:", error);
      res.status(500).json({ message: "Failed to upload font" });
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
      const currentUserId = req.user?.claims?.sub;
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

  return httpServer;
}
