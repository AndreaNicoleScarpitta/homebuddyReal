import { Info } from "lucide-react";
import { Link } from "wouter";

interface MissingDataItem {
  systemId: number;
  systemName: string;
  signal: string;
}

export function MissingDataPrompts({ items }: { items: MissingDataItem[] }) {
  if (items.length === 0) return null;

  // Group by system, limit to 5 total
  const limited = items.slice(0, 5);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4" />
        Improve Your Insights
      </h3>
      <div className="space-y-1.5">
        {limited.map((item, i) => (
          <Link key={i} href={`/systems/${item.systemId}`}>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer">
              <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-blue-700 dark:text-blue-300">{item.signal}</span>
            </div>
          </Link>
        ))}
      </div>
      {items.length > 5 && (
        <p className="text-xs text-muted-foreground pl-6">and {items.length - 5} more...</p>
      )}
    </div>
  );
}
