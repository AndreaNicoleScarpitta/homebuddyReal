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
  Landmark,
  CheckCircle2,
  Paintbrush,
  Plus,
  Palette,
  Wrench,
  Sparkles,
  Brain,
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHome, getSystems, getTasks, updateSystem, deleteSystem, updateTask, createLogEntry } from "@/lib/api";
import type { V2System, V2Task } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent, trackSlugPageView, trackModalOpen } from "@/lib/analytics";
import { PAGE_SLUGS, MODAL_SLUGS } from "@/lib/slug-registry";
import { systemConditions } from "@shared/schema";
import { CircuitMapDialog } from "@/components/circuit-map";
import { ComponentList } from "@/components/home-graph/component-list";
import { WarrantySection } from "@/components/home-graph/warranty-card";
import { RecommendationCard } from "@/components/home-graph/recommendation-card";
import { getRepairs, getRecommendations, getSystemInsight, type V2Repair, type V2Recommendation, type SystemInsightResponse } from "@/lib/api";
import { RecordActionDialog, RecordOutcomeDialog } from "@/components/learning/outcome-prompt";

const categoryIcons: Record<string, any> = {
  "Roof": Home,
  "HVAC": Wind,
  "Plumbing": Droplets,
  "Electrical": Zap,
  "Windows": Square,
  "Siding/Exterior": Layers,
  "Foundation": Building,
  "Chimney": Landmark,
  "Appliances": CookingPot,
  "Water Heater": Flame,
  "Landscaping": Trees,
  "Pest": Bug,
  "Paint": Paintbrush,
  "Other": HelpCircle,
};

