import { Calendar, AlertTriangle, CheckCircle2, Clock, ChevronRight, User, ShieldAlert, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MaintenanceTask } from "@shared/schema";

const serviceTypeMapping: Record<string, string> = {
  "HVAC": "hvac",
  "Plumbing": "plumbing", 
  "Electrical": "electricians",
  "Roof": "roofing",
  "Windows": "windows",
  "Siding/Exterior": "siding",
  "Foundation": "foundation",
  "Appliances": "appliance-repair",
  "Water Heater": "water-heater",
  "Landscaping": "landscaping",
  "Pest": "pest-control",
};

function buildAngiesListUrl(serviceType: string): string {
  const category = serviceTypeMapping[serviceType] || "home-improvement";
  return `https://www.angi.com/companylist/${category}.htm`;
}

interface TaskProps {
  task: MaintenanceTask;
}

export function MaintenanceCard({ task }: TaskProps) {
  const isNow = task.urgency === "now";
  
  const getDiyBadgeColor = (level: string | null) => {
    switch (level) {
      case "DIY-Safe": return "bg-green-100 text-green-700 hover:bg-green-200 border-green-200";
      case "Caution": return "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200";
      case "Pro-Only": return "bg-red-100 text-red-700 hover:bg-red-200 border-red-200";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <Card className={`group overflow-hidden border-l-4 transition-all duration-300 hover:shadow-md ${
      task.urgency === "now" ? "border-l-destructive" : 
      task.urgency === "soon" ? "border-l-orange-500" :
      task.urgency === "monitor" ? "border-l-blue-400" : "border-l-green-500"
    }`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {task.category && (
                <Badge variant="outline" className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                  {task.category}
                </Badge>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={`text-xs border ${getDiyBadgeColor(task.diyLevel)} shadow-none cursor-help`}>
                    {task.diyLevel || "Unknown"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {task.diyLevel === "DIY-Safe" && <p>Safe for most homeowners to complete with basic tools.</p>}
                  {task.diyLevel === "Caution" && <p>Can be done yourself but requires care. Research first or consider hiring a pro.</p>}
                  {task.diyLevel === "Pro-Only" && <p>Requires licensed professionals. May involve permits, electrical, gas, or structural work.</p>}
                  {!task.diyLevel && <p>Difficulty level not yet determined.</p>}
                </TooltipContent>
              </Tooltip>
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
              {task.title}
            </h3>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground group-hover:text-primary" data-testid={`button-task-${task.id}`}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View task details</TooltipContent>
          </Tooltip>
        </div>

        {task.safetyWarning && (
           <div className="mb-3 flex items-start gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
             <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
             {task.safetyWarning}
           </div>
        )}

        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mt-4 pt-4 border-t border-dashed">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className={isNow ? "text-destructive font-medium" : ""}>
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Not scheduled"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground justify-end">
             <span className="font-semibold text-foreground">{task.estimatedCost || "TBD"}</span>
          </div>
        </div>
        
        {task.diyLevel === "Pro-Only" && task.status !== "completed" && (
          <a
            href={buildAngiesListUrl(task.category || "Other")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
            data-testid={`link-find-pro-task-${task.id}`}
          >
            Find a Pro on Angi
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
