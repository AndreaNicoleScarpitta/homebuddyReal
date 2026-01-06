import { Layout } from "@/components/layout";
import { HomeHealth } from "@/components/home-health";
import { HomeInfoCard } from "@/components/home-info-card";
import { MaintenanceCard } from "@/components/maintenance-card";
import { AddSystemWizard } from "@/components/add-system-wizard";
import { OnboardingTour, useTourState } from "@/components/onboarding-tour";
import { ContractorSection } from "@/components/contractor-section";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getHome, getTasks, getSystems } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { hasSeenTour, showTour, tourKey, startTour, completeTour } = useTourState();
  const [showAddSystem, setShowAddSystem] = useState(false);

  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    enabled: isAuthenticated,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", home?.id],
    queryFn: () => getTasks(home!.id),
    enabled: !!home?.id,
  });

  const { data: systems = [] } = useQuery({
    queryKey: ["systems", home?.id],
    queryFn: () => getSystems(home!.id),
    enabled: !!home?.id,
  });

  useEffect(() => {
    if (!authLoading && !homeLoading && !home) {
      navigate("/onboarding");
    }
  }, [authLoading, homeLoading, home, navigate]);

  useEffect(() => {
    if (home && hasSeenTour === false && !showTour) {
      const timer = setTimeout(() => {
        startTour();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [home, hasSeenTour, showTour, startTour]);

  if (authLoading || homeLoading) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  if (!home) {
    return null;
  }

  const activeTasks = tasks.filter(t => t.status === "pending" || t.status === "scheduled");
  const highPriorityTasks = tasks.filter(t => t.urgency === "now" || t.urgency === "soon");
  
  const urgentTasksCount = tasks.filter(t => t.urgency === "now" && t.status !== "completed").length;
  const overdueTasksCount = tasks.filter(t => {
    if (!t.dueDate || t.status === "completed") return false;
    return new Date(t.dueDate) < new Date();
  }).length;
  const poorSystemsCount = systems.filter(s => s.condition === "Poor").length;

  return (
    <Layout>
      <OnboardingTour key={tourKey} isOpen={showTour} onComplete={completeTour} />
      
      <div className="space-y-10">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-heading">
            Your Home
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeTasks.length > 0 
              ? `${activeTasks.length} task${activeTasks.length > 1 ? 's' : ''} need${activeTasks.length === 1 ? 's' : ''} attention`
              : "Everything looks good"
            }
          </p>
        </header>

        {/* At a Glance */}
        <section className="space-y-4" data-tour="home-status">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HomeHealth 
              score={home.healthScore || 0} 
              systemsCount={systems.length}
              tasksCount={activeTasks.length}
              urgentTasksCount={urgentTasksCount}
              overdueTasksCount={overdueTasksCount}
              poorSystemsCount={poorSystemsCount}
            />
            <HomeInfoCard home={home} systems={systems} />
          </div>
          
          {/* Quick Stats Row */}
          <div className="flex flex-wrap gap-4 text-sm" data-tour="quick-stats">
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
              <span className="text-muted-foreground">Next up:</span>
              <span className="font-medium" data-testid="text-next-service">
                {tasks.length > 0 ? tasks[0].title : "Nothing scheduled"}
              </span>
            </div>
            {highPriorityTasks.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span className="font-medium">{highPriorityTasks.length} high priority</span>
              </div>
            )}
            <button 
              onClick={() => setShowAddSystem(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full transition-colors"
              data-testid="button-add-system"
            >
              <Plus className="h-4 w-4" />
              <span>Add system</span>
            </button>
          </div>
        </section>
        
        {/* Add System Wizard */}
        <AddSystemWizard 
          isOpen={showAddSystem} 
          onClose={() => setShowAddSystem(false)} 
          homeId={home.id} 
        />

        {/* Tasks Section */}
        <section className="space-y-6" data-tour="maintenance-plan">
          <div className="flex justify-between items-baseline">
            <h2 className="text-lg font-heading font-semibold">Maintenance Plan</h2>
            <Link href="/budget">
              <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="button-view-plan">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          
          {tasks.length === 0 ? (
            <Card className="p-8">
              <div className="max-w-md mx-auto text-center">
                <h3 className="text-lg font-medium mb-2">No maintenance tasks yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Chat with your assistant to identify what needs attention, or upload an inspection report.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/chat">
                    <Button data-testid="button-start-chat">
                      Chat with Assistant
                    </Button>
                  </Link>
                  <Link href="/inspections">
                    <Button variant="outline" data-testid="button-upload-inspection">
                      Upload Report
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {["now", "soon", "later", "monitor"].map((urgency) => {
                const urgencyTasks = tasks.filter(t => t.urgency === urgency);
                if (urgencyTasks.length === 0) return null;

                const urgencyLabels: Record<string, string> = {
                  now: "Fix Now",
                  soon: "Plan Soon", 
                  later: "Address Later",
                  monitor: "Monitor"
                };

                return (
                  <div key={urgency} className="space-y-3">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        urgency === 'now' ? 'bg-red-500' : 
                        urgency === 'soon' ? 'bg-orange-500' : 
                        urgency === 'monitor' ? 'bg-blue-400' : 'bg-green-500'
                      }`} />
                      {urgencyLabels[urgency]}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {urgencyTasks.map((task) => (
                        <MaintenanceCard key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Contractor Section */}
        {tasks.filter(t => t.diyLevel === "Pro-Only" && t.status !== "completed").length > 0 && (
          <section className="space-y-4" data-tour="find-pro">
            <ContractorSection homeId={home.id} pendingTasks={tasks} />
          </section>
        )}

        {/* Help link */}
        {hasSeenTour && (
          <div className="text-center pt-4">
            <button 
              onClick={startTour}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-restart-tour"
            >
              Need help? Take a quick tour
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
