import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDefinition } from "@/data/definitions";
import { useDefinitions } from "@/hooks/use-definitions";
import { trackEvent } from "@/lib/analytics";
import { useCallback } from "react";

interface FieldTooltipProps {
  termSlug: string;
  className?: string;
  screenName?: string;
}

export function FieldTooltip({ termSlug, className = "", screenName }: FieldTooltipProps) {
  const term = getDefinition(termSlug);
  const { openDefinitions } = useDefinitions();

  const handleOpen = useCallback((open: boolean) => {
    if (open) {
      trackEvent("tooltip_opened", "definitions", termSlug);
    }
  }, [termSlug]);

  const handleLearnMore = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    trackEvent("definition_viewed", "definitions", termSlug);
    openDefinitions(termSlug);
  }, [termSlug, openDefinitions]);

  if (!term) return null;

  return (
    <Tooltip delayDuration={100} onOpenChange={handleOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className={`inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none min-w-[28px] min-h-[28px] md:min-w-[22px] md:min-h-[22px] ${className}`}
          aria-label={`What is ${term.title}?`}
          data-testid={`tooltip-trigger-${termSlug}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs bg-popover text-popover-foreground border shadow-md rounded-lg px-3 py-2.5 text-sm"
        sideOffset={6}
      >
        <p className="leading-relaxed">{term.shortDefinition}</p>
        {term.longDefinition && (
          <button
            type="button"
            onClick={handleLearnMore}
            className="mt-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors focus:outline-none focus:underline"
            data-testid={`tooltip-learn-more-${termSlug}`}
          >
            Learn more
          </button>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
