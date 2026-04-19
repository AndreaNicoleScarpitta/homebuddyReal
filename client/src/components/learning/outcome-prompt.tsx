import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordAction, recordOutcome } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, Clock, Wrench, UserCheck, X, MessageSquare } from "lucide-react";

const actionOptions = [
  { value: "completed_task", label: "I did it myself", icon: CheckCircle },
  { value: "hired_contractor", label: "Hired a pro", icon: UserCheck },
  { value: "deferred", label: "I'll do it later", icon: Clock },
  { value: "ignored_task", label: "Not needed", icon: X },
];

export function RecordActionDialog({ homeId, systemId, systemName, onRecorded }: {
  homeId: number | string;
  systemId?: number;
  systemName?: string;
  onRecorded?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => recordAction(homeId, {
      systemId,
      actionType,
      costActual: cost ? Math.round(parseFloat(cost) * 100) : undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions", homeId] });
      queryClient.invalidateQueries({ queryKey: ["learning-summary", homeId] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      setOpen(false);
      setActionType("");
      setCost("");
      setNotes("");
      onRecorded?.();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Record Action
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What did you do?{systemName ? ` (${systemName})` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {actionOptions.map(opt => {
              const Icon = opt.icon;
              const selected = actionType === opt.value;
              return (
                <button key={opt.value} onClick={() => setActionType(opt.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                    selected ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
                  }`}>
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {(actionType === "completed_task" || actionType === "hired_contractor") && (
            <div><Label>Cost ($)</Label><Input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" /></div>
          )}
          <div><Label>Notes (optional)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What happened?" rows={2} /></div>
          <Button onClick={() => mutation.mutate()} disabled={!actionType || mutation.isPending} className="w-full">
            {mutation.isPending ? "Recording..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RecordOutcomeDialog({ homeId, systemId, systemName, onRecorded }: {
  homeId: number | string;
  systemId?: number;
  systemName?: string;
  onRecorded?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [outcomeType, setOutcomeType] = useState("");
  const [severity, setSeverity] = useState("low");
  const [cost, setCost] = useState("");
  const [description, setDescription] = useState("");

  const outcomeOptions = [
    { value: "avoided_issue", label: "Avoided a problem", color: "text-green-600" },
    { value: "improved", label: "It got better", color: "text-blue-600" },
    { value: "no_change", label: "No change", color: "text-gray-600" },
    { value: "degraded", label: "It got worse", color: "text-amber-600" },
    { value: "failure", label: "Something broke", color: "text-red-600" },
  ];

  const mutation = useMutation({
    mutationFn: () => recordOutcome(homeId, {
      systemId,
      outcomeType,
      severity,
      costImpact: cost ? Math.round(parseFloat(cost) * 100) : undefined,
      description: description || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outcomes", homeId] });
      queryClient.invalidateQueries({ queryKey: ["learning-summary", homeId] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      setOpen(false);
      setOutcomeType("");
      setCost("");
      setDescription("");
      onRecorded?.();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Wrench className="h-3.5 w-3.5" />
          Record Outcome
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What happened?{systemName ? ` (${systemName})` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {outcomeOptions.map(opt => (
              <button key={opt.value} onClick={() => setOutcomeType(opt.value)}
                className={`w-full flex items-center gap-2 p-3 rounded-lg border text-sm text-left transition-colors ${
                  outcomeType === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}>
                <span className={`font-medium ${opt.color}`}>{opt.label}</span>
              </button>
            ))}
          </div>
          {(outcomeType === "failure" || outcomeType === "degraded") && (
            <>
              <div><Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Cost impact ($)</Label><Input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" /></div>
            </>
          )}
          <div><Label>Description (optional)</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell us more..." rows={2} /></div>
          <Button onClick={() => mutation.mutate()} disabled={!outcomeType || mutation.isPending} className="w-full">
            {mutation.isPending ? "Recording..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
