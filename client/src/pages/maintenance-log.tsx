import { Layout } from "@/components/layout";
import { SwipeableTask } from "@/components/swipeable-task";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Wrench, 
  CheckCircle2,
  Clock,
  FileText,
  ClipboardList,
  AlertTriangle,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  UserCheck,
  HardHat
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHome, getTasks, getSystems, getLogEntries, createLogEntry, updateTask, deleteTask } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, formatDistanceToNow, isPast, isToday, isFuture, differenceInDays } from "date-fns";
import type { V2Task, V2System } from "@/lib/api";
import type { MaintenanceLogEntry } from "@shared/schema";
import { trackEvent } from "@/lib/analytics";

/**
 * Filter categories for the Maintenance Log task list.
 * Tasks are categorized by their due date relative to today:
 * - upcoming: due date > 7 days out or no due date
 * - due: due today or within the next 7 days
 * - past_due: due date is in the past
 * - completed: task status is "completed"
 */
type FilterTab = "upcoming" | "due" | "past_due" | "completed";

const filterTabs: { key: FilterTab; label: string; icon: React.ElementType }[] = [
  { key: "upcoming", label: "Upcoming", icon: CalendarClock },
  { key: "due", label: "Due", icon: CalendarCheck },
  { key: "past_due", label: "Past Due", icon: CalendarX },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

/**
 * Sorts tasks into four buckets based on due date and completion status.
 * Each bucket is sorted by due date (earliest first, except completed which is newest first).
 * Tasks without a due date are placed in "upcoming" by default.
 */
function categorizeTasks(tasks: V2Task[]) {
  const now = new Date();
  const upcoming: V2Task[] = [];
  const due: V2Task[] = [];
  const pastDue: V2Task[] = [];
  const completed: V2Task[] = [];

  for (const task of tasks) {
    if (task.status === "completed" || task.state === "completed") {
      completed.push(task);
      continue;
    }

    const dueDate = task.dueDate ? new Date(task.dueDate) : null;

    if (!dueDate) {
      upcoming.push(task);
      continue;
    }

    if (isPast(dueDate) && !isToday(dueDate)) {
      pastDue.push(task);
    } else if (isToday(dueDate) || (isFuture(dueDate) && differenceInDays(dueDate, now) <= 7)) {
      due.push(task);
    } else {
      upcoming.push(task);
    }
  }

  pastDue.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  due.sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aDate - bDate;
  });
  upcoming.sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aDate - bDate;
  });
  completed.sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return bDate - aDate;
  });

  return { upcoming, due, past_due: pastDue, completed };
}

