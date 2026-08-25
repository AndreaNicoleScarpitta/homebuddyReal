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
import { Plus, Trash2, ShieldCheck, AlertTriangle, Pencil } from "lucide-react";
import { insurancePolicyTypes, insurancePremiumFrequencies } from "@shared/schema";
import type { InsurancePolicy } from "@shared/schema";

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

function renewalStatus(p: InsurancePolicy): "expired" | "soon" | "ok" | "unknown" {
  if (!p.renewalDate) return "unknown";
  const now = Date.now();
  const exp = new Date(p.renewalDate).getTime();
  if (exp < now) return "expired";
  if (exp - now < 60 * 24 * 60 * 60 * 1000) return "soon";
  return "ok";
}

function InsuranceForm({ homeId, initial, onSaved }: { homeId: number; initial?: Partial<InsurancePolicy>; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    policyType: initial?.policyType ?? "homeowners",
    carrier: initial?.carrier ?? "",
    policyNumber: initial?.policyNumber ?? "",
    agentName: initial?.agentName ?? "",
    agentPhone: initial?.agentPhone ?? "",
    agentEmail: initial?.agentEmail ?? "",
    premiumAmount: initial?.premiumAmount?.toString() ?? "",
    premiumFrequency: initial?.premiumFrequency ?? "annual",
    renewalDate: initial?.renewalDate ? new Date(initial.renewalDate).toISOString().split("T")[0] : "",
    coverageSummary: initial?.coverageSummary ?? "",
    notes: initial?.notes ?? "",
  });

  const isEdit = !!initial?.id;
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        premiumAmount: form.premiumAmount ? parseInt(form.premiumAmount) : null,
        renewalDate: form.renewalDate ? new Date(form.renewalDate).toISOString() : null,
      };
      return isEdit
        ? apiRequest("PATCH", `/api/insurance/${initial!.id}`, body)
        : apiRequest("POST", `/api/home/${homeId}/insurance`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance", homeId] });
      toast({ title: isEdit ? "Updated" : "Policy saved" });
      onSaved();
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ins-type">Policy Type</Label>
          <Select value={form.policyType} onValueChange={v => setForm(p => ({ ...p, policyType: v }))}>
            <SelectTrigger id="ins-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {insurancePolicyTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ins-carrier">Carrier</Label>
          <Input id="ins-carrier" placeholder="e.g. State Farm" value={form.carrier} onChange={f("carrier")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ins-policy">Policy Number</Label>
          <Input id="ins-policy" placeholder="Optional" value={form.policyNumber} onChange={f("policyNumber")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ins-renewal">Renewal Date</Label>
          <Input id="ins-renewal" type="date" value={form.renewalDate} onChange={f("renewalDate")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ins-premium">Premium Amount ($)</Label>
          <Input id="ins-premium" type="number" inputMode="decimal" placeholder="1200" value={form.premiumAmount} onChange={f("premiumAmount")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ins-freq">Frequency</Label>
          <Select value={form.premiumFrequency} onValueChange={v => setForm(p => ({ ...p, premiumFrequency: v }))}>
            <SelectTrigger id="ins-freq"><SelectValue /></SelectTrigger>
            <SelectContent>
              {insurancePremiumFrequencies.map(f => <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ins-agent">Agent Name</Label>
        <Input id="ins-agent" placeholder="Optional" value={form.agentName} onChange={f("agentName")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ins-phone">Agent Phone</Label>
          <Input id="ins-phone" type="tel" value={form.agentPhone} onChange={f("agentPhone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ins-email">Agent Email</Label>
          <Input id="ins-email" type="email" value={form.agentEmail} onChange={f("agentEmail")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ins-coverage">Coverage Summary</Label>
        <Textarea id="ins-coverage" placeholder="Key coverages, deductibles, exclusions…" rows={2} value={form.coverageSummary} onChange={f("coverageSummary")} />
      </div>
      <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : isEdit ? "Update" : "Save Policy"}
      </Button>
    </div>
  );
}

export function InsuranceSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<InsurancePolicy | null>(null);

  const { data: home } = useQuery({ queryKey: ["home"], queryFn: () => apiRequest("GET", "/api/home"), enabled: !!user });
  const homeId = home?.id;

  const { data: policies = [], isLoading } = useQuery<InsurancePolicy[]>({
    queryKey: ["insurance", homeId],
    queryFn: () => apiRequest("GET", `/api/home/${homeId}/insurance`),
    enabled: !!homeId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/insurance/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["insurance", homeId] }); toast({ title: "Policy removed" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const renewingSoon = policies.filter(p => renewalStatus(p) === "soon").length;
  const expired = policies.filter(p => renewalStatus(p) === "expired").length;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Policies, carriers, agents, and renewal dates</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Insurance Policy</DialogTitle></DialogHeader>
              {homeId && <InsuranceForm homeId={homeId} onSaved={() => setAddOpen(false)} />}
            </DialogContent>
          </Dialog>
        </div>

        {(renewingSoon > 0 || expired > 0) && (
          <div className="flex gap-3">
            {expired > 0 && <div className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{expired} expired</div>}
            {renewingSoon > 0 && <div className="flex items-center gap-1.5 text-sm text-amber-600"><AlertTriangle className="h-4 w-4" />{renewingSoon} renewing within 60 days</div>}
          </div>
        )}

        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {!isLoading && policies.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No policies tracked yet</p>
            <p className="text-sm mt-1">Add homeowners, flood, earthquake, or other coverage</p>
          </div>
        )}

        <div className="space-y-3">
          {policies.map(p => {
            const st = renewalStatus(p);
            const statusBadge = {
              expired: <Badge variant="destructive">Expired</Badge>,
              soon: <Badge className="bg-amber-100 text-amber-800 border-amber-200">Renewing soon</Badge>,
              ok: <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>,
              unknown: null,
            }[st];

            return (
              <div key={p.id} className="p-4 rounded-xl border bg-card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium capitalize">{p.policyType}</span>
                      {statusBadge}
                    </div>
                    {p.carrier && <p className="text-sm text-muted-foreground">{p.carrier}</p>}
                    {p.policyNumber && <p className="text-xs text-muted-foreground">Policy #{p.policyNumber}</p>}
                    {p.renewalDate && <p className="text-xs text-muted-foreground">Renews {new Date(p.renewalDate).toLocaleDateString()}</p>}
                    {p.premiumAmount && (
                      <p className="text-sm font-medium">${p.premiumAmount.toLocaleString()} / {p.premiumFrequency ?? "year"}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" aria-label="Edit policy" className="h-11 w-11 text-muted-foreground" onClick={() => setEditPolicy(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Delete policy" className="h-11 w-11 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {(p.agentName || p.agentPhone) && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {p.agentName && <span>Agent: {p.agentName}</span>}
                    {p.agentPhone && (
                      <a href={`tel:${p.agentPhone}`} className="ml-2 text-primary hover:underline">{p.agentPhone}</a>
                    )}
                  </div>
                )}
                {p.coverageSummary && <p className="text-xs text-muted-foreground">{p.coverageSummary}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!editPolicy} onOpenChange={open => !open && setEditPolicy(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Policy</DialogTitle></DialogHeader>
          {homeId && editPolicy && (
            <InsuranceForm homeId={homeId} initial={editPolicy} onSaved={() => setEditPolicy(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
