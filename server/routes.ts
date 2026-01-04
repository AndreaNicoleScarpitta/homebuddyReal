import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { logInfo, logError, logWarn } from "./lib/logger";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  insertHomeSchema,
  insertSystemSchema,
  insertMaintenanceTaskSchema,
  insertChatMessageSchema,
  insertFundSchema,
  insertFundAllocationSchema,
  insertExpenseSchema,
  insertContactMessageSchema,
} from "@shared/schema";

function formatValidationError(error: ZodError): string {
  const zodError = fromZodError(error);
  return zodError.message;
}

function handleApiError(res: any, context: string, error: unknown, statusCode = 400) {
  if (error instanceof ZodError) {
    const message = formatValidationError(error);
    logWarn(context, `Validation error: ${message}`);
    return res.status(400).json({ 
      message: "Please check your input and try again.",
      details: message,
      code: "VALIDATION_ERROR"
    });
  }
  
  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
  logError(context, error);
  
  return res.status(statusCode).json({ 
    message: "Something went wrong. Please try again or contact support if the problem persists.",
    details: errorMessage,
    code: "SERVER_ERROR"
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // All routes protected by authentication
  
  // Home routes
  app.get("/api/home", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      logInfo("home.get", "Fetching home for user", { userId });
      const home = await storage.getHome(userId);
      
      if (!home) {
        return res.status(404).json({ 
          message: "No home profile found. Please complete your home setup first.",
          code: "HOME_NOT_FOUND"
        });
      }
      
      res.json(home);
    } catch (error) {
      return handleApiError(res, "home.get", error, 500);
    }
  });
  
  app.post("/api/home", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const homeData = insertHomeSchema.parse({ ...req.body, userId });
      const home = await storage.createHome(homeData);
      logInfo("home.create", "Home created successfully", { homeId: home.id, userId });
      res.json(home);
    } catch (error) {
      return handleApiError(res, "home.create", error);
    }
  });
  
  app.patch("/api/home/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const home = await storage.updateHome(id, req.body);
      logInfo("home.update", "Home updated successfully", { homeId: id });
      res.json(home);
    } catch (error) {
      return handleApiError(res, "home.update", error);
    }
  });
  
  // System routes
  app.get("/api/home/:homeId/systems", isAuthenticated, async (req, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const systems = await storage.getSystemsByHomeId(homeId);
      res.json(systems);
    } catch (error) {
      return handleApiError(res, "systems.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/systems", isAuthenticated, async (req, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const systemData = insertSystemSchema.parse({ ...req.body, homeId });
      const system = await storage.createSystem(systemData);
      logInfo("systems.create", "System created successfully", { systemId: system.id, homeId });
      res.json(system);
    } catch (error) {
      return handleApiError(res, "systems.create", error);
    }
  });
  
  // Maintenance task routes
  app.get("/api/home/:homeId/tasks", isAuthenticated, async (req, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const tasks = await storage.getTasksByHomeId(homeId);
      res.json(tasks);
    } catch (error) {
      return handleApiError(res, "tasks.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/tasks", isAuthenticated, async (req, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const taskData = insertMaintenanceTaskSchema.parse({ ...req.body, homeId });
      const task = await storage.createTask(taskData);
      logInfo("tasks.create", "Task created successfully", { taskId: task.id, homeId });
      res.json(task);
    } catch (error) {
      return handleApiError(res, "tasks.create", error);
    }
  });
  
  app.patch("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.updateTask(id, req.body);
      logInfo("tasks.update", "Task updated successfully", { taskId: id });
      res.json(task);
    } catch (error) {
      return handleApiError(res, "tasks.update", error);
    }
  });
  
  app.delete("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTask(id);
      logInfo("tasks.delete", "Task deleted successfully", { taskId: id });
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      return handleApiError(res, "tasks.delete", error);
    }
  });
  
  // Chat message routes
  app.get("/api/home/:homeId/chat", isAuthenticated, async (req, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const messages = await storage.getChatMessagesByHomeId(homeId);
      res.json(messages);
    } catch (error) {
      return handleApiError(res, "chat.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/chat", isAuthenticated, async (req, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const messageData = insertChatMessageSchema.parse({ ...req.body, homeId });
      const message = await storage.createChatMessage(messageData);
      res.json(message);
    } catch (error) {
      return handleApiError(res, "chat.create", error);
    }
  });
  
  // Fund routes
  app.get("/api/home/:homeId/funds", isAuthenticated, async (req, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const fundsList = await storage.getFundsByHomeId(homeId);
      res.json(fundsList);
    } catch (error) {
      return handleApiError(res, "funds.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/funds", isAuthenticated, async (req, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const fundData = insertFundSchema.parse({ ...req.body, homeId });
      const fund = await storage.createFund(fundData);
      logInfo("funds.create", "Fund created successfully", { fundId: fund.id, homeId });
      res.json(fund);
    } catch (error) {
      return handleApiError(res, "funds.create", error);
    }
  });
  
  app.patch("/api/funds/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const fund = await storage.updateFund(id, req.body);
      logInfo("funds.update", "Fund updated successfully", { fundId: id });
      res.json(fund);
    } catch (error) {
      return handleApiError(res, "funds.update", error);
    }
  });
  
  app.delete("/api/funds/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFund(id);
      logInfo("funds.delete", "Fund deleted successfully", { fundId: id });
      res.json({ message: "Fund deleted successfully" });
    } catch (error) {
      return handleApiError(res, "funds.delete", error);
    }
  });
  
  // Fund allocation routes
  app.get("/api/funds/:fundId/allocations", isAuthenticated, async (req, res) => {
    try {
      const fundId = parseInt(req.params.fundId);
      const allocations = await storage.getAllocationsByFundId(fundId);
      res.json(allocations);
    } catch (error) {
      return handleApiError(res, "allocations.get", error, 500);
    }
  });
  
  app.get("/api/tasks/:taskId/allocations", isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const allocations = await storage.getAllocationsByTaskId(taskId);
      res.json(allocations);
    } catch (error) {
      return handleApiError(res, "allocations.getByTask", error, 500);
    }
  });
  
  app.post("/api/allocations", isAuthenticated, async (req, res) => {
    try {
      const allocationData = insertFundAllocationSchema.parse(req.body);
      const allocation = await storage.createAllocation(allocationData);
      logInfo("allocations.create", "Allocation created successfully", { allocationId: allocation.id });
      res.json(allocation);
    } catch (error) {
      return handleApiError(res, "allocations.create", error);
    }
  });
  
  app.patch("/api/allocations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allocation = await storage.updateAllocation(id, req.body);
      logInfo("allocations.update", "Allocation updated successfully", { allocationId: id });
      res.json(allocation);
    } catch (error) {
      return handleApiError(res, "allocations.update", error);
    }
  });
  
  app.delete("/api/allocations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAllocation(id);
      logInfo("allocations.delete", "Allocation deleted successfully", { allocationId: id });
      res.json({ message: "Allocation deleted successfully" });
    } catch (error) {
      return handleApiError(res, "allocations.delete", error);
    }
  });
  
  // Expense routes
  app.get("/api/home/:homeId/expenses", isAuthenticated, async (req, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const expensesList = await storage.getExpensesByHomeId(homeId);
      res.json(expensesList);
    } catch (error) {
      return handleApiError(res, "expenses.get", error, 500);
    }
  });
  
  app.get("/api/funds/:fundId/expenses", isAuthenticated, async (req, res) => {
    try {
      const fundId = parseInt(req.params.fundId);
      const expensesList = await storage.getExpensesByFundId(fundId);
      res.json(expensesList);
    } catch (error) {
      return handleApiError(res, "expenses.getByFund", error, 500);
    }
  });
  
  app.post("/api/expenses", isAuthenticated, async (req, res) => {
    try {
      const expenseData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(expenseData);
      logInfo("expenses.create", "Expense created successfully", { expenseId: expense.id });
      res.json(expense);
    } catch (error) {
      return handleApiError(res, "expenses.create", error);
    }
  });
  
  app.patch("/api/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const expense = await storage.updateExpense(id, req.body);
      logInfo("expenses.update", "Expense updated successfully", { expenseId: id });
      res.json(expense);
    } catch (error) {
      return handleApiError(res, "expenses.update", error);
    }
  });
  
  app.delete("/api/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteExpense(id);
      logInfo("expenses.delete", "Expense deleted successfully", { id });
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      return handleApiError(res, "expenses.delete", error);
    }
  });
  
  // Contact form route (public - no auth required)
  app.post("/api/contact", async (req, res) => {
    try {
      const messageData = insertContactMessageSchema.parse(req.body);
      const message = await storage.createContactMessage(messageData);
      
      logInfo("contact.create", "Contact message received", { 
        name: messageData.name, 
        email: messageData.email,
        subject: messageData.subject 
      });
      
      res.json({ 
        message: "Thank you for reaching out! We'll get back to you soon.",
        id: message.id 
      });
    } catch (error) {
      return handleApiError(res, "contact.create", error);
    }
  });
  
  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  return httpServer;
}