function MaintenanceLogSkeleton() {
  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-28" />
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function urgencyColor(urgency?: string) {
  switch (urgency) {
    case "now": return "text-red-600 bg-red-500/10";
    case "soon": return "text-orange-600 bg-orange-500/10";
    case "later": return "text-blue-600 bg-blue-500/10";
    case "monitor": return "text-gray-600 bg-gray-500/10";
    default: return "text-muted-foreground bg-muted";
  }
}

function diyColor(diy?: string | null) {
  switch (diy) {
    case "DIY-Safe": return "text-green-700 bg-green-500/10 border-green-200";
    case "Caution": return "text-amber-700 bg-amber-500/10 border-amber-200";
    case "Pro-Only": return "text-red-700 bg-red-500/10 border-red-200";
    default: return "text-muted-foreground bg-muted";
  }
}

function TaskRow({ task, systemsById, onComplete }: {
  task: V2Task;
  systemsById: Record<string, V2System>;
  onComplete: (task: V2Task) => void;
}) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);
  const isCompleted = task.status === "completed" || task.state === "completed";
  const system = task.relatedSystemId ? systemsById[task.relatedSystemId] : null;

  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
        isOverdue ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20" :
        isDueToday ? "border-orange-200 bg-orange-50/50 dark:border-orange-900/30 dark:bg-orange-950/20" :
        isCompleted ? "border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-950/20" :
        "bg-muted/30 hover:bg-muted/50"
      }`}
      data-testid={`row-task-${task.id}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isCompleted ? "bg-green-500/20" : isOverdue ? "bg-red-500/20" : "bg-muted"
        }`}>
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : isOverdue ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : (
            <Wrench className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className={`font-medium text-sm truncate ${isCompleted ? "line-through text-muted-foreground" : ""}`} data-testid={`text-task-title-${task.id}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {task.category && (
              <span className="text-xs text-muted-foreground">{task.category}</span>
            )}
            {system && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {system.name}
              </Badge>
            )}
            {dueDate && (
              <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : isDueToday ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
                {isOverdue ? `Overdue ${formatDistanceToNow(dueDate)}` : 
                 isDueToday ? "Due today" : 
                 `Due ${format(dueDate, "MMM d")}`}
              </span>
            )}
            {!dueDate && !isCompleted && (
              <span className="text-xs text-muted-foreground">No due date</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
        {task.urgency && !isCompleted && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 hidden sm:flex ${urgencyColor(task.urgency)}`}>
            {task.urgency}
          </Badge>
        )}
        {task.diyLevel && !isCompleted && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 hidden sm:flex ${diyColor(task.diyLevel)}`}>
            {task.diyLevel}
          </Badge>
        )}
        {task.estimatedCost && !isCompleted && (
          <span className="text-xs text-muted-foreground hidden md:block">{task.estimatedCost}</span>
        )}
        {!isCompleted && (
          <Button 
            size="sm" 
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onComplete(task)}
            data-testid={`button-complete-${task.id}`}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Complete
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MaintenanceLog() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [selectedTask, setSelectedTask] = useState<V2Task | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("upcoming");

  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    enabled: isAuthenticated,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", home?.id],
    queryFn: () => getTasks(home!.id),
    enabled: !!home?.id,
  });

  const { data: systems = [] } = useQuery({
    queryKey: ["systems", home?.id],
    queryFn: () => getSystems(home!.id),
    enabled: !!home?.id,
  });

  const { data: logEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["logEntries", home?.id],
    queryFn: () => getLogEntries(home!.legacyId!),
    enabled: !!home?.id && !!home?.legacyId,
  });

  const categorized = useMemo(() => categorizeTasks(tasks), [tasks]);

  const counts = useMemo(() => ({
    upcoming: categorized.upcoming.length,
    due: categorized.due.length,
    past_due: categorized.past_due.length,
    completed: categorized.completed.length,
  }), [categorized]);

  useEffect(() => {
    if (counts.past_due > 0) {
      setActiveFilter("past_due");
    } else if (counts.due > 0) {
      setActiveFilter("due");
    } else {
      setActiveFilter("upcoming");
    }
  }, [tasks.length]);

  const filteredTasks = categorized[activeFilter];

  const systemsById = systems.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {} as Record<string, V2System>);

  const handleCompleteTask = (task: V2Task) => {
    trackEvent('click', 'maintenance_log', 'complete_task');
    setSelectedTask(task);
    setShowAddEntry(true);
  };

  const taskDeleteMutation = useMutation({
    mutationFn: (taskId: string | number) => deleteTask(taskId),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", home?.id] });
      const previous = queryClient.getQueryData<V2Task[]>(["tasks", home?.id]);
      queryClient.setQueryData<V2Task[]>(["tasks", home?.id], old => old?.filter(t => t.id !== String(taskId)) ?? []);
      return { previous };
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks", home?.id], context.previous);
      toast({ title: "Error", description: "Could not delete task.", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const handleDeleteTask = (task: V2Task) => {
    trackEvent('swipe', 'maintenance_log', 'delete_task');
    taskDeleteMutation.mutate(task.id);
    toast({ title: "Task deleted", description: `"${task.title}" was removed.` });
  };

  const swipeCompleteMutation = useMutation({
    mutationFn: async (task: V2Task) => {
      await createLogEntry(home!.legacyId!, {
        title: task.title,
        date: new Date().toISOString(),
      });
      await updateTask(task.id, { status: "completed" });
    },
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", home?.id] });
      const previous = queryClient.getQueryData<V2Task[]>(["tasks", home?.id]);
      queryClient.setQueryData<V2Task[]>(["tasks", home?.id], old =>
        old?.map(t => t.id === task.id ? { ...t, status: "completed" } : t) ?? []
      );
      return { previous };
    },
    onError: (_err, _task, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks", home?.id], context.previous);
      toast({ title: "Error", description: "Could not complete task.", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["logEntries"] });
    },
  });

  const handleSwipeComplete = (task: V2Task) => {
    trackEvent('swipe', 'maintenance_log', 'complete_task_quick');
    swipeCompleteMutation.mutate(task);
    toast({ title: "Task completed!", description: `"${task.title}" marked as done.` });
  };


  if (homeLoading || (home && tasksLoading)) {
    return (
      <Layout>
        <MaintenanceLogSkeleton />
      </Layout>
    );
  }

  if (!home) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center max-w-md">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Set up your home first</h2>
            <p className="text-muted-foreground">
              Complete your home profile to start tracking your maintenance.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-heading font-bold" data-testid="text-heading">
              Maintenance Log
            </h1>
            <p className="text-muted-foreground mt-1">
              Track tasks and completed work on your home
            </p>
          </div>
          <Button onClick={() => { trackEvent('click', 'maintenance_log', 'log_work'); setSelectedTask(null); setShowAddEntry(true); }} data-testid="button-add-entry">
            <Plus className="h-4 w-4 mr-2" />
            Log Work
          </Button>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-completed-count">{counts.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-past-due-count">{counts.past_due}</p>
                  <p className="text-xs text-muted-foreground">Past Due</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-due-count">{counts.due}</p>
                  <p className="text-xs text-muted-foreground">Due Now</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <CalendarClock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-upcoming-count">{counts.upcoming}</p>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg overflow-x-auto" data-testid="filter-tabs">
          {filterTabs.map(({ key, label, icon: Icon }) => {
            const count = counts[key];
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => { setActiveFilter(key); trackEvent('click', 'maintenance_log', `filter_${key}`); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
                data-testid={`filter-${key}`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {count > 0 && (
                  <Badge 
                    variant={isActive ? "default" : "secondary"} 
                    className={`ml-1 h-5 min-w-[20px] flex items-center justify-center text-[10px] px-1.5 ${
                      key === "past_due" && count > 0 ? "bg-red-500 text-white" : ""
                    }`}
                  >
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        <div data-testid="task-list">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                {activeFilter === "completed" ? (
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                ) : activeFilter === "past_due" ? (
                  <CalendarX className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <CalendarClock className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {activeFilter === "upcoming" && "No upcoming tasks"}
                {activeFilter === "due" && "Nothing due right now"}
                {activeFilter === "past_due" && "No overdue tasks"}
                {activeFilter === "completed" && "No completed tasks yet"}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                {activeFilter === "upcoming" && "Tasks scheduled for the future will appear here."}
                {activeFilter === "due" && "Tasks due today or within the next 7 days will appear here."}
                {activeFilter === "past_due" && "Great job staying on top of your maintenance!"}
                {activeFilter === "completed" && "Complete your first task to start building your maintenance history."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const isCompleted = task.status === "completed" || task.state === "completed";
                return (
                  <SwipeableTask
                    key={task.id}
                    onSwipeLeft={() => handleSwipeComplete(task)}
                    onSwipeRight={() => handleDeleteTask(task)}
                    disabled={isCompleted}
                  >
                    <TaskRow
                      task={task}
                      systemsById={systemsById}
                      onComplete={handleCompleteTask}
                    />
                  </SwipeableTask>
                );
              })}
            </div>
          )}
        </div>

        {logEntries.length > 0 && activeFilter === "completed" && (
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" />
                Work Log
              </CardTitle>
              <CardDescription>
                Detailed records of completed maintenance work
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {logEntries.map((entry, index) => (
                    <div key={entry.id}>
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </div>
                          {index < logEntries.length - 1 && (
                            <div className="w-px h-full bg-border mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium" data-testid={`text-entry-title-${entry.id}`}>
                                {entry.title}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.date), "MMM d, yyyy")} • {formatDistanceToNow(new Date(entry.date), { addSuffix: true })}
                              </p>
                            </div>
                            {entry.cost && (
                              <Badge variant="secondary" className="ml-2">
                                ${(entry.cost / 100).toLocaleString()}
                              </Badge>
                            )}
                          </div>
                          {entry.notes && (
                            <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            {entry.systemId && systemsById[entry.systemId] && (
                              <Badge variant="outline" className="text-xs">
                                {systemsById[entry.systemId].name}
                              </Badge>
                            )}
                            {entry.provider && (
                              <Badge variant="outline" className="text-xs">
                                {entry.provider}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      <AddLogEntryDialog
        isOpen={showAddEntry}
        onClose={() => { setShowAddEntry(false); setSelectedTask(null); }}
        homeId={home?.id || ""}
        legacyHomeId={home?.legacyId || null}
        task={selectedTask}
        systems={systems}
      />
    </Layout>
  );
}

interface AddLogEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  homeId: string;
  legacyHomeId: number | null;
  task: V2Task | null;
  systems: V2System[];
}

function AddLogEntryDialog({ isOpen, onClose, homeId, legacyHomeId, task, systems }: AddLogEntryDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    title: task?.title || "",
    date: format(new Date(), "yyyy-MM-dd"),
    systemId: task?.relatedSystemId?.toString() || "",
    cost: "",
    completedBy: "myself" as "myself" | "contractor",
    provider: "",
    notes: "",
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        date: format(new Date(), "yyyy-MM-dd"),
        systemId: task.relatedSystemId?.toString() || "",
        cost: "",
        completedBy: "myself",
        provider: "",
        notes: "",
      });
    } else {
      setFormData({
        title: "",
        date: format(new Date(), "yyyy-MM-dd"),
        systemId: "",
        cost: "",
        completedBy: "myself",
        provider: "",
        notes: "",
      });
    }
  }, [task]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (legacyHomeId) {
        await createLogEntry(legacyHomeId, {
          title: data.title,
          date: new Date(data.date).toISOString(),
          cost: data.cost ? Math.round(parseFloat(data.cost) * 100) : undefined,
          provider: data.completedBy === "contractor" ? (data.provider || "Contractor") : "DIY (Myself)",
          notes: data.notes || undefined,
        });
      }

      if (task) {
        await updateTask(task.id, { status: "completed" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logEntries"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Logged!", description: "Maintenance work has been recorded." });
      onClose();
      setFormData({
        title: "",
        date: format(new Date(), "yyyy-MM-dd"),
        systemId: "",
        cost: "",
        completedBy: "myself",
        provider: "",
        notes: "",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save log entry.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({ title: "Error", description: "Please enter a title.", variant: "destructive" });
      return;
    }
    trackEvent('submit_form', 'maintenance_log', task ? 'complete_task' : 'log_entry');
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {task ? `Complete: ${task.title}` : "Log Maintenance Work"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!task && (
            <div className="space-y-2">
              <Label htmlFor="title">What was done?</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Replaced air filter, Fixed leak..."
                data-testid="input-entry-title"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Who completed this?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, completedBy: "myself", provider: "" })}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  formData.completedBy === "myself"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
                data-testid="button-completed-by-myself"
              >
                <UserCheck className="h-4 w-4" />
                <span className="text-sm font-medium">Myself</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, completedBy: "contractor" })}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  formData.completedBy === "contractor"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
                data-testid="button-completed-by-contractor"
              >
                <HardHat className="h-4 w-4" />
                <span className="text-sm font-medium">Contractor</span>
              </button>
            </div>
          </div>

          {formData.completedBy === "contractor" && (
            <div className="space-y-2">
              <Label htmlFor="provider">Contractor / Company Name</Label>
              <Input
                id="provider"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                placeholder="e.g., ABC Plumbing, Joe's Electric..."
                data-testid="input-entry-provider"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                data-testid="input-entry-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost ($)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                data-testid="input-entry-cost"
              />
            </div>
          </div>

          {systems.length > 0 && !task && (
            <div className="space-y-2">
              <Label htmlFor="system">Related System (optional)</Label>
              <Select 
                value={formData.systemId} 
                onValueChange={(v) => setFormData({ ...formData, systemId: v })}
              >
                <SelectTrigger data-testid="select-entry-system">
                  <SelectValue placeholder="Select a system..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {systems.map((system) => (
                    <SelectItem key={system.id} value={system.id.toString()}>
                      {system.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional details..."
              rows={3}
              data-testid="input-entry-notes"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-entry">
              {createMutation.isPending ? "Saving..." : task ? "Complete Task" : "Log Entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
