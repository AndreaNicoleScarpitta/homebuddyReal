import { users, disclaimerAuditLog, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createLocalUser(data: { email: string; passwordHash: string; firstName?: string | null; lastName?: string | null }): Promise<User>;
  updateUserPrivacy(id: string, dataStorageOptOut: boolean): Promise<User>;
  acceptDisclaimer(id: string, version: string, ipAddress?: string): Promise<User>;
  incrementLoginCount(id: string): Promise<User>;
  snoozeDonationPrompt(id: string, snoozeUntilLoginCount: number): Promise<User>;
  markDonated(id: string): Promise<User>;
  updateStripeCustomerId(id: string, stripeCustomerId: string): Promise<User>;
  setPasswordResetToken(id: string, token: string, expiresAt: Date): Promise<void>;
  clearPasswordResetToken(id: string): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, normalized));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user;
  }

  async createLocalUser(data: {
    email: string;
    passwordHash: string;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.trim().toLowerCase(),
        passwordHash: data.passwordHash,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        provider: "local",
        emailVerified: false,
      })
      .returning();
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

  async incrementLoginCount(id: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ loginCount: sql`COALESCE(${users.loginCount}, 0) + 1`, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async snoozeDonationPrompt(id: string, snoozeUntilLoginCount: number): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ donationPromptSnoozeUntilLoginCount: snoozeUntilLoginCount, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async markDonated(id: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ hasDonated: true, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async updateStripeCustomerId(id: string, stripeCustomerId: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
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

  async setPasswordResetToken(id: string, token: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({ passwordResetToken: token, passwordResetTokenExpiresAt: expiresAt, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async clearPasswordResetToken(id: string): Promise<void> {
    await db
      .update(users)
      .set({ passwordResetToken: null, passwordResetTokenExpiresAt: null, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ passwordHash, passwordResetToken: null, passwordResetTokenExpiresAt: null, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }
}

export const authStorage = new AuthStorage();
