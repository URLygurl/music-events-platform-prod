import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { events, products } from "./schema";

// Membership describes the profile, never an authentication/authorization role.
// IDs are supplied by auth (legacy UUID or better-auth:<id>), with no legacy-user FK.
export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id").primaryKey(),
  username: varchar("username", { length: 40 }),
  userType: varchar("user_type", { length: 20 })
    .$type<"guest" | "audience" | "artist" | "advertiser" | "supplier" | "venue">()
    .notNull().default("audience"),
  avatarData: text("avatar_data"),
  avatarMime: varchar("avatar_mime", { length: 10 }),
  avatarUpdatedAt: timestamp("avatar_updated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_profiles_username_lower_unique")
    .on(sql`lower(${table.username})`).where(sql`${table.username} IS NOT NULL`),
  check("user_profiles_username_valid", sql`${table.username} IS NULL OR ${table.username} ~ '^[A-Za-z0-9_.-]{3,40}$'`),
  check("user_profiles_user_type_valid", sql`${table.userType} IN ('guest', 'audience', 'artist', 'advertiser', 'supplier', 'venue')`),
  check("user_profiles_avatar_mime_valid", sql`${table.avatarMime} IS NULL OR ${table.avatarMime} IN ('image/jpeg', 'image/png', 'image/webp')`),
  check("user_profiles_avatar_complete", sql`(${table.avatarData} IS NULL AND ${table.avatarMime} IS NULL AND ${table.avatarUpdatedAt} IS NULL) OR (${table.avatarData} IS NOT NULL AND ${table.avatarMime} IS NOT NULL AND ${table.avatarUpdatedAt} IS NOT NULL)`),
]);

export const userFavourites = pgTable("user_favourites", {
  userId: varchar("user_id").notNull().references(() => userProfiles.userId, { onDelete: "cascade" }),
  // Deferred reference callbacks are intentional: schema.ts re-exports this module.
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ name: "user_favourites_pkey", columns: [table.userId, table.productId] }),
  index("user_favourites_product_id_idx").on(table.productId),
]);

export const userTickets = pgTable("user_tickets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => userProfiles.userId, { onDelete: "cascade" }),
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  label: varchar("label", { length: 255 }).notNull(),
  ticketReference: varchar("ticket_reference", { length: 255 }),
  status: varchar("status", { length: 32 }).notNull().default("issued"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
}, (table) => [
  index("user_tickets_user_id_idx").on(table.userId),
  index("user_tickets_event_id_idx").on(table.eventId),
]);

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;
export type UserFavourite = typeof userFavourites.$inferSelect;
export type InsertUserFavourite = typeof userFavourites.$inferInsert;
export type UserTicket = typeof userTickets.$inferSelect;
export type InsertUserTicket = typeof userTickets.$inferInsert;
