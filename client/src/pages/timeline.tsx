import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHome, getTimeline, type V2TimelineEvent } from "@/lib/api";
import { Layout } from "@/components/layout";
import { TimelineEntry } from "@/components/home-graph/timeline-entry";
import { Badge } from "@/components/ui/badge";
import { Clock, Wrench, Replace, ClipboardCheck, CheckCircle, ShoppingCart, FileCheck, Shield, Flag, FileText } from "lucide-react";

const categories = [
  { value: "", label: "All", icon: Clock },
  { value: "repair", label: "Repairs", icon: Wrench },
  { value: "replacement", label: "Replacements", icon: Replace },
  { value: "maintenance", label: "Maintenance", icon: CheckCircle },
  { value: "inspection", label: "Inspections", icon: ClipboardCheck },
  { value: "purchase", label: "Purchases", icon: ShoppingCart },
  { value: "permit", label: "Permits", icon: FileCheck },
  { value: "warranty", label: "Warranties", icon: Shield },
  { value: "milestone", label: "Milestones", icon: Flag },
  { value: "document", label: "Documents", icon: FileText },
];

export default function Timeline() {
  const [selectedCategory, setSelectedCategory] = useState("");

  const { data: home } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });

  const homeId = home?.legacyId || home?.id;

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["timeline", homeId, selectedCategory],
    queryFn: () => getTimeline(homeId!, { category: selectedCategory || undefined, limit: 100 }),
    enabled: !!homeId,
  });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold">Your Home's Story</h1>
          <p className="text-muted-foreground text-sm mt-1">Everything that's happened to your home, in order.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.value;
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No events yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              As you track repairs, maintenance, and documents, your home's timeline will build automatically.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-6">
              {events.map((event) => (
                <div key={event.id} className="relative pl-12">
                  <div className="absolute left-3.5 top-3 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                  <TimelineEntry event={event} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
