import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Zap, Flame, Droplets, Wifi, Trash, Phone, MoreHorizontal, Pencil } from "lucide-react";
import { utilityTypes } from "@shared/schema";
import type { UtilityAccount } from "@shared/schema";

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

const utilityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  electricity: Zap,
  gas: Flame,
  water: Droplets,
  sewer: Droplets,
  internet: Wifi,
  trash: Trash,
  phone: Phone,
  other: MoreHorizontal,
};

const utilityColors: Record<string, string> = {
  electricity: "text-yellow-600",
  gas: "text-orange-600",
  water: "text-blue-600",
  sewer: "text-blue-400",
  internet: "text-violet-600",
  trash: "text-green-600",
  phone: "text-slate-600",
  other: "text-muted-foreground",
};

function UtilityForm({ homeId, initial, onSaved }: { homeId: number; initial?: Partial<UtilityAccount>; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    utilityType: initial?.utilityType ?? "electricity",
    provider: initial?.provider ?? "",
    accountNumber: initial?.accountNumber ?? "",
    contactPhone: initial?.contactPhone ?? "",
    website: initial?.website ?? "",
    autoPayEnabled: initial?.autoPayEnabled ?? false,
    billingDayOfMonth: initial?.billingDayOfMonth?.toString() ?? "",
    averageMonthlyBill: initial?.averageMonthlyBill?.toString() ?? "",
    notes: initial?.notes ?? "",
  });

  const isEdit = !!initial?.id;
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        billingDayOfMonth: form.billingDayOfMonth ? parseInt(form.billingDayOfMonth) : null,
        averageMonthlyBill: form.averageMonthlyBill ? parseInt(form.averageMonthlyBill) : null,
      };
      return isEdit
        ? apiRequest("PATCH", `/api/utilities/${initial!.id}`, body)
        : apiRequest("POST", `/api/home/${homeId}/utilities`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utilities", homeId] });
      toast({ title: isEdit ? "Updated" : "Utility account saved" });
      onSaved();
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ut-type">Utility Type</Label>
        <Select value={form.utilityType} onValueChange={v => setForm(p => ({ ...p, utilityType: v }))}>
          <SelectTrigger id="ut-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {utilityTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ut-provider">Provider</Label>
          <Input id="ut-provider" placeholder="e.g. Con Edison" value={form.provider} onChange={f("provider")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ut-account">Account Number</Label>
          <Input id="ut-account" placeholder="Optional" value={form.accountNumber} onChange={f("accountNumber")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ut-phone">Contact Phone</Label>
          <Input id="ut-phone" type="tel" placeholder="1-800-…" value={form.contactPhone} onChange={f("contactPhone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ut-website">Website</Label>
          <Input id="ut-website" type="url" placeholder="https://…" value={form.website} onChange={f("website")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ut-bill">Avg Monthly Bill ($)</Label>
          <Input id="ut-bill" type="number" inputMode="numeric" placeholder="120" value={form.averageMonthlyBill} onChange={f("averageMonthlyBill")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ut-day">Billing Day of Month</Label>
          <Input id="ut-day" type="number" inputMode="numeric" min={1} max={31} placeholder="15" value={form.billingDayOfMonth} onChange={f("billingDayOfMonth")} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input id="ut-autopay" type="checkbox" checked={form.autoPayEnabled} onChange={e => setForm(p => ({ ...p, autoPayEnabled: e.target.checked }))} className="h-4 w-4" />
        <Label htmlFor="ut-autopay">Auto-pay enabled</Label>
      </div>
      <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : isEdit ? "Update" : "Save Account"}
      </Button>
    </div>
  );
}

export function UtilitiesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<UtilityAccount | null>(null);

  const { data: home } = useQuery({ queryKey: ["home"], queryFn: () => apiRequest("GET", "/api/home"), enabled: !!user });
  const homeId = home?.id;

  const { data: accounts = [], isLoading } = useQuery<UtilityAccount[]>({
    queryKey: ["utilities", homeId],
    queryFn: () => apiRequest("GET", `/api/home/${homeId}/utilities`),
    enabled: !!homeId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/utilities/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["utilities", homeId] }); toast({ title: "Removed" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const totalMonthly = accounts.reduce((s, a) => s + (a.averageMonthlyBill ?? 0), 0);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Provider contacts, account numbers, and billing info</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Utility Account</DialogTitle></DialogHeader>
              {homeId && <UtilityForm homeId={homeId} onSaved={() => setAddOpen(false)} />}
            </DialogContent>
          </Dialog>
        </div>

        {totalMonthly > 0 && (
          <div className="p-4 rounded-xl border bg-muted/30">
            <p className="text-sm text-muted-foreground">Estimated monthly utilities</p>
            <p className="text-2xl font-bold">${totalMonthly.toLocaleString()}</p>
          </div>
        )}

        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {!isLoading && accounts.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No utility accounts yet</p>
            <p className="text-sm mt-1">Add electricity, gas, water, and more</p>
          </div>
        )}

        <div className="space-y-3">
          {accounts.map(a => {
            const Icon = utilityIcons[a.utilityType] ?? MoreHorizontal;
            const color = utilityColors[a.utilityType] ?? "text-muted-foreground";
            return (
              <div key={a.id} className="p-4 rounded-xl border bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} />
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{a.utilityType}</span>
                        {a.autoPayEnabled && <span className="text-xs text-green-600 font-medium">Auto-pay</span>}
                      </div>
                      {a.provider && <p className="text-sm text-muted-foreground">{a.provider}</p>}
                      {a.contactPhone && (
                        <a href={`tel:${a.contactPhone}`} className="text-sm text-primary hover:underline block">{a.contactPhone}</a>
                      )}
                      {a.accountNumber && <p className="text-xs text-muted-foreground">Account: {a.accountNumber}</p>}
                      {a.averageMonthlyBill && <p className="text-sm font-medium">${a.averageMonthlyBill}/mo avg</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" aria-label="Edit utility account" className="h-11 w-11 text-muted-foreground" onClick={() => setEditAccount(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Delete utility account" className="h-11 w-11 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(a.id)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!editAccount} onOpenChange={open => !open && setEditAccount(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Utility Account</DialogTitle></DialogHeader>
          {homeId && editAccount && (
            <UtilityForm homeId={homeId} initial={editAccount} onSaved={() => setEditAccount(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
