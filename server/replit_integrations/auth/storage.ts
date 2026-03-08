import { users, disclaimerAuditLog, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPrivacy(id: string, dataStorageOptOut: boolean): Promise<User>;
  acceptDisclaimer(id: string, version: string, ipAddress?: string): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          provider: userData.provider,
          providerId: userData.providerId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPrivacy(id: string, dataStorageOptOut: boolean): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ dataStorageOptOut, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async acceptDisclaimer(id: string, version: string, ipAddress?: string): Promise<User> {
    const now = new Date();
    const [updated] = await db
      .update(users)
      .set({
        disclaimerAccepted: true,
        disclaimerAcceptedAt: now,
        disclaimerVersion: version,
        updatedAt: now,
      })
      .where(eq(users.id, id))
      .returning();

    await db.insert(disclaimerAuditLog).values({
      userId: id,
      disclaimerVersion: version,
      action: "accepted",
      ipAddress: ipAddress || null,
      acceptedAt: now,
    });

    return updated;
  }
}

export const authStorage = new AuthStorage();
