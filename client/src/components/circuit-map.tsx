import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Zap,
  Camera,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Sparkles,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCircuitMaps,
  createCircuitMap,
  updateCircuitMap,
  deleteCircuitMap,
  analyzeCircuitPanel,
} from "@/lib/api";
import type { Breaker, CircuitMap as CircuitMapType } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PhotoConsentModal, usePhotoConsent } from "@/components/photo-consent-modal";
import { trackEvent } from "@/lib/analytics";

type FlowState = "idle" | "capturing" | "analyzing" | "annotating" | "saved";

const ROOMS = [
  "",
  "Kitchen",
  "Living Room",
  "Dining Room",
  "Master Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Bedroom 4",
  "Bathroom",
  "Master Bath",
  "Laundry",
  "Garage",
  "Basement",
  "Attic",
  "Office",
  "Hallway",
  "Exterior",
  "HVAC",
  "Water Heater",
  "Pool/Spa",
  "Workshop",
  "Other",
];

interface CircuitMapProps {
  homeId: string;
  systemId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CircuitMapDialog({ homeId, systemId, isOpen, onClose }: CircuitMapProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasConsented, grantConsent } = usePhotoConsent();
  const [showConsent, setShowConsent] = useState(false);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [breakers, setBreakers] = useState<Breaker[]>([]);
  const [storeImage, setStoreImage] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: circuitMaps = [], isLoading } = useQuery({
    queryKey: ["circuitMaps", homeId],
    queryFn: () => getCircuitMaps(homeId),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: { breakers: Breaker[]; imageUrl?: string; storeImage: boolean }) =>
      createCircuitMap(homeId, { systemId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circuitMaps", homeId] });
      toast({ title: "Circuit map saved", description: `${breakers.length} breaker${breakers.length !== 1 ? "s" : ""} mapped.` });
      trackEvent("circuit_map_saved", "circuit_map", `breakers_${breakers.length}`);
      resetFlow();
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save circuit map.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { mapId: string; breakers: Breaker[]; storeImage?: boolean }) =>
      updateCircuitMap(data.mapId, { breakers: data.breakers, storeImage: data.storeImage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circuitMaps", homeId] });
      toast({ title: "Circuit map updated", description: "Your breaker annotations have been saved." });
      trackEvent("circuit_map_saved", "circuit_map", "updated");
      resetFlow();
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update circuit map.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCircuitMap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circuitMaps", homeId] });
      toast({ title: "Circuit map deleted" });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete circuit map.", variant: "destructive" });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: analyzeCircuitPanel,
    onSuccess: (result) => {
      const mappedBreakers = (result.breakers || []).map((b: any) => ({
        number: b.number || 1,
        label: b.label || "",
        room: b.room || "",
        notes: b.notes || "",
        amperage: b.amperage,
      }));
      setBreakers(mappedBreakers.length > 0 ? mappedBreakers : getDefaultBreakers());
      setAiConfidence(result.confidence);
      setAiNotes(result.notes || null);
      setFlowState("annotating");
      trackEvent("circuit_map_photo_captured", "circuit_map", `confidence_${Math.round(result.confidence * 100)}`);
    },
    onError: () => {
      toast({
        title: "Analysis unavailable",
        description: "You can still map breakers manually.",
      });
      setBreakers(getDefaultBreakers());
      setFlowState("annotating");
    },
  });

  function getDefaultBreakers(): Breaker[] {
    return Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      label: "",
      room: "",
      notes: "",
    }));
  }

  function resetFlow() {
    setFlowState("idle");
    setBreakers([]);
    setImageBase64(null);
    setImageUrl(null);
    setStoreImage(false);
    setAiConfidence(null);
    setAiNotes(null);
    setEditingMapId(null);
  }

  const handleStartCapture = useCallback(() => {
    trackEvent("circuit_map_started", "circuit_map");
    if (!hasConsented) {
      setShowConsent(true);
      return;
    }
    setFlowState("capturing");
  }, [hasConsented]);

  const handleConsentAccepted = useCallback(() => {
    grantConsent();
    setShowConsent(false);
    setFlowState("capturing");
  }, [grantConsent]);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 10MB.", variant: "destructive" });
      return;
    }

    setFlowState("analyzing");

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImageBase64(base64);
      analyzeMutation.mutate(base64);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [analyzeMutation, toast]);

  const handleSkipAI = useCallback(() => {
    trackEvent("circuit_map_started", "circuit_map", "manual");
    setBreakers(getDefaultBreakers());
    setFlowState("annotating");
  }, []);

  const handleEditExisting = useCallback((map: CircuitMapType) => {
    setEditingMapId(map.id);
    setBreakers(map.breakers.length > 0 ? [...map.breakers] : getDefaultBreakers());
    setStoreImage(map.storeImage);
    setFlowState("annotating");
  }, []);

  const updateBreaker = useCallback((index: number, field: keyof Breaker, value: string | number) => {
    setBreakers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    if (field === "label" || field === "room") {
      trackEvent("breaker_annotation_added", "circuit_map", field);
    }
  }, []);

  const addBreaker = useCallback(() => {
    setBreakers(prev => [
      ...prev,
      { number: prev.length + 1, label: "", room: "", notes: "" },
    ]);
  }, []);

  const removeBreaker = useCallback((index: number) => {
    setBreakers(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((b, i) => ({ ...b, number: i + 1 }));
    });
  }, []);

  const handleSave = useCallback(() => {
    const validBreakers = breakers.filter(b => b.label || b.room);
    if (validBreakers.length === 0) {
      toast({ title: "No breakers labeled", description: "Label at least one breaker before saving.", variant: "destructive" });
      return;
    }

    if (editingMapId) {
      updateMutation.mutate({ mapId: editingMapId, breakers, storeImage });
    } else {
      createMutation.mutate({
        breakers,
        imageUrl: storeImage && imageBase64 ? imageBase64 : undefined,
        storeImage,
      });
    }
  }, [breakers, editingMapId, storeImage, imageBase64, createMutation, updateMutation, toast]);

  const handleAbandon = useCallback(() => {
    trackEvent("circuit_map_abandoned", "circuit_map", flowState);
    resetFlow();
  }, [flowState]);

  const handleClose = useCallback(() => {
    if (flowState !== "idle" && flowState !== "saved") {
      trackEvent("circuit_map_abandoned", "circuit_map", flowState);
    }
    resetFlow();
    onClose();
  }, [flowState, onClose]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] h-[90vh] sm:h-auto flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-circuit-map-title">
              <Zap className="h-5 w-5 text-primary" />
              Circuit Panel Map
            </DialogTitle>
            <DialogDescription>
              Map your breaker panel for quick reference during outages or maintenance.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {flowState === "idle" && (
              <IdleView
                circuitMaps={circuitMaps}
                isLoading={isLoading}
                onStartCapture={handleStartCapture}
                onSkipAI={handleSkipAI}
                onEdit={handleEditExisting}
                onDelete={(id) => setDeleteTarget(id)}
              />
            )}

            {flowState === "capturing" && (
              <CapturingView
                fileInputRef={fileInputRef}
                onFileSelected={handleFileSelected}
                onSkipAI={handleSkipAI}
                onCancel={handleAbandon}
              />
            )}

            {flowState === "analyzing" && <AnalyzingView />}

            {flowState === "annotating" && (
              <AnnotatingView
                breakers={breakers}
                storeImage={storeImage}
                hasImage={!!imageBase64}
                aiConfidence={aiConfidence}
                aiNotes={aiNotes}
                isSaving={isSaving}
                isEditing={!!editingMapId}
                onUpdateBreaker={updateBreaker}
                onAddBreaker={addBreaker}
                onRemoveBreaker={removeBreaker}
                onStoreImageChange={setStoreImage}
                onSave={handleSave}
                onCancel={handleAbandon}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PhotoConsentModal
        isOpen={showConsent}
        onAccept={handleConsentAccepted}
        onCancel={() => setShowConsent(false)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete circuit map?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this breaker mapping. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-map">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-map"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function IdleView({
  circuitMaps,
  isLoading,
  onStartCapture,
  onSkipAI,
  onEdit,
  onDelete,
}: {
  circuitMaps: CircuitMapType[];
  isLoading: boolean;
  onStartCapture: () => void;
  onSkipAI: () => void;
  onEdit: (map: CircuitMapType) => void;
  onDelete: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {circuitMaps.length > 0 ? (
        <div className="space-y-3">
          {circuitMaps.map((map) => (
            <Card key={map.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm" data-testid={`text-map-breaker-count-${map.id}`}>
                        {map.breakers.length} breaker{map.breakers.length !== 1 ? "s" : ""} mapped
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {map.updatedAt ? new Date(map.updatedAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(map)}
                      data-testid={`button-edit-map-${map.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(map.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-map-${map.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {map.breakers.slice(0, 6).map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-xs px-2 py-1 bg-muted/50 rounded"
                    >
                      <Badge variant="outline" className="h-5 w-5 p-0 justify-center text-[10px] shrink-0">
                        {b.number}
                      </Badge>
                      <span className="truncate">{b.label || b.room || "—"}</span>
                    </div>
                  ))}
                  {map.breakers.length > 6 && (
                    <div className="text-xs text-muted-foreground px-2 py-1">
                      +{map.breakers.length - 6} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 space-y-3">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-medium">No circuit map yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Photograph your breaker panel and label each circuit. Helpful during outages or when planning electrical work.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onStartCapture} className="flex-1" data-testid="button-map-circuit-panel">
          <Camera className="h-4 w-4 mr-2" />
          {circuitMaps.length > 0 ? "Add Another Map" : "Map Circuit Panel"}
        </Button>
        <Button variant="outline" onClick={onSkipAI} className="flex-1" data-testid="button-manual-entry">
          <Plus className="h-4 w-4 mr-2" />
          Enter Manually
        </Button>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Your breaker data is stored as structured annotations only. Photos are optional and require your explicit consent.
        </p>
      </div>
    </div>
  );
}

function CapturingView({
  fileInputRef,
  onFileSelected,
  onSkipAI,
  onCancel,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSkipAI: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-4">
        <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Camera className="h-10 w-10 text-primary" />
        </div>
        <div>
          <p className="font-medium">Take a photo of your breaker panel</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Open the panel cover and capture the full face of the breakers. Good lighting helps the AI identify labels.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileSelected}
          className="hidden"
          data-testid="input-circuit-photo"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-14 text-base"
          data-testid="button-take-photo"
        >
          <Camera className="h-5 w-5 mr-2" />
          Take Photo or Choose Image
        </Button>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onSkipAI} className="flex-1" data-testid="button-skip-ai">
            Skip — Enter Manually
          </Button>
          <Button variant="ghost" onClick={onCancel} className="flex-1" data-testid="button-cancel-capture">
            Cancel
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" />
        <p>
          AI analysis provides suggestions only. Always verify breaker labels against your actual panel. This is not a substitute for a licensed electrician.
        </p>
      </div>
    </div>
  );
}

function AnalyzingView() {
  return (
    <div className="space-y-6 py-8">
      <div className="text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="font-medium">Analyzing your breaker panel...</p>
          <p className="text-sm text-muted-foreground mt-1">
            Identifying breakers, labels, and amperage ratings.
          </p>
        </div>
      </div>
      <div className="space-y-3 max-w-sm mx-auto">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    </div>
  );
}

function AnnotatingView({
  breakers,
  storeImage,
  hasImage,
  aiConfidence,
  aiNotes,
  isSaving,
  isEditing,
  onUpdateBreaker,
  onAddBreaker,
  onRemoveBreaker,
  onStoreImageChange,
  onSave,
  onCancel,
}: {
  breakers: Breaker[];
  storeImage: boolean;
  hasImage: boolean;
  aiConfidence: number | null;
  aiNotes: string | null;
  isSaving: boolean;
  isEditing: boolean;
  onUpdateBreaker: (index: number, field: keyof Breaker, value: string | number) => void;
  onAddBreaker: () => void;
  onRemoveBreaker: (index: number) => void;
  onStoreImageChange: (v: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      {aiConfidence !== null && (
        <div className={`flex items-start gap-2 text-xs rounded-lg p-3 border ${
          aiConfidence >= 0.7
            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
            : aiConfidence >= 0.4
            ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300"
            : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        }`}>
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              AI confidence: {Math.round(aiConfidence * 100)}%
              {aiConfidence < 0.4 && " — Review carefully"}
            </p>
            {aiNotes && <p className="mt-1 opacity-80">{aiNotes}</p>}
            <p className="mt-1 opacity-70">
              These are suggestions. Verify each label against your actual panel.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {breakers.length} Breaker{breakers.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={onAddBreaker} data-testid="button-add-breaker">
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-2 pr-2">
          {breakers.map((breaker, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border"
              role="listitem"
              aria-label={`Breaker ${breaker.number}`}
              data-testid={`breaker-row-${index}`}
            >
              <Badge
                variant="outline"
                className="h-8 w-8 p-0 justify-center shrink-0 mt-1 font-mono"
              >
                {breaker.number}
              </Badge>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Label</Label>
                  <Input
                    value={breaker.label}
                    onChange={(e) => onUpdateBreaker(index, "label", e.target.value)}
                    placeholder="e.g., Kitchen outlets"
                    className="h-8 text-sm"
                    aria-label={`Breaker ${breaker.number} label`}
                    data-testid={`input-breaker-label-${index}`}
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Room</Label>
                  <Select
                    value={breaker.room}
                    onValueChange={(v) => onUpdateBreaker(index, "room", v)}
                  >
                    <SelectTrigger className="h-8 text-sm" aria-label={`Breaker ${breaker.number} room`} data-testid={`select-breaker-room-${index}`}>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOMS.map((room) => (
                        <SelectItem key={room || "none"} value={room || "none"}>
                          {room || "None"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amps</Label>
                  <Input
                    type="number"
                    value={breaker.amperage ?? ""}
                    onChange={(e) => onUpdateBreaker(index, "amperage", e.target.value ? parseInt(e.target.value) : 0)}
                    placeholder="15"
                    className="h-8 text-sm"
                    min={1}
                    max={200}
                    aria-label={`Breaker ${breaker.number} amperage`}
                    data-testid={`input-breaker-amps-${index}`}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveBreaker(index)}
                className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive mt-4"
                aria-label={`Remove breaker ${breaker.number}`}
                data-testid={`button-remove-breaker-${index}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {hasImage && (
        <div className="flex items-start gap-3 pt-2">
          <Checkbox
            id="store-image"
            checked={storeImage}
            onCheckedChange={(checked) => onStoreImageChange(checked === true)}
            data-testid="checkbox-store-image"
          />
          <label htmlFor="store-image" className="text-sm leading-relaxed cursor-pointer">
            Store panel image for future reference
          </label>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1" data-testid="button-cancel-annotate">
          Cancel
        </Button>
        <Button onClick={onSave} disabled={isSaving} className="flex-1" data-testid="button-save-circuit-map">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "Update Map" : "Save Map"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
