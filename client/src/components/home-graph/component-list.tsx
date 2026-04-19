import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getComponents, createComponent, deleteComponent, type V2Component } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Box } from "lucide-react";
import { ProvenanceBadge } from "./provenance-badge";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const conditionColors: Record<string, string> = {
  Great: "bg-green-100 text-green-700",
  Good: "bg-blue-100 text-blue-700",
  Fair: "bg-yellow-100 text-yellow-700",
  Poor: "bg-red-100 text-red-700",
  Unknown: "bg-gray-100 text-gray-700",
};

export function ComponentList({ systemId, homeId }: { systemId: number | string; homeId: number | string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [componentType, setComponentType] = useState("");
  const [material, setMaterial] = useState("");
  const [condition, setCondition] = useState("Unknown");
  const [installYear, setInstallYear] = useState("");

  const { data: components = [], isLoading } = useQuery({
    queryKey: ["components", systemId],
    queryFn: () => getComponents(systemId),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<V2Component>) => createComponent(systemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["components", systemId] });
      setOpen(false);
      setName("");
      setComponentType("");
      setMaterial("");
      setCondition("Unknown");
      setInstallYear("");
      toast({ title: "Component added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteComponent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["components", systemId] });
      toast({ title: "Component removed" });
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading components...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Box className="h-4 w-4" /> Components ({components.length})
        </h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Component</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shingles, Compressor, Thermostat" /></div>
              <div><Label>Type</Label><Input value={componentType} onChange={(e) => setComponentType(e.target.value)} placeholder="e.g. roofing, mechanical" /></div>
              <div><Label>Material</Label><Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Copper, Asphalt" /></div>
              <div><Label>Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Great", "Good", "Fair", "Poor", "Unknown"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Install Year</Label><Input type="number" value={installYear} onChange={(e) => setInstallYear(e.target.value)} placeholder="2020" /></div>
              <Button onClick={() => createMutation.mutate({ name, componentType, material, condition, installYear: installYear ? parseInt(installYear) : undefined, homeId: Number(homeId) })} disabled={!name || createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Component"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {components.length === 0 ? (
        <p className="text-sm text-muted-foreground">No components tracked yet. Add sub-parts like shingles, compressors, or thermostats.</p>
      ) : (
        <div className="space-y-2">
          {components.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c.name}</span>
                    <Badge variant="outline" className={`text-xs ${conditionColors[c.condition || "Unknown"]}`}>{c.condition || "Unknown"}</Badge>
                    <ProvenanceBadge source={c.provenanceSource} confidence={c.provenanceConfidence} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[c.material, c.installYear ? `Installed ${c.installYear}` : null, c.componentType].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
