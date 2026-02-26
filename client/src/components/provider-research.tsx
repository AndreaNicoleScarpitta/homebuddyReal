import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ExternalLink, Star, Users, Globe } from "lucide-react";

interface ProviderResearchProps {
  category: string;
  repairType?: string;
  variant?: "inline" | "card" | "collapsed";
  className?: string;
}

export function ProviderResearch({ 
  category, 
  repairType,
  variant = "inline",
  className = ""
}: ProviderResearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const angiUrl = `https://www.angi.com/search/?search_query=${encodeURIComponent(`${repairType || category} repair`)}`;
  
  if (variant === "collapsed") {
    return (
      <div className={className}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-find-pros"
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          Find a professional
        </button>
        
        {isExpanded && (
          <div className="mt-3 p-4 bg-muted/30 rounded-lg border border-muted">
            <p className="text-sm text-muted-foreground mb-3">
              Compare local pros, reviews, and typical pricing for {category.toLowerCase()} work.
            </p>
            <a
              href={angiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              data-testid="link-angi-search"
            >
              Research providers via Angi
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="text-xs text-muted-foreground mt-3 italic">
              Provider listings powered by Angi. Home Buddy does not receive payment based on your choice.
            </p>
          </div>
        )}
      </div>
    );
  }
  
  if (variant === "card") {
    return (
      <div className={`p-4 rounded-lg bg-muted/20 border border-muted ${className}`}>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <Globe className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-foreground text-sm">Find a professional</h4>
              <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
                via Angi
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Search Angi.com to compare local providers, read reviews, and get quotes.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <a
                href={angiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                data-testid="link-angi-search"
              >
                Search on Angi.com
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-muted">
          This opens Angi.com in a new tab. Home Buddy is not affiliated with Angi and receives no payment based on your choice.
        </p>
      </div>
    );
  }
  
  return (
    <div className={`p-3 bg-muted/20 rounded-lg border border-muted ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Need a pro?</span>
          <a
            href={angiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            data-testid="link-angi-search"
          >
            Search vetted providers
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
          <Globe className="h-3 w-3 mr-1" />
          Angi
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Opens Angi.com in a new tab. We're not affiliated with Angi and receive no payment.
      </p>
    </div>
  );
}

export function ProviderPrompt({ 
  category, 
  estimatedCost,
  fundsAvailable,
  onDismiss 
}: { 
  category: string; 
  estimatedCost?: string;
  fundsAvailable?: number;
  onDismiss?: () => void;
}) {
  const angiUrl = `https://www.angi.com/search/?search_query=${encodeURIComponent(`${category} repair`)}`;
  
  const costNum = estimatedCost ? parseInt(estimatedCost.replace(/[^0-9]/g, '')) * 100 : 0;
  const canAfford = fundsAvailable ? costNum <= fundsAvailable : true;
  
  return (
    <div className="p-4 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 border border-muted">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground">This repair typically requires a professional</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {canAfford 
              ? "You can explore vetted providers now, or save this for later."
              : "You can explore providers now to compare quotes, or wait until your budget catches up."
            }
          </p>
          <div className="flex items-center gap-3 mt-3">
            <a
              href={angiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
              data-testid="link-angi-cta"
            >
              Research providers
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground">
                Not now
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4 italic">
        Provider listings powered by Angi. Home Buddy does not receive payment based on your choice.
      </p>
    </div>
  );
}
