import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEnquirySchema, insertArtistSchema, insertEventSchema, insertMediaItemSchema, insertDonationSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "client", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/artists", async (_req, res) => {
    try {
      const artists = await storage.getArtists();
      res.json(artists);
    } catch (error) {
      console.error("Error fetching artists:", error);
      res.status(500).json({ message: "Failed to fetch artists" });
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

  app.post("/api/artists", async (req, res) => {
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

  app.patch("/api/artists/:id", async (req, res) => {
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

  app.delete("/api/artists/:id", async (req, res) => {
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

  app.post("/api/events", async (req, res) => {
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

  app.patch("/api/events/:id", async (req, res) => {
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

  app.delete("/api/events/:id", async (req, res) => {
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
    } catch (error) {
      console.error("Error creating enquiry:", error);
      res.status(500).json({ message: "Failed to submit enquiry" });
    }
  });

  app.get("/api/enquiries", async (_req, res) => {
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

  app.put("/api/settings", async (req, res) => {
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

  app.post("/api/upload", upload.single("file"), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
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

  app.post("/api/media", async (req, res) => {
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

  app.patch("/api/media/:id", async (req, res) => {
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

  app.delete("/api/media/:id", async (req, res) => {
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

  app.get("/api/donations", async (_req, res) => {
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
    } catch (error) {
      console.error("Error creating donation:", error);
      res.status(500).json({ message: "Failed to submit donation" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
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
