import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AddSystemWizard } from "@/components/add-system-wizard";
import {
  Home,
  Wind,
  Droplets,
  Zap,
  Square,
  Layers,
  Building,
  CookingPot,
  Flame,
  Trees,
  Bug,
  HelpCircle,
  Search,
  Plus,
  ArrowLeft,
  ArrowUpDown,
  ChevronRight,
  Package,
  Landmark,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getHome, getSystems, getTasks } from "@/lib/api";
import type { V2System, V2Task } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { systemCategories } from "@shared/schema";

const categoryIcons: Record<string, any> = {
  Roof: Home,
  HVAC: Wind,
  Plumbing: Droplets,
  Electrical: Zap,
  Windows: Square,
  "Siding/Exterior": Layers,
  Foundation: Building,
  Chimney: Landmark,
  Appliances: CookingPot,
  "Water Heater": Flame,
  Landscaping: Trees,
  Pest: Bug,
  Other: HelpCircle,
};

type SortOption = "recent" | "type" | "oldest";

function SystemsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

function SystemCard({
  system,
  taskCount,
}: {
  system: V2System;
  taskCount: number;
}) {
  const Icon = categoryIcons[system.category] || Package;

  return (
    <Link href={`/systems/${system.id}`}>
      <Card
        className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group"
        data-testid={`card-system-${system.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3
                  className="font-medium text-sm truncate"
                  data-testid={`text-system-name-${system.id}`}
                >
                  {system.name}
                </h3>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {system.category}
                </Badge>
                {system.condition && system.condition !== "Unknown" && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${
                      system.condition === "Poor"
                        ? "border-red-300 text-red-600 dark:border-red-700 dark:text-red-400"
                        : system.condition === "Fair"
                          ? "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                          : "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                    }`}
                  >
                    {system.condition}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {(system.make || system.model) && (
                  <span className="truncate">
                    {[system.make, system.model].filter(Boolean).join(" ")}
                  </span>
                )}
                {taskCount > 0 && (
                  <span className="shrink-0">
                    {taskCount} task{taskCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ onAddSystem }: { onAddSystem: (type?: string) => void }) {
  const commonTypes = ["HVAC", "Plumbing", "Electrical"];

  return (
    <Card className="p-8">
      <div className="max-w-md mx-auto text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-medium mb-2" data-testid="text-empty-state">
          No systems yet
        </h3>
        <p className="text-muted-foreground text-sm mb-6">
          Start tracking your home systems to stay on top of maintenance. Here
          are the most common ones to add first:
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {commonTypes.map((type) => {
            const Icon = categoryIcons[type];
            return (
              <Button
                key={type}
                variant="outline"
                onClick={() => {
                  trackEvent("system_instance_add_started", "systems", type);
                  onAddSystem(type);
                }}
                className="gap-2"
                data-testid={`button-suggest-${type.toLowerCase()}`}
              >
                <Icon className="h-4 w-4" />
                Add {type}
              </Button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function TypeInstancesView({
  type,
  systems,
  tasks,
  onAddSystem,
  onClearFilter,
}: {
  type: string;
  systems: V2System[];
  tasks: V2Task[];
  onAddSystem: () => void;
  onClearFilter: () => void;
}) {
  const typeInstances = systems.filter((s) => s.category === type);

  const getTaskCount = (systemId: string) =>
    tasks.filter((t) => t.relatedSystemId === systemId).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilter}
          className="gap-1 text-muted-foreground"
          data-testid="button-clear-type-filter"
        >
          <ArrowLeft className="h-4 w-4" />
          All Systems
        </Button>
      </div>

      {typeInstances.length === 0 ? (
        <Card className="p-8">
          <div className="max-w-sm mx-auto text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              {(() => {
                const Icon = categoryIcons[type] || Package;
                return <Icon className="h-6 w-6 text-primary" />;
              })()}
            </div>
            <h3 className="text-lg font-medium mb-2" data-testid="text-type-empty">
              No {type} systems
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              You haven't added any {type} systems yet. Add one to start
              tracking it.
            </p>
            <Button
              onClick={() => {
                trackEvent("system_instance_add_started", "systems", type);
                onAddSystem();
              }}
              className="gap-2"
              data-testid="button-add-type-system"
            >
              <Plus className="h-4 w-4" />
              Add {type} System
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-type-count"
            >
              You have {typeInstances.length} {type} system
              {typeInstances.length !== 1 ? "s" : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                trackEvent("system_instance_add_started", "systems", type);
                onAddSystem();
              }}
              className="gap-1.5"
              data-testid="button-add-another-type"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Another {type} System
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {typeInstances.map((system) => (
              <SystemCard
                key={system.id}
                system={system}
                taskCount={getTaskCount(system.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SystemsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const typeParam = params.get("type");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [activeType, setActiveType] = useState<string | null>(typeParam);
  const [showAddSystem, setShowAddSystem] = useState(false);

  useEffect(() => {
    if (typeParam) {
      setActiveType(typeParam);
      trackEvent("system_type_opened", "systems", typeParam);
    }
  }, [typeParam]);

  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    enabled: isAuthenticated,
  });

  const { data: systems = [], isLoading: systemsLoading } = useQuery({
    queryKey: ["systems", home?.id],
    queryFn: () => getSystems(home!.id),
    enabled: !!home?.id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", home?.id],
    queryFn: () => getTasks(home!.id),
    enabled: !!home?.id,
  });

  useEffect(() => {
    if (!authLoading && !homeLoading && !home) {
      navigate("/onboarding");
    }
  }, [authLoading, homeLoading, home, navigate]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of systemCategories) {
      counts[cat] = 0;
    }
    for (const s of systems) {
      if (counts[s.category] !== undefined) {
        counts[s.category]++;
      }
    }
    return counts;
  }, [systems]);

  const getTaskCount = (systemId: string) =>
    tasks.filter((t) => t.relatedSystemId === systemId).length;

  const filteredSystems = useMemo(() => {
    let result = [...systems];

    if (activeType) {
      result = result.filter((s) => s.category === activeType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.make && s.make.toLowerCase().includes(q)) ||
          (s.model && s.model.toLowerCase().includes(q))
      );
    }

    switch (sortBy) {
      case "type":
        result.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case "oldest":
        result.sort((a, b) => {
          const aYear = a.installYear ?? 9999;
          const bYear = b.installYear ?? 9999;
          return aYear - bYear;
        });
        break;
      case "recent":
      default:
        result.sort((a, b) => {
          const aYear = a.installYear ?? 0;
          const bYear = b.installYear ?? 0;
          return bYear - aYear;
        });
        break;
    }

    return result;
  }, [systems, activeType, searchQuery, sortBy]);

  if (authLoading || homeLoading || systemsLoading) {
    return (
      <Layout>
        <SystemsPageSkeleton />
      </Layout>
    );
  }

  if (!home) return null;

  const handleTypeClick = (type: string) => {
    if (activeType === type) {
      setActiveType(null);
      navigate("/systems", { replace: true });
    } else {
      setActiveType(type);
      trackEvent("system_type_opened", "systems", type);
      navigate(`/systems?type=${encodeURIComponent(type)}`, { replace: true });
    }
  };

  const handleClearFilter = () => {
    setActiveType(null);
    navigate("/systems", { replace: true });
  };

  const handleAddSystem = (_type?: string) => {
    setShowAddSystem(true);
  };

  const isTypeView = activeType && !searchQuery.trim();

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-heading font-bold text-foreground"
              data-testid="text-systems-heading"
            >
              Systems
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {systems.length} system{systems.length !== 1 ? "s" : ""} tracked
            </p>
          </div>
          <Button
            onClick={() => {
              trackEvent("system_instance_add_started", "systems", "general");
              setShowAddSystem(true);
            }}
            size="sm"
            className="gap-1.5"
            data-testid="button-add-system"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add System</span>
          </Button>
        </header>

        {systems.length === 0 && !searchQuery ? (
          <EmptyState onAddSystem={handleAddSystem} />
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <button
                onClick={handleClearFilter}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  !activeType
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid="button-filter-all"
              >
                All ({systems.length})
              </button>
              {systemCategories.map((cat) => {
                const count = typeCounts[cat];
                const isActive = activeType === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => handleTypeClick(cat)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    data-testid={`button-filter-${cat.toLowerCase().replace(/\//g, "-")}`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            {isTypeView ? (
              <TypeInstancesView
                type={activeType}
                systems={systems}
                tasks={tasks}
                onAddSystem={() => {
                  trackEvent(
                    "system_instance_add_started",
                    "systems",
                    activeType
                  );
                  setShowAddSystem(true);
                }}
                onClearFilter={handleClearFilter}
              />
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, brand, or model..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-systems"
                    />
                  </div>
                  <Select
                    value={sortBy}
                    onValueChange={(v) => setSortBy(v as SortOption)}
                  >
                    <SelectTrigger
                      className="w-[140px] shrink-0"
                      data-testid="select-sort-systems"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Most Recent</SelectItem>
                      <SelectItem value="type">By Type</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredSystems.length === 0 ? (
                  <Card className="p-8">
                    <div className="text-center">
                      <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                      <h3 className="font-medium mb-1" data-testid="text-no-results">
                        No systems found
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {searchQuery
                          ? `No systems match "${searchQuery}"`
                          : "Try adjusting your filters"}
                      </p>
                    </div>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredSystems.map((system) => (
                      <SystemCard
                        key={system.id}
                        system={system}
                        taskCount={getTaskCount(system.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <AddSystemWizard
          isOpen={showAddSystem}
          onClose={() => setShowAddSystem(false)}
          homeId={home.id}
          existingSystems={systems}
        />
      </div>
    </Layout>
  );
}
