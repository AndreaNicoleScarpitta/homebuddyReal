import { Layout } from "@/components/layout";
import { HomeHealth } from "@/components/home-health";
import { MaintenanceCard } from "@/components/maintenance-card";
import { OnboardingTour, useTourState } from "@/components/onboarding-tour";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, ArrowRight, HelpCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getHome, getTasks, getSystems } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { hasSeenTour, showTour, tourKey, startTour, completeTour } = useTourState();

  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    enabled: isAuthenticated,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
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
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading your home...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!home) {
    return null;
  }

  const activeTasks = tasks.filter(t => t.status === "pending" || t.status === "scheduled");
  const highPriorityTasks = tasks.filter(t => t.urgency === "now" || t.urgency === "soon");

  return (
    <Layout>
      <OnboardingTour key={tourKey} isOpen={showTour} onComplete={completeTour} />
      
      <div className="space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-heading">Overview</h1>
            <p className="text-muted-foreground mt-1">Here's what needs your attention.</p>
          </div>
          <div className="flex items-center gap-2">
            {hasSeenTour && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={startTour}
                    className="text-muted-foreground hover:text-foreground"
                    data-testid="button-restart-tour"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Take a quick tour</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/chat">
                  <Button size="lg" className="shadow-lg shadow-primary/20" data-testid="button-chat">
                    Ask Assistant <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Get expert advice on repairs, maintenance, and costs</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Home Status */}
          <div className="md:col-span-1" data-tour="home-status">
            <HomeHealth 
              score={home.healthScore || 0} 
              systemsCount={systems.length}
              tasksCount={activeTasks.length}
            />
          </div>

          {/* Quick Stats */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4" data-tour="quick-stats">
             <Card className="bg-primary/5 border-primary/10">
               <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium text-muted-foreground">Next Service</CardTitle>
               </CardHeader>
               <CardContent>
                 {tasks.length > 0 ? (
                   <>
                     <div className="text-2xl font-bold text-foreground" data-testid="text-next-service">{tasks[0].title}</div>
                     <p className="text-sm text-muted-foreground mt-1">
                       {tasks[0].dueDate ? new Date(tasks[0].dueDate).toLocaleDateString() : "Not scheduled"}
                     </p>
                   </>
                 ) : (
                   <>
                     <div className="text-2xl font-bold text-foreground" data-testid="text-next-service">None scheduled</div>
                     <p className="text-sm text-muted-foreground mt-1">All caught up!</p>
                   </>
                 )}
               </CardContent>
             </Card>
             <Card>
               <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium text-muted-foreground">Home Age</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold text-foreground" data-testid="text-home-age">
                   {home.builtYear ? new Date().getFullYear() - home.builtYear : "N/A"}
                 </div>
                 <p className="text-sm text-muted-foreground mt-1">
                   {home.builtYear ? `Built ${home.builtYear}` : "Year not set"}
                 </p>
               </CardContent>
             </Card>
             <Tooltip>
               <TooltipTrigger asChild>
                 <Card className="cursor-help">
                   <CardHeader className="pb-2">
                     <CardTitle className="text-sm font-medium text-muted-foreground">Active Tasks</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="text-2xl font-bold text-foreground" data-testid="text-active-tasks">{activeTasks.length}</div>
                     <p className="text-sm text-orange-600 mt-1">{highPriorityTasks.length} High Priority</p>
                   </CardContent>
                 </Card>
               </TooltipTrigger>
               <TooltipContent>Pending and scheduled maintenance tasks</TooltipContent>
             </Tooltip>
             <Tooltip>
               <TooltipTrigger asChild>
                 <Card className="flex flex-col justify-center items-center border-dashed cursor-pointer hover:bg-muted/50 transition-colors" data-testid="card-add-system">
                   <div className="flex flex-col items-center gap-2 text-muted-foreground">
                     <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                       <Plus className="h-6 w-6" />
                     </div>
                     <span className="font-medium">Add System</span>
                   </div>
                 </Card>
               </TooltipTrigger>
               <TooltipContent>Add HVAC, plumbing, roof, or other home systems to track</TooltipContent>
             </Tooltip>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="space-y-6" data-tour="maintenance-plan">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-heading font-semibold">Your Maintenance Plan</h2>
              <p className="text-sm text-muted-foreground">Prioritized by urgency and safety.</p>
            </div>
            <Button variant="ghost" data-testid="button-view-plan">View Full Plan</Button>
          </div>
          
          {tasks.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No maintenance tasks yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload an inspection report to get personalized recommendations, or ask the assistant to help create a plan.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  We'll help you understand what needs attention now versus what can wait.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/inspections">
                    <Button variant="outline" data-testid="button-upload-inspection">
                      Upload Inspection
                    </Button>
                  </Link>
                  <Link href="/chat">
                    <Button data-testid="button-start-chat">
                      Ask Assistant
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            ["now", "soon", "later", "monitor"].map((urgency) => {
              const urgencyTasks = tasks.filter(t => t.urgency === urgency);
              if (urgencyTasks.length === 0) return null;

              return (
                <div key={urgency} className="space-y-3">
                  <h3 className="uppercase text-xs font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      urgency === 'now' ? 'bg-destructive' : 
                      urgency === 'soon' ? 'bg-orange-500' : 
                      urgency === 'monitor' ? 'bg-blue-400' : 'bg-green-500'
                    }`} />
                    {urgency}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {urgencyTasks.map((task) => (
                      <MaintenanceCard key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
