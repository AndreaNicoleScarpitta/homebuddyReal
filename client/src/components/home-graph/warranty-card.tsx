import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWarranties, createWarranty, deleteWarranty, type V2Warranty } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { ProvenanceBadge } from "./provenance-badge";
import { differenceInDays } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

function expiryStatus(expiryDate: string | null | undefined) {
  if (!expiryDate) return { label: "No expiry", color: "bg-gray-100 text-gray-600", icon: Shield };
  const days = differenceInDays(new Date(expiryDate), new Date());
  if (days < 0) return { label: "Expired", color: "bg-red-100 text-red-700", icon: ShieldAlert };
  if (days < 90) return { label: `${days}d left`, color: "bg-yellow-100 text-yellow-700", icon: ShieldAlert };
  return { label: `${Math.floor(days / 365)}y left`, color: "bg-green-100 text-green-700", icon: ShieldCheck };
}

export function WarrantySection({ homeId, systemId }: { homeId: number | string; systemId?: number | string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [warrantyType, setWarrantyType] = useState("manufacturer");
  const [coverage, setCoverage] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const { data: warranties = [], isLoading } = useQuery({
    queryKey: ["warranties", homeId],
    queryFn: () => getWarranties(homeId),
    select: (data) => systemId ? data.filter(w => w.systemId === Number(systemId)) : data,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<V2Warranty>) => createWarranty(homeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warranties", homeId] });
      setOpen(false);
      setProvider("");
      setCoverage("");
      setExpiryDate("");
      toast({ title: "Warranty added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteWarranty(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warranties", homeId] });
      toast({ title: "Warranty removed" });
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading warranties...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4" /> Warranties ({warranties.length})
        </h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Warranty</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Provider</Label><Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. GAF, Carrier" /></div>
              <div><Label>Type</Label>
                <Select value={warrantyType} onValueChange={setWarrantyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["manufacturer", "extended", "home-warranty", "labor", "other"].map(t => <SelectItem key={t} value={t}>{t.replace("-", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Coverage Summary</Label><Textarea value={coverage} onChange={(e) => setCoverage(e.target.value)} placeholder="What does this warranty cover?" /></div>
              <div><Label>Expiry Date</Label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
              <Button onClick={() => createMutation.mutate({ systemId: systemId ? Number(systemId) : undefined, warrantyProvider: provider, warrantyType, coverageSummary: coverage, expiryDate: expiryDate || undefined })} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Warranty"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {warranties.length === 0 ? (
        <p className="text-sm text-muted-foreground">No warranties tracked. Add manufacturer or extended warranties to stay protected.</p>
      ) : (
        <div className="space-y-2">
          {warranties.map((w) => {
            const status = expiryStatus(w.expiryDate);
            const StatusIcon = status.icon;
            return (
              <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <StatusIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{w.warrantyProvider || "Warranty"}</span>
                      <Badge variant="outline" className="text-xs capitalize">{(w.warrantyType || "other").replace("-", " ")}</Badge>
                      <Badge variant="outline" className={`text-xs ${status.color}`}>{status.label}</Badge>
                      {w.isTransferable && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">Transferable</Badge>}
                      <ProvenanceBadge source={w.provenanceSource} confidence={w.provenanceConfidence} />
                    </div>
                    {w.coverageSummary && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{w.coverageSummary}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(w.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