const notesPlaceholders: Record<string, string> = {
  "Roof": "e.g., GAF Timberline HDZ in Charcoal, 30-year warranty, installed by ABC Roofing...",
  "HVAC": "e.g., Serial #XYZ123, 10-year parts warranty with Carrier, last serviced 6/2024...",
  "Plumbing": "e.g., Copper pipes throughout, PEX in the addition, main shutoff in garage...",
  "Electrical": "e.g., 200-amp panel, Siemens breakers, whole-home surge protector installed...",
  "Windows": "e.g., Andersen 400 Series, double-hung, Low-E glass, lifetime warranty...",
  "Siding/Exterior": "e.g., James Hardie HardiePlank in Arctic White, 30-year warranty...",
  "Foundation": "e.g., Poured concrete, sealed in 2020, French drain on east side...",
  "Chimney": "e.g., Clay flue liner, stainless steel cap, last swept 10/2024, no cracks found...",
  "Appliances": "e.g., Serial #ABC456, purchased from Home Depot, extended warranty until 2027...",
  "Water Heater": "e.g., 50-gallon tank, Serial #WH789, anode rod replaced 2023...",
  "Landscaping": "e.g., Rain Bird irrigation, 6 zones, winterized each November...",
  "Pest": "e.g., Contract #12345, quarterly treatments, termite bond renewal date 3/2026...",
  "Paint": "e.g., Sherwin-Williams Agreeable Gray SW 7029 in living room, Benjamin Moore White Dove OC-17 for trim...",
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

interface PaintColor {
  room: string;
  wall: string;
  color: string;
  hex: string;
}

function parsePaintData(notes: string | null | undefined): { colors: PaintColor[]; textNotes: string } {
  if (!notes) return { colors: [], textNotes: "" };
  try {
    const parsed = JSON.parse(notes);
    const colors: PaintColor[] = [];
    if (parsed?.paintColors && Array.isArray(parsed.paintColors)) {
      for (const entry of parsed.paintColors) {
        if (entry && typeof entry === "object") {
          colors.push({
            room: typeof entry.room === "string" ? entry.room : (typeof entry.name === "string" ? entry.name : ""),
            wall: typeof entry.wall === "string" ? entry.wall : "",
            color: typeof entry.color === "string" && !entry.color.startsWith("#") ? entry.color : (typeof entry.brand === "string" ? entry.brand : ""),
            hex: typeof entry.hex === "string" ? entry.hex : (typeof entry.color === "string" && entry.color.startsWith("#") ? entry.color : (typeof entry.code === "string" ? entry.code : "")),
          });
        }
      }
    }
    const textNotes = typeof parsed?.textNotes === "string" ? parsed.textNotes : "";
    return { colors, textNotes };
  } catch {
    return { colors: [], textNotes: notes || "" };
  }
}

function serializePaintData(colors: PaintColor[], textNotes: string): string {
  return JSON.stringify({ paintColors: colors, textNotes });
}

export default function SystemDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { trackSlugPageView(PAGE_SLUGS.systemDetail); }, []);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [editNotes, setEditNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showCircuitMap, setShowCircuitMap] = useState(false);
  const [paintColors, setPaintColors] = useState<PaintColor[]>([]);
  const [paintTextNotes, setPaintTextNotes] = useState("");
  const [newPaintEntry, setNewPaintEntry] = useState<PaintColor>({ room: "", wall: "", color: "", hex: "" });

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

  const homeId = home?.legacyId || home?.id;

  const { data: repairs = [] } = useQuery({
    queryKey: ["repairs", homeId],
    queryFn: () => getRepairs(homeId!),
    enabled: !!homeId,
  });

  const { data: allRecommendations = [] } = useQuery({
    queryKey: ["recommendations", homeId],
    queryFn: () => getRecommendations(homeId!),
    enabled: !!homeId,
  });

  const { data: systemInsight } = useQuery({
    queryKey: ["systemInsight", id],
    queryFn: () => getSystemInsight(id!),
    enabled: !!id,
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
      if (system.category === "Paint") {
        const { colors, textNotes } = parsePaintData(system.notes);
        setPaintColors(colors);
        setPaintTextNotes(textNotes);
        setEditNotes(textNotes);
      } else {
        setEditNotes(system.notes || "");
      }
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
    mutationFn: (text: string) => {
      if (system?.category === "Paint") {
        const notes = serializePaintData(paintColors, text);
        setPaintTextNotes(text);
        return updateSystem(id!, { notes });
      }
      return updateSystem(id!, { notes: text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      setIsEditingNotes(false);
      toast({ title: "Notes saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save notes.", variant: "destructive" });
    },
  });

  const paintMutation = useMutation({
    mutationFn: (colors: PaintColor[]) => {
      const notes = serializePaintData(colors, paintTextNotes);
      return updateSystem(id!, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      toast({ title: "Paint colors saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save paint colors.", variant: "destructive" });
    },
  });

  const handleAddPaintColor = () => {
    const hasAnyField = newPaintEntry.room.trim() || newPaintEntry.wall.trim() || newPaintEntry.color.trim() || newPaintEntry.hex.trim();
    if (!hasAnyField) {
      toast({ title: "Empty row", description: "Fill in at least one field.", variant: "destructive" });
      return;
    }
    const updated = [...paintColors, {
      room: newPaintEntry.room.trim(),
      wall: newPaintEntry.wall.trim(),
      color: newPaintEntry.color.trim(),
      hex: newPaintEntry.hex.trim(),
    }];
    setPaintColors(updated);
    paintMutation.mutate(updated);
    setNewPaintEntry({ room: "", wall: "", color: "", hex: "" });
  };

  const handleRemovePaintColor = (index: number) => {
    const updated = paintColors.filter((_, i) => i !== index);
    setPaintColors(updated);
    paintMutation.mutate(updated);
  };

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

  const completeTaskMutation = useMutation({
    mutationFn: async (task: V2Task) => {
      if (home?.legacyId) {
        await createLogEntry(home.legacyId, {
          title: task.title,
          date: new Date().toISOString(),
        });
      }
      await updateTask(task.id, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["logEntries"] });
      toast({ title: "Task completed!", description: "Nice work — this has been logged." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not complete task.", variant: "destructive" });
    },
  });

  const handleCompleteRelatedTask = (task: V2Task) => {
    trackEvent('click', 'system_detail', 'complete_related_task');
    completeTaskMutation.mutate(task);
  };

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
          <AlertDialog onOpenChange={(open) => { if (open) trackModalOpen(MODAL_SLUGS.deleteSystem); }}>
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
                <Button variant="ghost" size="sm" onClick={() => { setEditNotes(system.category === "Paint" ? paintTextNotes : (system.notes || "")); setIsEditingNotes(true); }} data-testid="button-edit-notes">
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
                placeholder={notesPlaceholders[system.category] || "Add notes about this system (serial number, warranty info, service history, etc.)"}
                rows={5}
                data-testid="textarea-notes"
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-notes">
                {(system.category === "Paint" ? paintTextNotes : system.notes) || "No notes yet. Click Edit to add notes about this system."}
              </p>
            )}
          </CardContent>
        </Card>

        {system.category === "Electrical" && home?.id && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Circuit Panel Map</p>
                    <p className="text-xs text-muted-foreground">
                      Map your breakers for quick reference during outages
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    trackEvent("circuit_map_opened", "system_detail", "electrical");
                    setShowCircuitMap(true);
                  }}
                  data-testid="button-open-circuit-map"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showCircuitMap && home?.id && (
          <CircuitMapDialog
            homeId={home.id}
            systemId={system.id}
            isOpen={showCircuitMap}
            onClose={() => setShowCircuitMap(false)}
          />
        )}

        {system.category === "Paint" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Add Paint Colors
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto" data-testid="paint-colors-table">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Room</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Wall</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Color</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Hex</th>
                      <th className="w-8 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paintColors.map((entry, index) => (
                      // Composite key: deleting a row would otherwise shift index keys
                      // onto the wrong DOM nodes — content + index is stable enough.
                      <tr key={`${entry.room}|${entry.wall}|${entry.hex}|${index}`} className="group border-b border-border/50 hover:bg-muted/30" data-testid={`paint-color-row-${index}`}>
                        <td className="py-2 pr-3" data-testid={`text-paint-room-${index}`}>{entry.room || <span className="text-muted-foreground/50">—</span>}</td>
                        <td className="py-2 pr-3" data-testid={`text-paint-wall-${index}`}>{entry.wall || <span className="text-muted-foreground/50">—</span>}</td>
                        <td className="py-2 pr-3" data-testid={`text-paint-color-${index}`}>{entry.color || <span className="text-muted-foreground/50">—</span>}</td>
                        <td className="py-2 pr-3 font-mono text-xs" data-testid={`text-paint-hex-${index}`}>{entry.hex || <span className="text-muted-foreground/50">—</span>}</td>
                        <td className="py-2">
                          <button
                            onClick={() => handleRemovePaintColor(index)}
                            className="h-6 w-6 rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            data-testid={`button-remove-paint-${index}`}
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b border-dashed border-primary/20" data-testid="paint-new-row">
                      <td className="py-2 pr-2">
                        <Input
                          value={newPaintEntry.room}
                          onChange={(e) => setNewPaintEntry({ ...newPaintEntry, room: e.target.value })}
                          placeholder="e.g., Living Room"
                          className="h-8 text-sm"
                          data-testid="input-paint-room"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          value={newPaintEntry.wall}
                          onChange={(e) => setNewPaintEntry({ ...newPaintEntry, wall: e.target.value })}
                          placeholder="e.g., Accent Wall"
                          className="h-8 text-sm"
                          data-testid="input-paint-wall"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          value={newPaintEntry.color}
                          onChange={(e) => setNewPaintEntry({ ...newPaintEntry, color: e.target.value })}
                          placeholder="e.g., Veranda White"
                          className="h-8 text-sm"
                          data-testid="input-paint-color"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          value={newPaintEntry.hex}
                          onChange={(e) => setNewPaintEntry({ ...newPaintEntry, hex: e.target.value })}
                          placeholder="e.g., #f5e6d3"
                          className="h-8 text-sm font-mono"
                          data-testid="input-paint-hex"
                        />
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={handleAddPaintColor}
                          disabled={paintMutation.isPending}
                          data-testid="button-add-paint-row"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {paintColors.length === 0 && (
                <p className="text-xs text-muted-foreground mt-3" data-testid="text-no-paint-colors">
                  Fill in any fields above and click + to add a row.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
                {relatedTasks.map((task) => {
                  const isDone = task.status === "completed" || task.state === "completed";
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                      data-testid={`card-task-${task.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${urgencyColors[task.urgency || "later"] || "bg-gray-400"}`} />
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isDone ? "line-through text-muted-foreground" : ""}`} data-testid={`text-task-title-${task.id}`}>{task.title}</p>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground">
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </p>
                          )}
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isDone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCompleteRelatedTask(task)}
                            data-testid={`button-complete-task-${task.id}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Done
                          </Button>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${taskStatusColors[task.status] || taskStatusColors.pending}`} data-testid={`badge-task-status-${task.id}`}>
                          {task.status}
                        </span>
                        {task.estimatedCost && (
                          <span className="text-xs text-muted-foreground">{task.estimatedCost}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
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

        {systemInsight && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                System Intelligence
                <Badge variant="outline" className={`text-xs ml-auto ${
                  systemInsight.insight.conditionStatus === "good" ? "bg-green-100 text-green-700" :
                  systemInsight.insight.conditionStatus === "watch" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {systemInsight.insight.conditionStatus === "good" ? "Good" :
                   systemInsight.insight.conditionStatus === "watch" ? "Watch" : "At Risk"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {systemInsight.insight.keyFindings.length > 0 && (
                <div className="space-y-1">
                  {systemInsight.insight.keyFindings.map((f, i) => (
                    <p key={i} className="text-sm text-muted-foreground">· {f}</p>
                  ))}
                </div>
              )}
              {systemInsight.prediction && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">12-month risk</p>
                    <p className="text-lg font-semibold">{Math.round(systemInsight.prediction.failureProbability12Months * 100)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">24-month risk</p>
                    <p className="text-lg font-semibold">{Math.round(systemInsight.prediction.failureProbability24Months * 100)}%</p>
                  </div>
                </div>
              )}
              {systemInsight.costProjection && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Estimated costs</p>
                  <p className="text-sm">Repair: ${Math.round(systemInsight.costProjection.repairCostRange[0]/100).toLocaleString()}–${Math.round(systemInsight.costProjection.repairCostRange[1]/100).toLocaleString()}</p>
                  <p className="text-sm">Replace: ${Math.round(systemInsight.costProjection.replacementCostRange[0]/100).toLocaleString()}–${Math.round(systemInsight.costProjection.replacementCostRange[1]/100).toLocaleString()}</p>
                </div>
              )}
              {systemInsight.inactionInsight && (
                <div className="pt-2 border-t bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-3 -mx-1">
                  <p className="text-sm">{systemInsight.inactionInsight.riskSummary}</p>
                  <p className="text-xs text-muted-foreground mt-1">Recommended action {systemInsight.inactionInsight.recommendedActionWindow}</p>
                </div>
              )}
              {systemInsight.insight.missingDataSignals.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">For better insights:</p>
                  {systemInsight.insight.missingDataSignals.map((s, i) => (
                    <p key={i} className="text-xs text-blue-600">· {s}</p>
                  ))}
                </div>
              )}
              {homeId && (
                <div className="flex gap-2 mt-3">
                  <RecordActionDialog homeId={homeId} systemId={system?.legacyId || Number(id)} systemName={system?.name} />
                  <RecordOutcomeDialog homeId={homeId} systemId={system?.legacyId || Number(id)} systemName={system?.name} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {homeId && (
          <Card>
            <CardContent className="pt-6">
              <ComponentList systemId={id!} homeId={homeId} />
            </CardContent>
          </Card>
        )}

        {homeId && (
          <Card>
            <CardContent className="pt-6">
              <WarrantySection homeId={homeId} systemId={system?.legacyId || id} />
            </CardContent>
          </Card>
        )}

        {homeId && (() => {
          const legacySystemId = system?.legacyId || id;
          const systemRepairs = repairs.filter(r => r.systemId != null && String(r.systemId) === String(legacySystemId));
          return systemRepairs.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Repair History ({systemRepairs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemRepairs.map((repair) => (
                    <div key={repair.id} className="flex items-start justify-between p-3 rounded-lg border bg-card">
                      <div>
                        <p className="font-medium text-sm">{repair.title}</p>
                        {repair.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{repair.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {repair.repairDate && <span>{new Date(repair.repairDate).toLocaleDateString()}</span>}
                          {repair.cost != null && repair.cost > 0 && <span className="font-medium text-foreground">${(repair.cost / 100).toLocaleString()}</span>}
                          {repair.outcome && <Badge variant="outline" className="text-xs capitalize">{repair.outcome}</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}

        {homeId && (() => {
          const legacySystemIdForRecs = system?.legacyId || id;
          const systemRecs = allRecommendations.filter(r => r.systemId != null && String(r.systemId) === String(legacySystemIdForRecs));
          return systemRecs.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Recommendations ({systemRecs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {systemRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} homeId={homeId} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}
      </div>
    </Layout>
  );
}