import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { warrantyTypes } from "@shared/schema";
import type { Warranty } from "@shared/schema";

async function apiRequest(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function warrantyStatus(w: Warranty): "expired" | "soon" | "ok" | "unknown" {
  if (!w.expiryDate) return "unknown";
  const now = Date.now();
  const exp = new Date(w.expiryDate).getTime();
  if (exp < now) return "expired";
  if (exp - now < 90 * 24 * 60 * 60 * 1000) return "soon";
  return "ok";
}

const statusBadge = {
  expired: <Badge variant="destructive">Expired</Badge>,
  soon: <Badge className="bg-amber-100 text-amber-800 border-amber-200">Expires soon</Badge>,
  ok: <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>,
  unknown: <Badge variant="outline">No expiry</Badge>,
};

function WarrantyForm({ homeId, onSaved }: { homeId: number; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    warrantyProvider: "",
    warrantyType: "manufacturer" as string,
    coverageSummary: "",
    startDate: "",
    expiryDate: "",
    isTransferable: false,
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/home/${homeId}/warranties`, {
      ...form,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warranties", homeId] });
      toast({ title: "Warranty saved" });
      onSaved();
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="w-provider">Provider</Label>
          <Input id="w-provider" placeholder="e.g. Samsung, 2-10 HBW" value={form.warrantyProvider} onChange={e => setForm(f => ({ ...f, warrantyProvider: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-type">Type</Label>
          <Select value={form.warrantyType} onValueChange={v => setForm(f => ({ ...f, warrantyType: v }))}>
            <SelectTrigger id="w-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {warrantyTypes.map(t => <SelectItem key={t} value={t}>{t.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="w-start">Start Date</Label>
          <Input id="w-start" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-expiry">Expiry Date</Label>
          <Input id="w-expiry" type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="w-coverage">Coverage Summary</Label>
        <Textarea id="w-coverage" placeholder="What does this warranty cover?" rows={2} value={form.coverageSummary} onChange={e => setForm(f => ({ ...f, coverageSummary: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="w-notes">Notes</Label>
        <Input id="w-notes" placeholder="Claim number, contact info, etc." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="flex items-center gap-2">
        <input id="w-transferable" type="checkbox" checked={form.isTransferable} onChange={e => setForm(f => ({ ...f, isTransferable: e.target.checked }))} className="h-4 w-4" />
        <Label htmlFor="w-transferable">Transferable to next owner</Label>
      </div>
      <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save Warranty"}
      </Button>
    </div>
  );
}

export function WarrantiesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: home } = useQuery({ queryKey: ["home"], queryFn: () => apiRequest("GET", "/api/home"), enabled: !!user });
  const homeId = home?.id;

  const { data: warranties = [], isLoading } = useQuery<Warranty[]>({
    queryKey: ["warranties", homeId],
    queryFn: () => apiRequest("GET", `/api/home/${homeId}/warranties`),
    enabled: !!homeId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/warranties/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warranties", homeId] }); toast({ title: "Warranty removed" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const expiring = warranties.filter(w => warrantyStatus(w) === "soon").length;
  const expired = warranties.filter(w => warrantyStatus(w) === "expired").length;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Track coverage for appliances, systems, and home warranty plans</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Warranty</DialogTitle></DialogHeader>
              {homeId && <WarrantyForm homeId={homeId} onSaved={() => setAddOpen(false)} />}
            </DialogContent>
          </Dialog>
        </div>

        {(expiring > 0 || expired > 0) && (
          <div className="flex gap-3">
            {expired > 0 && <div className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{expired} expired</div>}
            {expiring > 0 && <div className="flex items-center gap-1.5 text-sm text-amber-600"><AlertTriangle className="h-4 w-4" />{expiring} expiring soon</div>}
          </div>
        )}

        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {!isLoading && warranties.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No warranties tracked yet</p>
            <p className="text-sm mt-1">Add warranties for appliances, HVAC, roof, and more</p>
          </div>
        )}

        <div className="space-y-3">
          {warranties.map(w => {
            const st = warrantyStatus(w);
            return (
              <div key={w.id} className="p-4 rounded-xl border bg-card space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{w.warrantyProvider || "Unknown provider"}</span>
                      {statusBadge[st]}
                      {w.isTransferable && <Badge variant="outline" className="text-xs">Transferable</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{w.warrantyType?.replace("-", " ")}</p>
                    {w.expiryDate && (
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(w.expiryDate).toLocaleDateString()}
                      </p>
                    )}
                    {w.coverageSummary && <p className="text-sm text-muted-foreground mt-1">{w.coverageSummary}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete warranty"
                    className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(w.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {w.notes && <p className="text-xs text-muted-foreground border-t pt-1.5">{w.notes}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
