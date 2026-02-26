import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Calendar, 
  DollarSign, 
  Wrench, 
  CheckCircle2,
  Clock,
  Building,
  FileText,
  ChevronRight,
  ClipboardList
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHome, getTasks, getSystems, getLogEntries, createLogEntry, updateTask } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, formatDistanceToNow } from "date-fns";
import type { V2Task, V2System } from "@/lib/api";
import type { MaintenanceLogEntry } from "@shared/schema";
import { trackEvent } from "@/lib/analytics";

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

export default function MaintenanceLog() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [selectedTask, setSelectedTask] = useState<V2Task | null>(null);

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

  const { data: logEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["logEntries", home?.id],
    queryFn: () => getLogEntries(home!.legacyId!),
    enabled: !!home?.id && !!home?.legacyId,
  });

  const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "scheduled");
  const completedTasks = tasks.filter(t => t.status === "completed");

  const systemsById = systems.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {} as Record<string, V2System>);

  const markDoneMutation = useMutation({
    mutationFn: async (task: V2Task) => {
      return updateTask(task.id, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Done!", description: "Task marked as complete." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not complete task.", variant: "destructive" });
    },
  });

  const handleCompleteTask = (task: V2Task) => {
    setSelectedTask(task);
    setShowAddEntry(true);
  };

  const handleMarkDone = (task: V2Task) => {
    trackEvent('click', 'maintenance_log', 'mark_done');
    markDoneMutation.mutate(task);
  };

  const totalSpent = logEntries.reduce((sum, e) => sum + (e.cost || 0), 0);

  if (homeLoading || (home && entriesLoading)) {
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
              Complete your home profile to start tracking your maintenance history.
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
              Track completed work and maintenance history
            </p>
          </div>
          <Button onClick={() => { trackEvent('click', 'maintenance_log', 'log_work'); setSelectedTask(null); setShowAddEntry(true); }} data-testid="button-add-entry">
            <Plus className="h-4 w-4 mr-2" />
            Log Work
          </Button>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-entries-count">{logEntries.length}</p>
                  <p className="text-xs text-muted-foreground">Entries Logged</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-spent">
                    ${(totalSpent / 100).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Spent</p>
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
                  <p className="text-2xl font-bold" data-testid="text-pending-count">{pendingTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Pending Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-systems-count">{systems.length}</p>
                  <p className="text-xs text-muted-foreground">Home Systems</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions: Mark Tasks Complete */}
        {pendingTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ready to Complete?</CardTitle>
              <CardDescription>Mark tasks as done and log the details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingTasks.slice(0, 5).map((task) => (
                  <div 
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.category} {task.estimatedCost && `• Est. ${task.estimatedCost}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleMarkDone(task)}
                        disabled={markDoneMutation.isPending}
                        data-testid={`button-mark-done-${task.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Mark Done
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => { trackEvent('click', 'maintenance_log', 'complete_task'); handleCompleteTask(task); }}
                        data-testid={`button-complete-task-${task.id}`}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Log Details
                      </Button>
                    </div>
                  </div>
                ))}
                {pendingTasks.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{pendingTasks.length - 5} more pending tasks
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Maintenance History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Maintenance History
            </CardTitle>
            <CardDescription>
              A timeline of all completed work on your home
            </CardDescription>
          </CardHeader>
          <CardContent>
            {entriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : logEntries.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No maintenance logged yet</h3>
                <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                  Start tracking your home maintenance by logging completed work. This helps you
                  keep records and plan future maintenance.
                </p>
                <Button onClick={() => setShowAddEntry(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Log First Entry
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Entry Dialog */}
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
        provider: "",
        notes: "",
      });
    } else {
      setFormData({
        title: "",
        date: format(new Date(), "yyyy-MM-dd"),
        systemId: "",
        cost: "",
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
          provider: data.provider || undefined,
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

          {systems.length > 0 && (
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
            <Label htmlFor="provider">Service Provider (optional)</Label>
            <Input
              id="provider"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              placeholder="e.g., ABC Plumbing, DIY..."
              data-testid="input-entry-provider"
            />
          </div>

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
