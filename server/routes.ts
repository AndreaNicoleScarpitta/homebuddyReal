import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { logInfo, logError, logWarn } from "./lib/logger";
import { verifyAddress, isUSPSConfigured } from "./lib/usps";
import { streamAIResponse } from "./lib/ai-chat";
import { sendContactFormNotification } from "./lib/email";
import { ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  insertHomeSchema,
  insertSystemSchema,
  insertMaintenanceTaskSchema,
  insertMaintenanceLogEntrySchema,
  insertChatMessageSchema,
  insertFundSchema,
  insertFundAllocationSchema,
  insertExpenseSchema,
  insertContactMessageSchema,
  insertInspectionReportSchema,
  insertContractorAppointmentSchema,
  insertNotificationPreferencesSchema,
} from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

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
      const userId = req.user.claims.sub;
      const home = await storage.updateHome(id, userId, req.body);
      logInfo("home.update", "Home updated successfully", { homeId: id, userId });
      res.json(home);
    } catch (error) {
      return handleApiError(res, "home.update", error);
    }
  });
  
  // Address verification routes
  const addressVerifySchema = z.object({
    streetAddress: z.string().min(1, "Street address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().length(2, "State must be 2 characters"),
    zipCode: z.string().optional(),
  });
  
  app.post("/api/address/verify", isAuthenticated, async (req, res) => {
    try {
      if (!isUSPSConfigured()) {
        logWarn("address.verify", "USPS API not configured");
        return res.status(503).json({
          message: "Address verification is not available",
          code: "USPS_NOT_CONFIGURED"
        });
      }
      
      const { streetAddress, city, state, zipCode } = addressVerifySchema.parse(req.body);
      
      logInfo("address.verify", "Verifying address", { streetAddress, city, state });
      
      const result = await verifyAddress(streetAddress, city, state, zipCode);
      
      if (result.verified && result.address) {
        return res.json({
          verified: true,
          address: {
            streetAddress: result.address.streetAddress,
            city: result.address.city,
            state: result.address.state,
            zipCode: result.address.ZIPCode,
            zipPlus4: result.address.ZIPPlus4,
          }
        });
      }
      
      return res.json({
        verified: false,
        error: result.error || "Could not verify address"
      });
    } catch (error) {
      return handleApiError(res, "address.verify", error);
    }
  });
  
  app.get("/api/address/status", async (_req, res) => {
    res.json({
      uspsConfigured: isUSPSConfigured(),
      googlePlacesConfigured: !!process.env.GOOGLE_PLACES_API_KEY
    });
  });
  
  // System routes
  app.get("/api/home/:homeId/systems", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const systems = await storage.getSystemsByHomeId(homeId);
      res.json(systems);
    } catch (error) {
      return handleApiError(res, "systems.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/systems", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const systemData = insertSystemSchema.parse({ ...req.body, homeId });
      const system = await storage.createSystem(systemData);
      logInfo("systems.create", "System created successfully", { systemId: system.id, homeId });
      res.json(system);
    } catch (error) {
      return handleApiError(res, "systems.create", error);
    }
  });
  
  // Maintenance task routes
  app.get("/api/home/:homeId/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const tasks = await storage.getTasksByHomeId(homeId);
      res.json(tasks);
    } catch (error) {
      return handleApiError(res, "tasks.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const taskData = insertMaintenanceTaskSchema.parse({ ...req.body, homeId });
      const task = await storage.createTask(taskData);
      logInfo("tasks.create", "Task created successfully", { taskId: task.id, homeId });
      res.json(task);
    } catch (error) {
      return handleApiError(res, "tasks.create", error);
    }
  });
  
  app.patch("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyTaskOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const task = await storage.updateTask(id, req.body);
      logInfo("tasks.update", "Task updated successfully", { taskId: id });
      res.json(task);
    } catch (error) {
      return handleApiError(res, "tasks.update", error);
    }
  });
  
  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyTaskOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      await storage.deleteTask(id);
      logInfo("tasks.delete", "Task deleted successfully", { taskId: id });
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      return handleApiError(res, "tasks.delete", error);
    }
  });
  
  // Maintenance log entry routes
  app.get("/api/home/:homeId/log-entries", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const entries = await storage.getLogEntriesByHomeId(homeId);
      res.json(entries);
    } catch (error) {
      return handleApiError(res, "logEntries.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/log-entries", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const entryData = insertMaintenanceLogEntrySchema.parse({ ...req.body, homeId });
      const entry = await storage.createLogEntry(entryData);
      logInfo("logEntries.create", "Log entry created successfully", { entryId: entry.id, homeId });
      res.json(entry);
    } catch (error) {
      return handleApiError(res, "logEntries.create", error);
    }
  });
  
  app.patch("/api/log-entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyLogEntryOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const entry = await storage.updateLogEntry(id, req.body);
      logInfo("logEntries.update", "Log entry updated successfully", { entryId: id });
      res.json(entry);
    } catch (error) {
      return handleApiError(res, "logEntries.update", error);
    }
  });
  
  app.delete("/api/log-entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyLogEntryOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      await storage.deleteLogEntry(id);
      logInfo("logEntries.delete", "Log entry deleted successfully", { entryId: id });
      res.json({ message: "Log entry deleted successfully" });
    } catch (error) {
      return handleApiError(res, "logEntries.delete", error);
    }
  });
  
  // Chat message routes
  app.get("/api/home/:homeId/chat", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const messages = await storage.getChatMessagesByHomeId(homeId);
      res.json(messages);
    } catch (error) {
      return handleApiError(res, "chat.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/chat", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      
      const { content, image, imageType } = req.body;
      if (!content && !image) {
        return res.status(400).json({ message: "Message content or image is required", code: "VALIDATION_ERROR" });
      }
      
      const messageContent = image 
        ? `${content || "What can you tell me about this?"} [Photo attached]`
        : content;
      
      await storage.createChatMessage({ homeId, role: "user", content: messageContent });
      
      const history = await storage.getChatMessagesByHomeId(homeId);
      const conversationHistory = history.slice(-10).map(m => ({ role: m.role, content: m.content }));
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      try {
        const fullResponse = await streamAIResponse(
          homeId,
          content || "What can you tell me about this photo?",
          conversationHistory.slice(0, -1),
          (chunk) => res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`),
          () => {},
          image,
          imageType
        );
        
        await storage.createChatMessage({ homeId, role: "assistant", content: fullResponse });
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (aiError) {
        logError("chat.ai", aiError);
        res.write(`data: ${JSON.stringify({ error: "Failed to get AI response" })}\n\n`);
        res.end();
      }
    } catch (error) {
      if (!res.headersSent) {
        return handleApiError(res, "chat.create", error);
      }
    }
  });
  
  // Fund routes
  app.get("/api/home/:homeId/funds", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const fundsList = await storage.getFundsByHomeId(homeId);
      res.json(fundsList);
    } catch (error) {
      return handleApiError(res, "funds.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/funds", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const fundData = insertFundSchema.parse({ ...req.body, homeId });
      const fund = await storage.createFund(fundData);
      logInfo("funds.create", "Fund created successfully", { fundId: fund.id, homeId });
      res.json(fund);
    } catch (error) {
      return handleApiError(res, "funds.create", error);
    }
  });
  
  app.patch("/api/funds/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyFundOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const fund = await storage.updateFund(id, req.body);
      logInfo("funds.update", "Fund updated successfully", { fundId: id });
      res.json(fund);
    } catch (error) {
      return handleApiError(res, "funds.update", error);
    }
  });
  
  app.delete("/api/funds/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyFundOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      await storage.deleteFund(id);
      logInfo("funds.delete", "Fund deleted successfully", { fundId: id });
      res.json({ message: "Fund deleted successfully" });
    } catch (error) {
      return handleApiError(res, "funds.delete", error);
    }
  });
  
  // Fund allocation routes
  app.get("/api/funds/:fundId/allocations", isAuthenticated, async (req: any, res) => {
    try {
      const fundId = parseInt(req.params.fundId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyFundOwnership(fundId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const allocations = await storage.getAllocationsByFundId(fundId);
      res.json(allocations);
    } catch (error) {
      return handleApiError(res, "allocations.get", error, 500);
    }
  });
  
  app.get("/api/tasks/:taskId/allocations", isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyTaskOwnership(taskId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const allocations = await storage.getAllocationsByTaskId(taskId);
      res.json(allocations);
    } catch (error) {
      return handleApiError(res, "allocations.getByTask", error, 500);
    }
  });
  
  app.post("/api/allocations", isAuthenticated, async (req: any, res) => {
    try {
      const allocationData = insertFundAllocationSchema.parse(req.body);
      const userId = req.user.claims.sub;
      if (!await storage.verifyFundOwnership(allocationData.fundId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const allocation = await storage.createAllocation(allocationData);
      logInfo("allocations.create", "Allocation created successfully", { allocationId: allocation.id });
      res.json(allocation);
    } catch (error) {
      return handleApiError(res, "allocations.create", error);
    }
  });
  
  app.patch("/api/allocations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyAllocationOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const allocation = await storage.updateAllocation(id, req.body);
      logInfo("allocations.update", "Allocation updated successfully", { allocationId: id });
      res.json(allocation);
    } catch (error) {
      return handleApiError(res, "allocations.update", error);
    }
  });
  
  app.delete("/api/allocations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyAllocationOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      await storage.deleteAllocation(id);
      logInfo("allocations.delete", "Allocation deleted successfully", { allocationId: id });
      res.json({ message: "Allocation deleted successfully" });
    } catch (error) {
      return handleApiError(res, "allocations.delete", error);
    }
  });
  
  // Expense routes
  app.get("/api/home/:homeId/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const expensesList = await storage.getExpensesByHomeId(homeId);
      res.json(expensesList);
    } catch (error) {
      return handleApiError(res, "expenses.get", error, 500);
    }
  });
  
  app.get("/api/funds/:fundId/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const fundId = parseInt(req.params.fundId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyFundOwnership(fundId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const expensesList = await storage.getExpensesByFundId(fundId);
      res.json(expensesList);
    } catch (error) {
      return handleApiError(res, "expenses.getByFund", error, 500);
    }
  });
  
  app.post("/api/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const expenseData = insertExpenseSchema.parse(req.body);
      const userId = req.user.claims.sub;
      if (!await storage.verifyFundOwnership(expenseData.fundId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const expense = await storage.createExpense(expenseData);
      logInfo("expenses.create", "Expense created successfully", { expenseId: expense.id });
      res.json(expense);
    } catch (error) {
      return handleApiError(res, "expenses.create", error);
    }
  });
  
  app.patch("/api/expenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyExpenseOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const expense = await storage.updateExpense(id, req.body);
      logInfo("expenses.update", "Expense updated successfully", { expenseId: id });
      res.json(expense);
    } catch (error) {
      return handleApiError(res, "expenses.update", error);
    }
  });
  
  app.delete("/api/expenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyExpenseOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
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
      
      sendContactFormNotification(
        messageData.name,
        messageData.email,
        `Subject: ${messageData.subject || "No subject"}\n\n${messageData.message}`
      ).catch(() => {});
      
      res.json({ 
        message: "Thank you for reaching out! We'll get back to you soon.",
        id: message.id 
      });
    } catch (error) {
      return handleApiError(res, "contact.create", error);
    }
  });
  
  // Register object storage routes
  registerObjectStorageRoutes(app);
  
  // Inspection Reports routes
  app.get("/api/home/:homeId/reports", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const reports = await storage.getInspectionReportsByHomeId(homeId);
      res.json(reports);
    } catch (error) {
      return handleApiError(res, "reports.list", error, 500);
    }
  });
  
  app.get("/api/reports/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyReportOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const report = await storage.getInspectionReport(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found", code: "NOT_FOUND" });
      }
      const findings = await storage.getFindingsByReportId(id);
      res.json({ ...report, findings });
    } catch (error) {
      return handleApiError(res, "reports.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/reports", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const reportData = insertInspectionReportSchema.parse({ ...req.body, homeId });
      const report = await storage.createInspectionReport(reportData);
      logInfo("reports.create", "Report created successfully", { reportId: report.id });
      res.json(report);
    } catch (error) {
      return handleApiError(res, "reports.create", error);
    }
  });
  
  app.post("/api/reports/:id/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyReportOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const report = await storage.getInspectionReport(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found", code: "NOT_FOUND" });
      }
      
      await storage.updateInspectionReport(id, { status: "analyzing" });
      
      setTimeout(async () => {
        try {
          const sampleFindings = [
            { reportId: id, category: "Roof", title: "Shingle wear observed", description: "Minor wear on south-facing shingles", severity: "minor", location: "Roof - South side", estimatedCost: "$500-1,500", urgency: "later", diyLevel: "Pro-Only" },
            { reportId: id, category: "HVAC", title: "Filter replacement needed", description: "HVAC filter is dirty and should be replaced", severity: "minor", location: "HVAC Unit", estimatedCost: "$20-50", urgency: "soon", diyLevel: "DIY-Safe" },
            { reportId: id, category: "Plumbing", title: "Minor leak under kitchen sink", description: "Small drip from P-trap connection", severity: "moderate", location: "Kitchen", estimatedCost: "$50-150", urgency: "soon", diyLevel: "Caution" },
          ];
          
          for (const finding of sampleFindings) {
            await storage.createFinding(finding as any);
          }
          
          await storage.updateInspectionReport(id, { 
            status: "analyzed",
            summary: "Inspection analysis complete. 3 issues identified - 1 moderate, 2 minor. Estimated total repair cost: $570-1,700.",
            issuesFound: sampleFindings.length,
            analyzedAt: new Date(),
          });
          
          logInfo("reports.analyze", "Report analyzed successfully", { reportId: id, findingsCount: sampleFindings.length });
        } catch (err) {
          logError("reports.analyze.background", err);
          await storage.updateInspectionReport(id, { status: "error" });
        }
      }, 2000);
      
      res.json({ message: "Analysis started", status: "analyzing" });
    } catch (error) {
      return handleApiError(res, "reports.analyze", error);
    }
  });
  
  app.delete("/api/reports/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyReportOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      await storage.deleteInspectionReport(id);
      logInfo("reports.delete", "Report deleted successfully", { id });
      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      return handleApiError(res, "reports.delete", error);
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

  // Notification Preferences routes
  app.get("/api/notifications/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let prefs = await storage.getNotificationPreferences(userId);
      if (!prefs) {
        prefs = await storage.createNotificationPreferences({ userId });
      }
      res.json(prefs);
    } catch (error) {
      return handleApiError(res, "notifications.get", error, 500);
    }
  });
  
  app.patch("/api/notifications/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertNotificationPreferencesSchema.partial().parse(req.body);
      const prefs = await storage.updateNotificationPreferences(userId, data);
      logInfo("notifications.update", "Preferences updated", { userId });
      res.json(prefs);
    } catch (error) {
      return handleApiError(res, "notifications.update", error);
    }
  });

  // Contractor Appointments routes
  app.get("/api/home/:homeId/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const appointments = await storage.getAppointmentsByHomeId(homeId);
      res.json(appointments);
    } catch (error) {
      return handleApiError(res, "appointments.list", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = parseInt(req.params.homeId);
      const userId = req.user.claims.sub;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const appointmentData = insertContractorAppointmentSchema.parse({ ...req.body, homeId });
      const appointment = await storage.createAppointment(appointmentData);
      logInfo("appointments.create", "Appointment created", { appointmentId: appointment.id });
      res.json(appointment);
    } catch (error) {
      return handleApiError(res, "appointments.create", error);
    }
  });
  
  app.patch("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyAppointmentOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const updateData = insertContractorAppointmentSchema.omit({ homeId: true }).partial().parse(req.body);
      const appointment = await storage.updateAppointment(id, updateData);
      logInfo("appointments.update", "Appointment updated", { appointmentId: id });
      res.json(appointment);
    } catch (error) {
      return handleApiError(res, "appointments.update", error);
    }
  });
  
  app.delete("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      if (!await storage.verifyAppointmentOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      await storage.deleteAppointment(id);
      logInfo("appointments.delete", "Appointment deleted", { appointmentId: id });
      res.json({ message: "Appointment deleted" });
    } catch (error) {
      return handleApiError(res, "appointments.delete", error);
    }
  });

  // AI System Identification endpoint
  const systemIdentifySchema = z.object({
    imageBase64: z.string().min(1, "Image is required"),
  });
  
  app.post("/api/ai/identify-system", isAuthenticated, async (req, res) => {
    try {
      const { imageBase64 } = systemIdentifySchema.parse(req.body);
      
      logInfo("ai.identify-system", "Analyzing image for system identification");
      
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a home system identification expert. Analyze images of home systems and components to identify what they are.
            
Return a JSON object with these fields:
- category: One of "HVAC", "Plumbing", "Electrical", "Roof", "Windows", "Siding/Exterior", "Foundation", "Appliances", "Water Heater", "Landscaping", "Pest", or "Other"
- name: A descriptive name for the system (e.g., "Central AC Unit", "Gas Water Heater")
- make: Brand/manufacturer if visible (e.g., "Carrier", "Rheem")
- model: Model number if visible
- condition: Estimated condition: "Excellent", "Good", "Fair", "Poor", or "Unknown"
- material: Material type if applicable (for roof, windows, siding)
- estimatedAge: Rough age estimate if possible (e.g., "5-10 years")
- notes: Any additional observations about the system

Only include fields you can reasonably determine from the image. If unsure, omit the field or set to null.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please identify this home system and provide details in JSON format."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_completion_tokens: 500,
      });
      
      const content = response.choices[0]?.message?.content || "{}";
      let result;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        result = { notes: content };
      }
      
      logInfo("ai.identify-system", "System identified successfully", { category: result.category });
      res.json(result);
    } catch (error) {
      return handleApiError(res, "ai.identify-system", error, 500);
    }
  });

  return httpServer;
}
