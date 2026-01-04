import { Home, Wrench, MessageSquare, User, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";

export const HOME_PROFILE = {
  address: "123 Maple Street, Springfield, IL",
  builtYear: 1985,
  sqFt: 2400,
  type: "Single Family",
  healthScore: 82,
  systems: [
    { name: "HVAC", age: 4, status: "good", lastService: "2024-05-10" },
    { name: "Roof", age: 12, status: "warning", lastService: "2012-08-15" },
    { name: "Water Heater", age: 8, status: "good", lastService: "2023-11-20" },
    { name: "Plumbing", age: 15, status: "good", lastService: "2024-01-05" },
    { name: "Electrical", age: 39, status: "good", lastService: "2015-03-12" },
  ]
};

export const MAINTENANCE_TASKS = [
  {
    id: 1,
    title: "Change HVAC Filter",
    category: "Routine",
    dueDate: "2025-02-01",
    priority: "medium",
    status: "pending",
    estimatedCost: "$20",
    difficulty: "Easy"
  },
  {
    id: 2,
    title: "Inspect Roof Shingles",
    category: "Inspection",
    dueDate: "2025-03-15",
    priority: "high",
    status: "pending",
    estimatedCost: "Free (Self) or $150",
    difficulty: "Medium"
  },
  {
    id: 3,
    title: "Flush Water Heater",
    category: "Maintenance",
    dueDate: "2025-04-10",
    priority: "medium",
    status: "scheduled",
    estimatedCost: "$200",
    difficulty: "Hard"
  },
  {
    id: 4,
    title: "Clean Gutters",
    category: "Seasonal",
    dueDate: "2024-11-15",
    priority: "high",
    status: "overdue",
    estimatedCost: "$150",
    difficulty: "Medium"
  }
];

export const CHAT_HISTORY = [
  {
    role: "assistant",
    content: "Hi! I'm HomeWise. I've analyzed your home profile. Based on your home's age (1985) and your last roof inspection, I'd recommend checking your roof shingles soon. How can I help you today?"
  }
];
