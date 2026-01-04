import { pgTable, varchar, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth models (IMPORTANT for Replit Auth)
export * from "./models/auth";
import { users } from "./models/auth";

// Homes table - stores user's home profile
export const homes = pgTable("homes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  address: text("address").notNull(),
  builtYear: integer("built_year"),
  sqFt: integer("sq_ft"),
  type: varchar("type", { length: 100 }),
  healthScore: integer("health_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("homes_user_id_idx").on(table.userId),
]);

export const insertHomeSchema = createInsertSchema(homes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHome = z.infer<typeof insertHomeSchema>;
export type Home = typeof homes.$inferSelect;

// Systems table - stores home systems (HVAC, Roof, etc.)
export const systems = pgTable("systems", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  age: integer("age"),
  status: varchar("status", { length: 50 }).default("good"), // good, warning, critical
  lastService: timestamp("last_service"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("systems_home_id_idx").on(table.homeId),
]);

export const insertSystemSchema = createInsertSchema(systems).omit({ id: true, createdAt: true });
export type InsertSystem = z.infer<typeof insertSystemSchema>;
export type System = typeof systems.$inferSelect;

// Maintenance tasks table
export const maintenanceTasks = pgTable("maintenance_tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  dueDate: timestamp("due_date"),
  urgency: varchar("urgency", { length: 50 }).default("later"), // now, soon, later, monitor
  diyLevel: varchar("diy_level", { length: 50 }).default("DIY-Safe"), // DIY-Safe, Caution, Pro-Only
  status: varchar("status", { length: 50 }).default("pending"), // pending, scheduled, completed, overdue
  estimatedCost: varchar("estimated_cost", { length: 100 }),
  difficulty: varchar("difficulty", { length: 50 }),
  safetyWarning: text("safety_warning"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("maintenance_tasks_home_id_idx").on(table.homeId),
  index("maintenance_tasks_urgency_idx").on(table.urgency),
]);

export const insertMaintenanceTaskSchema = createInsertSchema(maintenanceTasks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMaintenanceTask = z.infer<typeof insertMaintenanceTaskSchema>;
export type MaintenanceTask = typeof maintenanceTasks.$inferSelect;

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull(), // user, assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("chat_messages_home_id_idx").on(table.homeId),
]);

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Funds table - stores user's budget funds/buckets
export const funds = pgTable("funds", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  balance: integer("balance").notNull().default(0), // in cents
  monthlyContribution: integer("monthly_contribution").default(0), // in cents
  fundType: varchar("fund_type", { length: 50 }).default("general"), // general, emergency, dedicated
  label: text("label"), // optional mental label like "Do not touch unless critical"
  color: varchar("color", { length: 20 }).default("#f97316"), // for visual distinction
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("funds_home_id_idx").on(table.homeId),
]);

export const insertFundSchema = createInsertSchema(funds).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFund = z.infer<typeof insertFundSchema>;
export type Fund = typeof funds.$inferSelect;

// Fund allocations table - tracks money earmarked for specific tasks
export const fundAllocations = pgTable("fund_allocations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fundId: integer("fund_id").notNull().references(() => funds.id, { onDelete: "cascade" }),
  taskId: integer("task_id").notNull().references(() => maintenanceTasks.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull().default(0), // in cents
  status: varchar("status", { length: 50 }).default("planned"), // planned, committed, paid
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("fund_allocations_fund_id_idx").on(table.fundId),
  index("fund_allocations_task_id_idx").on(table.taskId),
]);

export const insertFundAllocationSchema = createInsertSchema(fundAllocations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFundAllocation = z.infer<typeof insertFundAllocationSchema>;
export type FundAllocation = typeof fundAllocations.$inferSelect;

// Expenses table - tracks actual spending
export const expenses = pgTable("expenses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fundId: integer("fund_id").notNull().references(() => funds.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => maintenanceTasks.id, { onDelete: "set null" }),
  amount: integer("amount").notNull().default(0), // in cents
  description: text("description"),
  paymentStatus: varchar("payment_status", { length: 50 }).default("paid"), // estimated, partial, paid
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("expenses_fund_id_idx").on(table.fundId),
  index("expenses_task_id_idx").on(table.taskId),
]);

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  homes: many(homes),
}));

export const homesRelations = relations(homes, ({ one, many }) => ({
  user: one(users, {
    fields: [homes.userId],
    references: [users.id],
  }),
  systems: many(systems),
  maintenanceTasks: many(maintenanceTasks),
  chatMessages: many(chatMessages),
  funds: many(funds),
}));

export const systemsRelations = relations(systems, ({ one }) => ({
  home: one(homes, {
    fields: [systems.homeId],
    references: [homes.id],
  }),
}));

export const maintenanceTasksRelations = relations(maintenanceTasks, ({ one, many }) => ({
  home: one(homes, {
    fields: [maintenanceTasks.homeId],
    references: [homes.id],
  }),
  allocations: many(fundAllocations),
  expenses: many(expenses),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  home: one(homes, {
    fields: [chatMessages.homeId],
    references: [homes.id],
  }),
}));

export const fundsRelations = relations(funds, ({ one, many }) => ({
  home: one(homes, {
    fields: [funds.homeId],
    references: [homes.id],
  }),
  allocations: many(fundAllocations),
  expenses: many(expenses),
}));

export const fundAllocationsRelations = relations(fundAllocations, ({ one }) => ({
  fund: one(funds, {
    fields: [fundAllocations.fundId],
    references: [funds.id],
  }),
  task: one(maintenanceTasks, {
    fields: [fundAllocations.taskId],
    references: [maintenanceTasks.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  fund: one(funds, {
    fields: [expenses.fundId],
    references: [funds.id],
  }),
  task: one(maintenanceTasks, {
    fields: [expenses.taskId],
    references: [maintenanceTasks.id],
  }),
}));
