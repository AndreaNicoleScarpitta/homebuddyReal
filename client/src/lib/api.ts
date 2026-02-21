import type { Home, System, MaintenanceTask, MaintenanceLogEntry, ChatMessage, Fund, FundAllocation, Expense, InspectionReport, InspectionFinding, ContractorAppointment, NotificationPreferences } from "@shared/schema";

async function handleResponse<T>(response: Response): Promise<T> {
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

export interface V2ChatMessage {
  id: string;
  homeId: string;
  role: string;
  content: string;
  createdAt: string;
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
  address: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  zipPlus4?: string;
  addressVerified?: boolean;
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
// Chat API (v2 reads, legacy SSE streaming)
// ---------------------------------------------------------------------------
export async function getChatMessages(homeId: string | number): Promise<V2ChatMessage[]> {
  const response = await fetch(`/v2/homes/${homeId}/chat`);
  return handleResponse<V2ChatMessage[]>(response);
}

export async function createChatMessage(homeId: number, data: {
  role: string;
  content: string;
}): Promise<ChatMessage> {
  const response = await fetch(`/api/home/${homeId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<ChatMessage>(response);
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
