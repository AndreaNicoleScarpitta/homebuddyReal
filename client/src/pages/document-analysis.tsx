import { Layout } from "@/components/layout";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import {
  Upload,
  FileText,
  Loader2,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FilePlus,
  ArrowRight,
  FileImage,
  FileType,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getHome,
  runFileAnalysis,
  approveSuggestion,
  declineSuggestion,
  confirmMatchedTasks,
} from "@/lib/api";
import type {
  FileAnalysisResultV2,
  ProposedTaskV2,
  SuggestedSystemV2,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { trackEvent, trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";
import { useDisclaimer } from "@/hooks/use-disclaimer";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = ".pdf,.txt,.csv,.md,.png,.jpg,.jpeg,.heic,.docx";
const MAX_FILE_MB = 10;

const ANALYSIS_STAGES = [
  { label: "Reading your document…", detail: "Extracting text and images", progress: 15 },
  { label: "Matching to your home…", detail: "Identifying systems and components", progress: 50 },
  { label: "Generating recommendations…", detail: "Evaluating issues and priorities", progress: 80 },
  { label: "Finalising…", detail: "Assembling your maintenance tasks", progress: 95 },
];

// Stage advance times in ms (approximate — real latency determines actual end)
const STAGE_DELAYS = [0, 7000, 22000, 42000];

const urgencyColors: Record<string, string> = {
  now: "bg-red-100 text-red-800 border-red-200",
  soon: "bg-orange-100 text-orange-800 border-orange-200",
  later: "bg-blue-100 text-blue-800 border-blue-200",
  monitor: "bg-gray-100 text-gray-800 border-gray-200",
};

const diyColors: Record<string, string> = {
  "DIY-Safe": "bg-green-100 text-green-800 border-green-200",
  "Caution": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Pro-Only": "bg-red-100 text-red-800 border-red-200",
};

const categoryColors: Record<string, string> = {
  Repair: "bg-red-50 text-red-700 border-red-200",
  Maintenance: "bg-blue-50 text-blue-700 border-blue-200",
  Inspection: "bg-purple-50 text-purple-700 border-purple-200",
  Replacement: "bg-orange-50 text-orange-700 border-orange-200",
  Improvement: "bg-green-50 text-green-700 border-green-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(file: File) {
  if (file.type === "application/pdf") return <FileText className="w-4 h-4 text-red-500 shrink-0" />;
  if (file.type.startsWith("image/")) return <FileImage className="w-4 h-4 text-blue-500 shrink-0" />;
  return <FileType className="w-4 h-4 text-muted-foreground shrink-0" />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaskRow({
  task,
  selected,
  onToggle,
}: {
  task: ProposedTaskV2;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-lg p-3 transition-all ${
        selected ? "border-primary bg-primary/5" : "border-border"
      }`}
      data-testid={`task-row-${task.id}`}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onToggle}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            selected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/40"
          }`}
          data-testid={`checkbox-task-${task.id}`}
        >
          {selected && <Check className="w-3 h-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm leading-tight" data-testid={`task-title-${task.id}`}>
            {task.title}
          </h4>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[10px] py-0 ${categoryColors[task.category] || ""}`}>
              {task.category}
            </Badge>
            <Badge variant="outline" className={`text-[10px] py-0 ${urgencyColors[task.urgency] || ""}`}>
              {task.urgency}
            </Badge>
            <Badge variant="outline" className={`text-[10px] py-0 ${diyColors[task.diyLevel] || ""}`}>
              {task.diyLevel}
            </Badge>
            {task.estimatedCost && (
              <Badge variant="outline" className="text-[10px] py-0">
                {task.estimatedCost}
              </Badge>
            )}
            {task.isInferred && (
              <Badge variant="outline" className="text-[10px] py-0 bg-violet-50 text-violet-700 border-violet-200">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                Inferred
              </Badge>
            )}
          </div>
          {(task.description || task.safetyWarning || task.inferenceReason) && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid={`toggle-details-${task.id}`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Hide details" : "Details"}
            </button>
          )}
          {expanded && (
            <div className="mt-2 space-y-1.5">
              {task.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
              )}
              {task.inferenceReason && (
                <p className="text-[10px] text-violet-600 italic">
                  <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
                  {task.inferenceReason}
                </p>
              )}
            </div>
          )}
          {task.safetyWarning && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{task.safetyWarning}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestedSystemCard({
  suggestion,
  onApprove,
  onDecline,
  isProcessing,
}: {
  suggestion: SuggestedSystemV2;
  onApprove: (s: SuggestedSystemV2) => void;
  onDecline: (s: SuggestedSystemV2) => void;
  isProcessing: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="border-2 border-dashed border-amber-300 rounded-xl p-4 bg-amber-50/30"
      data-testid={`suggested-system-${suggestion.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-sm">{suggestion.name}</h3>
            <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] py-0 bg-amber-100 text-amber-800 border-amber-300 shrink-0">
          New system
        </Badge>
      </div>

      {suggestion.pendingTasks.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {suggestion.pendingTasks.length} pending task{suggestion.pendingTasks.length !== 1 ? "s" : ""}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {suggestion.pendingTasks.map((task) => (
                <div key={task.id} className="pl-3 border-l-2 border-amber-200">
                  <p className="text-xs font-medium">{task.title}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    <Badge variant="outline" className={`text-[9px] py-0 ${categoryColors[task.category] || ""}`}>
                      {task.category}
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] py-0 ${urgencyColors[task.urgency] || ""}`}>
                      {task.urgency}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {Object.keys(suggestion.pendingAttributes).length > 0 && (
        <div className="mt-2 text-[10px] text-muted-foreground">
          <span className="font-medium">Detected: </span>
          {Object.entries(suggestion.pendingAttributes).map(([k, v]) => (
            <span key={k} className="inline-block mr-2">
              {k.split("_").slice(1).join(" ")}: <strong>{v}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          onClick={() => onApprove(suggestion)}
          disabled={isProcessing}
          className="flex-1 h-8"
          data-testid={`approve-${suggestion.id}`}
        >
          {isProcessing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Add to home
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDecline(suggestion)}
          disabled={isProcessing}
          className="flex-1 h-8 text-muted-foreground"
          data-testid={`decline-${suggestion.id}`}
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Skip
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentAnalysis() {
  const { data: home } = useQuery({ queryKey: ["/api/home"], queryFn: getHome });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const { disclaimerAccepted, isLoading: disclaimerLoading } = useDisclaimer();
  const [, navigate] = useLocation();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => { trackSlugPageView(PAGE_SLUGS.documentAnalysis); }, []);

  // ── File staging ──────────────────────────────────────────────────────────
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // ── Analysis state ────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<FileAnalysisResultV2 | null>(null);

  // ── Review/confirm state ──────────────────────────────────────────────────
  const [isConfirming, setIsConfirming] = useState(false);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [decidedSuggestions, setDecidedSuggestions] = useState<Map<string, "approved" | "declined">>(new Map());

  // ── Done state ────────────────────────────────────────────────────────────
  const [doneState, setDoneState] = useState<{
    systemsAdded: number;
    tasksAdded: number;
    analyzedFileNames: string[];
  } | null>(null);

  // ── File staging ──────────────────────────────────────────────────────────

  const stageFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter((f) => {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast({
          title: `${f.name} is too large`,
          description: `Max file size is ${MAX_FILE_MB} MB.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });
    if (valid.length > 0) {
      setStagedFiles((prev) => {
        // Dedupe by name+size
        const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
        return [...prev, ...valid.filter((f) => !existing.has(`${f.name}-${f.size}`))];
      });
    }
  }, [toast]);

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    stageFiles(Array.from(e.dataTransfer.files));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    stageFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  // ── Analysis progress ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisStage(0);
      return;
    }
    // Advance through stages on timers; actual request end resets everything
    const timers = STAGE_DELAYS.map((delay, i) =>
      setTimeout(() => setAnalysisStage(i), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [isAnalyzing]);

  // ── Run analysis ───────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!home || stagedFiles.length === 0) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setSelectedTaskIds(new Set());
    setDecidedSuggestions(new Map());
    setDoneState(null);

    try {
      const result = await runFileAnalysis(home.id, stagedFiles, controller.signal);
      setAnalysisResult(result);
      setSelectedTaskIds(new Set(result.matchedSystemTasks.map((t) => t.id)));
      trackEvent("file_analysis_complete", "file_upload", "success", result.matchedSystemTasks.length);

      const totalItems =
        result.matchedSystemTasks.length +
        result.suggestedSystems.length +
        result.matchedSystemUpdates.length;

      if (totalItems === 0) {
        toast({
          title: "No issues found",
          description: "The uploaded files did not contain identifiable home maintenance issues.",
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // user cancelled — no toast
      const message = err instanceof Error ? err.message : "Upload failed. Please try again.";
      toast({ title: "Analysis failed", description: message, variant: "destructive" });
      trackEvent("file_analysis_error", "file_upload", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCancelAnalysis = () => {
    abortControllerRef.current?.abort();
    setIsAnalyzing(false);
    setAnalysisStage(0);
  };

  // ── Approve / decline suggestions ─────────────────────────────────────────

  const handleApprove = async (suggestion: SuggestedSystemV2) => {
    if (!home) return;
    setProcessingId(suggestion.id);
    try {
      await approveSuggestion(suggestion.id, {
        homeId: home.id,
        systemName: suggestion.name,
        systemCategory: suggestion.category,
        pendingTasks: suggestion.pendingTasks,
        pendingAttributes: suggestion.pendingAttributes,
      });
      setDecidedSuggestions((prev) => new Map(prev).set(suggestion.id, "approved"));
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      trackEvent("suggestion_approved", "file_upload", suggestion.category);
    } catch (err) {
      toast({
        title: "Approval failed",
        description: err instanceof Error ? err.message : "Could not approve. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (suggestion: SuggestedSystemV2) => {
    if (!home) return;
    setProcessingId(suggestion.id);
    try {
      await declineSuggestion(suggestion.id, {
        homeId: home.id,
        reason: "User declined",
        pendingTaskIds: suggestion.pendingTasks.map((t) => t.id),
        pendingAttributeKeys: Object.keys(suggestion.pendingAttributes),
      });
      setDecidedSuggestions((prev) => new Map(prev).set(suggestion.id, "declined"));
      trackEvent("suggestion_declined", "file_upload", suggestion.category);
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Could not decline. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // ── Confirm matched tasks ──────────────────────────────────────────────────

  const handleConfirmMatched = async () => {
    if (!home || !analysisResult) return;
    const selectedTasks = analysisResult.matchedSystemTasks.filter((t) => selectedTaskIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast({ title: "No tasks selected", description: "Select at least one task to add." });
      return;
    }
    setIsConfirming(true);
    try {
      await confirmMatchedTasks(home.id, selectedTasks, analysisResult.matchedSystemUpdates);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      trackEvent("matched_tasks_confirmed", "file_upload", "confirm", selectedTasks.length);
      // Transition to done state
      setDoneState({
        systemsAdded: Array.from(decidedSuggestions.values()).filter((v) => v === "approved").length,
        tasksAdded: selectedTasks.length,
        analyzedFileNames: stagedFiles.map((f) => f.name),
      });
      setAnalysisResult(null);
      setSelectedTaskIds(new Set());
      setDecidedSuggestions(new Map());
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  // ── Accept all ─────────────────────────────────────────────────────────────

  const handleAcceptAll = async () => {
    if (!home || !analysisResult) return;

    const toApprove = analysisResult.suggestedSystems.filter((s) => !decidedSuggestions.has(s.id));
    const allMatchedTasks = analysisResult.matchedSystemTasks;
    const updates = analysisResult.matchedSystemUpdates;

    if (toApprove.length === 0 && allMatchedTasks.length === 0 && updates.length === 0) {
      toast({ title: "Nothing to accept", description: "No findings to add." });
      return;
    }

    setIsAcceptingAll(true);
    let approvedCount = 0;
    let failedApprovals = 0;
    const newlyDecided = new Map(decidedSuggestions);

    try {
      for (const suggestion of toApprove) {
        try {
          await approveSuggestion(suggestion.id, {
            homeId: home.id,
            systemName: suggestion.name,
            systemCategory: suggestion.category,
            pendingTasks: suggestion.pendingTasks,
            pendingAttributes: suggestion.pendingAttributes,
          });
          newlyDecided.set(suggestion.id, "approved");
          approvedCount += 1;
        } catch {
          failedApprovals += 1;
        }
      }
      setDecidedSuggestions(newlyDecided);

      let matchedCount = 0;
      if (allMatchedTasks.length > 0 || updates.length > 0) {
        await confirmMatchedTasks(home.id, allMatchedTasks, updates);
        matchedCount = allMatchedTasks.length;
      }

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["systems"] });

      trackEvent("accept_all_clicked", "file_upload", "bulk", approvedCount + matchedCount);

      if (failedApprovals > 0) {
        toast({
          title: "Partially accepted",
          description: `${approvedCount + matchedCount} items added. ${failedApprovals} suggestion${failedApprovals !== 1 ? "s" : ""} failed — retry individually.`,
          variant: "destructive",
        });
        // Don't fully clear — let user retry the failures
        return;
      }

      // Full success → done state
      setDoneState({
        systemsAdded: approvedCount,
        tasksAdded: matchedCount,
        analyzedFileNames: stagedFiles.map((f) => f.name),
      });
      setAnalysisResult(null);
      setSelectedTaskIds(new Set());
      setDecidedSuggestions(new Map());
    } catch (err) {
      toast({
        title: "Accept all failed",
        description: err instanceof Error ? err.message : "Something went wrong. You can still accept items individually.",
        variant: "destructive",
      });
    } finally {
      setIsAcceptingAll(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const selectAll = () => {
    if (analysisResult) setSelectedTaskIds(new Set(analysisResult.matchedSystemTasks.map((t) => t.id)));
  };
  const deselectAll = () => setSelectedTaskIds(new Set());

  const resetToUpload = () => {
    setStagedFiles([]);
    setAnalysisResult(null);
    setSelectedTaskIds(new Set());
    setDecidedSuggestions(new Map());
    setDoneState(null);
  };

  const pendingSuggestions = analysisResult?.suggestedSystems.filter((s) => !decidedSuggestions.has(s.id)) ?? [];
  const approvedCount = Array.from(decidedSuggestions.values()).filter((v) => v === "approved").length;
  const declinedCount = Array.from(decidedSuggestions.values()).filter((v) => v === "declined").length;

  const hasResults = analysisResult && (
    analysisResult.matchedSystemTasks.length > 0 ||
    analysisResult.suggestedSystems.length > 0 ||
    analysisResult.matchedSystemUpdates.length > 0
  );
  const noResults = analysisResult && !hasResults;

  const remainingSuggestions = pendingSuggestions.length;
  const availableToAccept = remainingSuggestions + (analysisResult?.matchedSystemTasks.length ?? 0);

  // ── Gate: disclaimer ───────────────────────────────────────────────────────

  if (disclaimerLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!disclaimerAccepted) {
    navigate("/disclaimer?from=document-analysis");
    return null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-heading font-bold" data-testid="text-page-title">
            Document Analysis
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload home inspection reports, maintenance documents, or photos to detect systems, issues, and tasks.
          </p>
        </div>

        {/* ── Done state ──────────────────────────────────────────────────── */}
        {doneState && (
          <div className="rounded-xl border border-green-200 bg-green-50/40 p-5 space-y-4" data-testid="done-panel">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-base">All done!</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {[
                    doneState.systemsAdded > 0 && `${doneState.systemsAdded} system${doneState.systemsAdded !== 1 ? "s" : ""} added`,
                    doneState.tasksAdded > 0 && `${doneState.tasksAdded} task${doneState.tasksAdded !== 1 ? "s" : ""} added to your maintenance plan`,
                  ].filter(Boolean).join(" · ") || "Analysis complete."}
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link href="/maintenance-log">
                <Button className="gap-2" data-testid="button-go-to-plan">
                  View maintenance plan
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button variant="outline" onClick={resetToUpload} className="gap-2" data-testid="button-analyze-another">
                <FilePlus className="w-4 h-4" />
                Analyze another document
              </Button>
            </div>
          </div>
        )}

        {/* ── File staging / dropzone ─────────────────────────────────────── */}
        {!doneState && !analysisResult && !isAnalyzing && (
          <div className="space-y-3">
            {/* Dropzone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              data-testid="upload-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={SUPPORTED_EXTENSIONS}
                multiple
                onChange={handleInputChange}
                data-testid="input-file-upload"
              />
              <div className="space-y-3">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Drop files here or tap to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, PNG, JPG, HEIC, DOCX, TXT · max {MAX_FILE_MB} MB each
                  </p>
                </div>
              </div>
            </div>

            {/* Staged file list */}
            {stagedFiles.length > 0 && (
              <div className="space-y-2" data-testid="staged-files">
                {stagedFiles.map((file, i) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 border rounded-lg px-3 py-2.5 bg-muted/20">
                    {fileIcon(file)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStagedFile(i)}
                      className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
                      data-testid={`remove-file-${i}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleAnalyze}
                    className="flex-1"
                    data-testid="button-start-analysis"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze {stagedFiles.length} file{stagedFiles.length !== 1 ? "s" : ""}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => addMoreInputRef.current?.click()}
                    data-testid="button-add-more-files"
                  >
                    <FilePlus className="w-4 h-4" />
                  </Button>
                  <input
                    ref={addMoreInputRef}
                    type="file"
                    className="hidden"
                    accept={SUPPORTED_EXTENSIONS}
                    multiple
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Analysis in progress ────────────────────────────────────────── */}
        {isAnalyzing && (
          <div className="border rounded-xl p-6 space-y-4" data-testid="analysis-progress">
            {/* Stage label */}
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{ANALYSIS_STAGES[analysisStage]?.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{ANALYSIS_STAGES[analysisStage]?.detail}</p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {analysisStage + 1}/{ANALYSIS_STAGES.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-[2000ms] ease-out"
                style={{ width: `${ANALYSIS_STAGES[analysisStage]?.progress ?? 10}%` }}
              />
            </div>

            {/* File names */}
            <p className="text-xs text-muted-foreground">
              {stagedFiles.map((f) => f.name).join(", ")}
            </p>

            {/* Cancel */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelAnalysis}
              className="w-full"
              data-testid="button-cancel-analysis"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* ── Analysis warnings ───────────────────────────────────────────── */}
        {analysisResult && analysisResult.analysisWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 space-y-0.5">
                {analysisResult.analysisWarnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            </div>
          </div>
        )}

        {/* ── Accept all shortcut ─────────────────────────────────────────── */}
        {hasResults && availableToAccept > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4" data-testid="accept-all-panel">
            <div className="flex items-start gap-3 flex-wrap">
              <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-[200px]">
                <h3 className="font-semibold text-sm">Add everything AI found?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {analysisResult!.matchedSystemTasks.length > 0 && (
                    <span>{analysisResult!.matchedSystemTasks.length} task{analysisResult!.matchedSystemTasks.length !== 1 ? "s" : ""}</span>
                  )}
                  {analysisResult!.matchedSystemTasks.length > 0 && remainingSuggestions > 0 && <span> + </span>}
                  {remainingSuggestions > 0 && (
                    <span>{remainingSuggestions} new system{remainingSuggestions !== 1 ? "s" : ""}</span>
                  )}
                  <span> will be added. You can edit or delete anything later.</span>
                </p>
              </div>
              <Button
                onClick={handleAcceptAll}
                disabled={isAcceptingAll || isConfirming || processingId !== null}
                data-testid="button-accept-all"
                className="shrink-0"
              >
                {isAcceptingAll ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />Accept all</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Matched tasks (existing systems) — shown first, lower friction ─ */}
        {analysisResult && analysisResult.matchedSystemTasks.length > 0 && (
          <div className="space-y-3" data-testid="matched-tasks-section">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <div>
                  <h2 className="font-semibold text-sm">Tasks for your existing systems</h2>
                  <p className="text-xs text-muted-foreground">
                    {analysisResult.matchedSystemTasks.length} task{analysisResult.matchedSystemTasks.length !== 1 ? "s" : ""} detected · select which to add
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs" data-testid="button-select-all">
                  All
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll} className="h-7 text-xs" data-testid="button-deselect-all">
                  None
                </Button>
              </div>
            </div>

            <div className="space-y-2" data-testid="task-list">
              {analysisResult.matchedSystemTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selectedTaskIds.has(task.id)}
                  onToggle={() => toggleTask(task.id)}
                />
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleConfirmMatched}
                disabled={selectedTaskIds.size === 0 || isConfirming || isAcceptingAll}
                className="flex-1"
                data-testid="button-confirm-tasks"
              >
                {isConfirming ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding…</>
                ) : (
                  `Add ${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              AI-generated — urgency, costs, and safety levels are approximate. You're always in control of what gets added.
            </p>
          </div>
        )}

        {/* ── New systems (need approval) — shown after matched tasks ──────── */}
        {pendingSuggestions.length > 0 && (
          <div className="space-y-3" data-testid="suggested-systems-section">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-sm">New systems found in your documents</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              These weren't in your home profile yet. Approve each one to add it (along with its tasks), or skip to ignore.
            </p>
            {pendingSuggestions.map((s) => (
              <SuggestedSystemCard
                key={s.id}
                suggestion={s}
                onApprove={handleApprove}
                onDecline={handleDecline}
                isProcessing={processingId === s.id}
              />
            ))}
          </div>
        )}

        {/* ── Decided suggestions summary ─────────────────────────────────── */}
        {(approvedCount > 0 || declinedCount > 0) && pendingSuggestions.length === 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            {approvedCount > 0 && (
              <span className="flex items-center gap-1 text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {approvedCount} approved
              </span>
            )}
            {declinedCount > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <XCircle className="w-3.5 h-3.5" />
                {declinedCount} skipped
              </span>
            )}
          </div>
        )}

        {/* ── System attribute updates ─────────────────────────────────────── */}
        {analysisResult && analysisResult.matchedSystemUpdates.length > 0 && (
          <div className="space-y-2" data-testid="matched-updates-section">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <h2 className="font-semibold text-sm">System info updated</h2>
            </div>
            <div className="space-y-1.5">
              {analysisResult.matchedSystemUpdates.map((update) => (
                <div key={update.systemId} className="border rounded-lg p-3 bg-green-50/30">
                  <p className="text-sm font-medium">{update.systemName}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(update.attributes).map(([key, val]) => (
                      <span key={key} className="text-[10px] text-muted-foreground">
                        {key.split("_").slice(1).join(" ")}: <strong>{val}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── "Analyze another" when results are showing ──────────────────── */}
        {hasResults && (
          <div className="pt-2 border-t">
            <button
              type="button"
              onClick={resetToUpload}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-reset-upload"
            >
              <FilePlus className="w-3.5 h-3.5" />
              Analyze a different document
            </button>
          </div>
        )}

        {/* ── No results ───────────────────────────────────────────────────── */}
        {noResults && (
          <div className="border rounded-xl p-6 text-center" data-testid="no-issues-found">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-sm">No maintenance issues detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              The uploaded file{stagedFiles.length !== 1 ? "s" : ""} didn't contain identifiable home maintenance issues.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={resetToUpload}
              data-testid="button-try-another"
            >
              Try another file
            </Button>
          </div>
        )}

        {/* ── Source files footer ─────────────────────────────────────────── */}
        {analysisResult && analysisResult.sourceFiles.length > 0 && (
          <div className="text-[10px] text-muted-foreground pt-2 border-t">
            <span className="font-medium">Analysed: </span>
            {analysisResult.sourceFiles.map((f, i) => (
              <span key={i}>{f.fileName}{i < analysisResult.sourceFiles.length - 1 ? ", " : ""}</span>
            ))}
          </div>
        )}

      </div>
    </Layout>
  );
}
