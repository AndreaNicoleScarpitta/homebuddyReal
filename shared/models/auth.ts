import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uuid: varchar("uuid").notNull().default(sql`gen_random_uuid()`),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  provider: varchar("provider"),       // "local" | "google" | "replit" (legacy)
  providerId: varchar("provider_id"),
  passwordHash: varchar("password_hash"), // bcrypt hash — only set for provider="local"
  emailVerified: boolean("email_verified").default(false),
  dataStorageOptOut: boolean("data_storage_opt_out").default(false),
  disclaimerAccepted: boolean("disclaimer_accepted").default(false),
  disclaimerAcceptedAt: timestamp("disclaimer_accepted_at"),
  disclaimerVersion: varchar("disclaimer_version"),
  loginCount: integer("login_count").default(0),
  hasDonated: boolean("has_donated").default(false),
  donationPromptSnoozeUntilLoginCount: integer("donation_prompt_snooze_until_login_count"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  plan: varchar("plan", { length: 20 }).notNull().default("free"), // "free" | "plus" | "pro"
  planStatus: varchar("plan_status", { length: 30 }).notNull().default("active"), // "active" | "past_due" | "canceled" | "trialing"
  planRenewsAt: timestamp("plan_renews_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("users_uuid_idx").on(table.uuid),
]);

// Object ACL policies live in the DB instead of being stamped into R2 object metadata,
// because R2/S3 user metadata can't be mutated without re-uploading the object.
export const objectAcl = pgTable("object_acl", {
  objectKey: varchar("object_key").primaryKey(),
  ownerId: varchar("owner_id"),
  visibility: varchar("visibility", { length: 10 }).notNull().default("private"), // "public" | "private"
  rules: jsonb("rules"), // Array<{group:{type,id}, permission:"read"|"write"}>
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const disclaimerAuditLog = pgTable("disclaimer_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  disclaimerVersion: varchar("disclaimer_version").notNull(),
  action: varchar("action").notNull(),
  ipAddress: varchar("ip_address"),
  acceptedAt: timestamp("accepted_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
