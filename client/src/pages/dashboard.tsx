import { Layout } from "@/components/layout";
import { HomeHealth } from "@/components/home-health";
import { HomeInfoCard } from "@/components/home-info-card";
import { MaintenanceCard } from "@/components/maintenance-card";
import { SwipeableTask } from "@/components/swipeable-task";
import { AddSystemWizard } from "@/components/add-system-wizard";
import { SystemsSummary } from "@/components/systems-summary";
import { OnboardingTour, useTourState } from "@/components/onboarding-tour";
import { ContractorSection } from "@/components/contractor-section";
import { ContractorSchedule } from "@/components/contractor-schedule";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowRight, ListTodo, CheckCircle2, Loader2, Sparkles, Wrench, AlertTriangle, ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FieldTooltip } from "@/components/field-tooltip";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHome, getTasks, getSystems, createTask, updateTask, deleteTask, createLogEntry, analyzeTask, getNotificationPreferences } from "@/lib/api";
import type { TaskAnalysis } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { format } from "date-fns";
import type { V2Task } from "@/lib/api";

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

function QuickAddTaskDialog({ isOpen, onClose, homeId }: { isOpen: boolean; onClose: () => void; homeId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [analysis, setAnalysis] = useState<TaskAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [diyOverride, setDiyOverride] = useState<string | null>(null);
  const [showDiyOverride, setShowDiyOverride] = useState(false);
  const [manualUrgency, setManualUrgency] = useState("soon");
  const [manualDiy, setManualDiy] = useState("Caution");
  const [manualCost, setManualCost] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const { data: prefs } = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: getNotificationPreferences,
  });
  const contractorMode = (prefs as any)?.contractorMode ?? false;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runAnalysis = useCallback(async (taskTitle: string, taskCategory: string) => {
    if (taskTitle.trim().length < 3) return;
    const thisRequest = ++requestIdRef.current;
    setAnalyzing(true);
    setAnalysisFailed(false);
    try {
      const result = await analyzeTask(taskTitle, taskCategory || undefined);
      if (thisRequest !== requestIdRef.current) return;
      setAnalysis(result);
      setDiyOverride(null);
      setShowDiyOverride(false);
    } catch {
      if (thisRequest !== requestIdRef.current) return;
      setAnalysis(null);
      setAnalysisFailed(true);
    } finally {
      if (thisRequest === requestIdRef.current) setAnalyzing(false);
    }
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => runAnalysis(value, category), 800);
    } else {
      setAnalysis(null);
      setAnalysisFailed(false);
    }
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    if (title.trim().length >= 3) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runAnalysis(title, value), 500);
    }
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const useManual = analysisFailed || !analysis;
      return createTask(homeId, {
        title: title.trim(),
        urgency: (useManual ? manualUrgency : analysis?.urgency || "later") as any,
        category: category || undefined,
        diyLevel: (useManual ? manualDiy : (diyOverride || analysis?.diyLevel || "Caution")) as any,
        estimatedCost: useManual ? (manualCost || undefined) : (analysis?.estimatedCost || undefined),
        description: analysis?.description || undefined,
        safetyWarning: analysis?.safetyWarning || undefined,
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Task added", description: "Your maintenance task has been created." });
      onClose();
      setTitle("");
      setCategory("");
      setAnalysis(null);
      setAnalysisFailed(false);
      setDiyOverride(null);
      setShowDiyOverride(false);
      setManualUrgency("soon");
      setManualDiy("Caution");
      setManualCost("");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not create task.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Error", description: "Please enter a task name.", variant: "destructive" });
      return;
    }
    trackEvent('submit_form', 'dashboard', 'quick_add_task');
    createMutation.mutate();
  };

  const getDiyIcon = (level: string) => {
    switch (level) {
      case "DIY-Safe": return <ShieldCheck className="h-3.5 w-3.5" />;
      case "Caution": return <Shield className="h-3.5 w-3.5" />;
      case "Pro-Only": return <ShieldAlert className="h-3.5 w-3.5" />;
      default: return <Shield className="h-3.5 w-3.5" />;
    }
  };

  const getDiyColor = (level: string) => {
    switch (level) {
      case "DIY-Safe": return "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
      case "Caution": return "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
      case "Pro-Only": return "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getUrgencyLabel = (u: string) => {
    switch (u) {
      case "now": return "Fix Now";
      case "soon": return "Plan Soon";
      case "later": return "Address Later";
      case "monitor": return "Monitor";
      default: return u;
    }
  };

  const getUrgencyColor = (u: string) => {
    switch (u) {
      case "now": return "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
      case "soon": return "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800";
      case "later": return "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
      case "monitor": return "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const activeDiy = diyOverride || analysis?.diyLevel;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Maintenance Task
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">What needs to be done?</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g., Replace furnace filter, Clean gutters..."
              data-testid="input-task-title"
            />
          </div>

          <div className="space-y-2">
            <Label>Category (optional)</Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger data-testid="select-task-category">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HVAC">HVAC</SelectItem>
                <SelectItem value="Plumbing">Plumbing</SelectItem>
                <SelectItem value="Electrical">Electrical</SelectItem>
                <SelectItem value="Roof">Roof</SelectItem>
                <SelectItem value="Windows">Windows</SelectItem>
                <SelectItem value="Siding/Exterior">Siding/Exterior</SelectItem>
                <SelectItem value="Foundation">Foundation</SelectItem>
                <SelectItem value="Appliances">Appliances</SelectItem>
                <SelectItem value="Water Heater">Water Heater</SelectItem>
                <SelectItem value="Landscaping">Landscaping</SelectItem>
                <SelectItem value="Pest">Pest</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {analyzing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 px-4 bg-muted/50 rounded-lg border border-dashed">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Analyzing task...</span>
            </div>
          )}

          {analysis && !analyzing && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-primary" />
                AI Assessment
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className={`text-xs border shadow-none ${getUrgencyColor(analysis.urgency)}`}>
                  {getUrgencyLabel(analysis.urgency)}
                </Badge>
                <Badge className={`text-xs border shadow-none flex items-center gap-1 ${getDiyColor(activeDiy || analysis.diyLevel)}`}>
                  {getDiyIcon(activeDiy || analysis.diyLevel)}
                  {activeDiy || analysis.diyLevel}
                </Badge>
                {analysis.estimatedCost && (
                  <Badge variant="outline" className="text-xs shadow-none">
                    {analysis.estimatedCost}
                  </Badge>
                )}
              </div>

              {analysis.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{analysis.description}</p>
              )}

              {analysis.safetyWarning && (
                <div className="flex items-start gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 p-2 rounded border border-orange-100 dark:border-orange-800">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  {analysis.safetyWarning}
                </div>
              )}

              {contractorMode && !showDiyOverride && (
                <button
                  type="button"
                  onClick={() => setShowDiyOverride(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  data-testid="button-override-diy"
                >
                  <Wrench className="h-3 w-3" />
                  Override DIY level (Contractor Mode)
                </button>
              )}

              {contractorMode && showDiyOverride && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    DIY Override
                  </Label>
                  <Select value={diyOverride || analysis.diyLevel} onValueChange={(v) => setDiyOverride(v)}>
                    <SelectTrigger data-testid="select-task-diy-override" className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIY-Safe">DIY-Safe</SelectItem>
                      <SelectItem value="Caution">Caution</SelectItem>
                      <SelectItem value="Pro-Only">Pro-Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {analysisFailed && !analyzing && (
            <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                Couldn't analyze automatically — set details manually
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Priority</Label>
                  <Select value={manualUrgency} onValueChange={setManualUrgency}>
                    <SelectTrigger data-testid="select-task-urgency-manual" className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">Fix Now</SelectItem>
                      <SelectItem value="soon">Plan Soon</SelectItem>
                      <SelectItem value="later">Address Later</SelectItem>
                      <SelectItem value="monitor">Monitor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">DIY Level</Label>
                  <Select value={manualDiy} onValueChange={setManualDiy}>
                    <SelectTrigger data-testid="select-task-diy-manual" className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIY-Safe">DIY-Safe</SelectItem>
                      <SelectItem value="Caution">Caution</SelectItem>
                      <SelectItem value="Pro-Only">Pro-Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Est. Cost</Label>
                <Input
                  value={manualCost}
                  onChange={(e) => setManualCost(e.target.value)}
                  placeholder="e.g., $50-100"
                  className="h-8 text-sm"
                  data-testid="input-task-cost-manual"
                />
              </div>
            </div>
          )}

          {!analysisFailed && (
            <p className="text-xs text-muted-foreground">
              Priority, safety level, and cost estimate are determined automatically. {contractorMode ? "You can override DIY level in Contractor Mode." : "Enable Contractor Mode in Settings to override DIY level."}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || analyzing || (!analysis && !analysisFailed)} data-testid="button-save-task">
              {createMutation.isPending ? "Adding..." : "Add Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompleteTaskDialog({ isOpen, onClose, task, homeId }: { isOpen: boolean; onClose: () => void; task: V2Task | null; homeId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (task) {
      setCost("");
      setNotes("");
    }
  }, [task]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!task) return;
      await createLogEntry(homeId, {
        title: task.title,
        date: new Date().toISOString(),
        cost: cost ? Math.round(parseFloat(cost) * 100) : undefined,
        notes: notes || undefined,
      });
      await updateTask(task.id, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["logEntries"] });
      toast({ title: "Task completed!", description: "Nice work — this has been logged." });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Could not complete task.", variant: "destructive" });
    },
  });

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Complete: {task.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="complete-cost">What did it cost? (optional)</Label>
            <Input
              id="complete-cost"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              data-testid="input-complete-cost"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="complete-notes">Any notes? (optional)</Label>
            <Input
              id="complete-notes"
              placeholder="e.g., Hired ABC Plumbing, took 2 hours..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-complete-notes"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              onClick={() => { trackEvent('submit_form', 'dashboard', 'complete_task'); completeMutation.mutate(); }} 
              disabled={completeMutation.isPending}
              data-testid="button-confirm-complete"
            >
              {completeMutation.isPending ? "Saving..." : "Complete Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { hasSeenTour, showTour, tourKey, startTour, completeTour } = useTourState();
  const [showAddSystem, setShowAddSystem] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [completingTask, setCompletingTask] = useState<V2Task | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    enabled: isAuthenticated,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", home?.id],
    queryFn: () => getTasks(home!.id),
    enabled: !!home?.id,
  });

  const { data: systems = [] } = useQuery({
    queryKey: ["systems", home?.id],
    queryFn: () => getSystems(home!.id),
    enabled: !!home?.id,
  });

  const deleteMutation = useMutation({
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
    trackEvent('swipe', 'task', 'delete');
    deleteMutation.mutate(task.id);
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
    trackEvent('swipe', 'task', 'complete');
    swipeCompleteMutation.mutate(task);
    toast({ title: "Task completed!", description: `"${task.title}" marked as done.` });
  };

  useEffect(() => {
    if (!authLoading && !homeLoading && !home) {
      navigate("/onboarding");
    }
  }, [authLoading, homeLoading, home, navigate]);

  useEffect(() => {
    if (home && hasSeenTour === false && !showTour) {
      const timer = setTimeout(() => {
        startTour();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [home, hasSeenTour, showTour, startTour]);

  if (authLoading || homeLoading) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  if (!home) {
    return null;
  }

  const activeTasks = tasks.filter(t => t.status === "pending" || t.status === "scheduled");
  const highPriorityTasks = tasks.filter(t => t.urgency === "now" || t.urgency === "soon");
  
  const urgentTasksCount = tasks.filter(t => t.urgency === "now" && t.status !== "completed").length;
  const overdueTasksCount = tasks.filter(t => {
    if (!t.dueDate || t.status === "completed") return false;
    return new Date(t.dueDate) < new Date();
  }).length;
  const poorSystemsCount = systems.filter(s => s.condition === "Poor").length;

  const computedHealthScore = (() => {
    const stored = home.healthScore;
    if (stored && stored > 0) return stored;
    if (systems.length === 0) return 0;
    const conditionScores: Record<string, number> = {
      "Great": 100, "Good": 90, "Fair": 70, "Poor": 40, "Unknown": 80
    };
    const avg = systems.reduce((sum, s) => {
      return sum + (conditionScores[s.condition || "Unknown"] || 80);
    }, 0) / systems.length;
    const taskPenalty = Math.min(urgentTasksCount * 10 + overdueTasksCount * 5, 30);
    return Math.max(0, Math.round(avg - taskPenalty));
  })();

  return (
    <Layout>
      <OnboardingTour key={tourKey} isOpen={showTour} onComplete={() => { completeTour(); setShowAddSystem(true); }} />
      
      <div className="space-y-10">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-heading">
            Your Home
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeTasks.length > 0 
              ? `${activeTasks.length} task${activeTasks.length > 1 ? 's' : ''} need${activeTasks.length === 1 ? 's' : ''} attention`
              : "Everything looks good"
            }
          </p>
        </header>

        {/* At a Glance */}
        <section className="space-y-4" data-tour="home-status">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HomeHealth 
              score={computedHealthScore} 
              systemsCount={systems.length}
              tasksCount={activeTasks.length}
              urgentTasksCount={urgentTasksCount}
              overdueTasksCount={overdueTasksCount}
              poorSystemsCount={poorSystemsCount}
            />
            <HomeInfoCard home={home} systems={systems} />
          </div>
          
          {/* Quick Stats Row */}
          <div className="flex flex-wrap gap-4 text-sm" data-tour="quick-stats">
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
              <span className="text-muted-foreground">Next up:</span>
              <span className="font-medium" data-testid="text-next-service">
                {(() => {
                  const nextTask = tasks
                    .filter(t => t.status === "pending" || t.status === "scheduled")
                    .sort((a, b) => {
                      const order: Record<string, number> = { now: 0, soon: 1, later: 2, monitor: 3 };
                      return (order[a.urgency ?? ""] ?? 4) - (order[b.urgency ?? ""] ?? 4);
                    })[0];
                  return nextTask ? nextTask.title : "Nothing scheduled";
                })()}
              </span>
            </div>
            {highPriorityTasks.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded-full">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="font-medium">{highPriorityTasks.length} high priority</span>
              </div>
            )}
            <button 
              onClick={() => { trackEvent('click', 'dashboard', 'add_system'); setShowAddSystem(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full transition-colors"
              data-testid="button-add-system"
            >
              <Plus className="h-4 w-4" />
              <span>Add system</span>
            </button>
            <button 
              onClick={() => { trackEvent('click', 'dashboard', 'add_task'); setShowAddTask(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full transition-colors"
              data-testid="button-add-task"
            >
              <ListTodo className="h-4 w-4" />
              <span>Add task</span>
            </button>
          </div>
        </section>
        
        {/* Systems Summary */}
        <section data-tour="systems-section">
          <SystemsSummary systems={systems} onAddSystem={() => setShowAddSystem(true)} />
        </section>

        {/* Add System Wizard */}
        <AddSystemWizard 
          isOpen={showAddSystem} 
          onClose={() => setShowAddSystem(false)} 
          homeId={home.id}
          existingSystems={systems}
        />

        {/* Quick Add Task Dialog */}
        <QuickAddTaskDialog
          isOpen={showAddTask}
          onClose={() => setShowAddTask(false)}
          homeId={home.id}
        />

        {/* Complete Task Dialog */}
        <CompleteTaskDialog
          isOpen={!!completingTask}
          onClose={() => setCompletingTask(null)}
          task={completingTask}
          homeId={home.legacyId!}
        />

        {/* Tasks Section */}
        <section className="space-y-6" data-tour="maintenance-plan">
          <div className="flex justify-between items-baseline">
            <h2 className="text-lg font-heading font-semibold">Maintenance Plan</h2>
            <Link href="/maintenance-log">
              <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="button-view-plan">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          
          {tasks.length === 0 ? (
            <Card className="p-8">
              <div className="max-w-md mx-auto text-center">
                <h3 className="text-lg font-medium mb-2">No maintenance tasks yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Chat with your assistant to identify what needs attention, or add a task manually.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/chat">
                    <Button data-testid="button-start-chat">
                      Chat with Assistant
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => setShowAddTask(true)} data-testid="button-add-task-empty">
                    <ListTodo className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                  <Link href="/inspections">
                    <Button variant="outline" data-testid="button-upload-inspection">
                      Upload Report
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {["now", "soon", "later", "monitor"].map((urgency) => {
                const urgencyTasks = tasks.filter(t => t.urgency === urgency);
                if (urgencyTasks.length === 0) return null;

                const urgencyLabels: Record<string, string> = {
                  now: "Fix Now",
                  soon: "Plan Soon", 
                  later: "Address Later",
                  monitor: "Monitor"
                };

                return (
                  <div key={urgency} className="space-y-3">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        urgency === 'now' ? 'bg-red-500' : 
                        urgency === 'soon' ? 'bg-orange-500' : 
                        urgency === 'monitor' ? 'bg-blue-400' : 'bg-green-500'
                      }`} />
                      {urgencyLabels[urgency]}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {urgencyTasks.map((task) => (
                        <SwipeableTask
                          key={task.id}
                          onSwipeLeft={() => handleSwipeComplete(task)}
                          onSwipeRight={() => handleDeleteTask(task)}
                          disabled={task.status === "completed"}
                        >
                          <MaintenanceCard 
                            task={task} 
                            onComplete={(t) => setCompletingTask(t)}
                          />
                        </SwipeableTask>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Contractor Section */}
        {tasks.filter(t => t.diyLevel === "Pro-Only" && t.status !== "completed").length > 0 && (
          <section className="space-y-4" data-tour="find-pro">
            <ContractorSection homeId={home.id} pendingTasks={tasks} zipCode={home.zipCode || undefined} />
          </section>
        )}
        
        {/* Contractor Schedule */}
        <section className="space-y-4">
          <ContractorSchedule homeId={home.legacyId!} />
        </section>

        {/* Help link */}
        {hasSeenTour && (
          <div className="text-center pt-4">
            <button 
              onClick={() => { trackEvent('click', 'dashboard', 'restart_tour'); startTour(); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-restart-tour"
            >
              Need help? Take a quick tour
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
