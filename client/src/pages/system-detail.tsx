import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Trash2,
  Home,
  Wind,
  Droplets,
  Zap,
  Square,
  Layers,
  Building,
  CookingPot,
  Flame,
  Trees,
  Bug,
  HelpCircle,
  ListTodo,
  FileText,
  FolderOpen,
  ClipboardList,
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHome, getSystems, getTasks, updateSystem, deleteSystem } from "@/lib/api";
import type { V2System, V2Task } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { systemConditions } from "@shared/schema";

const categoryIcons: Record<string, any> = {
  "Roof": Home,
  "HVAC": Wind,
  "Plumbing": Droplets,
  "Electrical": Zap,
  "Windows": Square,
  "Siding/Exterior": Layers,
  "Foundation": Building,
  "Appliances": CookingPot,
  "Water Heater": Flame,
  "Landscaping": Trees,
  "Pest": Bug,
  "Other": HelpCircle,
};

const taskStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  skipped: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const urgencyColors: Record<string, string> = {
  now: "bg-red-500",
  soon: "bg-orange-500",
  later: "bg-green-500",
  monitor: "bg-blue-400",
};

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48" />
      <Skeleton className="h-32" />
      <Skeleton className="h-24" />
    </div>
  );
}

export default function SystemDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [editNotes, setEditNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    enabled: isAuthenticated,
  });

  const { data: systems = [], isLoading: systemsLoading } = useQuery({
    queryKey: ["systems", home?.id],
    queryFn: () => getSystems(home!.id),
    enabled: !!home?.id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", home?.id],
    queryFn: () => getTasks(home!.id),
    enabled: !!home?.id,
  });

  const system = systems.find(s => String(s.id) === String(id));
  const relatedTasks = tasks.filter(t => t.relatedSystemId && String(t.relatedSystemId) === String(id));

  useEffect(() => {
    if (system) {
      trackEvent("system_instance_opened", "systems", system.category);
    }
  }, [system?.id]);

  useEffect(() => {
    if (system) {
      setEditData({
        name: system.name || "",
        make: system.make || "",
        model: system.model || "",
        installYear: system.installYear?.toString() || "",
        condition: system.condition || "Unknown",
        material: system.material || "",
        energyRating: system.energyRating || "",
        provider: system.provider || "",
        treatmentType: system.treatmentType || "",
        recurrenceInterval: system.recurrenceInterval || "",
        cadence: system.cadence || "",
      });
      setEditNotes(system.notes || "");
    }
  }, [system]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<V2System>) => updateSystem(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      setIsEditing(false);
      toast({ title: "System updated", description: "Changes saved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update system.", variant: "destructive" });
    },
  });

  const notesMutation = useMutation({
    mutationFn: (notes: string) => updateSystem(id!, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      setIsEditingNotes(false);
      toast({ title: "Notes saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save notes.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSystem(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      toast({ title: "System deleted", description: "The system has been removed." });
      navigate("/systems");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete system.", variant: "destructive" });
    },
  });

  const handleSaveEdit = () => {
    const payload: Partial<V2System> = {
      name: editData.name || undefined,
      make: editData.make || null,
      model: editData.model || null,
      installYear: editData.installYear ? parseInt(editData.installYear) : null,
      condition: editData.condition || null,
      material: editData.material || null,
      energyRating: editData.energyRating || null,
      provider: editData.provider || null,
      treatmentType: editData.treatmentType || null,
      recurrenceInterval: editData.recurrenceInterval || null,
      cadence: editData.cadence || null,
    };
    updateMutation.mutate(payload);
  };

  const handleCancelEdit = () => {
    if (system) {
      setEditData({
        name: system.name || "",
        make: system.make || "",
        model: system.model || "",
        installYear: system.installYear?.toString() || "",
        condition: system.condition || "Unknown",
        material: system.material || "",
        energyRating: system.energyRating || "",
        provider: system.provider || "",
        treatmentType: system.treatmentType || "",
        recurrenceInterval: system.recurrenceInterval || "",
        cadence: system.cadence || "",
      });
    }
    setIsEditing(false);
  };

  if (authLoading || homeLoading || systemsLoading) {
    return (
      <Layout>
        <DetailSkeleton />
      </Layout>
    );
  }

  if (!system) {
    return (
      <Layout>
        <div className="space-y-4">
          <Link href="/systems">
            <Button variant="ghost" size="sm" data-testid="button-back-systems">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Systems
            </Button>
          </Link>
          <Card className="p-8 text-center">
            <h2 className="text-lg font-medium mb-2">System not found</h2>
            <p className="text-muted-foreground text-sm">This system may have been deleted or doesn't exist.</p>
          </Card>
        </div>
      </Layout>
    );
  }

  const Icon = categoryIcons[system.category] || HelpCircle;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/systems">
            <Button variant="ghost" size="sm" data-testid="button-back-systems">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Systems
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" data-testid="button-delete-system">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {system.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this system. Related tasks will not be deleted but will no longer be linked to this system.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete System"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <header className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-system-name">
              {system.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" data-testid="badge-system-category">{system.category}</Badge>
              {system.entityType && (
                <Badge variant="outline" className="text-xs" data-testid="badge-entity-type">
                  {system.entityType === "service" ? "Service" : "Asset"}
                </Badge>
              )}
              {system.condition && system.condition !== "Unknown" && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    system.condition === "Great" ? "border-green-500 text-green-700 dark:text-green-400" :
                    system.condition === "Good" ? "border-blue-500 text-blue-700 dark:text-blue-400" :
                    system.condition === "Fair" ? "border-yellow-500 text-yellow-700 dark:text-yellow-400" :
                    system.condition === "Poor" ? "border-red-500 text-red-700 dark:text-red-400" : ""
                  }`}
                  data-testid="badge-condition"
                >
                  {system.condition}
                </Badge>
              )}
            </div>
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">System Details</CardTitle>
              {!isEditing ? (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-system">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid="button-save-system">
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      data-testid="input-edit-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-condition">Condition</Label>
                    <Select value={editData.condition} onValueChange={(v) => setEditData({ ...editData, condition: v })}>
                      <SelectTrigger data-testid="select-edit-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {systemConditions.map((cond) => (
                          <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-make">Make/Brand</Label>
                    <Input
                      id="edit-make"
                      value={editData.make}
                      onChange={(e) => setEditData({ ...editData, make: e.target.value })}
                      placeholder="e.g., Carrier, Lennox"
                      data-testid="input-edit-make"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-model">Model</Label>
                    <Input
                      id="edit-model"
                      value={editData.model}
                      onChange={(e) => setEditData({ ...editData, model: e.target.value })}
                      placeholder="Model number"
                      data-testid="input-edit-model"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-install-year">Install Year</Label>
                    <Input
                      id="edit-install-year"
                      type="number"
                      value={editData.installYear}
                      onChange={(e) => setEditData({ ...editData, installYear: e.target.value })}
                      placeholder="2015"
                      data-testid="input-edit-install-year"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-material">Material</Label>
                    <Input
                      id="edit-material"
                      value={editData.material}
                      onChange={(e) => setEditData({ ...editData, material: e.target.value })}
                      placeholder="e.g., Asphalt, Vinyl"
                      data-testid="input-edit-material"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-energy-rating">Energy Rating</Label>
                    <Input
                      id="edit-energy-rating"
                      value={editData.energyRating}
                      onChange={(e) => setEditData({ ...editData, energyRating: e.target.value })}
                      placeholder="e.g., SEER 16, Energy Star"
                      data-testid="input-edit-energy-rating"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-provider">Provider</Label>
                    <Input
                      id="edit-provider"
                      value={editData.provider}
                      onChange={(e) => setEditData({ ...editData, provider: e.target.value })}
                      placeholder="Service provider"
                      data-testid="input-edit-provider"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {system.make && (
                  <div>
                    <p className="text-muted-foreground text-xs">Make/Brand</p>
                    <p className="font-medium" data-testid="text-make">{system.make}</p>
                  </div>
                )}
                {system.model && (
                  <div>
                    <p className="text-muted-foreground text-xs">Model</p>
                    <p className="font-medium" data-testid="text-model">{system.model}</p>
                  </div>
                )}
                {system.installYear && (
                  <div>
                    <p className="text-muted-foreground text-xs">Install Year</p>
                    <p className="font-medium" data-testid="text-install-year">{system.installYear}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Condition</p>
                  <p className="font-medium" data-testid="text-condition">{system.condition || "Unknown"}</p>
                </div>
                {system.material && (
                  <div>
                    <p className="text-muted-foreground text-xs">Material</p>
                    <p className="font-medium" data-testid="text-material">{system.material}</p>
                  </div>
                )}
                {system.energyRating && (
                  <div>
                    <p className="text-muted-foreground text-xs">Energy Rating</p>
                    <p className="font-medium" data-testid="text-energy-rating">{system.energyRating}</p>
                  </div>
                )}
                {system.provider && (
                  <div>
                    <p className="text-muted-foreground text-xs">Provider</p>
                    <p className="font-medium" data-testid="text-provider">{system.provider}</p>
                  </div>
                )}
                {system.treatmentType && (
                  <div>
                    <p className="text-muted-foreground text-xs">Treatment Type</p>
                    <p className="font-medium" data-testid="text-treatment-type">{system.treatmentType}</p>
                  </div>
                )}
                {system.cadence && (
                  <div>
                    <p className="text-muted-foreground text-xs">Service Cadence</p>
                    <p className="font-medium" data-testid="text-cadence">{system.cadence}</p>
                  </div>
                )}
                {system.recurrenceInterval && (
                  <div>
                    <p className="text-muted-foreground text-xs">Recurrence</p>
                    <p className="font-medium" data-testid="text-recurrence">{system.recurrenceInterval}</p>
                  </div>
                )}
                {system.warrantyExpiry && (
                  <div>
                    <p className="text-muted-foreground text-xs">Warranty Expires</p>
                    <p className="font-medium" data-testid="text-warranty">{new Date(system.warrantyExpiry).toLocaleDateString()}</p>
                  </div>
                )}
                {system.lastServiceDate && (
                  <div>
                    <p className="text-muted-foreground text-xs">Last Service</p>
                    <p className="font-medium" data-testid="text-last-service">{new Date(system.lastServiceDate).toLocaleDateString()}</p>
                  </div>
                )}
                {system.nextServiceDate && (
                  <div>
                    <p className="text-muted-foreground text-xs">Next Service</p>
                    <p className="font-medium" data-testid="text-next-service">{new Date(system.nextServiceDate).toLocaleDateString()}</p>
                  </div>
                )}
                {system.source && (
                  <div>
                    <p className="text-muted-foreground text-xs">Source</p>
                    <p className="font-medium" data-testid="text-source">{system.source}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </CardTitle>
              {!isEditingNotes ? (
                <Button variant="ghost" size="sm" onClick={() => { setEditNotes(system.notes || ""); setIsEditingNotes(true); }} data-testid="button-edit-notes">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(false)} data-testid="button-cancel-notes">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => notesMutation.mutate(editNotes)} disabled={notesMutation.isPending} data-testid="button-save-notes">
                    <Save className="h-4 w-4 mr-2" />
                    {notesMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingNotes ? (
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes about this system (serial number, warranty info, service history, etc.)"
                rows={4}
                data-testid="textarea-notes"
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-notes">
                {system.notes || "No notes yet. Click Edit to add notes about this system."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Related Tasks
              {relatedTasks.length > 0 && (
                <Badge variant="secondary" className="ml-2" data-testid="badge-task-count">{relatedTasks.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {relatedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-tasks">
                No tasks linked to this system yet.
              </p>
            ) : (
              <div className="space-y-3">
                {relatedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    data-testid={`card-task-${task.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${urgencyColors[task.urgency || "later"] || "bg-gray-400"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-task-title-${task.id}`}>{task.title}</p>
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${taskStatusColors[task.status] || taskStatusColors.pending}`} data-testid={`badge-task-status-${task.id}`}>
                        {task.status}
                      </span>
                      {task.estimatedCost && (
                        <span className="text-xs text-muted-foreground">{task.estimatedCost}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Maintenance History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground" data-testid="text-no-history">
              View past work on this system in your{" "}
              <Link href="/maintenance-log" className="text-primary hover:underline" data-testid="link-maintenance-log">
                Maintenance Log
              </Link>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground" data-testid="text-no-documents">
              No documents linked to this system yet. Upload documents from the{" "}
              <Link href="/documents" className="text-primary hover:underline" data-testid="link-documents">
                Documents
              </Link>{" "}
              page.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}