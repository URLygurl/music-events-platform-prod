import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const { role, ...safeData } = userData as any;
    const [user] = await db
      .insert(users)
      .values(safeData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...safeData,
          updatedAt: new Date(),
        },
      })
      .returning();

    const hasSuperAdmin = await db.select().from(users).where(eq(users.role, "superadmin"));
    if (hasSuperAdmin.length === 0) {
      const [promoted] = await db
        .update(users)
        .set({ role: "superadmin" })
        .where(eq(users.id, user.id))
        .returning();
      return promoted;
    }

    return user;
  }
}

export const authStorage = new AuthStorage();
