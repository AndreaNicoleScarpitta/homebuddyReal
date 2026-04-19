import { pgTable, varchar, integer, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth models (IMPORTANT for Replit Auth)
export * from "./models/auth";
export * from "./models/chat";
// Export event sourcing models (state-machine + immutable event log)
export * from "./models/eventing";
// Export agent system models
export * from "./models/agents";
import { users } from "./models/auth";

// Homes table - stores user's home profile with Zillow-style fields
export const homes = pgTable("homes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  address: text("address"),
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  streetAddress: varchar("street_address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  zipPlus4: varchar("zip_plus_4", { length: 4 }),
  addressVerified: boolean("address_verified").default(false),
  addressNeedsReview: boolean("address_needs_review").default(false),
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

// Home Graph enums
export const provenanceSources = ["manual", "ai-inferred", "document-extracted", "inspection"] as const;
export type ProvenanceSource = typeof provenanceSources[number];

export const warrantyTypes = ["manufacturer", "extended", "home-warranty", "labor", "other"] as const;
export type WarrantyType = typeof warrantyTypes[number];

export const permitTypes = ["building", "electrical", "plumbing", "mechanical", "roofing", "other"] as const;
export type PermitType = typeof permitTypes[number];

export const repairOutcomes = ["resolved", "partial", "temporary", "failed"] as const;
export type RepairOutcome = typeof repairOutcomes[number];

export const recommendationStatuses = ["open", "accepted", "dismissed", "completed"] as const;
export type RecommendationStatus = typeof recommendationStatuses[number];

export const timelineCategories = ["repair", "replacement", "inspection", "maintenance", "purchase", "permit", "warranty", "milestone", "document"] as const;
export type TimelineCategory = typeof timelineCategories[number];

// System categories enum
export const systemCategories = [
  "Roof",
  "HVAC", 
  "Plumbing",
  "Electrical",
  "Windows",
  "Siding/Exterior",
  "Foundation",
  "Chimney",
  "Appliances",
  "Water Heater",
  "Landscaping",
  "Pest",
  "Paint",
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

// Home documents table - stores uploaded document metadata
export const homeDocuments = pgTable("home_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: integer("file_size"),
  objectPath: text("object_path").notNull(),
  category: varchar("category", { length: 100 }).default("general"),
  notes: text("notes"),
  extractedData: text("extracted_data"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("home_documents_home_id_idx").on(table.homeId),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertHomeDocumentSchema = createInsertSchema(homeDocuments).omit({ id: true, createdAt: true });
export type InsertHomeDocument = Omit<typeof homeDocuments.$inferInsert, 'id' | 'createdAt'>;
export type HomeDocument = typeof homeDocuments.$inferSelect;

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
  contractorMode: boolean("contractor_mode").default(false),
  lastDigestSentAt: timestamp("last_digest_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// @ts-expect-error drizzle-zod omit type inference
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationPreferences = Omit<typeof notificationPreferences.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

// Components table - sub-parts of a system (e.g., compressor in HVAC)
export const components = pgTable("components", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  systemId: integer("system_id").notNull().references(() => systems.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  componentType: varchar("component_type", { length: 100 }),
  material: varchar("material", { length: 100 }),
  installYear: integer("install_year"),
  condition: varchar("condition", { length: 50 }).default("Unknown"),
  notes: text("notes"),
  photos: text("photos"),
  provenanceSource: varchar("provenance_source", { length: 50 }).default("manual"),
  provenanceConfidence: integer("provenance_confidence"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("components_home_id_idx").on(table.homeId),
  index("components_system_id_idx").on(table.systemId),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertComponentSchema = createInsertSchema(components).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComponent = Omit<typeof components.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type Component = typeof components.$inferSelect;

// Warranties table - warranty records for systems or components
export const warranties = pgTable("warranties", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  systemId: integer("system_id").references(() => systems.id, { onDelete: "set null" }),
  componentId: integer("component_id").references(() => components.id, { onDelete: "set null" }),
  warrantyProvider: varchar("warranty_provider", { length: 255 }),
  warrantyType: varchar("warranty_type", { length: 100 }),
  coverageSummary: text("coverage_summary"),
  startDate: timestamp("start_date"),
  expiryDate: timestamp("expiry_date"),
  isTransferable: boolean("is_transferable").default(false),
  documentId: integer("document_id").references(() => homeDocuments.id, { onDelete: "set null" }),
  notes: text("notes"),
  provenanceSource: varchar("provenance_source", { length: 50 }).default("manual"),
  provenanceConfidence: integer("provenance_confidence"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("warranties_home_id_idx").on(table.homeId),
  index("warranties_system_id_idx").on(table.systemId),
  index("warranties_expiry_idx").on(table.expiryDate),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertWarrantySchema = createInsertSchema(warranties).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWarranty = Omit<typeof warranties.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type Warranty = typeof warranties.$inferSelect;

// Permits table - building/renovation permits
export const permits = pgTable("permits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  systemId: integer("system_id").references(() => systems.id, { onDelete: "set null" }),
  permitNumber: varchar("permit_number", { length: 100 }),
  permitType: varchar("permit_type", { length: 100 }),
  issuedDate: timestamp("issued_date"),
  status: varchar("status", { length: 50 }).default("unknown"),
  issuingAuthority: varchar("issuing_authority", { length: 255 }),
  description: text("description"),
  documentId: integer("document_id").references(() => homeDocuments.id, { onDelete: "set null" }),
  provenanceSource: varchar("provenance_source", { length: 50 }).default("manual"),
  provenanceConfidence: integer("provenance_confidence"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("permits_home_id_idx").on(table.homeId),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertPermitSchema = createInsertSchema(permits).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPermit = Omit<typeof permits.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type Permit = typeof permits.$inferSelect;

// Repairs table - repair history
export const repairs = pgTable("repairs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  systemId: integer("system_id").references(() => systems.id, { onDelete: "set null" }),
  componentId: integer("component_id").references(() => components.id, { onDelete: "set null" }),
  taskId: integer("task_id").references(() => maintenanceTasks.id, { onDelete: "set null" }),
  contractorId: integer("contractor_id").references(() => contractors.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  repairDate: timestamp("repair_date"),
  cost: integer("cost"),
  partsUsed: text("parts_used"),
  outcome: varchar("outcome", { length: 50 }).default("resolved"),
  provenanceSource: varchar("provenance_source", { length: 50 }).default("manual"),
  provenanceConfidence: integer("provenance_confidence"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("repairs_home_id_idx").on(table.homeId),
  index("repairs_system_id_idx").on(table.systemId),
  index("repairs_date_idx").on(table.repairDate),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertRepairSchema = createInsertSchema(repairs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRepair = Omit<typeof repairs.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type Repair = typeof repairs.$inferSelect;

// Replacements table - system/component replacement history
export const replacements = pgTable("replacements", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  systemId: integer("system_id").references(() => systems.id, { onDelete: "set null" }),
  componentId: integer("component_id").references(() => components.id, { onDelete: "set null" }),
  replacedSystemName: varchar("replaced_system_name", { length: 255 }),
  replacedMake: varchar("replaced_make", { length: 100 }),
  replacedModel: varchar("replaced_model", { length: 100 }),
  replacementDate: timestamp("replacement_date"),
  cost: integer("cost"),
  contractorId: integer("contractor_id").references(() => contractors.id, { onDelete: "set null" }),
  reason: text("reason"),
  documentId: integer("document_id").references(() => homeDocuments.id, { onDelete: "set null" }),
  provenanceSource: varchar("provenance_source", { length: 50 }).default("manual"),
  provenanceConfidence: integer("provenance_confidence"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("replacements_home_id_idx").on(table.homeId),
  index("replacements_date_idx").on(table.replacementDate),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertReplacementSchema = createInsertSchema(replacements).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReplacement = Omit<typeof replacements.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type Replacement = typeof replacements.$inferSelect;

// Recommendations table - AI-generated or inspection-derived recommendations
export const recommendations = pgTable("recommendations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  systemId: integer("system_id").references(() => systems.id, { onDelete: "set null" }),
  componentId: integer("component_id").references(() => components.id, { onDelete: "set null" }),
  findingId: integer("finding_id").references(() => inspectionFindings.id, { onDelete: "set null" }),
  source: varchar("source", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  urgency: varchar("urgency", { length: 50 }).default("later"),
  confidence: integer("confidence"),
  rationale: text("rationale"),
  estimatedCost: varchar("estimated_cost", { length: 100 }),
  status: varchar("status", { length: 50 }).default("open"),
  taskId: integer("task_id").references(() => maintenanceTasks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("recommendations_home_id_idx").on(table.homeId),
  index("recommendations_status_idx").on(table.status),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRecommendation = Omit<typeof recommendations.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type Recommendation = typeof recommendations.$inferSelect;

// Timeline events table - unified timeline of all home events
export const timelineEvents = pgTable("timeline_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  eventDate: timestamp("event_date").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: integer("entity_id"),
  cost: integer("cost"),
  provenanceSource: varchar("provenance_source", { length: 50 }),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("timeline_events_home_id_idx").on(table.homeId),
  index("timeline_events_date_idx").on(table.eventDate),
  index("timeline_events_category_idx").on(table.category),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertTimelineEventSchema = createInsertSchema(timelineEvents).omit({ id: true, createdAt: true });
export type InsertTimelineEvent = Omit<typeof timelineEvents.$inferInsert, 'id' | 'createdAt'>;
export type TimelineEvent = typeof timelineEvents.$inferSelect;

// User action types enum
export const actionTypes = ["completed_task", "ignored_task", "deferred", "manual_fix", "hired_contractor", "dismissed_recommendation"] as const;
export type ActionType = typeof actionTypes[number];

// User actions table - tracks what users do in response to recommendations/tasks
export const userActions = pgTable("user_actions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  systemId: integer("system_id").references(() => systems.id, { onDelete: "set null" }),
  relatedRecommendationId: integer("related_recommendation_id").references(() => recommendations.id, { onDelete: "set null" }),
  relatedTaskId: integer("related_task_id").references(() => maintenanceTasks.id, { onDelete: "set null" }),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  actionDate: timestamp("action_date").defaultNow(),
  costActual: integer("cost_actual"),
  contractorId: integer("contractor_id").references(() => contractors.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_actions_home_id_idx").on(table.homeId),
  index("user_actions_system_id_idx").on(table.systemId),
  index("user_actions_date_idx").on(table.actionDate),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertUserActionSchema = createInsertSchema(userActions).omit({ id: true, createdAt: true });
export type InsertUserAction = Omit<typeof userActions.$inferInsert, 'id' | 'createdAt'>;
export type UserAction = typeof userActions.$inferSelect;

// Outcome event types enum
export const outcomeTypes = ["failure", "avoided_issue", "degraded", "improved", "no_change", "unknown"] as const;
export type OutcomeType = typeof outcomeTypes[number];

// Outcome events table - tracks what actually happened to systems
export const outcomeEvents = pgTable("outcome_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  systemId: integer("system_id").references(() => systems.id, { onDelete: "set null" }),
  relatedActionId: integer("related_action_id").references(() => userActions.id, { onDelete: "set null" }),
  outcomeType: varchar("outcome_type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 50 }).default("low"),
  costImpact: integer("cost_impact"),
  description: text("description"),
  occurredAt: timestamp("occurred_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("outcome_events_home_id_idx").on(table.homeId),
  index("outcome_events_system_id_idx").on(table.systemId),
  index("outcome_events_date_idx").on(table.occurredAt),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertOutcomeEventSchema = createInsertSchema(outcomeEvents).omit({ id: true, createdAt: true });
export type InsertOutcomeEvent = Omit<typeof outcomeEvents.$inferInsert, 'id' | 'createdAt'>;
export type OutcomeEvent = typeof outcomeEvents.$inferSelect;

// Learning adjustments table - stores calibrated engine parameters per home
export const learningAdjustments = pgTable("learning_adjustments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  homeId: integer("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  parameterKey: varchar("parameter_key", { length: 100 }).notNull(),
  parameterValue: text("parameter_value").notNull(),
  reason: text("reason"),
  dataPoints: integer("data_points").default(0),
  confidence: integer("confidence").default(50),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("learning_adjustments_home_id_idx").on(table.homeId),
  index("learning_adjustments_key_idx").on(table.parameterKey),
  uniqueIndex("learning_adjustments_home_param_unique").on(table.homeId, table.parameterKey),
]);

// @ts-expect-error drizzle-zod omit type inference
export const insertLearningAdjustmentSchema = createInsertSchema(learningAdjustments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLearningAdjustment = Omit<typeof learningAdjustments.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type LearningAdjustment = typeof learningAdjustments.$inferSelect;

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
  components: many(components),
  warranties: many(warranties),
  permits: many(permits),
  repairs: many(repairs),
  replacements: many(replacements),
  recommendations: many(recommendations),
  timelineEvents: many(timelineEvents),
  userActions: many(userActions),
  outcomeEvents: many(outcomeEvents),
  learningAdjustments: many(learningAdjustments),
}));

export const systemsRelations = relations(systems, ({ one, many }) => ({
  home: one(homes, {
    fields: [systems.homeId],
    references: [homes.id],
  }),
  tasks: many(maintenanceTasks),
  logEntries: many(maintenanceLogEntries),
  components: many(components),
  warranties: many(warranties),
  permits: many(permits),
  repairs: many(repairs),
  replacements: many(replacements),
  recommendations: many(recommendations),
  userActions: many(userActions),
  outcomeEvents: many(outcomeEvents),
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

export const componentsRelations = relations(components, ({ one, many }) => ({
  home: one(homes, {
    fields: [components.homeId],
    references: [homes.id],
  }),
  system: one(systems, {
    fields: [components.systemId],
    references: [systems.id],
  }),
  warranties: many(warranties),
  repairs: many(repairs),
  replacements: many(replacements),
  recommendations: many(recommendations),
}));

export const warrantiesRelations = relations(warranties, ({ one }) => ({
  home: one(homes, {
    fields: [warranties.homeId],
    references: [homes.id],
  }),
  system: one(systems, {
    fields: [warranties.systemId],
    references: [systems.id],
  }),
  component: one(components, {
    fields: [warranties.componentId],
    references: [components.id],
  }),
  document: one(homeDocuments, {
    fields: [warranties.documentId],
    references: [homeDocuments.id],
  }),
}));

export const permitsRelations = relations(permits, ({ one }) => ({
  home: one(homes, {
    fields: [permits.homeId],
    references: [homes.id],
  }),
  system: one(systems, {
    fields: [permits.systemId],
    references: [systems.id],
  }),
  document: one(homeDocuments, {
    fields: [permits.documentId],
    references: [homeDocuments.id],
  }),
}));

export const repairsRelations = relations(repairs, ({ one }) => ({
  home: one(homes, {
    fields: [repairs.homeId],
    references: [homes.id],
  }),
  system: one(systems, {
    fields: [repairs.systemId],
    references: [systems.id],
  }),
  component: one(components, {
    fields: [repairs.componentId],
    references: [components.id],
  }),
  task: one(maintenanceTasks, {
    fields: [repairs.taskId],
    references: [maintenanceTasks.id],
  }),
  contractor: one(contractors, {
    fields: [repairs.contractorId],
    references: [contractors.id],
  }),
}));

export const replacementsRelations = relations(replacements, ({ one }) => ({
  home: one(homes, {
    fields: [replacements.homeId],
    references: [homes.id],
  }),
  system: one(systems, {
    fields: [replacements.systemId],
    references: [systems.id],
  }),
  component: one(components, {
    fields: [replacements.componentId],
    references: [components.id],
  }),
  contractor: one(contractors, {
    fields: [replacements.contractorId],
    references: [contractors.id],
  }),
  document: one(homeDocuments, {
    fields: [replacements.documentId],
    references: [homeDocuments.id],
  }),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  home: one(homes, {
    fields: [recommendations.homeId],
    references: [homes.id],
  }),
  system: one(systems, {
    fields: [recommendations.systemId],
    references: [systems.id],
  }),
  component: one(components, {
    fields: [recommendations.componentId],
    references: [components.id],
  }),
  finding: one(inspectionFindings, {
    fields: [recommendations.findingId],
    references: [inspectionFindings.id],
  }),
  task: one(maintenanceTasks, {
    fields: [recommendations.taskId],
    references: [maintenanceTasks.id],
  }),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  home: one(homes, {
    fields: [timelineEvents.homeId],
    references: [homes.id],
  }),
}));

export const userActionsRelations = relations(userActions, ({ one }) => ({
  home: one(homes, {
    fields: [userActions.homeId],
    references: [homes.id],
  }),
  system: one(systems, {
    fields: [userActions.systemId],
    references: [systems.id],
  }),
  recommendation: one(recommendations, {
    fields: [userActions.relatedRecommendationId],
    references: [recommendations.id],
  }),
  task: one(maintenanceTasks, {
    fields: [userActions.relatedTaskId],
    references: [maintenanceTasks.id],
  }),
  contractor: one(contractors, {
    fields: [userActions.contractorId],
    references: [contractors.id],
  }),
}));

export const outcomeEventsRelations = relations(outcomeEvents, ({ one }) => ({
  home: one(homes, {
    fields: [outcomeEvents.homeId],
    references: [homes.id],
  }),
  system: one(systems, {
    fields: [outcomeEvents.systemId],
    references: [systems.id],
  }),
  relatedAction: one(userActions, {
    fields: [outcomeEvents.relatedActionId],
    references: [userActions.id],
  }),
}));

export const learningAdjustmentsRelations = relations(learningAdjustments, ({ one }) => ({
  home: one(homes, {
    fields: [learningAdjustments.homeId],
    references: [homes.id],
  }),
}));
