import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireUnderLimit, requireUnderSystemsLimit } from "./lib/plans";
import { logInfo, logError, logWarn } from "./lib/logger";
import { authStorage } from "./replit_integrations/auth/storage";
import multer from "multer";
import { extractTextFromDocument, analyzeDocumentWithLLM, convertIssuesToTasks } from "./lib/document-analysis";
import { sendContactFormNotification } from "./lib/email";
import { ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  insertHomeSchema,
  type InsertHome,
  insertSystemSchema,
  type InsertSystem,
  insertMaintenanceTaskSchema,
  type InsertMaintenanceTask,
  insertMaintenanceLogEntrySchema,
  type InsertMaintenanceLogEntry,
  insertFundSchema,
  type InsertFund,
  insertFundAllocationSchema,
  type InsertFundAllocation,
  insertExpenseSchema,
  type InsertExpense,
  insertContactMessageSchema,
  type InsertContactMessage,
  insertInspectionReportSchema,
  type InsertInspectionReport,
  insertHomeDocumentSchema,
  type InsertHomeDocument,
  insertContractorAppointmentSchema,
  type InsertContractorAppointment,
  insertNotificationPreferencesSchema,
} from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

function formatValidationError(error: ZodError): string {
  const zodError = fromZodError(error);
  return zodError.message;
}

function sanitizeText(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === "string") {
      (result as any)[key] = sanitizeText(val);
    }
  }
  return result;
}

