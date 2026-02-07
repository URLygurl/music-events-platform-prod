import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  artists, events, enquiries,
  type Artist, type InsertArtist,
  type Event, type InsertEvent,
  type Enquiry, type InsertEnquiry,
} from "@shared/schema";

export interface IStorage {
  getArtists(): Promise<Artist[]>;
  getArtist(id: number): Promise<Artist | undefined>;
  createArtist(artist: InsertArtist): Promise<Artist>;
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  getEnquiries(): Promise<Enquiry[]>;
  createEnquiry(enquiry: InsertEnquiry): Promise<Enquiry>;
}

export class DatabaseStorage implements IStorage {
  async getArtists(): Promise<Artist[]> {
    return db.select().from(artists);
  }

  async getArtist(id: number): Promise<Artist | undefined> {
    const [artist] = await db.select().from(artists).where(eq(artists.id, id));
    return artist;
  }

  async createArtist(artist: InsertArtist): Promise<Artist> {
    const [created] = await db.insert(artists).values(artist).returning();
    return created;
  }

  async getEvents(): Promise<Event[]> {
    return db.select().from(events);
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db.insert(events).values(event).returning();
    return created;
  }

  async getEnquiries(): Promise<Enquiry[]> {
    return db.select().from(enquiries);
  }

  async createEnquiry(enquiry: InsertEnquiry): Promise<Enquiry> {
    const [created] = await db.insert(enquiries).values(enquiry).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
