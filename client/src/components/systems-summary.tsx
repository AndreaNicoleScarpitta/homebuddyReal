import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Plus, Home, Wind, Droplets, Zap, Square, Layers, Building, CookingPot, Flame, Trees, Bug, HelpCircle, Landmark } from "lucide-react";
import { useLocation } from "wouter";
import { trackEvent } from "@/lib/analytics";
import { systemCategories } from "@shared/schema";
import type { V2System } from "@/lib/api";

const categoryIcons: Record<string, any> = {
  "Roof": Home,
  "HVAC": Wind,
  "Plumbing": Droplets,
  "Electrical": Zap,
  "Windows": Square,
  "Siding/Exterior": Layers,
  "Foundation": Building,
  "Chimney": Landmark,
  "Appliances": CookingPot,
  "Water Heater": Flame,
  "Landscaping": Trees,
  "Pest": Bug,
  "Other": HelpCircle,
};

interface SystemsSummaryProps {
  systems: V2System[];
  onAddSystem: () => void;
}

export function SystemsSummary({ systems, onAddSystem }: SystemsSummaryProps) {
  const [, navigate] = useLocation();

  const countsByType: Record<string, number> = {};
  for (const cat of systemCategories) {
    countsByType[cat] = 0;
  }
  for (const sys of systems) {
    const cat = sys.category || "Other";
    if (cat in countsByType) {
      countsByType[cat]++;
    } else {
      countsByType["Other"]++;
    }
  }

  const handleTypeClick = (type: string) => {
    trackEvent("system_type_opened", "systems", type);
    navigate(`/systems?type=${encodeURIComponent(type)}`);
  };

  const handleViewAll = () => {
    trackEvent("systems_directory_opened", "systems");
    navigate("/systems");
  };

  return (
    <Card data-testid="card-systems-summary">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            Your Systems
            <Badge variant="secondary" className="text-xs" data-testid="badge-systems-total">
              {systems.length}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleViewAll}
            data-testid="button-view-all-systems"
          >
            View All <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {systemCategories.map((type) => {
            const count = countsByType[type];
            const Icon = categoryIcons[type] || HelpCircle;
            const hasInstances = count > 0;

            return (
              <button
                key={type}
                onClick={() => handleTypeClick(type)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors hover:border-primary hover:bg-primary/5"
                data-testid={`pill-system-type-${type.toLowerCase().replace(/\//g, "-")}`}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{type}</span>
                {hasInstances ? (
                  <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                    {count}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Plus className="h-3 w-3" />
                    Add
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
