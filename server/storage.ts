import {
  homes,
  type Home,
  type InsertHome,
  systems,
  type System,
  type InsertSystem,
  maintenanceTasks,
  type MaintenanceTask,
  type InsertMaintenanceTask,
  chatMessages,
  type ChatMessage,
  type InsertChatMessage,
  funds,
  type Fund,
  type InsertFund,
  fundAllocations,
  type FundAllocation,
  type InsertFundAllocation,
  expenses,
  type Expense,
  type InsertExpense,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Homes
  getHome(userId: string): Promise<Home | undefined>;
  createHome(home: InsertHome): Promise<Home>;
  updateHome(id: number, data: Partial<InsertHome>): Promise<Home>;
  
  // Systems
  getSystemsByHomeId(homeId: number): Promise<System[]>;
  createSystem(system: InsertSystem): Promise<System>;
  updateSystem(id: number, data: Partial<InsertSystem>): Promise<System>;
  deleteSystem(id: number): Promise<void>;
  
  // Maintenance Tasks
  getTasksByHomeId(homeId: number): Promise<MaintenanceTask[]>;
  createTask(task: InsertMaintenanceTask): Promise<MaintenanceTask>;
  updateTask(id: number, data: Partial<InsertMaintenanceTask>): Promise<MaintenanceTask>;
  deleteTask(id: number): Promise<void>;
  
  // Chat Messages
  getChatMessagesByHomeId(homeId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Funds
  getFundsByHomeId(homeId: number): Promise<Fund[]>;
  getFund(id: number): Promise<Fund | undefined>;
  createFund(fund: InsertFund): Promise<Fund>;
  updateFund(id: number, data: Partial<InsertFund>): Promise<Fund>;
  deleteFund(id: number): Promise<void>;
  
  // Fund Allocations
  getAllocationsByFundId(fundId: number): Promise<FundAllocation[]>;
  getAllocationsByTaskId(taskId: number): Promise<FundAllocation[]>;
  createAllocation(allocation: InsertFundAllocation): Promise<FundAllocation>;
  updateAllocation(id: number, data: Partial<InsertFundAllocation>): Promise<FundAllocation>;
  deleteAllocation(id: number): Promise<void>;
  
  // Expenses
  getExpensesByFundId(fundId: number): Promise<Expense[]>;
  getExpensesByHomeId(homeId: number): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, data: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Homes
  async getHome(userId: string): Promise<Home | undefined> {
    const [home] = await db.select().from(homes).where(eq(homes.userId, userId));
    return home;
  }
  
  async createHome(homeData: InsertHome): Promise<Home> {
    const [home] = await db.insert(homes).values(homeData).returning();
    return home;
  }
  
  async updateHome(id: number, data: Partial<InsertHome>): Promise<Home> {
    const [home] = await db
      .update(homes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(homes.id, id))
      .returning();
    return home;
  }
  
  // Systems
  async getSystemsByHomeId(homeId: number): Promise<System[]> {
    return await db.select().from(systems).where(eq(systems.homeId, homeId));
  }
  
  async createSystem(systemData: InsertSystem): Promise<System> {
    const [system] = await db.insert(systems).values(systemData).returning();
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
  
  async createTask(taskData: InsertMaintenanceTask): Promise<MaintenanceTask> {
    const [task] = await db.insert(maintenanceTasks).values(taskData).returning();
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
  
  // Chat Messages
  async getChatMessagesByHomeId(homeId: number): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.homeId, homeId))
      .orderBy(chatMessages.createdAt);
  }
  
  async createChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(messageData).returning();
    return message;
  }
  
  // Funds
  async getFundsByHomeId(homeId: number): Promise<Fund[]> {
    return await db.select().from(funds).where(eq(funds.homeId, homeId));
  }
  
  async getFund(id: number): Promise<Fund | undefined> {
    const [fund] = await db.select().from(funds).where(eq(funds.id, id));
    return fund;
  }
  
  async createFund(fundData: InsertFund): Promise<Fund> {
    const [fund] = await db.insert(funds).values(fundData).returning();
    return fund;
  }
  
  async updateFund(id: number, data: Partial<InsertFund>): Promise<Fund> {
    const [fund] = await db
      .update(funds)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(funds.id, id))
      .returning();
    return fund;
  }
  
  async deleteFund(id: number): Promise<void> {
    await db.delete(funds).where(eq(funds.id, id));
  }
  
  // Fund Allocations
  async getAllocationsByFundId(fundId: number): Promise<FundAllocation[]> {
    return await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.fundId, fundId));
  }
  
  async getAllocationsByTaskId(taskId: number): Promise<FundAllocation[]> {
    return await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.taskId, taskId));
  }
  
  async createAllocation(allocationData: InsertFundAllocation): Promise<FundAllocation> {
    const [allocation] = await db.insert(fundAllocations).values(allocationData).returning();
    return allocation;
  }
  
  async updateAllocation(id: number, data: Partial<InsertFundAllocation>): Promise<FundAllocation> {
    const [allocation] = await db
      .update(fundAllocations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fundAllocations.id, id))
      .returning();
    return allocation;
  }
  
  async deleteAllocation(id: number): Promise<void> {
    await db.delete(fundAllocations).where(eq(fundAllocations.id, id));
  }
  
  // Expenses
  async getExpensesByFundId(fundId: number): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(eq(expenses.fundId, fundId))
      .orderBy(desc(expenses.createdAt));
  }
  
  async getExpensesByHomeId(homeId: number): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .innerJoin(funds, eq(expenses.fundId, funds.id))
      .where(eq(funds.homeId, homeId))
      .orderBy(desc(expenses.createdAt))
      .then(rows => rows.map(r => r.expenses));
  }
  
  async createExpense(expenseData: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(expenseData).returning();
    return expense;
  }
  
  async updateExpense(id: number, data: Partial<InsertExpense>): Promise<Expense> {
    const [expense] = await db
      .update(expenses)
      .set(data)
      .where(eq(expenses.id, id))
      .returning();
    return expense;
  }
  
  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }
}

export const storage = new DatabaseStorage();
