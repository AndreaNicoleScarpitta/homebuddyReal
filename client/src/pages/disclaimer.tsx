import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldAlert,
  AlertTriangle,
  Wrench,
  Bot,
  Phone,
  FileText,
  Scale,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

async function acceptDisclaimer(): Promise<{ accepted: boolean; version: string; acceptedAt: string }> {
  const res = await fetch("/api/disclaimer/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to accept disclaimer");
  return res.json();
}

export default function Disclaimer() {
  const [, navigate] = useLocation();
  const [acknowledged, setAcknowledged] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const acceptMutation = useMutation({
    mutationFn: acceptDisclaimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/disclaimer/status"] });
      trackEvent("disclaimer_accepted", "legal", "v1.0");
      toast({
        title: "Disclaimer accepted",
        description: "You can now use file upload and analysis features.",
      });
      navigate("/document-analysis");
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Could not record your acceptance. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6 pb-28 md:pb-6">
        <header>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="disclaimer-title">
              Safety & Responsibility Notice
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Please review this important information before using HomeBuddy's file analysis features.
          </p>
        </header>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-orange-50 border-b px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
            <p className="text-sm font-medium text-orange-900">
              HomeBuddy is not a monitoring service
            </p>
          </div>
          <div className="p-4 space-y-4 text-sm text-muted-foreground">
            <p>
              HomeBuddy does <strong className="text-foreground">not</strong> actively monitor your home, its systems, or their condition. The application does not detect emergencies, send real-time alerts about system failures, or warn you about developing hazards. If something goes wrong in your home — a pipe bursts, a breaker trips, an appliance fails — HomeBuddy will not detect or notify you.
            </p>
            <p>
              Any information, tasks, or recommendations you see inside HomeBuddy are generated <strong className="text-foreground">only</strong> from documents, photos, and data you have manually uploaded. HomeBuddy cannot see, sense, or evaluate anything beyond what you provide.
            </p>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-blue-50 border-b px-4 py-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm font-medium text-blue-900">
              AI-generated guidance only
            </p>
          </div>
          <div className="p-4 space-y-4 text-sm text-muted-foreground">
            <p>
              HomeBuddy uses artificial intelligence to analyze uploaded files and suggest maintenance tasks, repair priorities, and system attributes. These outputs are <strong className="text-foreground">informational guidance only</strong> and are not professional advice, formal inspections, or certified assessments.
            </p>
            <p>
              AI analysis can be wrong. It may miss issues, misidentify systems, suggest incorrect priorities, or provide inaccurate cost estimates. You should always verify AI-generated information independently and consult licensed professionals before taking action.
            </p>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-red-50 border-b px-4 py-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm font-medium text-red-900">
              Your responsibility
            </p>
          </div>
          <div className="p-4 space-y-3 text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-foreground font-medium shrink-0">•</span>
                All decisions about your home — including repairs, maintenance, and hiring contractors — are entirely your responsibility.
              </li>
              <li className="flex gap-2">
                <span className="text-foreground font-medium shrink-0">•</span>
                HomeBuddy is not a substitute for professional home inspections, licensed contractor evaluations, or building code compliance checks.
              </li>
              <li className="flex gap-2">
                <span className="text-foreground font-medium shrink-0">•</span>
                Any repairs or actions you take based on information from HomeBuddy are at your own risk.
              </li>
              <li className="flex gap-2">
                <span className="text-foreground font-medium shrink-0">•</span>
                HomeBuddy, its creators, and its affiliates are not liable for any damages, injuries, or losses resulting from actions taken based on the application's output.
              </li>
            </ul>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-amber-50 border-b px-4 py-3 flex items-center gap-2">
            <Phone className="h-4 w-4 text-amber-700 shrink-0" />
            <p className="text-sm font-medium text-amber-900">
              Emergencies
            </p>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            <p>
              For gas leaks, electrical fires, flooding, structural collapse, or any other emergency: <strong className="text-foreground">evacuate immediately and call 911.</strong> Do not rely on this application in any emergency situation.
            </p>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 border-b px-4 py-3 flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium text-foreground">
              Limitation of liability
            </p>
          </div>
          <div className="p-4 text-sm text-muted-foreground space-y-3">
            <p>
              HomeBuddy is provided "as is" without warranties of any kind, express or implied. No professional-client, contractor-client, or inspector-client relationship is formed by using this application. All guidance, recommendations, and estimates are general in nature and may not apply to your specific situation.
            </p>
            <p>
              In no event shall HomeBuddy be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the application or reliance on its output.
            </p>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-background space-y-4 sticky bottom-16 md:bottom-0 z-10 shadow-lg md:shadow-none md:relative">
          <label
            className="flex items-start gap-3 cursor-pointer select-none"
            data-testid="disclaimer-checkbox-label"
          >
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              className="mt-0.5"
              data-testid="disclaimer-checkbox"
            />
            <span className="text-sm leading-relaxed">
              I acknowledge that HomeBuddy provides informational guidance only,
              does not monitor my home, and that any repairs or actions I take
              based on this information are at my own risk.
            </span>
          </label>

          <div className="flex gap-3">
            <Button
              onClick={() => acceptMutation.mutate()}
              disabled={!acknowledged || acceptMutation.isPending}
              className="flex-1"
              data-testid="disclaimer-agree"
            >
              {acceptMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Processing…
                </span>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Agree and Continue
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              data-testid="disclaimer-cancel"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground pb-4">
          Disclaimer version v1.0 — Last updated March 2026
        </p>
      </div>
    </Layout>
  );
}
