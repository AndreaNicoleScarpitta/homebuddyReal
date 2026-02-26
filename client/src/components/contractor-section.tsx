import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Users, Search } from "lucide-react";
import type { V2Task } from "@/lib/api";

interface ContractorSectionProps {
  homeId: string | number;
  pendingTasks?: V2Task[];
  zipCode?: string;
}

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

function buildAngiSearchUrl(serviceType: string, zipCode?: string): string {
  const params = new URLSearchParams({ search_query: serviceType });
  if (zipCode) params.set("postal_code", zipCode);
  return `https://www.angi.com/search/?${params.toString()}`;
}

export function ContractorSection({ homeId, pendingTasks = [], zipCode }: ContractorSectionProps) {
  const urgentTasks = pendingTasks.filter(t => 
    (t.urgency === "now" || t.urgency === "soon") && 
    t.diyLevel === "Pro-Only" && 
    t.status !== "completed"
  );

  const uniqueCategories = Array.from(new Set(urgentTasks.map(t => t.category).filter(Boolean))) as string[];

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-background">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Find a Pro</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
            Powered by Angi
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {urgentTasks.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              {urgentTasks.length} task{urgentTasks.length > 1 ? 's' : ''} may need professional help
            </p>
            <div className="space-y-2">
              {urgentTasks.slice(0, 3).map((task) => (
                <a
                  key={task.id}
                  href={buildAngiSearchUrl(task.category || "Other", zipCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
                  data-testid={`link-find-pro-${task.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.category} • {task.urgency === "now" ? "Urgent" : "Plan soon"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-blue-600">
                    <span className="text-xs font-medium group-hover:underline">Find pros</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </a>
              ))}
            </div>
            {urgentTasks.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{urgentTasks.length - 3} more tasks need attention
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No urgent pro-only tasks right now
            </p>
            <a
              href={buildAngiSearchUrl("home improvement", zipCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
              data-testid="link-browse-angi"
            >
              <Search className="h-4 w-4" />
              Search for contractors on Angi
            </a>
          </div>
        )}

        {uniqueCategories.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">Quick search by category:</p>
            <div className="flex flex-wrap gap-2">
              {uniqueCategories.slice(0, 4).map((cat) => (
                <a
                  key={cat}
                  href={buildAngiSearchUrl(cat, zipCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                  data-testid={`link-category-${cat.toLowerCase().replace(/\//g, "-")}`}
                >
                  {cat}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
