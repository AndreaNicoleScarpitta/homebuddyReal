import { Layout } from "@/components/layout";
import { useState, useRef } from "react";
import { Upload, FileText, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getHome, analyzeDocument, confirmDocumentTasks } from "@/lib/api";
import type { DocumentAnalysisTask } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

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

function formatAttrKey(key: string): string {
  const parts = key.split("_");
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function SystemAttributesDisplay({
  systemName,
  attributes,
  taskIndex,
}: {
  systemName: string;
  attributes: Record<string, string>;
  taskIndex: number;
}) {
  const entries = Object.entries(attributes);
  if (entries.length === 0) return null;

  const prefix = systemName + "_";

  return (
    <div className="mt-2 space-y-1" data-testid={`attributes-${systemName}-${taskIndex}`}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {systemName.replace(/_/g, " ")} attributes
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {entries.map(([key, value]) => {
          const displayKey = key.startsWith(prefix)
            ? formatAttrKey(key.slice(prefix.length))
            : formatAttrKey(key);
          return (
            <div
              key={key}
              className="flex items-baseline gap-1.5 text-xs"
              data-testid={`attr-${key}-${taskIndex}`}
            >
              <span className="text-muted-foreground shrink-0">{displayKey}:</span>
              <span className="font-medium truncate">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  index,
  selected,
  onToggle,
}: {
  task: DocumentAnalysisTask;
  index: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAttributes = task.attributes && Object.keys(task.attributes).length > 0;
  const hasDetails = !!task.description || hasAttributes;

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        selected ? "border-primary bg-primary/5" : "border-border"
      }`}
      data-testid={`task-card-${index}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            selected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/40"
          }`}
          data-testid={`checkbox-task-${index}`}
        >
          {selected && <Check className="w-3 h-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm" data-testid={`task-title-${index}`}>
              {task.title}
            </h3>
          </div>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {task.systemName && task.systemName !== "unknown_system" && (
              <Badge variant="outline" className="text-[10px] py-0 bg-indigo-50 text-indigo-700 border-indigo-200">
                {task.systemName.replace(/_/g, " ")}
              </Badge>
            )}
            {task.category && (
              <Badge variant="outline" className="text-[10px] py-0">
                {task.category}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] py-0 ${urgencyColors[task.urgency] || ""}`}
            >
              {task.urgency}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] py-0 ${diyColors[task.diyLevel] || ""}`}
            >
              {task.diyLevel}
            </Badge>
            {task.estimatedCost && task.estimatedCost !== "Unknown" && (
              <Badge variant="outline" className="text-[10px] py-0">
                {task.estimatedCost}
              </Badge>
            )}
          </div>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid={`toggle-details-${index}`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Hide details" : "Show details"}
            </button>
          )}
          {expanded && (
            <>
              {task.description && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {task.description}
                </p>
              )}
              {hasAttributes && (
                <SystemAttributesDisplay
                  systemName={task.systemName}
                  attributes={task.attributes}
                  taskIndex={index}
                />
              )}
            </>
          )}
          {task.safetyWarning && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{task.safetyWarning}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DocumentAnalysis() {
  const { data: home } = useQuery({ queryKey: ["/api/home"], queryFn: getHome });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    fileName: string;
    tasks: DocumentAnalysisTask[];
  } | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = async (file: File) => {
    if (!home) {
      toast({ title: "No home profile found", description: "Please set up your home profile first.", variant: "destructive" });
      return;
    }

    const allowedTypes = ["application/pdf", "text/plain", "text/csv", "text/markdown"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Unsupported file type", description: "Please upload a PDF or text document.", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setSelectedTasks(new Set());

    try {
      const homeId = home.legacyId!;
      const result = await analyzeDocument(homeId, file);
      setAnalysisResult({ fileName: result.fileName, tasks: result.tasks });
      setSelectedTasks(new Set(result.tasks.map((_, i) => i)));
      trackEvent("document_analysis_complete", "document_analysis", "success", result.tasks.length);

      if (result.tasks.length === 0) {
        toast({ title: "No issues found", description: "The document did not contain any identifiable home maintenance issues." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to analyze document";
      toast({ title: "Analysis failed", description: message, variant: "destructive" });
      trackEvent("document_analysis_error", "document_analysis", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleConfirm = async () => {
    if (!home || !analysisResult) return;

    const tasksToCreate = analysisResult.tasks.filter((_, i) => selectedTasks.has(i));
    if (tasksToCreate.length === 0) {
      toast({ title: "No tasks selected", description: "Please select at least one task to add." });
      return;
    }

    setIsConfirming(true);
    try {
      const homeId = home.legacyId!;
      await confirmDocumentTasks(homeId, tasksToCreate);
      toast({ title: "Tasks added", description: `${tasksToCreate.length} task${tasksToCreate.length !== 1 ? "s" : ""} added to your maintenance list.` });
      trackEvent("document_tasks_confirmed", "document_analysis", "confirm", tasksToCreate.length);
      setAnalysisResult(null);
      setSelectedTasks(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create tasks";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsConfirming(false);
    }
  };

  const toggleTask = (index: number) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (analysisResult) {
      setSelectedTasks(new Set(analysisResult.tasks.map((_, i) => i)));
    }
  };

  const deselectAll = () => {
    setSelectedTasks(new Set());
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold" data-testid="text-page-title">
            Document Analysis
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload a home inspection report, maintenance document, or any text document to automatically detect issues and create maintenance tasks.
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
              accept=".pdf,.txt,.csv,.md"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = "";
              }}
              data-testid="input-file-upload"
            />
            {isAnalyzing ? (
              <div className="space-y-3">
                <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
                <p className="text-sm font-medium">Analyzing document...</p>
                <p className="text-xs text-muted-foreground">
                  Extracting text and identifying maintenance issues
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Drop a document here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports PDF, TXT, CSV, and Markdown files (max 10 MB)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {analysisResult && analysisResult.tasks.length > 0 && (
          <div className="space-y-4" data-testid="analysis-results">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium" data-testid="text-file-name">
                    {analysisResult.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analysisResult.tasks.length} issue{analysisResult.tasks.length !== 1 ? "s" : ""} detected
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll} data-testid="button-select-all">
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll} data-testid="button-deselect-all">
                  Deselect all
                </Button>
              </div>
            </div>

            <div className="space-y-2" data-testid="task-list">
              {analysisResult.tasks.map((task, i) => (
                <TaskCard
                  key={i}
                  task={task}
                  index={i}
                  selected={selectedTasks.has(i)}
                  onToggle={() => toggleTask(i)}
                />
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleConfirm}
                disabled={selectedTasks.size === 0 || isConfirming}
                className="flex-1"
                data-testid="button-confirm-tasks"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding tasks...
                  </>
                ) : (
                  `Add ${selectedTasks.size} task${selectedTasks.size !== 1 ? "s" : ""} to maintenance list`
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAnalysisResult(null);
                  setSelectedTasks(new Set());
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

        {analysisResult && analysisResult.tasks.length === 0 && (
          <Card className="p-6 text-center" data-testid="no-issues-found">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-sm">No maintenance issues detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              The document "{analysisResult.fileName}" did not contain identifiable home maintenance issues.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setAnalysisResult(null);
                setSelectedTasks(new Set());
              }}
              data-testid="button-try-another"
            >
              Try another document
            </Button>
          </Card>
        )}
      </div>
    </Layout>
  );
}
