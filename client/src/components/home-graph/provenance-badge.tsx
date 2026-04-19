import { User, Sparkles, FileText, ClipboardCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const sourceConfig: Record<string, { icon: any; label: string; className: string }> = {
  manual: { icon: User, label: "User-entered", className: "text-muted-foreground" },
  "ai-inferred": { icon: Sparkles, label: "AI-inferred", className: "text-purple-500" },
  "document-extracted": { icon: FileText, label: "From document", className: "text-blue-500" },
  inspection: { icon: ClipboardCheck, label: "From inspection", className: "text-green-600" },
};

export function ProvenanceBadge({ source, confidence }: { source?: string | null; confidence?: number | null }) {
  const config = sourceConfig[source || "manual"] || sourceConfig.manual;
  const Icon = config.icon;
  const tip = confidence != null ? `${config.label} (${confidence}% confidence)` : config.label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 text-xs ${config.className}`}>
          <Icon className="h-3 w-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent><p>{tip}</p></TooltipContent>
    </Tooltip>
  );
}
