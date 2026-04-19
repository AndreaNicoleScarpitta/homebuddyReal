import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Wrench, Replace, ClipboardCheck, CheckCircle, ShoppingCart, FileCheck, Shield, Flag, FileText } from "lucide-react";
import type { V2TimelineEvent } from "@/lib/api";
import { ProvenanceBadge } from "./provenance-badge";

const categoryIcons: Record<string, any> = {
  repair: Wrench,
  replacement: Replace,
  inspection: ClipboardCheck,
  maintenance: CheckCircle,
  purchase: ShoppingCart,
  permit: FileCheck,
  warranty: Shield,
  milestone: Flag,
  document: FileText,
};

const categoryColors: Record<string, string> = {
  repair: "bg-orange-100 text-orange-700",
  replacement: "bg-red-100 text-red-700",
  inspection: "bg-blue-100 text-blue-700",
  maintenance: "bg-green-100 text-green-700",
  purchase: "bg-purple-100 text-purple-700",
  permit: "bg-yellow-100 text-yellow-700",
  warranty: "bg-teal-100 text-teal-700",
  milestone: "bg-pink-100 text-pink-700",
  document: "bg-gray-100 text-gray-700",
};

export function TimelineEntry({ event }: { event: V2TimelineEvent }) {
  const Icon = categoryIcons[event.category] || Flag;
  const colorClass = categoryColors[event.category] || "bg-gray-100 text-gray-700";

  return (
    <div className="flex gap-4 items-start">
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{event.title}</span>
          <Badge variant="outline" className="text-xs capitalize">{event.category}</Badge>
          <ProvenanceBadge source={event.provenanceSource} />
        </div>
        {event.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span>{format(new Date(event.eventDate), "MMM d, yyyy")}</span>
          {event.cost != null && event.cost > 0 && (
            <span className="font-medium text-foreground">${(event.cost / 100).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
