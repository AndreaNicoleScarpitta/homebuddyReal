import { Layout } from "@/components/layout";
import { HomeHealth } from "@/components/home-health";
import { HomeInfoCard } from "@/components/home-info-card";
import { MaintenanceCard } from "@/components/maintenance-card";
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
import { Plus, ArrowRight, ListTodo, CheckCircle2 } from "lucide-react";
import { FieldTooltip } from "@/components/field-tooltip";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHome, getTasks, getSystems, createTask, updateTask, createLogEntry } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
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
  const [formData, setFormData] = useState({
    title: "",
    urgency: "soon",
    category: "",
    diyLevel: "DIY-Safe",
    estimatedCost: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => createTask(homeId, {
      title: data.title,
      urgency: data.urgency as any,
      category: data.category || undefined,
      diyLevel: data.diyLevel as any,
      estimatedCost: data.estimatedCost || undefined,
      status: "pending",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Task added", description: "Your maintenance task has been created." });
      onClose();
      setFormData({ title: "", urgency: "soon", category: "", diyLevel: "DIY-Safe", estimatedCost: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not create task.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({ title: "Error", description: "Please enter a task name.", variant: "destructive" });
      return;
    }
    trackEvent('submit_form', 'dashboard', 'quick_add_task');
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Maintenance Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">What needs to be done?</Label>
            <Input
              id="task-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Replace furnace filter, Clean gutters..."
              data-testid="input-task-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">Priority <FieldTooltip termSlug="urgency-soon" screenName="dashboard" /></Label>
              <Select value={formData.urgency} onValueChange={(v) => setFormData({ ...formData, urgency: v })}>
                <SelectTrigger data-testid="select-task-urgency">
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1">DIY Level <FieldTooltip termSlug="diy-level-safe" screenName="dashboard" /></Label>
              <Select value={formData.diyLevel} onValueChange={(v) => setFormData({ ...formData, diyLevel: v })}>
                <SelectTrigger data-testid="select-task-diy">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1">Est. Cost <FieldTooltip termSlug="estimated-cost" screenName="dashboard" /></Label>
              <Input
                value={formData.estimatedCost}
                onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                placeholder="e.g., $50-100"
                data-testid="input-task-cost"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-task">
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
                      return (order[a.urgency] ?? 4) - (order[b.urgency] ?? 4);
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
                        <MaintenanceCard 
                          key={task.id} 
                          task={task} 
                          onComplete={(t) => setCompletingTask(t)}
                        />
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
