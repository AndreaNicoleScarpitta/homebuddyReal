import { Layout } from "@/components/layout";
import { NotificationSettings } from "@/components/notification-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { User, MapPin, Home, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHome, updateHome } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-96" />
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: home, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });

  const [formData, setFormData] = useState({
    address: "",
  });

  useEffect(() => {
    if (home) {
      setFormData({
        address: home.address || "",
      });
    }
  }, [home]);

  const updateMutation = useMutation({
    mutationFn: (data: { address?: string }) =>
      updateHome(home!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update profile.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Layout>
        <ProfileSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 pb-16">
        <header className="space-y-2">
          <h1 className="text-2xl font-heading font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            Profile
          </h1>
          <p className="text-muted-foreground">
            Manage your account and notification preferences
          </p>
        </header>

        <section className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Home Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <div className="space-y-2">
                  <Label htmlFor="displayname">Name</Label>
                  <Input
                    id="displayname"
                    value={[user.firstName, user.lastName].filter(Boolean).join(" ") || "Not set"}
                    disabled
                    className="bg-muted"
                    data-testid="input-displayname"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your name is managed through your Replit account
                  </p>
                </div>
              )}

              {user?.email && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="bg-muted"
                    data-testid="input-email"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Home Address
                </Label>
                <Input
                  id="address"
                  placeholder="123 Main Street, City, State"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  data-testid="input-address"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto"
                data-testid="button-save-profile"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          <NotificationSettings />
        </section>
      </div>
    </Layout>
  );
}
