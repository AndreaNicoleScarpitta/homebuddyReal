import { useMutation, useQueryClient } from "@tanstack/react-query";
import { acceptRecommendation, dismissRecommendation, type V2Recommendation } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, Sparkles, ClipboardCheck, Wrench, User, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const urgencyColors: Record<string, string> = {
  now: "bg-red-100 text-red-700",
  soon: "bg-orange-100 text-orange-700",
  later: "bg-blue-100 text-blue-700",
  monitor: "bg-gray-100 text-gray-600",
};

const sourceIcons: Record<string, any> = {
  ai: Sparkles,
  inspector: ClipboardCheck,
  contractor: Wrench,
  manual: User,
  "best-practice": BookOpen,
};

export function RecommendationCard({ rec, homeId }: { rec: V2Recommendation; homeId: number | string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const SourceIcon = sourceIcons[rec.source] || Sparkles;

  const acceptMutation = useMutation({
    mutationFn: () => acceptRecommendation(rec.id, { createTask: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations", homeId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Recommendation accepted" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: () => dismissRecommendation(rec.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations", homeId] });
      toast({ title: "Recommendation dismissed" });
    },
  });

  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SourceIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm">{rec.title}</span>
            <Badge variant="outline" className={`text-xs ${urgencyColors[rec.urgency || "later"]}`}>{rec.urgency || "later"}</Badge>
            {rec.confidence != null && (
              <span className="text-xs text-muted-foreground">{rec.confidence}% confident</span>
            )}
          </div>
          {rec.description && <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>}
          {rec.rationale && <p className="text-xs text-muted-foreground mt-1 italic">{rec.rationale}</p>}
          {rec.estimatedCost && <span className="text-xs font-medium mt-1 inline-block">Est. {rec.estimatedCost}</span>}
        </div>
        {rec.status === "open" && (
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="outline" size="sm" className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Accept
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => dismissMutation.mutate()} disabled={dismissMutation.isPending}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {rec.status !== "open" && (
          <Badge variant="outline" className="text-xs capitalize">{rec.status}</Badge>
        )}
      </div>
    </div>
  );
}
