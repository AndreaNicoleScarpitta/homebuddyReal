import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Clock, DollarSign, Trash2, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAppointments, createAppointment, updateAppointment, deleteAppointment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { ContractorAppointment } from "@shared/schema";

interface ContractorScheduleProps {
  homeId: number;
}

const statusOptions = [
  { value: "inquiry", label: "Inquiry", color: "bg-gray-100 text-gray-700" },
  { value: "scheduled", label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
];

export function ContractorSchedule({ homeId }: ContractorScheduleProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    title: "",
    scheduledDate: "",
    estimatedCost: "",
    notes: "",
    status: "inquiry",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", homeId],
    queryFn: () => getAppointments(homeId),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newAppointment) => createAppointment(homeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", homeId] });
      setIsAddOpen(false);
      setNewAppointment({ title: "", scheduledDate: "", estimatedCost: "", notes: "", status: "inquiry" });
      toast({ title: "Appointment created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not create appointment", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ContractorAppointment> }) => updateAppointment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", homeId] });
      toast({ title: "Appointment updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update appointment", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", homeId] });
      toast({ title: "Appointment deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete appointment", variant: "destructive" });
    },
  });

  const upcomingAppointments = appointments.filter(a => 
    a.status !== "completed" && a.status !== "cancelled"
  );

  const getStatusStyle = (status: string | null) => {
    return statusOptions.find(s => s.value === status)?.color || "bg-gray-100 text-gray-700";
  };

  const getStatusLabel = (status: string | null) => {
    return statusOptions.find(s => s.value === status)?.label || "Inquiry";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Contractor Schedule
          </CardTitle>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-add-appointment">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Contractor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="apt-title">Service/Task</Label>
                  <Input
                    id="apt-title"
                    placeholder="e.g., HVAC Maintenance, Roof Inspection"
                    value={newAppointment.title}
                    onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })}
                    data-testid="input-appointment-title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apt-date">Date</Label>
                    <Input
                      id="apt-date"
                      type="datetime-local"
                      value={newAppointment.scheduledDate}
                      onChange={(e) => setNewAppointment({ ...newAppointment, scheduledDate: e.target.value })}
                      data-testid="input-appointment-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apt-cost">Est. Cost</Label>
                    <Input
                      id="apt-cost"
                      placeholder="$0"
                      value={newAppointment.estimatedCost}
                      onChange={(e) => setNewAppointment({ ...newAppointment, estimatedCost: e.target.value })}
                      data-testid="input-appointment-cost"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apt-status">Status</Label>
                  <Select 
                    value={newAppointment.status} 
                    onValueChange={(v) => setNewAppointment({ ...newAppointment, status: v })}
                  >
                    <SelectTrigger data-testid="select-appointment-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => createMutation.mutate(newAppointment)}
                  disabled={!newAppointment.title || createMutation.isPending}
                  data-testid="button-save-appointment"
                >
                  Save Appointment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingAppointments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming appointments</p>
            <p className="text-xs mt-1">Schedule a contractor visit to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingAppointments.map((apt) => (
              <div 
                key={apt.id} 
                className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
                data-testid={`appointment-${apt.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{apt.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    {apt.scheduledDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(apt.scheduledDate), "MMM d, h:mm a")}
                      </span>
                    )}
                    {apt.estimatedCost && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {apt.estimatedCost}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select 
                    value={apt.status || "inquiry"} 
                    onValueChange={(v) => updateMutation.mutate({ id: apt.id, data: { status: v } })}
                  >
                    <SelectTrigger className="h-7 w-auto border-0 p-0">
                      <Badge className={`${getStatusStyle(apt.status)} border-0`}>
                        {getStatusLabel(apt.status)}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => updateMutation.mutate({ id: apt.id, data: { status: "completed" } })}
                    data-testid={`button-complete-${apt.id}`}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteMutation.mutate(apt.id)}
                    data-testid={`button-delete-${apt.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {appointments.filter(a => a.status === "completed").length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              {appointments.filter(a => a.status === "completed").length} completed appointment{appointments.filter(a => a.status === "completed").length > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