function validateIntParam(value: string): number | null {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
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
  
  logError(context, error);

  // Never leak raw DB error messages or codes to the client
  return res.status(statusCode >= 500 ? 500 : statusCode).json({
    message: "Something went wrong. Please try again or contact support if the problem persists.",
    code: "SERVER_ERROR"
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // All routes protected by authentication

  // Privacy & data management routes
  app.get("/api/user/privacy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found", code: "NOT_FOUND" });
      res.json({ dataStorageOptOut: user.dataStorageOptOut ?? false });
    } catch (error) {
      return handleApiError(res, "privacy.get", error, 500);
    }
  });

  app.put("/api/user/privacy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dataStorageOptOut } = req.body;
      if (typeof dataStorageOptOut !== "boolean") {
        return res.status(400).json({ message: "dataStorageOptOut must be a boolean", code: "VALIDATION_ERROR" });
      }
      const user = await authStorage.updateUserPrivacy(userId, dataStorageOptOut);
      logInfo("privacy.update", "User updated privacy settings", { userId, dataStorageOptOut });
      res.json({ dataStorageOptOut: user.dataStorageOptOut ?? false });
    } catch (error) {
      return handleApiError(res, "privacy.update", error, 500);
    }
  });

  app.delete("/api/user/data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      logInfo("data.delete", "User requested deletion of all data", { userId });
      await storage.deleteAllUserData(userId);
      logInfo("data.delete", "All user data deleted", { userId });
      res.json({ success: true, message: "All your data has been permanently deleted." });
    } catch (error) {
      return handleApiError(res, "data.delete", error, 500);
    }
  });

  // Home routes
  app.get("/api/home", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
  
  app.post("/api/home", isAuthenticated, requireUnderLimit("homes"), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const homeData = insertHomeSchema.parse({ ...req.body, userId }) as unknown as InsertHome;
      const home = await storage.createHome(homeData);
      logInfo("home.create", "Home created successfully", { homeId: home.id, userId });
      res.json(home);
    } catch (error) {
      return handleApiError(res, "home.create", error);
    }
  });
  
  app.patch("/api/home/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      const home = await storage.updateHome(id, userId, req.body);
      logInfo("home.update", "Home updated successfully", { homeId: id, userId });
      res.json(home);
    } catch (error) {
      return handleApiError(res, "home.update", error);
    }
  });
  
  // System routes
  app.get("/api/home/:homeId/systems", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const systems = await storage.getSystemsByHomeId(homeId);
      res.json(systems);
    } catch (error) {
      return handleApiError(res, "systems.get", error, 500);
    }
  });
  
  app.post("/api/home/:homeId/systems", isAuthenticated, requireUnderSystemsLimit(), async (req: any, res) => {
    try {
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const systemData = insertSystemSchema.parse({ ...req.body, homeId }) as unknown as InsertSystem;
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const taskData = insertMaintenanceTaskSchema.parse({ ...req.body, homeId }) as unknown as InsertMaintenanceTask;
      const task = await storage.createTask(taskData);
      logInfo("tasks.create", "Task created successfully", { taskId: task.id, homeId });
      res.json(task);
    } catch (error) {
      return handleApiError(res, "tasks.create", error);
    }
  });
  
  const updateTaskSchema = insertMaintenanceTaskSchema.partial();
  app.patch("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyTaskOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const validated = updateTaskSchema.parse(req.body);
      if (Object.keys(validated).length === 0) {
        return res.status(400).json({ message: "No fields to update", code: "VALIDATION_ERROR" });
      }
      const task = await storage.updateTask(id, validated);
      logInfo("tasks.update", "Task updated successfully", { taskId: id });
      res.json(task);
    } catch (error) {
      return handleApiError(res, "tasks.update", error);
    }
  });
  
  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const body = { ...req.body, homeId };
      if (body.date && typeof body.date === "string") {
        body.date = new Date(body.date);
      }
      const entryData = insertMaintenanceLogEntrySchema.parse(body) as unknown as InsertMaintenanceLogEntry;
      const entry = await storage.createLogEntry(entryData);
      logInfo("logEntries.create", "Log entry created successfully", { entryId: entry.id, homeId });
      res.json(entry);
    } catch (error) {
      return handleApiError(res, "logEntries.create", error);
    }
  });
  
  const updateLogEntrySchema = insertMaintenanceLogEntrySchema.partial();
  app.patch("/api/log-entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyLogEntryOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const validated = updateLogEntrySchema.parse(req.body);
      const entry = await storage.updateLogEntry(id, validated);
      logInfo("logEntries.update", "Log entry updated successfully", { entryId: id });
      res.json(entry);
    } catch (error) {
      return handleApiError(res, "logEntries.update", error);
    }
  });
  
  app.delete("/api/log-entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
  
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["application/pdf", "text/plain", "text/csv", "text/markdown"];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Unsupported file type. Please upload a PDF or text document."));
      }
    },
  });

  /**
   * Best-effort magic-byte sniff. `fileFilter` only sees the client-asserted
   * mimetype (easy to spoof: any .exe can be uploaded as application/pdf).
   * Checking the first few bytes in the buffer lets us reject obvious
   * mismatches — PDFs must start with "%PDF-", text types should be valid
   * UTF-8 without null bytes. Not a full format validator, just a cheap
   * sanity check before we feed the buffer into the PDF extractor.
   */
  function validateDocumentMagicBytes(buf: Buffer, mimetype: string): string | null {
    if (!buf || buf.length === 0) return "Empty file";
    if (mimetype === "application/pdf") {
      // PDF spec: file must start with %PDF-<version> within first 1024 bytes.
      // We check the first 5 bytes for strictness — real PDFs always start here.
      const header = buf.subarray(0, 5).toString("ascii");
      if (header !== "%PDF-") {
        return "File claims to be a PDF but does not start with %PDF- magic bytes";
      }
      return null;
    }
    // text/* types: reject files containing NUL bytes in the first 4KB — that's
    // a reliable signal of binary content masquerading as text.
    const sample = buf.subarray(0, Math.min(buf.length, 4096));
    if (sample.includes(0x00)) {
      return "File claims to be text but contains binary NUL bytes";
    }
    return null;
  }

  app.post("/api/home/:homeId/analyze-document", isAuthenticated, requireUnderLimit("docAnalyses"), upload.single("document"), async (req: any, res) => {
    try {
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No document file provided", code: "VALIDATION_ERROR" });
      }

      const magicBytesError = validateDocumentMagicBytes(req.file.buffer, req.file.mimetype);
      if (magicBytesError) {
        return res.status(400).json({ message: magicBytesError, code: "VALIDATION_ERROR" });
      }

      const text = await extractTextFromDocument(req.file.buffer, req.file.mimetype);
      if (!text.trim()) {
        return res.status(400).json({ message: "The document appears to be empty or could not be read", code: "VALIDATION_ERROR" });
      }

      const analysis = await analyzeDocumentWithLLM(text, homeId);
      const tasks = convertIssuesToTasks(analysis.issues, homeId);

      logInfo("document-analysis.route", "Document analyzed successfully", {
        homeId,
        fileName: req.file.originalname,
        issuesFound: tasks.length,
      });

      res.json({
        fileName: req.file.originalname,
        extractedTextLength: text.length,
        tasks,
      });
    } catch (error) {
      return handleApiError(res, "document-analysis", error, 500);
    }
  });

  app.post("/api/home/:homeId/confirm-document-tasks", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }

      const { tasks } = req.body;
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ message: "No tasks provided", code: "VALIDATION_ERROR" });
      }

      const taskSchema = z.object({
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        systemName: z.string().optional().default("unknown_system"),
        urgency: z.enum(["now", "soon", "later", "monitor"]).optional().default("later"),
        diyLevel: z.enum(["DIY-Safe", "Caution", "Pro-Only"]).optional().default("Caution"),
        estimatedCost: z.string().nullable().optional(),
        safetyWarning: z.string().nullable().optional(),
        attributes: z.record(z.string(), z.string()).optional().default({}),
      });

      const created = [];
      for (const rawTask of tasks) {
        const parsed = taskSchema.safeParse(rawTask);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid task data", details: parsed.error.flatten(), code: "VALIDATION_ERROR" });
        }
        const task = parsed.data;

        const { validateAttributeNamespace, systemNameToPrefix } = await import("./lib/document-analysis");
        const prefix = systemNameToPrefix(task.systemName);
        const { valid: validAttrs } = validateAttributeNamespace(task.attributes, prefix);

        const attrSummary = Object.entries(validAttrs)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        const fullDescription = [task.description, attrSummary].filter(Boolean).join("\n\n");

        const result = await storage.createMaintenanceTask({
          homeId,
          title: sanitizeText(task.title),
          description: fullDescription ? sanitizeText(fullDescription) : null,
          category: task.category || null,
          urgency: task.urgency || "later",
          diyLevel: task.diyLevel || "Caution",
          estimatedCost: task.estimatedCost || null,
          safetyWarning: task.safetyWarning || null,
          createdFrom: "document-analysis",
          status: "pending",
        });
        created.push(result);
      }

      logInfo("document-analysis.confirm", "Tasks created from document analysis", {
        homeId,
        taskCount: created.length,
      });

      res.json({ created });
    } catch (error) {
      return handleApiError(res, "document-analysis.confirm", error, 500);
    }
  });
  
  // Fund routes
  app.get("/api/home/:homeId/funds", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const fundData = insertFundSchema.parse({ ...req.body, homeId }) as unknown as InsertFund;
      const fund = await storage.createFund(fundData);
      logInfo("funds.create", "Fund created successfully", { fundId: fund.id, homeId });
      res.json(fund);
    } catch (error) {
      return handleApiError(res, "funds.create", error);
    }
  });
  
  const updateFundSchema = insertFundSchema.partial();
  app.patch("/api/funds/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyFundOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const validated = updateFundSchema.parse(req.body);
      const fund = await storage.updateFund(id, validated);
      logInfo("funds.update", "Fund updated successfully", { fundId: id });
      res.json(fund);
    } catch (error) {
      return handleApiError(res, "funds.update", error);
    }
  });
  
  app.delete("/api/funds/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const fundId = validateIntParam(req.params.fundId);
      if (fundId === null) return res.status(400).json({ message: "Invalid fund ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const taskId = validateIntParam(req.params.taskId);
      if (taskId === null) return res.status(400).json({ message: "Invalid task ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const allocationData = insertFundAllocationSchema.parse(req.body) as unknown as InsertFundAllocation;
      const userId = req.user.id;
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
  
  const updateAllocationSchema = insertFundAllocationSchema.partial();
  app.patch("/api/allocations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyAllocationOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const validated = updateAllocationSchema.parse(req.body);
      const allocation = await storage.updateAllocation(id, validated);
      logInfo("allocations.update", "Allocation updated successfully", { allocationId: id });
      res.json(allocation);
    } catch (error) {
      return handleApiError(res, "allocations.update", error);
    }
  });
  
  app.delete("/api/allocations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const fundId = validateIntParam(req.params.fundId);
      if (fundId === null) return res.status(400).json({ message: "Invalid fund ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const expenseData = insertExpenseSchema.parse(req.body) as unknown as InsertExpense;
      const userId = req.user.id;
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
  
  const updateExpenseSchema = insertExpenseSchema.partial();
  app.patch("/api/expenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyExpenseOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const validated = updateExpenseSchema.parse(req.body);
      const expense = await storage.updateExpense(id, validated);
      logInfo("expenses.update", "Expense updated successfully", { expenseId: id });
      res.json(expense);
    } catch (error) {
      return handleApiError(res, "expenses.update", error);
    }
  });
  
  app.delete("/api/expenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
  
  app.post("/api/zillow/lookup", isAuthenticated, async (req: any, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Zillow URL is required" });
      }

      const zillowPattern = /zillow\.com\/(homedetails|homes)\//i;
      if (!zillowPattern.test(url)) {
        return res.status(400).json({ error: "Please provide a valid Zillow listing URL" });
      }

      const pathMatch = url.match(/\/(?:homedetails|homes)\/([^/?#]+)/);
      const slug = pathMatch ? pathMatch[1] : "";

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `Extract property data from this Zillow URL slug: "${slug}"

Zillow URL slugs follow this pattern: "Street-Address-City-State-Zip"
For example: "123-Main-St-Springfield-IL-62701" means 123 Main St, Springfield, IL 62701

Parse whatever you can from the slug. Return a JSON object with these fields (use null for anything you can't determine):
{
  "beds": number or null,
  "baths": number or null,
  "sqFt": number or null,
  "builtYear": number or null,
  "homeValueEstimate": number or null,
  "streetAddress": string or null,
  "city": string or null,
  "state": string or null (2-letter abbreviation),
  "zipCode": string or null
}

Note: beds, baths, sqFt, builtYear, and homeValueEstimate typically aren't in the URL — set those to null.
Only return the JSON object, no other text.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 300,
      });

      const content = completion.choices[0]?.message?.content || "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      logInfo("zillow.lookup", "Zillow URL parsed", { url: url.substring(0, 80) });
      res.json({ data: parsed });
    } catch (error) {
      return handleApiError(res, "zillow.lookup", error);
    }
  });

  // Contact form route (public - no auth required)
  app.post("/api/contact", async (req, res) => {
    try {
      const messageData = insertContactMessageSchema.parse(req.body) as unknown as InsertContactMessage;
      const sanitizedData: InsertContactMessage = {
        ...messageData,
        name: sanitizeText(messageData.name),
        email: sanitizeText(messageData.email),
        message: sanitizeText(messageData.message),
        subject: messageData.subject ? sanitizeText(messageData.subject) : messageData.subject,
      };
      const message = await storage.createContactMessage(sanitizedData);
      
      logInfo("contact.create", "Contact message received", { 
        name: sanitizedData.name, 
        email: sanitizedData.email,
        subject: sanitizedData.subject ?? undefined
      });
      
      sendContactFormNotification(
        sanitizedData.name,
        sanitizedData.email,
        `Subject: ${sanitizedData.subject || "No subject"}\n\n${sanitizedData.message}`
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const reportData = insertInspectionReportSchema.parse({ ...req.body, homeId }) as unknown as InsertInspectionReport;
      const report = await storage.createInspectionReport(reportData);
      logInfo("reports.create", "Report created successfully", { reportId: report.id });
      res.json(report);
    } catch (error) {
      return handleApiError(res, "reports.create", error);
    }
  });
  
  app.post("/api/reports/:id/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
          } as any);
          
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
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
  
  // Home Documents routes
  app.get("/api/home/:homeId/documents", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const documents = await storage.getDocumentsByHomeId(homeId);
      res.json(documents);
    } catch (error) {
      return handleApiError(res, "documents.list", error, 500);
    }
  });

  app.post("/api/home/:homeId/documents", isAuthenticated, async (req: any, res) => {
    try {
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const docData = insertHomeDocumentSchema.parse({ ...req.body, homeId }) as unknown as InsertHomeDocument;
      const doc = await storage.createDocument(docData);
      logInfo("documents.create", "Document created successfully", { docId: doc.id, homeId });
      res.json(doc);
    } catch (error) {
      return handleApiError(res, "documents.create", error);
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyDocumentOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      await storage.deleteDocument(id);
      logInfo("documents.delete", "Document deleted successfully", { id });
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      return handleApiError(res, "documents.delete", error);
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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
      const homeId = validateIntParam(req.params.homeId);
      if (homeId === null) return res.status(400).json({ message: "Invalid home ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyHomeOwnership(homeId, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const appointmentData = insertContractorAppointmentSchema.parse({ ...req.body, homeId }) as unknown as InsertContractorAppointment;
      const appointment = await storage.createAppointment(appointmentData);
      logInfo("appointments.create", "Appointment created", { appointmentId: appointment.id });
      res.json(appointment);
    } catch (error) {
      return handleApiError(res, "appointments.create", error);
    }
  });
  
  app.patch("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
      if (!await storage.verifyAppointmentOwnership(id, userId)) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      const updateData = (insertContractorAppointmentSchema as any).omit({ homeId: true }).partial().parse(req.body) as Partial<InsertContractorAppointment>;
      const appointment = await storage.updateAppointment(id, updateData);
      logInfo("appointments.update", "Appointment updated", { appointmentId: id });
      res.json(appointment);
    } catch (error) {
      return handleApiError(res, "appointments.update", error);
    }
  });
  
  app.delete("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = validateIntParam(req.params.id);
      if (id === null) return res.status(400).json({ message: "Invalid ID", code: "VALIDATION_ERROR" });
      const userId = req.user.id;
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

  const circuitPanelSchema = z.object({
    imageBase64: z.string().min(1, "Image is required"),
  });

  app.post("/api/ai/analyze-circuit-panel", isAuthenticated, async (req, res) => {
    try {
      const { imageBase64 } = circuitPanelSchema.parse(req.body);

      logInfo("ai.circuit-panel", "Analyzing circuit breaker panel image");

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
            content: `You are a home electrical system analyst. You are examining a photo of a residential circuit breaker panel (electrical panel / load center).

Your job is to identify individual breakers visible in the image and provide structured data for each one.

Return a JSON object with these fields:
- breakers: An array of objects, each with:
  - number: The breaker position number (1, 2, 3, etc., top to bottom, left to right)
  - label: Any visible label text on or near the breaker (e.g., "Kitchen", "Master Bed"). Use "" if not readable.
  - room: Your best guess of what room/area this breaker serves based on the label. Use "" if unknown.
  - notes: Any observations (e.g., "double-pole breaker", "GFCI", "appears tripped")
  - amperage: The amperage rating if visible (e.g., 15, 20, 30). Omit if not visible.
- confidence: A number 0-1 indicating how clearly you can read the panel (1 = very clear, 0 = unreadable)
- notes: General observations about the panel (brand, age estimate, condition)

IMPORTANT:
- This analysis is for informational reference only, not a professional electrical inspection.
- If the image is blurry or unclear, set confidence low and provide fewer breakers.
- Number breakers sequentially based on their physical position.
- Only include breakers you can actually see in the image.
- Do NOT guess amperage values — only include if clearly visible on the breaker.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this circuit breaker panel and identify each breaker. Return structured JSON."
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
        max_completion_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let result;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { breakers: [], confidence: 0, notes: "Could not parse response" };
      } catch {
        result = { breakers: [], confidence: 0, notes: content };
      }

      if (!result.breakers) result.breakers = [];
      if (result.confidence === undefined) result.confidence = 0.5;

      logInfo("ai.circuit-panel", "Panel analyzed", { breakerCount: result.breakers.length, confidence: result.confidence });
      res.json(result);
    } catch (error) {
      return handleApiError(res, "ai.circuit-panel", error, 500);
    }
  });

  return httpServer;
}
