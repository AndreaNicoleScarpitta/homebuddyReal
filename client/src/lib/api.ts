import type { Home, System, MaintenanceTask, MaintenanceLogEntry, Fund, FundAllocation, Expense, InspectionReport, InspectionFinding, ContractorAppointment, NotificationPreferences, HomeDocument } from "@shared/schema";

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "An error occurred" }));
    throw new Error(error.message || error.error || "Request failed");
  }
  return response.json();
}

function idempotencyKey(): string {
  return crypto.randomUUID();
}

function v2Headers(extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey(),
    ...extraHeaders,
  };
}

// ---------------------------------------------------------------------------
// V2 Home type — extends legacy Home with string UUID id + legacyId
// ---------------------------------------------------------------------------
export interface V2Home {
  id: string;
  legacyId: number | null;
  userId: string;
  address: string;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  zipPlus4?: string | null;
  addressVerified?: boolean;
  builtYear?: number | null;
  sqFt?: number | null;
  beds?: number | null;
  baths?: number | null;
  type?: string | null;
  lotSize?: number | null;
  exteriorType?: string | null;
  roofType?: string | null;
  lastSaleYear?: number | null;
  homeValueEstimate?: number | null;
  dataSource?: string | null;
  zillowUrl?: string | null;
  healthScore?: number | null;
}

export interface V2System {
  id: string;
  homeId: string;
  legacyId?: number | null;
  category: string;
  name: string;
  entityType?: string;
  make?: string | null;
  model?: string | null;
  installYear?: number | null;
  lastServiceDate?: string | null;
  nextServiceDate?: string | null;
  condition?: string | null;
  warrantyExpiry?: string | null;
  material?: string | null;
  energyRating?: string | null;
  provider?: string | null;
  treatmentType?: string | null;
  recurrenceInterval?: string | null;
  contractStartDate?: string | null;
  cadence?: string | null;
  statusReason?: string | null;
  notes?: string | null;
  photos?: string | null;
  documents?: string | null;
  source?: string | null;
  healthState?: string | null;
  riskScore?: number | null;
}

/**
 * Pro-workflow status for tasks that need a contractor.
 *
 * These values live in the task's `estimates` JSONB alongside the standard
 * task attributes. They're separate from `status` (the legacy state machine
 * value) so that a task can be both "scheduled" and "needs_pro" — i.e. the
 * plumber is booked but the task isn't done yet.
 *
 * Progression: needs_pro → quoted → scheduled_pro → (task completes)
 */
export type TaskProStatus = "needs_pro" | "quoted" | "scheduled_pro";

export interface V2Task {
  id: string;
  homeId: string;
  relatedSystemId?: string | null;
  title: string;
  status: string;
  state: string;
  description?: string | null;
  category?: string | null;
  dueDate?: string | null;
  urgency?: string;
  diyLevel?: string | null;
  estimatedCost?: string | null;
  actualCost?: number | null;
  difficulty?: string | null;
  safetyWarning?: string | null;
  createdFrom?: string;
  isRecurring?: boolean;
  recurrenceCadence?: string | null;
  completedAt?: string | null;
  namespacePrefix?: string | null;
  namespacedAttributes?: Record<string, string> | null;

  // Contractor / pro-workflow fields (stored in estimates JSONB, optional)
  proStatus?: TaskProStatus | null;
  contractorName?: string | null;
  contractorPhone?: string | null;
  contractorNotes?: string | null;
  scheduledProDate?: string | null;
  quotedCost?: string | null;
}

