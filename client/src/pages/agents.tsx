import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Play, Clock, CheckCircle2, XCircle, AlertTriangle,
  Zap, Mail, BarChart3, Megaphone, Wrench, ChevronDown, ChevronUp
} from "lucide-react";

interface Agent {
  id: number;
  slug: string;
  name: string;
  type: string;
  status: string;
  description: string;
  purpose: string;
  trigger: string;
  schedule: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  runCount: number;
  successCount: number;
  failureCount: number;
}

const TYPE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  marketing: { icon: Megaphone, label: "Marketing", color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800" },
  engagement: { icon: Mail, label: "Engagement", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
  maintenance: { icon: Wrench, label: "Maintenance", color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800" },
  system: { icon: Zap, label: "System", color: "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800" },
};

const STATUS_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  active: { icon: CheckCircle2, label: "Active", color: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
  inactive: { icon: XCircle, label: "Inactive", color: "text-gray-500 bg-gray-50 border-gray-200" },
  draft: { icon: Clock, label: "Draft", color: "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" },
  error: { icon: AlertTriangle, label: "Error", color: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" },
};

function AgentCard({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const typeMeta = TYPE_META[agent.type] || TYPE_META.system;
  const statusMeta = STATUS_META[agent.status] || STATUS_META.draft;
  const TypeIcon = typeMeta.icon;
  const StatusIcon = statusMeta.icon;

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/agents/${agent.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: {} }),
      });
      if (!res.ok) throw new Error("Failed to start agent");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: `${agent.name} started`, description: "Running in background — check back shortly." });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: () => {
      toast({ title: "Failed to start agent", variant: "destructive" });
    },
  });

  const successRate = agent.runCount > 0
    ? Math.round((agent.successCount / agent.runCount) * 100)
    : null;

  return (
    <div className="border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-muted mt-0.5 shrink-0">
              <TypeIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-heading font-semibold text-foreground">{agent.name}</h3>
                <Badge variant="outline" className={`text-xs border ${typeMeta.color}`}>
                  {typeMeta.label}
                </Badge>
                <Badge variant="outline" className={`text-xs border ${statusMeta.color}`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusMeta.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || agent.status === "inactive" || agent.status === "draft"}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              Run
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-dashed border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            {agent.runCount} run{agent.runCount !== 1 ? "s" : ""}
          </span>
          {successRate !== null && (
            <span className={successRate >= 80 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}>
              {successRate}% success
            </span>
          )}
          {agent.trigger === "scheduled" && agent.schedule && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {agent.schedule}
            </span>
          )}
          {agent.lastRunAt && (
            <span>Last run: {new Date(agent.lastRunAt).toLocaleDateString()}</span>
          )}
          {agent.lastRunStatus && (
            <span className={agent.lastRunStatus === "completed" ? "text-green-600 dark:text-green-400" : "text-red-500"}>
              {agent.lastRunStatus}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/30 p-5 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Purpose</p>
            <p className="text-sm text-foreground">{agent.purpose || "No purpose defined."}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Trigger: <strong className="text-foreground">{agent.trigger}</strong></span>
            <span>Model: <strong className="text-foreground">gpt-4o</strong></span>
            <span>Slug: <code className="bg-muted px-1 rounded text-foreground">{agent.slug}</code></span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const [filter, setFilter] = useState<string>("all");

  const { data: agentList = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  const types = ["all", "marketing", "engagement", "maintenance", "system"];
  const filtered = filter === "all" ? agentList : agentList.filter(a => a.type === filter);

  const counts = {
    total: agentList.length,
    active: agentList.filter(a => a.status === "active").length,
    marketing: agentList.filter(a => a.type === "marketing").length,
    engagement: agentList.filter(a => a.type === "engagement").length,
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-heading font-bold text-foreground">Agent System</h1>
          </div>
          <p className="text-muted-foreground">
            Autonomous agents for marketing, engagement, and home maintenance intelligence.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Agents", value: counts.total },
            { label: "Active", value: counts.active },
            { label: "Marketing", value: counts.marketing },
            { label: "Engagement", value: counts.engagement },
          ].map(stat => (
            <div key={stat.label} className="border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-heading text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {types.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Agent list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-border rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No agents found</p>
            <p className="text-sm mt-1">Run <code className="bg-muted px-1 rounded">npm run seed:agents</code> to seed agent data</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
