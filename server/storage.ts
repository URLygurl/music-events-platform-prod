import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  artists, events, enquiries, siteSettings, mediaItems, donations, dsClients,
  users,
  type Artist, type InsertArtist,
  type Event, type InsertEvent,
  type Enquiry, type InsertEnquiry,
  type SiteSetting, type InsertSiteSetting,
  type MediaItem, type InsertMediaItem,
  type Donation, type InsertDonation,
  type DsClient, type InsertDsClient,
  type User,
} from "@shared/schema";

export interface IStorage {
  getArtists(): Promise<Artist[]>;
  getArtist(id: number): Promise<Artist | undefined>;
  createArtist(artist: InsertArtist): Promise<Artist>;
  updateArtist(id: number, artist: Partial<InsertArtist>): Promise<Artist | undefined>;
  deleteArtist(id: number): Promise<void>;
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<void>;
  getEnquiries(): Promise<Enquiry[]>;
  createEnquiry(enquiry: InsertEnquiry): Promise<Enquiry>;
  getAllSettings(): Promise<SiteSetting[]>;
  getSetting(key: string): Promise<SiteSetting | undefined>;
  upsertSetting(setting: InsertSiteSetting): Promise<SiteSetting>;
  upsertManySettings(settings: InsertSiteSetting[]): Promise<void>;
  getMediaItems(): Promise<MediaItem[]>;
  getMediaItem(id: number): Promise<MediaItem | undefined>;
  createMediaItem(item: InsertMediaItem): Promise<MediaItem>;
  updateMediaItem(id: number, data: Partial<InsertMediaItem>): Promise<MediaItem | undefined>;
  deleteMediaItem(id: number): Promise<void>;
  getDonations(): Promise<Donation[]>;
  createDonation(donation: InsertDonation): Promise<Donation>;
  getDsClients(): Promise<DsClient[]>;
  getDsClient(id: number): Promise<DsClient | undefined>;
  createDsClient(client: InsertDsClient): Promise<DsClient>;
  updateDsClient(id: number, data: Partial<InsertDsClient>): Promise<DsClient | undefined>;
  deleteDsClient(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
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

  async updateArtist(id: number, data: Partial<InsertArtist>): Promise<Artist | undefined> {
    const [updated] = await db.update(artists).set(data).where(eq(artists.id, id)).returning();
    return updated;
  }

  async deleteArtist(id: number): Promise<void> {
    await db.delete(artists).where(eq(artists.id, id));
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

  async updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updated] = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return updated;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async getEnquiries(): Promise<Enquiry[]> {
    return db.select().from(enquiries);
  }

  async createEnquiry(enquiry: InsertEnquiry): Promise<Enquiry> {
    const [created] = await db.insert(enquiries).values(enquiry).returning();
    return created;
  }

  async getAllSettings(): Promise<SiteSetting[]> {
    return db.select().from(siteSettings);
  }

  async getSetting(key: string): Promise<SiteSetting | undefined> {
    const [setting] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return setting;
  }

  async upsertSetting(setting: InsertSiteSetting): Promise<SiteSetting> {
    const [result] = await db
      .insert(siteSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: setting.value, type: setting.type, section: setting.section, label: setting.label },
      })
      .returning();
    return result;
  }

  async upsertManySettings(settings: InsertSiteSetting[]): Promise<void> {
    for (const setting of settings) {
      await this.upsertSetting(setting);
    }
  }

  async getMediaItems(): Promise<MediaItem[]> {
    return db.select().from(mediaItems);
  }

  async getMediaItem(id: number): Promise<MediaItem | undefined> {
    const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, id));
    return item;
  }

  async createMediaItem(item: InsertMediaItem): Promise<MediaItem> {
    const [created] = await db.insert(mediaItems).values(item).returning();
    return created;
  }

  async updateMediaItem(id: number, data: Partial<InsertMediaItem>): Promise<MediaItem | undefined> {
    const [updated] = await db.update(mediaItems).set(data).where(eq(mediaItems.id, id)).returning();
    return updated;
  }

  async deleteMediaItem(id: number): Promise<void> {
    await db.delete(mediaItems).where(eq(mediaItems.id, id));
  }

  async getDonations(): Promise<Donation[]> {
    return db.select().from(donations);
  }

  async createDonation(donation: InsertDonation): Promise<Donation> {
    const [created] = await db.insert(donations).values(donation).returning();
    return created;
  }

  async getDsClients(): Promise<DsClient[]> {
    return db.select().from(dsClients);
  }

  async getDsClient(id: number): Promise<DsClient | undefined> {
    const [client] = await db.select().from(dsClients).where(eq(dsClients.id, id));
    return client;
  }

  async createDsClient(client: InsertDsClient): Promise<DsClient> {
    const [created] = await db.insert(dsClients).values(client).returning();
    return created;
  }

  async updateDsClient(id: number, data: Partial<InsertDsClient>): Promise<DsClient | undefined> {
    const [updated] = await db.update(dsClients).set(data).where(eq(dsClients.id, id)).returning();
    return updated;
  }

  async deleteDsClient(id: number): Promise<void> {
    await db.delete(dsClients).where(eq(dsClients.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
