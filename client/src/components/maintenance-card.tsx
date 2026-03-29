import { useState } from "react";
import { Calendar, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert, ExternalLink, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { V2Task } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

const serviceTypeMapping: Record<string, string> = {
  "HVAC": "hvac",
  "Plumbing": "plumbing", 
  "Electrical": "electricians",
  "Roof": "roofing",
  "Windows": "windows",
  "Siding/Exterior": "siding",
  "Foundation": "foundation-repair",
  "Appliances": "appliance-repair",
  "Water Heater": "water-heater",
  "Landscaping": "landscaping",
  "Pest": "pest-control",
  "Other": "home-improvement",
};

function buildAngiesListUrl(serviceType: string): string {
  const mappedCategory = serviceTypeMapping[serviceType];
  const category = mappedCategory || encodeURIComponent(serviceType.toLowerCase().replace(/\s+/g, "-"));
  return `https://www.angi.com/companylist/${category}.htm`;
}

interface TaskProps {
  task: V2Task;
  onComplete?: (task: V2Task) => void;
}

export function MaintenanceCard({ task, onComplete }: TaskProps) {
  const [expanded, setExpanded] = useState(false);
  const isNow = task.urgency === "now";
  
  const getDiyBadgeColor = (level: string | null | undefined) => {
    switch (level) {
      case "DIY-Safe": return "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-950/60 border-green-200 dark:border-green-800";
      case "Caution": return "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-950/60 border-yellow-200 dark:border-yellow-800";
      case "Pro-Only": return "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-950/60 border-red-200 dark:border-red-800";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
    trackEvent('click', 'task_card', expanded ? 'collapse' : 'expand');
  };

  const urgencyLabel = task.urgency === "now" ? "Urgent" :
    task.urgency === "soon" ? "Soon" :
    task.urgency === "monitor" ? "Monitor" : "Later";

  const urgencyA11yClass = task.urgency === "now" ? "border-l-destructive" :
    task.urgency === "soon" ? "border-l-orange-500" :
    task.urgency === "monitor" ? "border-l-blue-400" : "border-l-green-500";

  return (
    <Card className={`group overflow-hidden border-l-4 transition-all duration-300 hover:shadow-md ${urgencyA11yClass}`} role="article" aria-label={`${task.title} — urgency: ${urgencyLabel}`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Urgency badge — visible text label + icon so color is not the only indicator */}
              <Badge
                variant="outline"
                className={`text-xs font-semibold uppercase tracking-wider ${
                  task.urgency === "now" ? "text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30" :
                  task.urgency === "soon" ? "text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30" :
                  task.urgency === "monitor" ? "text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30" :
                  "text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30"
                }`}
                aria-label={`Urgency: ${urgencyLabel}`}
              >
                {task.urgency === "now" ? "⚠ Urgent" :
                 task.urgency === "soon" ? "● Soon" :
                 task.urgency === "monitor" ? "◉ Monitor" : "○ Later"}
              </Badge>
              {task.category && (
                <Badge variant="outline" className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                  {task.category}
                </Badge>
              )}
              {task.namespacePrefix && task.namespacePrefix !== "unknown_system" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs font-mono bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      data-testid={`badge-namespace-${task.id}`}
                    >
                      {task.namespacePrefix.replace(/_/g, " ")}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>System namespace: <code className="text-xs">{task.namespacePrefix}</code></p>
                    <p className="text-muted-foreground mt-1">Attributes for this task are scoped to this system instance.</p>
                  </TooltipContent>
                </Tooltip>
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
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground group-hover:text-primary shrink-0" 
            onClick={toggleExpanded}
            data-testid={`button-task-${task.id}`}
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </div>

        {task.safetyWarning && (
           <div className="mb-3 flex items-start gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 p-2 rounded border border-orange-100 dark:border-orange-800">
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
             <DollarSign className="h-3.5 w-3.5" />
             <span className="font-semibold text-foreground">{task.estimatedCost || "TBD"}</span>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {task.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
            )}
            
            <div className="flex flex-wrap gap-2">
              {onComplete && task.status !== "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackEvent('click', 'task_card', 'mark_done');
                    onComplete(task);
                  }}
                  className="text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-800 dark:hover:text-green-300"
                  data-testid={`button-complete-task-${task.id}`}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Mark Done
                </Button>
              )}
              
              {task.diyLevel === "Pro-Only" && task.status !== "completed" && (
                <a
                  href={buildAngiesListUrl(task.category || "Other")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 rounded-md transition-colors border border-blue-200 dark:border-blue-800"
                  data-testid={`link-find-pro-task-${task.id}`}
                >
                  Find a Pro on Angi
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
        
        {!expanded && task.diyLevel === "Pro-Only" && task.status !== "completed" && (
          <a
            href={buildAngiesListUrl(task.category || "Other")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 rounded-md transition-colors"
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
