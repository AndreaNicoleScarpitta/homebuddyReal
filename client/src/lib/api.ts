import type { Home, System, MaintenanceTask, MaintenanceLogEntry, ChatMessage, Fund, FundAllocation, Expense, InspectionReport, InspectionFinding, ContractorAppointment, NotificationPreferences } from "@shared/schema";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "An error occurred" }));
    throw new Error(error.message || "Request failed");
  }
  return response.json();
}

// Home API
export async function getHome(): Promise<Home | null> {
  try {
    const response = await fetch("/api/home");
    if (response.status === 404) {
      return null;
    }
    return handleResponse<Home>(response);
  } catch (error) {
    if ((error as any)?.message === "Home not found") {
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
}): Promise<Home> {
  const response = await fetch("/api/home", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Home>(response);
}

export async function updateHome(id: number, data: Partial<Home>): Promise<Home> {
  const response = await fetch(`/api/home/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Home>(response);
}

// Systems API
export async function getSystems(homeId: number): Promise<System[]> {
  const response = await fetch(`/api/home/${homeId}/systems`);
  return handleResponse<System[]>(response);
}

export async function createSystem(homeId: number, data: {
  name: string;
  category?: string;
  installYear?: number;
  condition?: string;
  notes?: string;
  photos?: string;
  documents?: string;
  source?: string;
}): Promise<System> {
  const response = await fetch(`/api/home/${homeId}/systems`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<System>(response);
}

export async function updateSystem(id: number, data: Partial<System>): Promise<System> {
  const response = await fetch(`/api/systems/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<System>(response);
}

export async function deleteSystem(id: number): Promise<void> {
  const response = await fetch(`/api/systems/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

// Tasks API
export async function getTasks(homeId: number): Promise<MaintenanceTask[]> {
  const response = await fetch(`/api/home/${homeId}/tasks`);
  return handleResponse<MaintenanceTask[]>(response);
}

export async function createTask(homeId: number, data: Partial<MaintenanceTask>): Promise<MaintenanceTask> {
  const response = await fetch(`/api/home/${homeId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<MaintenanceTask>(response);
}

export async function updateTask(id: number, data: Partial<MaintenanceTask>): Promise<MaintenanceTask> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<MaintenanceTask>(response);
}

export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

// Maintenance Log API
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

// Chat API
export async function getChatMessages(homeId: number): Promise<ChatMessage[]> {
  const response = await fetch(`/api/home/${homeId}/chat`);
  return handleResponse<ChatMessage[]>(response);
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

// Funds API
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

// Allocations API
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

// Expenses API
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

// Inspection Reports API
export async function getInspectionReports(homeId: number): Promise<InspectionReport[]> {
  const response = await fetch(`/api/home/${homeId}/reports`);
  return handleResponse<InspectionReport[]>(response);
}

export async function getInspectionReport(id: number): Promise<InspectionReport & { findings: InspectionFinding[] }> {
  const response = await fetch(`/api/reports/${id}`);
  return handleResponse<InspectionReport & { findings: InspectionFinding[] }>(response);
}

export async function createInspectionReport(homeId: number, data: {
  fileName: string;
  fileType?: string;
  objectPath: string;
  reportType?: string;
  inspectionDate?: string;
}): Promise<InspectionReport> {
  const response = await fetch(`/api/home/${homeId}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<InspectionReport>(response);
}

export async function analyzeInspectionReport(id: number): Promise<{ message: string; status: string }> {
  const response = await fetch(`/api/reports/${id}/analyze`, {
    method: "POST",
  });
  return handleResponse<{ message: string; status: string }>(response);
}

export async function deleteInspectionReport(id: number): Promise<void> {
  const response = await fetch(`/api/reports/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

// AI System Identification
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

// Contractor Appointments
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

// Notification Preferences
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetch("/api/notifications/preferences");
  return handleResponse<NotificationPreferences>(response);
}

export async function updateNotificationPreferences(data: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const response = await fetch("/api/notifications/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<NotificationPreferences>(response);
}
