import { db } from "./db";
import { artists, events } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const [existing] = await db.select({ count: sql<number>`count(*)` }).from(artists);
  if (existing && Number(existing.count) > 0) return;

  console.log("Seeding database...");

  await db.insert(artists).values([
    {
      name: "DJ Momentum",
      genre: "House / Deep House",
      description: "DJ Momentum brings pulsating deep house rhythms that move the crowd from the first beat. Known for seamless transitions and an instinct for the dancefloor, Momentum has played at festivals across the country.",
      imageUrl: "",
      email: "momentum@example.com",
      phone: "+1 555-0101",
      socialLinks: "https://instagram.com/djmomentum",
      timeSlot: "22:00 - 00:00",
      featured: true,
      promoterImageUrl: "",
    },
    {
      name: "Vox Luna",
      genre: "Indie Pop / Electronic",
      description: "Vox Luna blends ethereal vocals with electronic beats to create a dreamy sonic landscape. Her live performances weave looping and layering into a captivating one-woman show.",
      imageUrl: "",
      email: "voxluna@example.com",
      phone: "+1 555-0102",
      socialLinks: "https://instagram.com/voxluna",
      timeSlot: "20:00 - 21:30",
      featured: true,
      promoterImageUrl: "",
    },
    {
      name: "The Brass Assembly",
      genre: "Jazz / Funk",
      description: "A seven-piece brass ensemble that fuses classic jazz with modern funk grooves. The Brass Assembly brings high energy and tight arrangements to every performance.",
      imageUrl: "",
      email: "brass@example.com",
      phone: "+1 555-0103",
      socialLinks: "https://instagram.com/brassassembly",
      timeSlot: "18:00 - 19:30",
      featured: true,
      promoterImageUrl: "",
    },
    {
      name: "Neon Pulse",
      genre: "Synthwave / Retro",
      description: "Neon Pulse takes audiences on a journey through retro-futuristic soundscapes. Combining analogue synths with modern production, each set feels like a soundtrack to a film that hasn't been made yet.",
      imageUrl: "",
      email: "neonpulse@example.com",
      phone: "+1 555-0104",
      socialLinks: "https://instagram.com/neonpulse",
      timeSlot: "00:00 - 02:00",
      featured: true,
      promoterImageUrl: "",
    },
    {
      name: "Roots Collective",
      genre: "Reggae / Dub",
      description: "Roots Collective brings authentic reggae and dub vibrations with live instrumentation. The group keeps the tradition alive while adding their own contemporary twist.",
      imageUrl: "",
      email: "roots@example.com",
      phone: "+1 555-0105",
      socialLinks: "https://instagram.com/rootscollective",
      timeSlot: "16:00 - 17:30",
      featured: false,
      promoterImageUrl: "",
    },
    {
      name: "MC Frequency",
      genre: "Hip Hop / Spoken Word",
      description: "MC Frequency delivers sharp lyricism and powerful spoken word over original beats. A storyteller at heart, Frequency commands the stage with raw energy and authenticity.",
      imageUrl: "",
      email: "frequency@example.com",
      phone: "+1 555-0106",
      socialLinks: "https://instagram.com/mcfrequency",
      timeSlot: "19:30 - 20:00",
      featured: false,
      promoterImageUrl: "",
    },
    {
      name: "Aurora Keys",
      genre: "Classical Crossover",
      description: "Aurora Keys reimagines classical piano pieces with electronic arrangements. Her performances bridge centuries of musical tradition into something entirely new.",
      imageUrl: "",
      email: "aurora@example.com",
      phone: "+1 555-0107",
      socialLinks: "https://instagram.com/aurorakeys",
      timeSlot: "15:00 - 16:00",
      featured: false,
      promoterImageUrl: "",
    },
    {
      name: "Bass Theory",
      genre: "Drum & Bass / Jungle",
      description: "Bass Theory delivers relentless drum and bass sets that push the boundaries of tempo and texture. A favorite in the underground scene with a growing festival presence.",
      imageUrl: "",
      email: "basstheory@example.com",
      phone: "+1 555-0108",
      socialLinks: "https://instagram.com/basstheory",
      timeSlot: "02:00 - 04:00",
      featured: false,
      promoterImageUrl: "",
    },
  ]);

  await db.insert(events).values([
    {
      name: "Summer Sound Festival 2026",
      description: "A full day of live music across three stages. Featuring local and international acts spanning house, jazz, indie, and more.",
      imageUrl: "",
      date: "July 15, 2026",
      venue: "Riverside Park Amphitheatre",
    },
    {
      name: "Midnight Sessions",
      description: "An intimate late-night electronic music showcase in the heart of the city.",
      imageUrl: "",
      date: "August 22, 2026",
      venue: "The Warehouse, Downtown",
    },
  ]);

  console.log("Seeding complete.");
}