export interface V2Report {
  id: string;
  homeId: string;
  status: string;
  fileName: string;
  objectPath: string;
  summary?: string | null;
  issuesFound?: number;
  createdAt?: string;
  findings?: Array<{
    id: string;
    reportId: string;
    state: string;
    title?: string;
    description?: string;
    severity?: string | null;
    urgency?: string | null;
    category?: string | null;
    location?: string | null;
    estimatedCost?: string | null;
    diyLevel?: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Home API (v2)
// ---------------------------------------------------------------------------
export async function getHome(): Promise<V2Home | null> {
  try {
    const response = await fetch("/v2/home");
    if (response.status === 404) {
      return null;
    }
    return handleResponse<V2Home>(response);
  } catch (error) {
    if ((error as any)?.message?.includes("not found")) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a home with a partial profile.
 *
 * ZIP is the only truly required field — everything else (street, city,
 * state, year built, square footage) can be filled in later. This mirrors
 * the server-side validation in routes_v2.ts and is the core of the
 * "first useful output in under 2 minutes" onboarding flip.
 */
export async function createHome(data: {
  zipCode: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  builtYear?: number;
  sqFt?: number;
  type?: string;
}): Promise<V2Home> {
  const response = await fetch("/v2/homes", {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Home>(response);
}

export async function updateHome(id: string | number, data: Partial<V2Home>): Promise<V2Home> {
  const response = await fetch(`/v2/homes/${id}`, {
    method: "PATCH",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Home>(response);
}

export interface ZillowData {
  beds?: number | null;
  baths?: number | null;
  sqFt?: number | null;
  builtYear?: number | null;
  homeValueEstimate?: number | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

export async function fetchZillowData(url: string): Promise<ZillowData> {
  const response = await fetch("/api/zillow/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const result = await handleResponse<{ data: ZillowData }>(response);
  return result.data;
}

// ---------------------------------------------------------------------------
// Systems API (v2)
// ---------------------------------------------------------------------------
export async function getSystems(homeId: string | number): Promise<V2System[]> {
  const response = await fetch(`/v2/homes/${homeId}/systems`);
  return handleResponse<V2System[]>(response);
}

export async function createSystem(homeId: string | number, data: {
  name: string;
  category?: string;
  installYear?: number;
  condition?: string;
  notes?: string;
  photos?: string;
  documents?: string;
  source?: string;
  entityType?: string;
}): Promise<V2System> {
  const response = await fetch(`/v2/homes/${homeId}/systems`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2System>(response);
}

export async function updateSystem(id: string | number, data: Partial<V2System>): Promise<V2System> {
  const response = await fetch(`/v2/systems/${id}`, {
    method: "PATCH",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2System>(response);
}

export async function deleteSystem(id: string | number): Promise<void> {
  const response = await fetch(`/v2/systems/${id}`, {
    method: "DELETE",
    headers: v2Headers(),
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// Tasks API (v2)
// ---------------------------------------------------------------------------
export async function getTasks(homeId: string | number): Promise<V2Task[]> {
  const response = await fetch(`/v2/homes/${homeId}/tasks`);
  return handleResponse<V2Task[]>(response);
}

export async function createTask(homeId: string | number, data: Partial<V2Task>): Promise<V2Task> {
  const response = await fetch(`/v2/tasks`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify({ homeId, ...data }),
  });
  return handleResponse<V2Task>(response);
}

export async function updateTask(id: string | number, data: Partial<V2Task>): Promise<V2Task> {
  const response = await fetch(`/v2/tasks/${id}`, {
    method: "PATCH",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Task>(response);
}

export async function deleteTask(id: string | number): Promise<void> {
  const response = await fetch(`/v2/tasks/${id}`, {
    method: "DELETE",
    headers: v2Headers(),
  });
  return handleResponse<void>(response);
}

export interface SuggestedTask {
  title: string;
  description: string;
  urgency: "now" | "soon" | "later" | "monitor";
  diyLevel: "DIY-Safe" | "Caution" | "Pro-Only";
  cadence: string;
  monthsUntilDue: number;
  estimatedCost: string;
  safetyWarning: string | null;
}

/**
 * AI-determined task properties returned by the analyze endpoint.
 * Used in QuickAddTaskDialog to auto-fill urgency, DIY level, and cost.
 */
export interface TaskAnalysis {
  urgency: string;
  diyLevel: string;
  estimatedCost: string;
  description: string;
  safetyWarning: string | null;
  namespacePrefix?: string;
  namespacedAttributes?: Record<string, string>;
}

export async function analyzeTask(
  title: string,
  category?: string,
  systemId?: string,
  systemName?: string
): Promise<TaskAnalysis> {
  const response = await fetch("/v2/tasks/analyze", {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify({
      title,
      category: category || undefined,
      systemId: systemId || undefined,
      systemName: systemName || undefined,
    }),
  });
  return handleResponse<TaskAnalysis>(response);
}

export async function suggestMaintenanceTasks(
  systemName: string,
  systemCategory: string,
  notes?: string,
  systemId?: string
): Promise<SuggestedTask[]> {
  const response = await fetch(`/v2/systems/suggest-tasks`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify({ systemName, systemCategory, notes, systemId }),
  });
  const data = await handleResponse<{ tasks: SuggestedTask[] }>(response);
  return data.tasks;
}

export async function createTasksBatch(homeId: string | number, tasks: Array<{
  title: string;
  systemId?: string;
  estimates?: Record<string, unknown>;
  dueAt?: string;
}>): Promise<V2Task[]> {
  const results: V2Task[] = [];
  for (const task of tasks) {
    const response = await fetch(`/v2/tasks`, {
      method: "POST",
      headers: v2Headers(),
      body: JSON.stringify({ homeId, ...task }),
    });
    results.push(await handleResponse<V2Task>(response));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Maintenance Log API (legacy — stays on CRUD)
// ---------------------------------------------------------------------------
export async function getLogEntries(homeId: number): Promise<MaintenanceLogEntry[]> {
  const response = await fetch(`/api/home/${homeId}/log-entries`);
  return handleResponse<MaintenanceLogEntry[]>(response);
}

export async function createLogEntry(homeId: number, data: {
  title: string;
  taskId?: number;
  systemId?: number;
  date?: string;
  notes?: string;
  photos?: string;
  cost?: number;
  provider?: string;
}): Promise<MaintenanceLogEntry> {
  const response = await fetch(`/api/home/${homeId}/log-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<MaintenanceLogEntry>(response);
}

export async function updateLogEntry(id: number, data: Partial<MaintenanceLogEntry>): Promise<MaintenanceLogEntry> {
  const response = await fetch(`/api/log-entries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<MaintenanceLogEntry>(response);
}

export async function deleteLogEntry(id: number): Promise<void> {
  const response = await fetch(`/api/log-entries/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// Document Analysis API
// ---------------------------------------------------------------------------
export interface DocumentAnalysisTask {
  homeId: number;
  title: string;
  description: string | null;
  category: string | null;
  systemName: string;
  urgency: string;
  diyLevel: string;
  estimatedCost: string | null;
  safetyWarning: string | null;
  createdFrom: string;
  status: string;
  attributes: Record<string, string>;
}

export interface DocumentAnalysisResult {
  fileName: string;
  extractedTextLength: number;
  tasks: DocumentAnalysisTask[];
}

export async function analyzeDocument(
  homeId: string | number,
  file: File
): Promise<DocumentAnalysisResult> {
  const formData = new FormData();
  formData.append("document", file);
  const response = await fetch(`/api/home/${homeId}/analyze-document`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<DocumentAnalysisResult>(response);
}

export async function confirmDocumentTasks(
  homeId: string | number,
  tasks: DocumentAnalysisTask[]
): Promise<{ created: any[] }> {
  const response = await fetch(`/api/home/${homeId}/confirm-document-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks }),
  });
  return handleResponse<{ created: any[] }>(response);
}

// ---------------------------------------------------------------------------
// File Analysis Pipeline API (V2)
// ---------------------------------------------------------------------------

export interface ProposedTaskV2 {
  id: string;
  title: string;
  description: string;
  systemId?: string;
  suggestionId?: string;
  category: string;
  priority: string;
  urgency: string;
  diyLevel: string;
  estimatedCost?: string;
  safetyWarning?: string;
  timing?: string;
  sourceRef: string;
  isInferred: boolean;
  inferenceReason?: string;
}

export interface MatchedSystemUpdateV2 {
  systemId: string;
  systemName: string;
  systemCategory: string;
  attributes: Record<string, string>;
  sourceRef: string;
}

export interface SuggestedSystemV2 {
  id: string;
  name: string;
  category: string;
  reason: string;
  status: "pending" | "approved" | "declined";
  sourceRef: string;
  pendingAttributes: Record<string, string>;
  pendingTasks: ProposedTaskV2[];
}

export interface FileAnalysisResultV2 {
  analysisId: string;
  matchedSystemUpdates: MatchedSystemUpdateV2[];
  matchedSystemTasks: ProposedTaskV2[];
  suggestedSystems: SuggestedSystemV2[];
  analysisWarnings: string[];
  sourceFiles: Array<{ fileName: string; fileType: string; textLength: number }>;
}

export async function runFileAnalysis(
  homeId: string,
  files: File[]
): Promise<FileAnalysisResultV2> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const response = await fetch(`/v2/homes/${homeId}/file-analysis`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey() },
    body: formData,
  });
  return handleResponse<FileAnalysisResultV2>(response);
}

export async function approveSuggestion(
  suggestionId: string,
  data: {
    homeId: string;
    systemName: string;
    systemCategory: string;
    pendingTasks: ProposedTaskV2[];
    pendingAttributes: Record<string, string>;
  }
): Promise<{ approved: boolean; systemId: string; taskIds: string[] }> {
  const response = await fetch(`/v2/suggestions/${suggestionId}/approve`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function declineSuggestion(
  suggestionId: string,
  data: {
    homeId: string;
    reason?: string;
    pendingTaskIds?: string[];
    pendingAttributeKeys?: string[];
  }
): Promise<{ declined: boolean }> {
  const response = await fetch(`/v2/suggestions/${suggestionId}/decline`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function confirmMatchedTasks(
  homeId: string,
  tasks: ProposedTaskV2[],
  systemUpdates?: MatchedSystemUpdateV2[]
): Promise<{ created: number; taskIds: string[] }> {
  const response = await fetch(`/v2/homes/${homeId}/confirm-matched-tasks`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify({ tasks, systemUpdates }),
  });
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// Funds API (legacy — stays on CRUD)
// ---------------------------------------------------------------------------
export async function getFunds(homeId: number): Promise<Fund[]> {
  const response = await fetch(`/api/home/${homeId}/funds`);
  return handleResponse<Fund[]>(response);
}

export async function createFund(homeId: number, data: {
  name: string;
  balance: number;
  monthlyContribution?: number;
  fundType?: string;
  label?: string;
  color?: string;
  purpose?: string;
  scopedSystemId?: number;
}): Promise<Fund> {
  const response = await fetch(`/api/home/${homeId}/funds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Fund>(response);
}

export async function updateFund(id: number, data: Partial<Fund>): Promise<Fund> {
  const response = await fetch(`/api/funds/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Fund>(response);
}

export async function deleteFund(id: number): Promise<void> {
  const response = await fetch(`/api/funds/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// Allocations API (legacy — stays on CRUD)
// ---------------------------------------------------------------------------
export async function getAllocationsByFund(fundId: number): Promise<FundAllocation[]> {
  const response = await fetch(`/api/funds/${fundId}/allocations`);
  return handleResponse<FundAllocation[]>(response);
}

export async function getAllocationsByTask(taskId: number): Promise<FundAllocation[]> {
  const response = await fetch(`/api/tasks/${taskId}/allocations`);
  return handleResponse<FundAllocation[]>(response);
}

export async function createAllocation(data: {
  fundId: number;
  taskId: number;
  amount: number;
  status?: string;
  notes?: string;
}): Promise<FundAllocation> {
  const response = await fetch(`/api/allocations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<FundAllocation>(response);
}

export async function updateAllocation(id: number, data: Partial<FundAllocation>): Promise<FundAllocation> {
  const response = await fetch(`/api/allocations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<FundAllocation>(response);
}

export async function deleteAllocation(id: number): Promise<void> {
  const response = await fetch(`/api/allocations/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// Expenses API (legacy — stays on CRUD)
// ---------------------------------------------------------------------------
export async function getExpenses(homeId: number): Promise<Expense[]> {
  const response = await fetch(`/api/home/${homeId}/expenses`);
  return handleResponse<Expense[]>(response);
}

export async function getExpensesByFund(fundId: number): Promise<Expense[]> {
  const response = await fetch(`/api/funds/${fundId}/expenses`);
  return handleResponse<Expense[]>(response);
}

export async function createExpense(data: {
  fundId: number;
  taskId?: number;
  amount: number;
  description?: string;
  paymentStatus?: string;
  notes?: string;
}): Promise<Expense> {
  const response = await fetch(`/api/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Expense>(response);
}

export async function updateExpense(id: number, data: Partial<Expense>): Promise<Expense> {
  const response = await fetch(`/api/expenses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Expense>(response);
}

export async function deleteExpense(id: number): Promise<void> {
  const response = await fetch(`/api/expenses/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// Inspection Reports API (v2)
// ---------------------------------------------------------------------------
export async function getInspectionReports(homeId: string | number): Promise<V2Report[]> {
  const response = await fetch(`/v2/homes/${homeId}/reports`);
  return handleResponse<V2Report[]>(response);
}

export async function getInspectionReport(id: string | number): Promise<V2Report> {
  const response = await fetch(`/v2/reports/${id}`);
  return handleResponse<V2Report>(response);
}

export async function createInspectionReport(homeId: string | number, data: {
  fileName: string;
  fileType?: string;
  objectPath: string;
  reportType?: string;
  inspectionDate?: string;
}): Promise<V2Report> {
  const response = await fetch(`/v2/homes/${homeId}/reports`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify({
      fileHash: data.fileName,
      storageRef: data.objectPath,
      reportType: data.reportType,
      inspectionDate: data.inspectionDate,
    }),
  });
  return handleResponse<V2Report>(response);
}

export async function analyzeInspectionReport(id: string | number): Promise<{ message: string; status: string }> {
  const response = await fetch(`/v2/reports/${id}/queue-analysis`, {
    method: "POST",
    headers: v2Headers(),
  });
  return handleResponse<{ message: string; status: string }>(response);
}

export async function deleteInspectionReport(id: string | number): Promise<void> {
  const response = await fetch(`/v2/reports/${id}`, {
    method: "DELETE",
    headers: v2Headers(),
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// Home Documents API (legacy — stays on CRUD)
// ---------------------------------------------------------------------------
export async function getDocuments(homeId: number): Promise<HomeDocument[]> {
  const response = await fetch(`/api/home/${homeId}/documents`);
  return handleResponse<HomeDocument[]>(response);
}

export async function createDocument(homeId: number, data: {
  name: string;
  fileType?: string;
  fileSize?: number;
  objectPath: string;
  category?: string;
  notes?: string;
}): Promise<HomeDocument> {
  const response = await fetch(`/api/home/${homeId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<HomeDocument>(response);
}

export async function deleteDocument(id: number): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// AI System Identification (legacy)
// ---------------------------------------------------------------------------
export interface SystemIdentificationResult {
  category?: string;
  name?: string;
  make?: string;
  model?: string;
  condition?: string;
  material?: string;
  estimatedAge?: string;
  notes?: string;
}

export async function identifySystemFromImage(imageBase64: string): Promise<SystemIdentificationResult> {
  const response = await fetch("/api/ai/identify-system", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  return handleResponse<SystemIdentificationResult>(response);
}

// ---------------------------------------------------------------------------
// Contractor Appointments (legacy — stays on CRUD)
// ---------------------------------------------------------------------------
export async function getAppointments(homeId: number): Promise<ContractorAppointment[]> {
  const response = await fetch(`/api/home/${homeId}/appointments`);
  return handleResponse<ContractorAppointment[]>(response);
}

export async function createAppointment(homeId: number, data: {
  title: string;
  scheduledDate?: string;
  status?: string;
  estimatedCost?: string;
  notes?: string;
  taskId?: number;
}): Promise<ContractorAppointment> {
  const response = await fetch(`/api/home/${homeId}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<ContractorAppointment>(response);
}

export async function updateAppointment(id: number, data: Partial<ContractorAppointment>): Promise<ContractorAppointment> {
  const response = await fetch(`/api/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<ContractorAppointment>(response);
}

export async function deleteAppointment(id: number): Promise<void> {
  const response = await fetch(`/api/appointments/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// Notification Preferences (v2)
// ---------------------------------------------------------------------------
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetch("/v2/notifications/preferences");
  return handleResponse<NotificationPreferences>(response);
}

export async function updateNotificationPreferences(data: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const response = await fetch("/v2/notifications/preferences", {
    method: "PUT",
    headers: v2Headers(),
    body: JSON.stringify({ prefs: data }),
  });
  return handleResponse<NotificationPreferences>(response);
}

// ---------------------------------------------------------------------------
// Circuit Panel Map API (v2)
// ---------------------------------------------------------------------------
export interface Breaker {
  number: number;
  label: string;
  room: string;
  notes: string;
  amperage?: number;
}

export interface CircuitMap {
  id: string;
  homeId: string;
  systemId?: string | null;
  imageUrl?: string | null;
  storeImage: boolean;
  state: string;
  breakers: Breaker[];
  createdAt?: string;
  updatedAt?: string;
}

export async function getCircuitMaps(homeId: string): Promise<CircuitMap[]> {
  const response = await fetch(`/v2/homes/${homeId}/circuit-maps`);
  return handleResponse<CircuitMap[]>(response);
}

export async function getCircuitMap(mapId: string): Promise<CircuitMap> {
  const response = await fetch(`/v2/circuit-maps/${mapId}`);
  return handleResponse<CircuitMap>(response);
}

export async function createCircuitMap(homeId: string, data: {
  systemId?: string;
  imageUrl?: string;
  storeImage?: boolean;
  breakers?: Breaker[];
}): Promise<CircuitMap> {
  const response = await fetch(`/v2/homes/${homeId}/circuit-maps`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<CircuitMap>(response);
}

export async function updateCircuitMap(mapId: string, data: {
  breakers?: Breaker[];
  imageUrl?: string;
  storeImage?: boolean;
}): Promise<any> {
  const response = await fetch(`/v2/circuit-maps/${mapId}`, {
    method: "PATCH",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<any>(response);
}

export async function deleteCircuitMap(mapId: string): Promise<void> {
  const response = await fetch(`/v2/circuit-maps/${mapId}`, {
    method: "DELETE",
    headers: v2Headers(),
  });
  return handleResponse<void>(response);
}

export interface CircuitPanelAnalysis {
  breakers: Breaker[];
  confidence: number;
  notes?: string;
}

export async function analyzeCircuitPanel(imageBase64: string): Promise<CircuitPanelAnalysis> {
  const response = await fetch("/api/ai/analyze-circuit-panel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  return handleResponse<CircuitPanelAnalysis>(response);
}

// ---------------------------------------------------------------------------
// Snake-to-camel helper for raw SQL API responses
// ---------------------------------------------------------------------------
function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      result[camelKey] = val;
    }
    return result;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Home Graph API Types
// ---------------------------------------------------------------------------
export interface V2Component {
  id: number;
  homeId: number;
  systemId: number;
  name: string;
  componentType?: string | null;
  material?: string | null;
  installYear?: number | null;
  condition?: string | null;
  notes?: string | null;
  photos?: string | null;
  provenanceSource?: string | null;
  provenanceConfidence?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface V2Warranty {
  id: number;
  homeId: number;
  systemId?: number | null;
  componentId?: number | null;
  warrantyProvider?: string | null;
  warrantyType?: string | null;
  coverageSummary?: string | null;
  startDate?: string | null;
  expiryDate?: string | null;
  isTransferable?: boolean;
  documentId?: number | null;
  notes?: string | null;
  provenanceSource?: string | null;
  provenanceConfidence?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface V2Permit {
  id: number;
  homeId: number;
  systemId?: number | null;
  permitNumber?: string | null;
  permitType?: string | null;
  issuedDate?: string | null;
  status?: string | null;
  issuingAuthority?: string | null;
  description?: string | null;
  provenanceSource?: string | null;
  createdAt?: string;
}

export interface V2Repair {
  id: number;
  homeId: number;
  systemId?: number | null;
  componentId?: number | null;
  taskId?: number | null;
  contractorId?: number | null;
  title: string;
  description?: string | null;
  repairDate?: string | null;
  cost?: number | null;
  partsUsed?: string | null;
  outcome?: string | null;
  provenanceSource?: string | null;
  createdAt?: string;
}

export interface V2Replacement {
  id: number;
  homeId: number;
  systemId?: number | null;
  replacedSystemName?: string | null;
  replacementDate?: string | null;
  cost?: number | null;
  reason?: string | null;
  provenanceSource?: string | null;
  createdAt?: string;
}

export interface V2Recommendation {
  id: number;
  homeId: number;
  systemId?: number | null;
  source: string;
  title: string;
  description?: string | null;
  urgency?: string | null;
  confidence?: number | null;
  rationale?: string | null;
  estimatedCost?: string | null;
  status: string;
  taskId?: number | null;
  createdAt?: string;
}

export interface V2TimelineEvent {
  id: number;
  homeId: number;
  eventDate: string;
  category: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  cost?: number | null;
  provenanceSource?: string | null;
  metadata?: string | null;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Components API (v2)
// ---------------------------------------------------------------------------
export async function getComponents(systemId: number | string): Promise<V2Component[]> {
  const response = await fetch(`/v2/systems/${systemId}/components`);
  const data = await handleResponse<any[]>(response);
  return snakeToCamel(data);
}

export async function createComponent(systemId: number | string, data: Partial<V2Component>): Promise<V2Component> {
  const response = await fetch(`/v2/systems/${systemId}/components`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Component>(response);
}

export async function updateComponent(id: number | string, data: Partial<V2Component>): Promise<V2Component> {
  const response = await fetch(`/v2/components/${id}`, {
    method: "PUT",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Component>(response);
}

export async function deleteComponent(id: number | string): Promise<void> {
  const response = await fetch(`/v2/components/${id}`, {
    method: "DELETE",
    headers: v2Headers(),
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// Warranties API (v2)
// ---------------------------------------------------------------------------
export async function getWarranties(homeId: number | string): Promise<V2Warranty[]> {
  const response = await fetch(`/v2/homes/${homeId}/warranties`);
  const data = await handleResponse<any[]>(response);
  return snakeToCamel(data);
}

export async function createWarranty(homeId: number | string, data: Partial<V2Warranty>): Promise<V2Warranty> {
  const response = await fetch(`/v2/homes/${homeId}/warranties`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Warranty>(response);
}

export async function updateWarranty(id: number | string, data: Partial<V2Warranty>): Promise<V2Warranty> {
  const response = await fetch(`/v2/warranties/${id}`, {
    method: "PUT",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Warranty>(response);
}

export async function deleteWarranty(id: number | string): Promise<void> {
  const response = await fetch(`/v2/warranties/${id}`, {
    method: "DELETE",
    headers: v2Headers(),
  });
  return handleResponse<void>(response);
}

// ---------------------------------------------------------------------------
// Permits API (v2)
// ---------------------------------------------------------------------------
export async function getPermits(homeId: number | string): Promise<V2Permit[]> {
  const response = await fetch(`/v2/homes/${homeId}/permits`);
  const data = await handleResponse<any[]>(response);
  return snakeToCamel(data);
}

export async function createPermit(homeId: number | string, data: Partial<V2Permit>): Promise<V2Permit> {
  const response = await fetch(`/v2/homes/${homeId}/permits`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Permit>(response);
}

// ---------------------------------------------------------------------------
// Repairs API (v2)
// ---------------------------------------------------------------------------
export async function getRepairs(homeId: number | string): Promise<V2Repair[]> {
  const response = await fetch(`/v2/homes/${homeId}/repairs`);
  const data = await handleResponse<any[]>(response);
  return snakeToCamel(data);
}

export async function createRepair(homeId: number | string, data: Partial<V2Repair>): Promise<V2Repair> {
  const response = await fetch(`/v2/homes/${homeId}/repairs`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Repair>(response);
}

// ---------------------------------------------------------------------------
// Replacements API (v2)
// ---------------------------------------------------------------------------
export async function getReplacements(homeId: number | string): Promise<V2Replacement[]> {
  const response = await fetch(`/v2/homes/${homeId}/replacements`);
  const data = await handleResponse<any[]>(response);
  return snakeToCamel(data);
}

export async function createReplacement(homeId: number | string, data: Partial<V2Replacement>): Promise<V2Replacement> {
  const response = await fetch(`/v2/homes/${homeId}/replacements`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<V2Replacement>(response);
}

// ---------------------------------------------------------------------------
// Recommendations API (v2)
// ---------------------------------------------------------------------------
export async function getRecommendations(homeId: number | string): Promise<V2Recommendation[]> {
  const response = await fetch(`/v2/homes/${homeId}/recommendations`);
  const data = await handleResponse<any[]>(response);
  return snakeToCamel(data);
}

export async function acceptRecommendation(id: number | string, data?: { createTask?: boolean }): Promise<V2Recommendation> {
  const response = await fetch(`/v2/recommendations/${id}/accept`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data || {}),
  });
  return handleResponse<V2Recommendation>(response);
}

export async function dismissRecommendation(id: number | string): Promise<V2Recommendation> {
  const response = await fetch(`/v2/recommendations/${id}/dismiss`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify({}),
  });
  return handleResponse<V2Recommendation>(response);
}

// ---------------------------------------------------------------------------
// Timeline API (v2)
// ---------------------------------------------------------------------------
export async function getTimeline(homeId: number | string, params?: {
  category?: string;
  page?: number;
  limit?: number;
}): Promise<V2TimelineEvent[]> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  const response = await fetch(`/v2/homes/${homeId}/timeline${qs ? `?${qs}` : ""}`);
  const result = await handleResponse<{ events: any[]; pagination: any }>(response);
  // Map snake_case API response to camelCase interface
  return (result.events || []).map((e: any) => ({
    id: e.id,
    homeId: e.home_id,
    eventDate: e.event_date,
    category: e.category,
    title: e.title,
    description: e.description,
    icon: e.icon,
    entityType: e.entity_type,
    entityId: e.entity_id,
    cost: e.cost,
    provenanceSource: e.provenance_source,
    metadata: e.metadata,
    createdAt: e.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Intelligence API Types
// ---------------------------------------------------------------------------

export interface SystemInsight {
  systemId: number;
  systemType: string;
  systemName: string;
  conditionStatus: "good" | "watch" | "at-risk";
  riskLevel: number;
  remainingLifeEstimateMonths: number | null;
  estimatedAge: number | null;
  expectedLifespanYears: number | null;
  keyFindings: string[];
  recommendedActions: string[];
  missingDataSignals: string[];
  confidenceScore: number;
}

export interface HomeInsight {
  overallHealthScore: number;
  highRiskSystems: Array<{ systemId: number; name: string; riskLevel: number; status: string }>;
  upcomingMaintenance: Array<{ systemId: number; systemName: string; action: string; urgency: string }>;
  missingCriticalData: Array<{ systemId: number; systemName: string; signal: string }>;
  summaryNarrative: string;
}

export interface SystemPrediction {
  failureProbability12Months: number;
  failureProbability24Months: number;
  estimatedTimeToFailureMonths: number | null;
  severityIfFailure: "critical" | "major" | "moderate";
  confidenceScore: number;
}

export interface SystemCostProjection {
  repairCostRange: [number, number];
  replacementCostRange: [number, number];
}

export interface InactionInsight {
  riskSummary: string;
  probabilityOfCostEvent: number;
  estimatedFinancialImpact: [number, number];
  recommendedActionWindow: string;
}

export interface HomeForecast {
  systemPredictions: Array<{
    systemId: number;
    systemName: string;
    systemCategory: string;
    prediction: SystemPrediction;
    costProjection: SystemCostProjection;
    inactionInsight: InactionInsight | null;
  }>;
  totalEstimatedCostRange12Months: [number, number];
  totalEstimatedCostRange24Months: [number, number];
  highestPriorityInterventions: Array<{
    systemId: number;
    systemName: string;
    action: string;
    urgency: string;
    estimatedCost: string;
  }>;
}

export interface HomeIntelligenceResponse {
  insight: HomeInsight;
  forecast: HomeForecast;
  systems: SystemInsight[];
}

export interface SystemInsightResponse {
  insight: SystemInsight;
  prediction: SystemPrediction;
  costProjection: SystemCostProjection;
  inactionInsight: InactionInsight | null;
}

// ---------------------------------------------------------------------------
// Intelligence API Functions
// ---------------------------------------------------------------------------

export async function getHomeIntelligence(homeId: number | string): Promise<HomeIntelligenceResponse> {
  const response = await fetch(`/v2/homes/${homeId}/intelligence`, {
    headers: v2Headers(),
  });
  return handleResponse<HomeIntelligenceResponse>(response);
}

export async function getSystemInsight(systemId: number | string): Promise<SystemInsightResponse> {
  const response = await fetch(`/v2/systems/${systemId}/insight`, {
    headers: v2Headers(),
  });
  return handleResponse<SystemInsightResponse>(response);
}

// ---------------------------------------------------------------------------
// Outcome Learning API Types
// ---------------------------------------------------------------------------

export interface UserAction {
  id: number;
  home_id: number;
  system_id: number | null;
  related_recommendation_id: number | null;
  related_task_id: number | null;
  action_type: string;
  action_date: string;
  cost_actual: number | null;
  contractor_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface OutcomeEvent {
  id: number;
  home_id: number;
  system_id: number | null;
  related_action_id: number | null;
  outcome_type: string;
  severity: string;
  cost_impact: number | null;
  description: string | null;
  occurred_at: string;
  created_at: string;
}

export interface HomeLearningProfile {
  homeId: number;
  behaviorPattern: "proactive" | "reactive" | "neglectful" | "unknown";
  maintenanceComplianceRate: number;
  averageResponseTimeDays: number | null;
  riskAdjustmentFactor: number;
  totalActions: number;
  totalOutcomes: number;
}

export interface SystemReliabilityProfile {
  systemType: string;
  sampleSize: number;
  averageFailureAge: number | null;
  maintenanceImpactScore: number;
  variance: number;
  confidence: number;
}

export interface LearningSummary {
  homeProfile: HomeLearningProfile;
  systemReliability: SystemReliabilityProfile[];
  adjustments: Array<{
    parameterKey: string;
    parameterValue: number;
    reason: string;
    dataPoints: number;
    confidence: number;
  }>;
  predictionAccuracy: {
    totalPredictions: number;
    accurateCount: number;
    accuracyRate: number;
    falsePositiveRate: number;
  };
  narrative: string;
}

// ---------------------------------------------------------------------------
// Outcome Learning API Functions
// ---------------------------------------------------------------------------

export async function recordAction(homeId: number | string, data: {
  systemId?: number;
  relatedRecommendationId?: number;
  relatedTaskId?: number;
  actionType: string;
  costActual?: number;
  contractorId?: number;
  notes?: string;
}): Promise<UserAction> {
  const response = await fetch(`/v2/homes/${homeId}/actions`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<UserAction>(response);
}

export async function recordOutcome(homeId: number | string, data: {
  systemId?: number;
  relatedActionId?: number;
  outcomeType: string;
  severity?: string;
  costImpact?: number;
  description?: string;
}): Promise<OutcomeEvent> {
  const response = await fetch(`/v2/homes/${homeId}/outcomes`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify(data),
  });
  return handleResponse<OutcomeEvent>(response);
}

export async function getActions(homeId: number | string): Promise<UserAction[]> {
  const response = await fetch(`/v2/homes/${homeId}/actions`, {
    headers: v2Headers(),
  });
  return handleResponse<UserAction[]>(response);
}

export async function getOutcomes(homeId: number | string): Promise<OutcomeEvent[]> {
  const response = await fetch(`/v2/homes/${homeId}/outcomes`, {
    headers: v2Headers(),
  });
  return handleResponse<OutcomeEvent[]>(response);
}

export async function getLearningSummary(homeId: number | string): Promise<LearningSummary> {
  const response = await fetch(`/v2/homes/${homeId}/learning-summary`, {
    headers: v2Headers(),
  });
  return handleResponse<LearningSummary>(response);
}

// ---------------------------------------------------------------------------
// Calendar feed
// ---------------------------------------------------------------------------

export interface CalendarFeed {
  url: string;
  webcalUrl: string;
  token: string;
}

export async function getCalendarFeed(): Promise<CalendarFeed> {
  const response = await fetch("/api/me/calendar-feed", {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  return handleResponse<CalendarFeed>(response);
}

// ---------------------------------------------------------------------------
// Chat sessions
// ---------------------------------------------------------------------------

export interface ChatSession {
  id: string;
  homeId: string;
  title: string;
  messageCount: number;
  createdAt: string;
}

export interface V2ChatMessage {
  id: string;
  homeId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function getChatSessions(homeId: number | string): Promise<ChatSession[]> {
  const response = await fetch(`/v2/homes/${homeId}/chat/sessions`, {
    headers: v2Headers(),
  });
  return handleResponse<ChatSession[]>(response);
}

export async function createChatSession(homeId: number | string): Promise<{ sessionId: string }> {
  const response = await fetch(`/v2/chat/sessions`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify({ homeId }),
  });
  return handleResponse<{ sessionId: string }>(response);
}

export async function getChatSession(sessionId: string): Promise<{ session: ChatSession; messages: V2ChatMessage[] }> {
  const response = await fetch(`/v2/chat/sessions/${sessionId}`, {
    headers: v2Headers(),
  });
  return handleResponse<{ session: ChatSession; messages: V2ChatMessage[] }>(response);
}

export async function updateChatSessionTitle(sessionId: string, title: string): Promise<{ sessionId: string; title: string }> {
  const response = await fetch(`/v2/chat/sessions/${sessionId}`, {
    method: "PATCH",
    headers: v2Headers(),
    body: JSON.stringify({ title }),
  });
  return handleResponse<{ sessionId: string; title: string }>(response);
}
