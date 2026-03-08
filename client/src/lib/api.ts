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

export async function createHome(data: {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
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
}

/**
 * Calls GPT-4o to analyze a task title and return urgency, DIY level,
 * cost estimate, description, and safety warnings.
 * Debounced in the UI to avoid excessive calls while typing.
 */
export async function analyzeTask(title: string, category?: string): Promise<TaskAnalysis> {
  const response = await fetch("/v2/tasks/analyze", {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify({ title, category: category || undefined }),
  });
  return handleResponse<TaskAnalysis>(response);
}

export async function suggestMaintenanceTasks(systemName: string, systemCategory: string, notes?: string): Promise<SuggestedTask[]> {
  const response = await fetch(`/v2/systems/suggest-tasks`, {
    method: "POST",
    headers: v2Headers(),
    body: JSON.stringify({ systemName, systemCategory, notes }),
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
