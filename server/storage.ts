import {
  homes,
  type Home,
  type InsertHome,
  systems,
  type System,
  type InsertSystem,
  warranties,
  type Warranty,
  type InsertWarranty,
  utilityAccounts,
  type UtilityAccount,
  type InsertUtilityAccount,
  insurancePolicies,
  type InsurancePolicy,
  type InsertInsurancePolicy,
  maintenanceTasks,
  type MaintenanceTask,
  type InsertMaintenanceTask,
  maintenanceLogEntries,
  type MaintenanceLogEntry,
  type InsertMaintenanceLogEntry,
  chatMessages,
  type ChatMessage,
  type InsertChatMessage,
  // No CRUD left for these — they exist solely so deleteAllUserData can
  // still purge legacy rows until the tables themselves are dropped.
  funds,
  fundAllocations,
  expenses,
  contactMessages,
  type ContactMessage,
  type InsertContactMessage,
  inspectionReports,
  type InspectionReport,
  type InsertInspectionReport,
  inspectionFindings,
  type InspectionFinding,
  type InsertInspectionFinding,
  contractorAppointments,
  type ContractorAppointment,
  type InsertContractorAppointment,
  notificationPreferences,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  homeDocuments,
  type HomeDocument,
  type InsertHomeDocument,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Homes
  getHome(userId: string): Promise<Home | undefined>;
  getHomeById(id: number): Promise<Home | undefined>;
  createHome(home: InsertHome): Promise<Home>;
  updateHome(id: number, userId: string, data: Partial<InsertHome>): Promise<Home>;
  
  // Systems
  getSystemsByHomeId(homeId: number): Promise<System[]>;
  createSystem(system: InsertSystem): Promise<System>;
  updateSystem(id: number, data: Partial<InsertSystem>): Promise<System>;
  deleteSystem(id: number): Promise<void>;
  
  // Maintenance Tasks
  getTasksByHomeId(homeId: number): Promise<MaintenanceTask[]>;
  getTask(id: number): Promise<MaintenanceTask | undefined>;
  createTask(task: InsertMaintenanceTask): Promise<MaintenanceTask>;
  updateTask(id: number, data: Partial<InsertMaintenanceTask>): Promise<MaintenanceTask>;
  deleteTask(id: number): Promise<void>;
  
  // Maintenance Log Entries
  getLogEntriesByHomeId(homeId: number): Promise<MaintenanceLogEntry[]>;
  getLogEntry(id: number): Promise<MaintenanceLogEntry | undefined>;
  createLogEntry(entry: InsertMaintenanceLogEntry): Promise<MaintenanceLogEntry>;
  updateLogEntry(id: number, data: Partial<InsertMaintenanceLogEntry>): Promise<MaintenanceLogEntry>;
  deleteLogEntry(id: number): Promise<void>;
  verifyLogEntryOwnership(entryId: number, userId: string): Promise<boolean>;
  
  // Chat Messages
  getChatMessagesByHomeId(homeId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Authorization helpers
  verifyHomeOwnership(homeId: number, userId: string): Promise<boolean>;
  verifyTaskOwnership(taskId: number, userId: string): Promise<boolean>;
  
  // Contact Messages
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  getContactMessages(): Promise<ContactMessage[]>;
  
  // Inspection Reports
  getInspectionReportsByHomeId(homeId: number): Promise<InspectionReport[]>;
  getInspectionReport(id: number): Promise<InspectionReport | undefined>;
  createInspectionReport(report: InsertInspectionReport): Promise<InspectionReport>;
  updateInspectionReport(id: number, data: Partial<InsertInspectionReport>): Promise<InspectionReport>;
  deleteInspectionReport(id: number): Promise<void>;
  
  // Inspection Findings
  getFindingsByReportId(reportId: number): Promise<InspectionFinding[]>;
  createFinding(finding: InsertInspectionFinding): Promise<InspectionFinding>;
  updateFinding(id: number, data: Partial<InsertInspectionFinding>): Promise<InspectionFinding>;
  deleteFinding(id: number): Promise<void>;
  verifyReportOwnership(reportId: number, userId: string): Promise<boolean>;
  
  // Contractor Appointments
  getAppointmentsByHomeId(homeId: number): Promise<ContractorAppointment[]>;
  getAppointment(id: number): Promise<ContractorAppointment | undefined>;
  createAppointment(appointment: InsertContractorAppointment): Promise<ContractorAppointment>;
  updateAppointment(id: number, data: Partial<InsertContractorAppointment>): Promise<ContractorAppointment>;
  deleteAppointment(id: number): Promise<void>;
  verifyAppointmentOwnership(appointmentId: number, userId: string): Promise<boolean>;
  
  // Notification Preferences
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  createNotificationPreferences(prefs: InsertNotificationPreferences): Promise<NotificationPreferences>;
  updateNotificationPreferences(userId: string, data: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;

  // Home Documents
  getDocumentsByHomeId(homeId: number): Promise<HomeDocument[]>;
  getDocument(id: number): Promise<HomeDocument | undefined>;
  createDocument(doc: InsertHomeDocument): Promise<HomeDocument>;
  deleteDocument(id: number): Promise<void>;
  verifyDocumentOwnership(documentId: number, userId: string): Promise<boolean>;

  // Warranties
  getWarrantiesByHomeId(homeId: number): Promise<Warranty[]>;
  createWarranty(warranty: InsertWarranty): Promise<Warranty>;
  updateWarranty(id: number, data: Partial<InsertWarranty>): Promise<Warranty>;
  deleteWarranty(id: number): Promise<void>;
  verifyWarrantyOwnership(warrantyId: number, userId: string): Promise<boolean>;

  // Utility Accounts
  getUtilityAccountsByHomeId(homeId: number): Promise<UtilityAccount[]>;
  createUtilityAccount(account: InsertUtilityAccount): Promise<UtilityAccount>;
  updateUtilityAccount(id: number, data: Partial<InsertUtilityAccount>): Promise<UtilityAccount>;
  deleteUtilityAccount(id: number): Promise<void>;
  verifyUtilityAccountOwnership(accountId: number, userId: string): Promise<boolean>;

  // Insurance Policies
  getInsurancePoliciesByHomeId(homeId: number): Promise<InsurancePolicy[]>;
  createInsurancePolicy(policy: InsertInsurancePolicy): Promise<InsurancePolicy>;
  updateInsurancePolicy(id: number, data: Partial<InsertInsurancePolicy>): Promise<InsurancePolicy>;
  deleteInsurancePolicy(id: number): Promise<void>;
  verifyInsurancePolicyOwnership(policyId: number, userId: string): Promise<boolean>;

  // Data Management
  deleteAllUserData(userId: string): Promise<void>;
  deleteChatMessagesByHomeId(homeId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Homes
  async getHome(userId: string): Promise<Home | undefined> {
    const [home] = await db.select().from(homes).where(eq(homes.userId, userId));
    return home;
  }
  
  async getHomeById(id: number): Promise<Home | undefined> {
    const [home] = await db.select().from(homes).where(eq(homes.id, id));
    return home;
  }
  
  async createHome(homeData: InsertHome): Promise<Home> {
    const [home] = await db.insert(homes).values(homeData as any).returning();
    return home;
  }
  
  async updateHome(id: number, userId: string, data: Partial<InsertHome>): Promise<Home> {
    const [home] = await db
      .update(homes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(homes.id, id), eq(homes.userId, userId)))
      .returning();
    if (!home) {
      throw new Error("Home not found or access denied");
    }
    return home;
  }
  
  // Systems
  async getSystemsByHomeId(homeId: number): Promise<System[]> {
    return await db.select().from(systems).where(eq(systems.homeId, homeId));
  }
  
  async createSystem(systemData: InsertSystem): Promise<System> {
    const [system] = await db.insert(systems).values(systemData as any).returning();
    return system;
  }
  
  async updateSystem(id: number, data: Partial<InsertSystem>): Promise<System> {
    const [system] = await db
      .update(systems)
      .set(data)
      .where(eq(systems.id, id))
      .returning();
    return system;
  }
  
  async deleteSystem(id: number): Promise<void> {
    await db.delete(systems).where(eq(systems.id, id));
  }
  
  // Maintenance Tasks
  async getTasksByHomeId(homeId: number): Promise<MaintenanceTask[]> {
    return await db
      .select()
      .from(maintenanceTasks)
      .where(eq(maintenanceTasks.homeId, homeId))
      .orderBy(maintenanceTasks.dueDate);
  }
  
  async getTask(id: number): Promise<MaintenanceTask | undefined> {
    const [task] = await db.select().from(maintenanceTasks).where(eq(maintenanceTasks.id, id));
    return task;
  }
  
  async createTask(taskData: InsertMaintenanceTask): Promise<MaintenanceTask> {
    const [task] = await db.insert(maintenanceTasks).values(taskData as any).returning();
    return task;
  }
  
  async updateTask(id: number, data: Partial<InsertMaintenanceTask>): Promise<MaintenanceTask> {
    const [task] = await db
      .update(maintenanceTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(maintenanceTasks.id, id))
      .returning();
    return task;
  }
  
  async deleteTask(id: number): Promise<void> {
    await db.delete(maintenanceTasks).where(eq(maintenanceTasks.id, id));
  }
  
  // Maintenance Log Entries
  async getLogEntriesByHomeId(homeId: number): Promise<MaintenanceLogEntry[]> {
    return await db
      .select()
      .from(maintenanceLogEntries)
      .where(eq(maintenanceLogEntries.homeId, homeId))
      .orderBy(desc(maintenanceLogEntries.date));
  }
  
  async getLogEntry(id: number): Promise<MaintenanceLogEntry | undefined> {
    const [entry] = await db.select().from(maintenanceLogEntries).where(eq(maintenanceLogEntries.id, id));
    return entry;
  }
  
  async createLogEntry(entryData: InsertMaintenanceLogEntry): Promise<MaintenanceLogEntry> {
    const [entry] = await db.insert(maintenanceLogEntries).values(entryData as any).returning();
    return entry;
  }
  
  async updateLogEntry(id: number, data: Partial<InsertMaintenanceLogEntry>): Promise<MaintenanceLogEntry> {
    const [entry] = await db
      .update(maintenanceLogEntries)
      .set(data)
      .where(eq(maintenanceLogEntries.id, id))
      .returning();
    return entry;
  }
  
  async deleteLogEntry(id: number): Promise<void> {
    await db.delete(maintenanceLogEntries).where(eq(maintenanceLogEntries.id, id));
  }
  
  async verifyLogEntryOwnership(entryId: number, userId: string): Promise<boolean> {
    const entry = await this.getLogEntry(entryId);
    if (!entry) return false;
    return this.verifyHomeOwnership(entry.homeId, userId);
  }
  
  // Chat Messages
  async getChatMessagesByHomeId(homeId: number): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.homeId, homeId))
      .orderBy(chatMessages.createdAt);
  }
  
  async createChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(messageData as any).returning();
    return message;
  }
  
  // Contact Messages
  async createContactMessage(messageData: InsertContactMessage): Promise<ContactMessage> {
    const [message] = await db.insert(contactMessages).values(messageData as any).returning();
    return message;
  }
  
  async getContactMessages(): Promise<ContactMessage[]> {
    return await db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt));
  }
  
  // Authorization helpers
  async verifyHomeOwnership(homeId: number, userId: string): Promise<boolean> {
    const home = await this.getHomeById(homeId);
    return home?.userId === userId;
  }
  
  async verifyTaskOwnership(taskId: number, userId: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task) return false;
    return this.verifyHomeOwnership(task.homeId, userId);
  }
  
  // Inspection Reports
  async getInspectionReportsByHomeId(homeId: number): Promise<InspectionReport[]> {
    return await db
      .select()
      .from(inspectionReports)
      .where(eq(inspectionReports.homeId, homeId))
      .orderBy(desc(inspectionReports.createdAt));
  }
  
  async getInspectionReport(id: number): Promise<InspectionReport | undefined> {
    const [report] = await db.select().from(inspectionReports).where(eq(inspectionReports.id, id));
    return report;
  }
  
  async createInspectionReport(reportData: InsertInspectionReport): Promise<InspectionReport> {
    const [report] = await db.insert(inspectionReports).values(reportData as any).returning();
    return report;
  }
  
  async updateInspectionReport(id: number, data: Partial<InsertInspectionReport>): Promise<InspectionReport> {
    const [report] = await db
      .update(inspectionReports)
      .set(data)
      .where(eq(inspectionReports.id, id))
      .returning();
    return report;
  }
  
  async deleteInspectionReport(id: number): Promise<void> {
    await db.delete(inspectionReports).where(eq(inspectionReports.id, id));
  }
  
  // Inspection Findings
  async getFindingsByReportId(reportId: number): Promise<InspectionFinding[]> {
    return await db
      .select()
      .from(inspectionFindings)
      .where(eq(inspectionFindings.reportId, reportId))
      .orderBy(desc(inspectionFindings.createdAt));
  }
  
  async createFinding(findingData: InsertInspectionFinding): Promise<InspectionFinding> {
    const [finding] = await db.insert(inspectionFindings).values(findingData as any).returning();
    return finding;
  }
  
  async updateFinding(id: number, data: Partial<InsertInspectionFinding>): Promise<InspectionFinding> {
    const [finding] = await db
      .update(inspectionFindings)
      .set(data)
      .where(eq(inspectionFindings.id, id))
      .returning();
    return finding;
  }
  
  async deleteFinding(id: number): Promise<void> {
    await db.delete(inspectionFindings).where(eq(inspectionFindings.id, id));
  }
  
  async verifyReportOwnership(reportId: number, userId: string): Promise<boolean> {
    const report = await this.getInspectionReport(reportId);
    if (!report) return false;
    return this.verifyHomeOwnership(report.homeId, userId);
  }
  
  // Contractor Appointments
  async getAppointmentsByHomeId(homeId: number): Promise<ContractorAppointment[]> {
    return await db
      .select()
      .from(contractorAppointments)
      .where(eq(contractorAppointments.homeId, homeId))
      .orderBy(desc(contractorAppointments.scheduledDate));
  }
  
  async getAppointment(id: number): Promise<ContractorAppointment | undefined> {
    const [appointment] = await db.select().from(contractorAppointments).where(eq(contractorAppointments.id, id));
    return appointment;
  }
  
  async createAppointment(appointmentData: InsertContractorAppointment): Promise<ContractorAppointment> {
    const [appointment] = await db.insert(contractorAppointments).values(appointmentData as any).returning();
    return appointment;
  }
  
  async updateAppointment(id: number, data: Partial<InsertContractorAppointment>): Promise<ContractorAppointment> {
    const [appointment] = await db
      .update(contractorAppointments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contractorAppointments.id, id))
      .returning();
    return appointment;
  }
  
  async deleteAppointment(id: number): Promise<void> {
    await db.delete(contractorAppointments).where(eq(contractorAppointments.id, id));
  }
  
  async verifyAppointmentOwnership(appointmentId: number, userId: string): Promise<boolean> {
    const appointment = await this.getAppointment(appointmentId);
    if (!appointment) return false;
    return this.verifyHomeOwnership(appointment.homeId, userId);
  }
  
  // Notification Preferences
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    return prefs;
  }
  
  async createNotificationPreferences(prefsData: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const [prefs] = await db.insert(notificationPreferences).values(prefsData as any).returning();
    return prefs;
  }
  
  async updateNotificationPreferences(userId: string, data: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences> {
    const existing = await this.getNotificationPreferences(userId);
    if (!existing) {
      return this.createNotificationPreferences({ userId, ...data });
    }
    const [prefs] = await db
      .update(notificationPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    return prefs;
  }

  // Home Documents
  async getDocumentsByHomeId(homeId: number): Promise<HomeDocument[]> {
    return await db
      .select()
      .from(homeDocuments)
      .where(eq(homeDocuments.homeId, homeId))
      .orderBy(desc(homeDocuments.createdAt));
  }

  async getDocument(id: number): Promise<HomeDocument | undefined> {
    const [doc] = await db.select().from(homeDocuments).where(eq(homeDocuments.id, id));
    return doc;
  }

  async createDocument(docData: InsertHomeDocument): Promise<HomeDocument> {
    const [doc] = await db.insert(homeDocuments).values(docData as any).returning();
    return doc;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(homeDocuments).where(eq(homeDocuments.id, id));
  }

  async verifyDocumentOwnership(documentId: number, userId: string): Promise<boolean> {
    const doc = await this.getDocument(documentId);
    if (!doc) return false;
    return this.verifyHomeOwnership(doc.homeId, userId);
  }

  async deleteChatMessagesByHomeId(homeId: number): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.homeId, homeId));
  }

  async deleteAllUserData(userId: string): Promise<void> {
    const uid = String(userId);
    let spCounter = 0;
    await db.transaction(async (tx) => {
      const safeExec = async (fn: () => Promise<any>) => {
        const spName = `sp_del_${++spCounter}`;
        await tx.execute(sql.raw(`SAVEPOINT ${spName}`));
        try {
          await fn();
          await tx.execute(sql.raw(`RELEASE SAVEPOINT ${spName}`));
        } catch {
          await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${spName}`));
        }
      };

      const userHomes = await tx.select().from(homes).where(eq(homes.userId, uid));

      for (const home of userHomes) {
        await safeExec(() => tx.delete(chatMessages).where(eq(chatMessages.homeId, home.id)));
        await safeExec(() => tx.delete(maintenanceTasks).where(eq(maintenanceTasks.homeId, home.id)));
        await safeExec(() => tx.delete(maintenanceLogEntries).where(eq(maintenanceLogEntries.homeId, home.id)));
        await safeExec(() => tx.delete(systems).where(eq(systems.homeId, home.id)));

        let homeFunds: any[] = [];
        const spf = `sp_del_${++spCounter}`;
        await tx.execute(sql.raw(`SAVEPOINT ${spf}`));
        try {
          homeFunds = await tx.select().from(funds).where(eq(funds.homeId, home.id));
          await tx.execute(sql.raw(`RELEASE SAVEPOINT ${spf}`));
        } catch {
          await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${spf}`));
          homeFunds = [];
        }
        for (const fund of homeFunds) {
          await safeExec(() => tx.delete(expenses).where(eq(expenses.fundId, fund.id)));
          await safeExec(() => tx.delete(fundAllocations).where(eq(fundAllocations.fundId, fund.id)));
        }
        await safeExec(() => tx.delete(funds).where(eq(funds.homeId, home.id)));

        await safeExec(() => tx.execute(sql`
          DELETE FROM inspection_findings
          WHERE report_id IN (SELECT id FROM inspection_reports WHERE home_id = ${home.id})
        `));
        await safeExec(() => tx.delete(inspectionReports).where(eq(inspectionReports.homeId, home.id)));
        await safeExec(() => tx.delete(contractorAppointments).where(eq(contractorAppointments.homeId, home.id)));
      }

      let v2HomeIds: string[] = [];
      const spv = `sp_del_${++spCounter}`;
      await tx.execute(sql.raw(`SAVEPOINT ${spv}`));
      try {
        const v2HomeRows = await tx.execute(sql`
          SELECT home_id FROM projection_home WHERE user_id = ${uid}
        `);
        v2HomeIds = v2HomeRows.rows.map((r: any) => r.home_id as string);
        await tx.execute(sql.raw(`RELEASE SAVEPOINT ${spv}`));
      } catch {
        await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${spv}`));
        v2HomeIds = [];
      }

      for (const homeId of v2HomeIds) {
        await safeExec(() => tx.execute(sql`
          DELETE FROM projection_chat_message
          WHERE session_id IN (SELECT session_id FROM projection_chat_session WHERE home_id = ${homeId})
        `));
        await safeExec(() => tx.execute(sql`DELETE FROM projection_chat_session WHERE home_id = ${homeId}`));
        await safeExec(() => tx.execute(sql`DELETE FROM projection_task WHERE home_id = ${homeId}`));
        await safeExec(() => tx.execute(sql`
          DELETE FROM projection_finding
          WHERE report_id IN (SELECT report_id FROM projection_report WHERE home_id = ${homeId})
        `));
        await safeExec(() => tx.execute(sql`DELETE FROM projection_report WHERE home_id = ${homeId}`));
        await safeExec(() => tx.execute(sql`DELETE FROM projection_system WHERE home_id = ${homeId}`));
        await safeExec(() => tx.execute(sql`DELETE FROM projection_assistant_action WHERE home_id = ${homeId}`));
        await safeExec(() => tx.execute(sql`DELETE FROM projection_notification_pref WHERE home_id = ${homeId}`));
        await safeExec(() => tx.execute(sql`DELETE FROM projection_circuit_map WHERE home_id = ${homeId}`));
        await safeExec(() => tx.execute(sql`DELETE FROM projection_home WHERE home_id = ${homeId}`));
      }

      await safeExec(() => tx.execute(sql`ALTER TABLE event_log DISABLE TRIGGER trg_event_log_immutable`));
      await safeExec(() => tx.execute(sql`DELETE FROM event_log WHERE actor_id = ${uid}`));
      for (const homeId of v2HomeIds) {
        await safeExec(() => tx.execute(sql`DELETE FROM event_log WHERE aggregate_id = ${homeId}`));
        await safeExec(() => tx.execute(sql`
          DELETE FROM event_log WHERE aggregate_id IN (
            SELECT DISTINCT aggregate_id FROM event_log
            WHERE data->>'homeId' = ${homeId}
          )
        `));
      }
      await safeExec(() => tx.execute(sql`ALTER TABLE event_log ENABLE TRIGGER trg_event_log_immutable`));

      for (const homeId of v2HomeIds) {
        await safeExec(() => tx.execute(sql`DELETE FROM job_queue WHERE data->>'homeId' = ${homeId}`));
      }

      await tx.delete(homes).where(eq(homes.userId, uid));
      await safeExec(() => tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, uid)));
    });
  }

  // Warranties
  async getWarrantiesByHomeId(homeId: number): Promise<Warranty[]> {
    return db.select().from(warranties).where(eq(warranties.homeId, homeId));
  }
  async createWarranty(data: InsertWarranty): Promise<Warranty> {
    const [w] = await db.insert(warranties).values(data as any).returning();
    return w;
  }
  async updateWarranty(id: number, data: Partial<InsertWarranty>): Promise<Warranty> {
    const [w] = await db.update(warranties).set({ ...data, updatedAt: new Date() }).where(eq(warranties.id, id)).returning();
    if (!w) throw new Error("Warranty not found");
    return w;
  }
  async deleteWarranty(id: number): Promise<void> {
    await db.delete(warranties).where(eq(warranties.id, id));
  }
  async verifyWarrantyOwnership(warrantyId: number, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: warranties.id })
      .from(warranties)
      .innerJoin(homes, eq(warranties.homeId, homes.id))
      .where(and(eq(warranties.id, warrantyId), eq(homes.userId, userId)));
    return !!row;
  }

  // Utility Accounts
  async getUtilityAccountsByHomeId(homeId: number): Promise<UtilityAccount[]> {
    return db.select().from(utilityAccounts).where(eq(utilityAccounts.homeId, homeId));
  }
  async createUtilityAccount(data: InsertUtilityAccount): Promise<UtilityAccount> {
    const [a] = await db.insert(utilityAccounts).values(data as any).returning();
    return a;
  }
  async updateUtilityAccount(id: number, data: Partial<InsertUtilityAccount>): Promise<UtilityAccount> {
    const [a] = await db.update(utilityAccounts).set({ ...data, updatedAt: new Date() }).where(eq(utilityAccounts.id, id)).returning();
    if (!a) throw new Error("Utility account not found");
    return a;
  }
  async deleteUtilityAccount(id: number): Promise<void> {
    await db.delete(utilityAccounts).where(eq(utilityAccounts.id, id));
  }
  async verifyUtilityAccountOwnership(accountId: number, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: utilityAccounts.id })
      .from(utilityAccounts)
      .innerJoin(homes, eq(utilityAccounts.homeId, homes.id))
      .where(and(eq(utilityAccounts.id, accountId), eq(homes.userId, userId)));
    return !!row;
  }

  // Insurance Policies
  async getInsurancePoliciesByHomeId(homeId: number): Promise<InsurancePolicy[]> {
    return db.select().from(insurancePolicies).where(eq(insurancePolicies.homeId, homeId));
  }
  async createInsurancePolicy(data: InsertInsurancePolicy): Promise<InsurancePolicy> {
    const [p] = await db.insert(insurancePolicies).values(data as any).returning();
    return p;
  }
  async updateInsurancePolicy(id: number, data: Partial<InsertInsurancePolicy>): Promise<InsurancePolicy> {
    const [p] = await db.update(insurancePolicies).set({ ...data, updatedAt: new Date() }).where(eq(insurancePolicies.id, id)).returning();
    if (!p) throw new Error("Insurance policy not found");
    return p;
  }
  async deleteInsurancePolicy(id: number): Promise<void> {
    await db.delete(insurancePolicies).where(eq(insurancePolicies.id, id));
  }
  async verifyInsurancePolicyOwnership(policyId: number, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: insurancePolicies.id })
      .from(insurancePolicies)
      .innerJoin(homes, eq(insurancePolicies.homeId, homes.id))
      .where(and(eq(insurancePolicies.id, policyId), eq(homes.userId, userId)));
    return !!row;
  }
}

export const storage = new DatabaseStorage();
