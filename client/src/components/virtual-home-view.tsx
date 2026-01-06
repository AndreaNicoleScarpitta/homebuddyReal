import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Home, 
  Zap, 
  Droplets, 
  Wind, 
  Sun, 
  Fence, 
  Shield, 
  Refrigerator,
  Flame,
  TreeDeciduous,
  Bug,
  Wrench,
  Plus,
  ChevronRight
} from "lucide-react";
import type { System } from "@shared/schema";

interface VirtualHomeViewProps {
  systems: System[];
  onAddSystem: (category: string) => void;
}

interface ZoneConfig {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  position: { top: string; left: string; width: string; height: string };
  color: string;
}

const zones: ZoneConfig[] = [
  {
    id: "roof",
    label: "Roof",
    category: "Roof",
    icon: <Home className="h-4 w-4" />,
    position: { top: "0%", left: "20%", width: "60%", height: "20%" },
    color: "bg-amber-100 border-amber-300 hover:bg-amber-200",
  },
  {
    id: "hvac",
    label: "HVAC",
    category: "HVAC",
    icon: <Wind className="h-4 w-4" />,
    position: { top: "25%", left: "5%", width: "25%", height: "30%" },
    color: "bg-blue-100 border-blue-300 hover:bg-blue-200",
  },
  {
    id: "electrical",
    label: "Electrical",
    category: "Electrical",
    icon: <Zap className="h-4 w-4" />,
    position: { top: "25%", left: "35%", width: "30%", height: "20%" },
    color: "bg-yellow-100 border-yellow-300 hover:bg-yellow-200",
  },
  {
    id: "plumbing",
    label: "Plumbing",
    category: "Plumbing",
    icon: <Droplets className="h-4 w-4" />,
    position: { top: "50%", left: "35%", width: "30%", height: "20%" },
    color: "bg-cyan-100 border-cyan-300 hover:bg-cyan-200",
  },
  {
    id: "windows",
    label: "Windows",
    category: "Windows",
    icon: <Sun className="h-4 w-4" />,
    position: { top: "25%", left: "70%", width: "25%", height: "30%" },
    color: "bg-sky-100 border-sky-300 hover:bg-sky-200",
  },
  {
    id: "appliances",
    label: "Appliances",
    category: "Appliances",
    icon: <Refrigerator className="h-4 w-4" />,
    position: { top: "60%", left: "5%", width: "25%", height: "25%" },
    color: "bg-slate-100 border-slate-300 hover:bg-slate-200",
  },
  {
    id: "water-heater",
    label: "Water Heater",
    category: "Water Heater",
    icon: <Flame className="h-4 w-4" />,
    position: { top: "60%", left: "70%", width: "25%", height: "25%" },
    color: "bg-orange-100 border-orange-300 hover:bg-orange-200",
  },
  {
    id: "exterior",
    label: "Exterior",
    category: "Siding/Exterior",
    icon: <Fence className="h-4 w-4" />,
    position: { top: "75%", left: "35%", width: "30%", height: "12%" },
    color: "bg-stone-100 border-stone-300 hover:bg-stone-200",
  },
  {
    id: "foundation",
    label: "Foundation",
    category: "Foundation",
    icon: <Shield className="h-4 w-4" />,
    position: { top: "88%", left: "20%", width: "60%", height: "12%" },
    color: "bg-gray-200 border-gray-400 hover:bg-gray-300",
  },
];

const getConditionColor = (condition: string | null | undefined) => {
  switch (condition) {
    case "Great": return "bg-green-500";
    case "Good": return "bg-green-400";
    case "Fair": return "bg-yellow-500";
    case "Poor": return "bg-red-500";
    default: return "bg-gray-400";
  }
};

export function VirtualHomeView({ systems, onAddSystem }: VirtualHomeViewProps) {
  const [selectedZone, setSelectedZone] = useState<ZoneConfig | null>(null);

  const getSystemsForZone = (category: string) => {
    return systems.filter(s => s.category === category);
  };

  const getZoneStatus = (category: string) => {
    const zoneSystems = getSystemsForZone(category);
    if (zoneSystems.length === 0) return null;
    
    const conditions = zoneSystems.map(s => s.condition).filter(Boolean);
    if (conditions.includes("Poor")) return "Poor";
    if (conditions.includes("Fair")) return "Fair";
    if (conditions.includes("Good")) return "Good";
    if (conditions.includes("Great")) return "Great";
    return "Unknown";
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Your Home Systems
          </CardTitle>
          <p className="text-sm text-muted-foreground">Tap any area to view or add systems</p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="relative w-full aspect-[4/3] bg-gradient-to-b from-sky-100 to-green-50 rounded-lg overflow-hidden border">
            {zones.map((zone) => {
              const zoneSystems = getSystemsForZone(zone.category);
              const status = getZoneStatus(zone.category);
              
              return (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZone(zone)}
                  className={`absolute flex flex-col items-center justify-center gap-1 rounded-md border-2 transition-all cursor-pointer ${zone.color}`}
                  style={{
                    top: zone.position.top,
                    left: zone.position.left,
                    width: zone.position.width,
                    height: zone.position.height,
                  }}
                  data-testid={`zone-${zone.id}`}
                >
                  <div className="flex items-center gap-1">
                    {zone.icon}
                    <span className="text-xs font-medium hidden sm:inline">{zone.label}</span>
                  </div>
                  {zoneSystems.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${getConditionColor(status)}`} />
                      <span className="text-xs text-muted-foreground">{zoneSystems.length}</span>
                    </div>
                  )}
                  {zoneSystems.length === 0 && (
                    <Plus className="h-3 w-3 text-muted-foreground opacity-50" />
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Great
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-yellow-500" /> Fair
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Poor
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-gray-400" /> Unknown
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedZone} onOpenChange={() => setSelectedZone(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedZone?.icon}
              {selectedZone?.label}
            </DialogTitle>
            <DialogDescription>
              Systems in this area of your home
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[300px]">
            {selectedZone && getSystemsForZone(selectedZone.category).length > 0 ? (
              <div className="space-y-3">
                {getSystemsForZone(selectedZone.category).map((system) => (
                  <div 
                    key={system.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{system.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {system.installYear && (
                          <span className="text-xs text-muted-foreground">
                            Installed {system.installYear}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${getConditionColor(system.condition)} text-white text-xs`}
                    >
                      {system.condition || "Unknown"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Wrench className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  No {selectedZone?.label.toLowerCase()} systems tracked yet
                </p>
              </div>
            )}
          </ScrollArea>
          
          <Button 
            onClick={() => {
              if (selectedZone) {
                onAddSystem(selectedZone.category);
                setSelectedZone(null);
              }
            }}
            className="w-full"
            data-testid="button-add-zone-system"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {selectedZone?.label} System
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
