import { Layout } from "@/components/layout";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
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
import { trackEvent } from "@/lib/analytics";
import { useDisclaimer } from "@/hooks/use-disclaimer";

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
  homeId,
  onApprove,
  onDecline,
  isProcessing,
}: {
  suggestion: SuggestedSystemV2;
  homeId: string;
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
          Needs Approval
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
          <span className="font-medium">Detected attributes: </span>
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
              Approve & Create
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDecline(suggestion)}
          disabled={isProcessing}
          className="flex-1 h-8 text-red-600 border-red-200 hover:bg-red-50"
          data-testid={`decline-${suggestion.id}`}
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Decline
        </Button>
      </div>
    </div>
  );
}

export default function DocumentAnalysis() {
  const { data: home } = useQuery({ queryKey: ["/api/home"], queryFn: getHome });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { disclaimerAccepted, isLoading: disclaimerLoading } = useDisclaimer();
  const [, navigate] = useLocation();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FileAnalysisResultV2 | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [decidedSuggestions, setDecidedSuggestions] = useState<Map<string, "approved" | "declined">>(new Map());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const supportedExtensions = ".pdf,.txt,.csv,.md,.png,.jpg,.jpeg,.heic,.docx";

  const handleFilesSelect = async (files: File[]) => {
    if (!home) {
      toast({
        title: "No home profile found",
        description: "Please set up your home profile first.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setSelectedTaskIds(new Set());
    setDecidedSuggestions(new Map());
    setSelectedFiles(files);

    try {
      const result = await runFileAnalysis(home.id, files);
      setAnalysisResult(result);

      const allTaskIds = new Set(result.matchedSystemTasks.map((t) => t.id));
      setSelectedTaskIds(allTaskIds);

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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload Failed. Please try again.";
      toast({ title: "Upload Failed", description: message, variant: "destructive" });
      trackEvent("file_analysis_error", "file_upload", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFilesSelect(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFilesSelect(files);
    e.target.value = "";
  };

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
      toast({ title: `${suggestion.name} approved`, description: "System and tasks have been created." });
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
      toast({ title: `${suggestion.name} declined`, description: "Suggested system and pending tasks removed." });
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

  const handleConfirmMatched = async () => {
    if (!home || !analysisResult) return;

    const selectedTasks = analysisResult.matchedSystemTasks.filter((t) => selectedTaskIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast({ title: "No tasks selected", description: "Please select at least one task to add." });
      return;
    }

    setIsConfirming(true);
    try {
      await confirmMatchedTasks(home.id, selectedTasks, analysisResult.matchedSystemUpdates);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      toast({
        title: "Tasks added",
        description: `${selectedTasks.length} task${selectedTasks.length !== 1 ? "s" : ""} added to your maintenance list.`,
      });
      trackEvent("matched_tasks_confirmed", "file_upload", "confirm", selectedTasks.length);
      setAnalysisResult(null);
      setSelectedTaskIds(new Set());
      setSelectedFiles([]);
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

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (analysisResult) {
      setSelectedTaskIds(new Set(analysisResult.matchedSystemTasks.map((t) => t.id)));
    }
  };

  const deselectAll = () => setSelectedTaskIds(new Set());

  const pendingSuggestions = analysisResult?.suggestedSystems.filter(
    (s) => !decidedSuggestions.has(s.id)
  ) || [];

  const approvedCount = Array.from(decidedSuggestions.values()).filter((v) => v === "approved").length;
  const declinedCount = Array.from(decidedSuggestions.values()).filter((v) => v === "declined").length;

  const hasResults = analysisResult && (
    analysisResult.matchedSystemTasks.length > 0 ||
    analysisResult.suggestedSystems.length > 0 ||
    analysisResult.matchedSystemUpdates.length > 0
  );

  const noResults = analysisResult && !hasResults;

  if (disclaimerLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!disclaimerAccepted) {
    navigate("/disclaimer");
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold" data-testid="text-page-title">
            Document Analysis
            <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary align-middle">Beta</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload home inspection reports, maintenance documents, or photos to automatically detect systems, issues, and maintenance tasks.
            <span className="block mt-1 text-xs italic">This feature is in beta — results may vary. Always verify AI-generated findings.</span>
          </p>
        </div>

        {!analysisResult && (
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40"
            } ${isAnalyzing ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            data-testid="upload-dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={supportedExtensions}
              multiple
              onChange={handleInputChange}
              data-testid="input-file-upload"
            />
            {isAnalyzing ? (
              <div className="space-y-3">
                <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
                <p className="text-sm font-medium">Analyzing files...</p>
                <p className="text-xs text-muted-foreground">
                  Extracting content, identifying systems, and generating recommendations
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Drop files here or tap to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports PDF, PNG, JPG, HEIC, DOCX, and TXT (max 10 MB each)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {analysisResult && analysisResult.analysisWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800 space-y-0.5">
                {analysisResult.analysisWarnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {pendingSuggestions.length > 0 && (
          <div className="space-y-3" data-testid="suggested-systems-section">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-sm">New Systems Detected — Approval Required</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              These systems were found in your files but don't exist in your home profile yet. Approve to create them, or decline to discard.
            </p>
            {pendingSuggestions.map((s) => (
              <SuggestedSystemCard
                key={s.id}
                suggestion={s}
                homeId={home?.id || ""}
                onApprove={handleApprove}
                onDecline={handleDecline}
                isProcessing={processingId === s.id}
              />
            ))}
          </div>
        )}

        {(approvedCount > 0 || declinedCount > 0) && pendingSuggestions.length === 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            {approvedCount > 0 && (
              <span className="flex items-center gap-1 text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {approvedCount} approved
              </span>
            )}
            {declinedCount > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="w-3.5 h-3.5" />
                {declinedCount} declined
              </span>
            )}
          </div>
        )}

        {analysisResult && analysisResult.matchedSystemUpdates.length > 0 && (
          <div className="space-y-2" data-testid="matched-updates-section">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <h2 className="font-semibold text-sm">System Updates Detected</h2>
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

        {analysisResult && analysisResult.matchedSystemTasks.length > 0 && (
          <div className="space-y-3" data-testid="matched-tasks-section">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <div>
                  <h2 className="font-semibold text-sm">Tasks for Existing Systems</h2>
                  <p className="text-xs text-muted-foreground">
                    {analysisResult.matchedSystemTasks.length} task{analysisResult.matchedSystemTasks.length !== 1 ? "s" : ""} detected
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs" data-testid="button-select-all">
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll} className="h-7 text-xs" data-testid="button-deselect-all">
                  Deselect all
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

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleConfirmMatched}
                disabled={selectedTaskIds.size === 0 || isConfirming}
                className="flex-1"
                data-testid="button-confirm-tasks"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding tasks...
                  </>
                ) : (
                  `Add ${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? "s" : ""} to maintenance list`
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAnalysisResult(null);
                  setSelectedTaskIds(new Set());
                  setSelectedFiles([]);
                  setDecidedSuggestions(new Map());
                }}
                data-testid="button-cancel-analysis"
              >
                Cancel
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              These suggestions are AI-generated estimates. Urgency, costs, and safety levels are approximate ranges. You are always in control of which tasks to add.
            </p>
          </div>
        )}

        {noResults && (
          <div className="border rounded-xl p-6 text-center" data-testid="no-issues-found">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-sm">No maintenance issues detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              The uploaded file{selectedFiles.length !== 1 ? "s" : ""} did not contain identifiable home maintenance issues.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setAnalysisResult(null);
                setSelectedTaskIds(new Set());
                setSelectedFiles([]);
              }}
              data-testid="button-try-another"
            >
              Try another file
            </Button>
          </div>
        )}

        {analysisResult && analysisResult.sourceFiles.length > 0 && (
          <div className="text-[10px] text-muted-foreground pt-2 border-t">
            <span className="font-medium">Analyzed files: </span>
            {analysisResult.sourceFiles.map((f, i) => (
              <span key={i}>
                {f.fileName}
                {i < analysisResult.sourceFiles.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
