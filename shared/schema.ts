import { pgTable, varchar, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth models (IMPORTANT for Replit Auth)
export * from "./models/auth";
export * from "./models/chat";
// Export event sourcing models (state-machine + immutable event log)
export * from "./models/eventing";
import { users } from "./models/auth";

// Homes table - stores user's home profile with Zillow-style fields
export const homes = pgTable("homes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  address: text("address").notNull(),
  streetAddress: varchar("street_address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  zipPlus4: varchar("zip_plus_4", { length: 4 }),
  addressVerified: boolean("address_verified").default(false),
  builtYear: integer("built_year"),
  sqFt: integer("sq_ft"),
  beds: integer("beds"),
  baths: integer("baths"),
  type: varchar("type", { length: 100 }),
  lotSize: integer("lot_size"),
  exteriorType: varchar("exterior_type", { length: 100 }),
  roofType: varchar("roof_type", { length: 100 }),
  lastSaleYear: integer("last_sale_year"),
  homeValueEstimate: integer("home_value_estimate"),
  dataSource: varchar("data_source", { length: 50 }).default("manual"),
  zillowUrl: text("zillow_url"),
  healthScore: integer("health_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("homes_user_id_idx").on(table.userId),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertHomeSchema = createInsertSchema(homes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHome = Omit<typeof homes.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type Home = typeof homes.$inferSelect;

// System categories enum
export const systemCategories = [
  "Roof",
  "HVAC", 
  "Plumbing",
  "Electrical",
  "Windows",
  "Siding/Exterior",
  "Foundation",
  "Appliances",
  "Water Heater",
  "Landscaping",
  "Pest",
  "Other"
] as const;
export type SystemCategory = typeof systemCategories[number];

// System conditions enum
export const systemConditions = ["Great", "Good", "Fair", "Poor", "Unknown"] as const;
export type SystemCondition = typeof systemConditions[number];

// Entity type enum - distinguishes ASSET systems from SERVICE relationships
export const entityTypes = ["asset", "service"] as const;
export type EntityType = typeof entityTypes[number];

// Service cadence options
export const serviceCadences = ["weekly", "biweekly", "monthly", "quarterly", "biannual", "annual", "one-time", "as-needed"] as const;
export type ServiceCadence = typeof serviceCadences[number];

// Systems table - stores home systems (ASSETS) and service relationships (SERVICES)
// ASSETS: installed things (HVAC, roof, windows, etc.) with install year, condition, make/model
// SERVICES: ongoing services (pest control, landscaping, cleaners) with contract start, cadence, contractor
export const systems = pgTable("systems", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 20 }).default("asset"), // asset or service
  category: varchar("category", { length: 50 }).default("Other"),
  name: varchar("name", { length: 100 }).notNull(),
  make: varchar("make", { length: 100 }),
  model: varchar("model", { length: 100 }),
  installYear: integer("install_year"), // ASSET only
  lastServiceDate: timestamp("last_service_date"), // both: last maintenance for asset, last visit for service
  nextServiceDate: timestamp("next_service_date"),
  condition: varchar("condition", { length: 50 }).default("Unknown"), // ASSET only
  warrantyExpiry: timestamp("warranty_expiry"),
  material: varchar("material", { length: 100 }),
  energyRating: varchar("energy_rating", { length: 50 }),
  provider: varchar("provider", { length: 255 }),
  treatmentType: varchar("treatment_type", { length: 100 }),
  recurrenceInterval: varchar("recurrence_interval", { length: 50 }),
  contractStartDate: timestamp("contract_start_date"), // SERVICE only: when contract/relationship began
  cadence: varchar("cadence", { length: 50 }), // SERVICE only: service frequency (weekly, monthly, etc.)
  contractorId: integer("contractor_id"), // SERVICE only: attached contractor
  relatedAssetId: integer("related_asset_id"), // SERVICE only: linked asset if applicable (e.g., HVAC service -> HVAC asset)
  statusReason: text("status_reason"),
  metadata: text("metadata"),
  notes: text("notes"),
  photos: text("photos"),
  documents: text("documents"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("systems_home_id_idx").on(table.homeId),
  index("systems_category_idx").on(table.category),
  index("systems_entity_type_idx").on(table.entityType),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertSystemSchema = createInsertSchema(systems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSystem = Omit<typeof systems.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type System = typeof systems.$inferSelect;

// Task statuses
export const taskStatuses = ["pending", "scheduled", "completed", "skipped"] as const;
export type TaskStatus = typeof taskStatuses[number];

// Maintenance tasks table
export const maintenanceTasks = pgTable("maintenance_tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  relatedSystemId: integer("related_system_id").references(() => systems.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  dueDate: timestamp("due_date"),
  urgency: varchar("urgency", { length: 50 }).default("later"), // now, soon, later, monitor
  diyLevel: varchar("diy_level", { length: 50 }).default("DIY-Safe"), // DIY-Safe, Caution, Pro-Only
  status: varchar("status", { length: 50 }).default("pending"), // pending, scheduled, completed, skipped
  estimatedCost: varchar("estimated_cost", { length: 100 }),
  actualCost: integer("actual_cost"), // in cents
  difficulty: varchar("difficulty", { length: 50 }),
  safetyWarning: text("safety_warning"),
  createdFrom: varchar("created_from", { length: 50 }).default("manual"), // manual, chat, inspection, import, best-practice
  isRecurring: boolean("is_recurring").default(false),
  recurrenceCadence: varchar("recurrence_cadence", { length: 50 }), // weekly, monthly, quarterly, biannual, annual
  parentTaskId: integer("parent_task_id"), // for recurring task instances, links to original recurring task
  assignedContractorId: integer("assigned_contractor_id"), // attached contractor for this task
  fundId: integer("fund_id"), // optional: linked fund for cost tracking
  completedAt: timestamp("completed_at"), // when task was marked complete
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("maintenance_tasks_home_id_idx").on(table.homeId),
  index("maintenance_tasks_urgency_idx").on(table.urgency),
  index("maintenance_tasks_system_id_idx").on(table.relatedSystemId),
  index("maintenance_tasks_contractor_idx").on(table.assignedContractorId),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertMaintenanceTaskSchema = createInsertSchema(maintenanceTasks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMaintenanceTask = Omit<typeof maintenanceTasks.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type MaintenanceTask = typeof maintenanceTasks.$inferSelect;

// Maintenance log entries - tracks completed maintenance work
export const maintenanceLogEntries = pgTable("maintenance_log_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => maintenanceTasks.id, { onDelete: "set null" }),
  systemId: integer("system_id").references(() => systems.id, { onDelete: "set null" }),
  date: timestamp("date").notNull().defaultNow(),
  title: varchar("title", { length: 255 }).notNull(),
  notes: text("notes"),
  photos: text("photos"), // JSON array of photo URIs
  cost: integer("cost"), // in cents
  provider: varchar("provider", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("maintenance_log_home_id_idx").on(table.homeId),
  index("maintenance_log_task_id_idx").on(table.taskId),
  index("maintenance_log_date_idx").on(table.date),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertMaintenanceLogEntrySchema = createInsertSchema(maintenanceLogEntries).omit({ id: true, createdAt: true });
export type InsertMaintenanceLogEntry = Omit<typeof maintenanceLogEntries.$inferInsert, 'id' | 'createdAt'>;
export type MaintenanceLogEntry = typeof maintenanceLogEntries.$inferSelect;

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull(),
  content: text("content").notNull(),
  imageData: text("image_data"),
  imageType: varchar("image_type", { length: 100 }),
  model: varchar("model", { length: 100 }),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("chat_messages_home_id_idx").on(table.homeId),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = Omit<typeof chatMessages.$inferInsert, 'id' | 'createdAt'>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Funds table - stores user's budget funds/buckets
export const funds = pgTable("funds", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  purpose: text("purpose"), // Fund purpose/description - this should be shown first in UI
  name: varchar("name", { length: 100 }).notNull(),
  balance: integer("balance").notNull().default(0), // in cents
  monthlyContribution: integer("monthly_contribution").default(0), // in cents
  fundType: varchar("fund_type", { length: 50 }).default("general"), // general, emergency, dedicated
  label: text("label"), // optional mental label like "Do not touch unless critical"
  color: varchar("color", { length: 20 }).default("#f97316"), // for visual distinction
  scopedSystemId: integer("scoped_system_id"), // optional: fund is scoped to this asset/system
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("funds_home_id_idx").on(table.homeId),
  index("funds_scoped_system_idx").on(table.scopedSystemId),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertFundSchema = createInsertSchema(funds).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFund = Omit<typeof funds.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
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

// @ts-expect-error drizzle-zod omit type inference
export const insertFundAllocationSchema = createInsertSchema(fundAllocations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFundAllocation = Omit<typeof fundAllocations.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
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

// @ts-expect-error drizzle-zod omit type inference
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export type InsertExpense = Omit<typeof expenses.$inferInsert, 'id' | 'createdAt'>;
export type Expense = typeof expenses.$inferSelect;

// Contact messages table - stores contact form submissions
export const contactMessages = pgTable("contact_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  message: text("message").notNull(),
  status: varchar("status", { length: 50 }).default("new"), // new, read, replied
  createdAt: timestamp("created_at").defaultNow(),
});

// @ts-expect-error drizzle-zod omit type inference
export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({ id: true, createdAt: true, status: true }).extend({
  email: z.string().email("Please provide a valid email address"),
});
export type InsertContactMessage = Omit<typeof contactMessages.$inferInsert, 'id' | 'createdAt' | 'status'>;
export type ContactMessage = typeof contactMessages.$inferSelect;

// Inspection reports table - stores uploaded inspection reports
export const inspectionReports = pgTable("inspection_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }),
  objectPath: text("object_path").notNull(),
  reportType: varchar("report_type", { length: 100 }).default("general"),
  inspectionDate: timestamp("inspection_date"),
  status: varchar("status", { length: 50 }).default("pending"),
  summary: text("summary"),
  issuesFound: integer("issues_found").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  analyzedAt: timestamp("analyzed_at"),
}, (table) => [
  index("inspection_reports_home_id_idx").on(table.homeId),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertInspectionReportSchema = createInsertSchema(inspectionReports).omit({ id: true, createdAt: true, analyzedAt: true });
export type InsertInspectionReport = Omit<typeof inspectionReports.$inferInsert, 'id' | 'createdAt' | 'analyzedAt'>;
export type InspectionReport = typeof inspectionReports.$inferSelect;

// Inspection findings table - stores individual findings from reports
export const inspectionFindings = pgTable("inspection_findings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  reportId: integer("report_id").notNull().references(() => inspectionReports.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 100 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 50 }).default("minor"),
  location: varchar("location", { length: 255 }),
  estimatedCost: varchar("estimated_cost", { length: 100 }),
  urgency: varchar("urgency", { length: 50 }).default("later"),
  diyLevel: varchar("diy_level", { length: 50 }).default("Pro-Only"),
  taskCreated: boolean("task_created").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("inspection_findings_report_id_idx").on(table.reportId),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertInspectionFindingSchema = createInsertSchema(inspectionFindings).omit({ id: true, createdAt: true });
export type InsertInspectionFinding = Omit<typeof inspectionFindings.$inferInsert, 'id' | 'createdAt'>;
export type InspectionFinding = typeof inspectionFindings.$inferSelect;

// Contractors table - stores saved contractor references (Angie's List integration)
export const contractors = pgTable("contractors", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  serviceType: varchar("service_type", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  website: text("website"),
  angiesListUrl: text("angies_list_url"),
  notes: text("notes"),
  rating: integer("rating"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("contractors_home_id_idx").on(table.homeId),
  index("contractors_service_type_idx").on(table.serviceType),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertContractorSchema = createInsertSchema(contractors).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContractor = Omit<typeof contractors.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type Contractor = typeof contractors.$inferSelect;

// Contractor appointments - tracks scheduled/completed work with contractors
export const contractorAppointments = pgTable("contractor_appointments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  contractorId: integer("contractor_id").references(() => contractors.id, { onDelete: "set null" }),
  taskId: integer("task_id").references(() => maintenanceTasks.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  scheduledDate: timestamp("scheduled_date"),
  status: varchar("status", { length: 50 }).default("inquiry"),
  estimatedCost: varchar("estimated_cost", { length: 100 }),
  actualCost: integer("actual_cost"),
  notes: text("notes"),
  angiesListInquiryId: varchar("angies_list_inquiry_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("contractor_appointments_home_id_idx").on(table.homeId),
  index("contractor_appointments_status_idx").on(table.status),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertContractorAppointmentSchema = createInsertSchema(contractorAppointments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContractorAppointment = Omit<typeof contractorAppointments.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type ContractorAppointment = typeof contractorAppointments.$inferSelect;

// User notification preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  maintenanceReminders: boolean("maintenance_reminders").default(true),
  contractorFollowups: boolean("contractor_followups").default(true),
  systemAlerts: boolean("system_alerts").default(true),
  weeklyDigest: boolean("weekly_digest").default(false),
  pushEnabled: boolean("push_enabled").default(false),
  emailEnabled: boolean("email_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// @ts-expect-error drizzle-zod omit type inference
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationPreferences = Omit<typeof notificationPreferences.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

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
  maintenanceLogEntries: many(maintenanceLogEntries),
  chatMessages: many(chatMessages),
  funds: many(funds),
  inspectionReports: many(inspectionReports),
}));

export const systemsRelations = relations(systems, ({ one, many }) => ({
  home: one(homes, {
    fields: [systems.homeId],
    references: [homes.id],
  }),
  tasks: many(maintenanceTasks),
  logEntries: many(maintenanceLogEntries),
}));

export const maintenanceTasksRelations = relations(maintenanceTasks, ({ one, many }) => ({
  home: one(homes, {
    fields: [maintenanceTasks.homeId],
    references: [homes.id],
  }),
  relatedSystem: one(systems, {
    fields: [maintenanceTasks.relatedSystemId],
    references: [systems.id],
  }),
  logEntries: many(maintenanceLogEntries),
  allocations: many(fundAllocations),
  expenses: many(expenses),
}));

export const maintenanceLogEntriesRelations = relations(maintenanceLogEntries, ({ one }) => ({
  home: one(homes, {
    fields: [maintenanceLogEntries.homeId],
    references: [homes.id],
  }),
  task: one(maintenanceTasks, {
    fields: [maintenanceLogEntries.taskId],
    references: [maintenanceTasks.id],
  }),
  system: one(systems, {
    fields: [maintenanceLogEntries.systemId],
    references: [systems.id],
  }),
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

export const inspectionReportsRelations = relations(inspectionReports, ({ one, many }) => ({
  home: one(homes, {
    fields: [inspectionReports.homeId],
    references: [homes.id],
  }),
  findings: many(inspectionFindings),
}));

export const inspectionFindingsRelations = relations(inspectionFindings, ({ one }) => ({
  report: one(inspectionReports, {
    fields: [inspectionFindings.reportId],
    references: [inspectionReports.id],
  }),
}));

export const contractorsRelations = relations(contractors, ({ one, many }) => ({
  home: one(homes, {
    fields: [contractors.homeId],
    references: [homes.id],
  }),
  appointments: many(contractorAppointments),
}));

export const contractorAppointmentsRelations = relations(contractorAppointments, ({ one }) => ({
  home: one(homes, {
    fields: [contractorAppointments.homeId],
    references: [homes.id],
  }),
  contractor: one(contractors, {
    fields: [contractorAppointments.contractorId],
    references: [contractors.id],
  }),
  task: one(maintenanceTasks, {
    fields: [contractorAppointments.taskId],
    references: [maintenanceTasks.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));
