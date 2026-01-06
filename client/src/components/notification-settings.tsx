import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Mail, Calendar, Wrench, AlertTriangle, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: getNotificationPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationPreferences"] });
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update settings", variant: "destructive" });
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const notificationOptions = [
    {
      key: "maintenanceReminders",
      label: "Maintenance Reminders",
      description: "Get notified when maintenance tasks are due or overdue",
      icon: Wrench,
      value: prefs?.maintenanceReminders ?? true,
    },
    {
      key: "contractorFollowups",
      label: "Contractor Follow-ups",
      description: "Reminders about scheduled appointments and quotes",
      icon: Calendar,
      value: prefs?.contractorFollowups ?? true,
    },
    {
      key: "systemAlerts",
      label: "System Alerts",
      description: "Alerts when systems need attention or are aging",
      icon: AlertTriangle,
      value: prefs?.systemAlerts ?? true,
    },
    {
      key: "weeklyDigest",
      label: "Weekly Digest",
      description: "A weekly summary of your home maintenance status",
      icon: FileText,
      value: prefs?.weeklyDigest ?? false,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="font-medium">Email Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive updates via email</p>
            </div>
          </div>
          <Switch
            checked={prefs?.emailEnabled ?? true}
            onCheckedChange={(checked) => handleToggle("emailEnabled", checked)}
            data-testid="switch-email-notifications"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="font-medium">Push Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive browser push notifications</p>
            </div>
          </div>
          <Switch
            checked={prefs?.pushEnabled ?? false}
            onCheckedChange={(checked) => handleToggle("pushEnabled", checked)}
            data-testid="switch-push-notifications"
          />
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-3">Notification Types</p>
          <div className="space-y-3">
            {notificationOptions.map((option) => (
              <div 
                key={option.key}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <option.icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">{option.label}</Label>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
                <Switch
                  checked={option.value}
                  onCheckedChange={(checked) => handleToggle(option.key, checked)}
                  data-testid={`switch-${option.key}`}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
