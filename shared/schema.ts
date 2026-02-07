import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const artists = pgTable("artists", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  genre: text("genre").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  imageUrl2: text("image_url_2"),
  email: text("email"),
  phone: text("phone"),
  socialLinks: text("social_links"),
  timeSlot: text("time_slot"),
  featured: boolean("featured").default(false),
  promoterImageUrl: text("promoter_image_url"),
  origin: text("origin"),
  members: text("members"),
  bio: text("bio"),
  website: text("website"),
  songLink1: text("song_link_1"),
  songLink2: text("song_link_2"),
  videoLink1: text("video_link_1"),
  videoLink2: text("video_link_2"),
  customLink1: text("custom_link_1"),
  customLink2: text("custom_link_2"),
  customLink3: text("custom_link_3"),
  customLink4: text("custom_link_4"),
  customLink5: text("custom_link_5"),
  visibleFields: text("visible_fields"),
});

export const events = pgTable("events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  date: text("date"),
  venue: text("venue"),
  time: text("time"),
  endDate: text("end_date"),
  endTime: text("end_time"),
  address: text("address"),
  googleMapsUrl: text("google_maps_url"),
  ticketUrl: text("ticket_url"),
  visibleFields: text("visible_fields"),
});

export const enquiries = pgTable("enquiries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  type: text("type").notNull().default("text"),
  section: text("section").notNull().default("global"),
  label: text("label").notNull().default(""),
});

export const mediaItems = pgTable("media_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  artist: text("artist"),
  type: text("type").notNull().default("youtube"),
  embedUrl: text("embed_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: text("duration"),
  sortOrder: integer("sort_order").default(0),
});

export const dsClients = pgTable("ds_clients", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  genre: text("genre"),
  description: text("description"),
  imageUrl: text("image_url"),
  imageUrl2: text("image_url_2"),
  email: text("email"),
  phone: text("phone"),
  socialLinks: text("social_links"),
  timeSlot: text("time_slot"),
  promoterImageUrl: text("promoter_image_url"),
  origin: text("origin"),
  members: text("members"),
  bio: text("bio"),
  website: text("website"),
  songLink1: text("song_link_1"),
  songLink2: text("song_link_2"),
  videoLink1: text("video_link_1"),
  videoLink2: text("video_link_2"),
  customLink1: text("custom_link_1"),
  customLink2: text("custom_link_2"),
  customLink3: text("custom_link_3"),
  customLink4: text("custom_link_4"),
  customLink5: text("custom_link_5"),
  visibleFields: text("visible_fields"),
});

export const donations = pgTable("donations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  amount: text("amount").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertArtistSchema = createInsertSchema(artists).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertEnquirySchema = createInsertSchema(enquiries).omit({ id: true, createdAt: true });
export const insertSiteSettingSchema = createInsertSchema(siteSettings).omit({ id: true });
export const insertMediaItemSchema = createInsertSchema(mediaItems).omit({ id: true });
export const insertDonationSchema = createInsertSchema(donations).omit({ id: true, createdAt: true });
export const insertDsClientSchema = createInsertSchema(dsClients).omit({ id: true });

export type Artist = typeof artists.$inferSelect;
export type InsertArtist = z.infer<typeof insertArtistSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Enquiry = typeof enquiries.$inferSelect;
export type InsertEnquiry = z.infer<typeof insertEnquirySchema>;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type MediaItem = typeof mediaItems.$inferSelect;
export type InsertMediaItem = z.infer<typeof insertMediaItemSchema>;
export type Donation = typeof donations.$inferSelect;
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type DsClient = typeof dsClients.$inferSelect;
export type InsertDsClient = z.infer<typeof insertDsClientSchema>;

export const ARTIST_FIELD_LABELS: Record<string, string> = {
  name: "Band Name",
  imageUrl: "Image 1",
  imageUrl2: "Image 2",
  origin: "Origin",
  members: "Members",
  bio: "Bio",
  website: "Website",
  phone: "Phone",
  email: "Email",
  songLink1: "Song Link 1",
  songLink2: "Song Link 2",
  videoLink1: "Video Link 1",
  videoLink2: "Video Link 2",
  customLink1: "Custom Link 1",
  customLink2: "Custom Link 2",
  customLink3: "Custom Link 3",
  customLink4: "Custom Link 4",
  customLink5: "Custom Link 5",
  genre: "Genre",
  description: "Description",
  timeSlot: "Time Slot",
  socialLinks: "Social Links",
  promoterImageUrl: "Promoter Image",
};

export const EVENT_FIELD_LABELS: Record<string, string> = {
  name: "Event Name",
  description: "Description",
  imageUrl: "Event Image",
  date: "Start Date",
  time: "Start Time",
  endDate: "End Date",
  endTime: "End Time",
  venue: "Venue",
  address: "Address",
  googleMapsUrl: "Google Maps URL",
  ticketUrl: "Ticket Link",
};

export function getVisibleFields(visibleFieldsJson: string | null | undefined, defaults: Record<string, boolean> = {}): Record<string, boolean> {
  const result: Record<string, boolean> = { ...defaults };
  if (visibleFieldsJson) {
    try {
      const parsed = JSON.parse(visibleFieldsJson);
      Object.assign(result, parsed);
    } catch {}
  }
  return result;
}

export const DEFAULT_ARTIST_VISIBILITY: Record<string, boolean> = {
  name: true, imageUrl: true, imageUrl2: true, origin: true, members: true,
  bio: true, website: true, phone: true, email: true, genre: true,
  description: true, timeSlot: true, socialLinks: true, promoterImageUrl: true,
  songLink1: true, songLink2: true, videoLink1: true, videoLink2: true,
  customLink1: true, customLink2: true, customLink3: true, customLink4: true, customLink5: true,
};

export const DEFAULT_EVENT_VISIBILITY: Record<string, boolean> = {
  name: true, description: true, imageUrl: true, date: true, time: true,
  endDate: true, endTime: true, venue: true, address: true,
  googleMapsUrl: true, ticketUrl: true,
};

export const DS_CLIENT_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  imageUrl: "Image 1",
  imageUrl2: "Image 2",
  origin: "Origin",
  members: "Members",
  bio: "Bio",
  website: "Website",
  phone: "Phone",
  email: "Email",
  songLink1: "Song Link 1",
  songLink2: "Song Link 2",
  videoLink1: "Video Link 1",
  videoLink2: "Video Link 2",
  customLink1: "Custom Link 1",
  customLink2: "Custom Link 2",
  customLink3: "Custom Link 3",
  customLink4: "Custom Link 4",
  customLink5: "Custom Link 5",
  genre: "Genre",
  description: "Description",
  timeSlot: "Time Slot",
  socialLinks: "Social Links",
  promoterImageUrl: "Promoter Image",
};

export const DEFAULT_DS_CLIENT_VISIBILITY: Record<string, boolean> = {
  name: true, imageUrl: true, imageUrl2: true, origin: true, members: true,
  bio: true, website: true, phone: true, email: true, genre: true,
  description: true, timeSlot: true, socialLinks: true, promoterImageUrl: true,
  songLink1: true, songLink2: true, videoLink1: true, videoLink2: true,
  customLink1: true, customLink2: true, customLink3: true, customLink4: true, customLink5: true,
};
