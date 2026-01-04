import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { 
  getHome, 
  getInspectionReports, 
  getInspectionReport,
  createInspectionReport, 
  analyzeInspectionReport, 
  deleteInspectionReport 
} from "@/lib/api";
import { 
  FileText, 
  Upload, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  ChevronRight,
  Sparkles,
  Info
} from "lucide-react";
import { format } from "date-fns";
import type { InspectionReport, InspectionFinding } from "@shared/schema";

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    critical: "bg-red-100 text-red-700 border-red-200",
    major: "bg-orange-100 text-orange-700 border-orange-200",
    moderate: "bg-yellow-100 text-yellow-700 border-yellow-200",
    minor: "bg-green-100 text-green-700 border-green-200",
  };
  const color = colors[severity as keyof typeof colors] || colors.minor;
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${color}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { icon: Clock, color: "text-muted-foreground", label: "Pending Analysis" },
    analyzing: { icon: Loader2, color: "text-primary", label: "Analyzing...", spin: true },
    analyzed: { icon: CheckCircle2, color: "text-green-600", label: "Analyzed" },
    error: { icon: AlertTriangle, color: "text-red-600", label: "Error" },
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;
  
  return (
    <div className={`flex items-center gap-1.5 text-sm ${config.color}`}>
      <Icon className={`h-4 w-4 ${config.spin ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </div>
  );
}

function FindingCard({ finding }: { finding: InspectionFinding }) {
  return (
    <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-foreground">{finding.title}</h4>
          <p className="text-sm text-muted-foreground">{finding.location}</p>
        </div>
        <SeverityBadge severity={finding.severity || "minor"} />
      </div>
      {finding.description && (
        <p className="text-sm text-muted-foreground">{finding.description}</p>
      )}
      <div className="flex flex-wrap gap-4 pt-2 text-sm">
        {finding.estimatedCost && (
          <div>
            <span className="text-muted-foreground">Est. Cost: </span>
            <span className="font-medium text-foreground">{finding.estimatedCost}</span>
          </div>
        )}
        {finding.urgency && (
          <div>
            <span className="text-muted-foreground">Urgency: </span>
            <span className={`font-medium capitalize ${
              finding.urgency === 'now' ? 'text-red-600' : 
              finding.urgency === 'soon' ? 'text-orange-600' : 'text-foreground'
            }`}>{finding.urgency}</span>
          </div>
        )}
        {finding.diyLevel && (
          <div>
            <span className="text-muted-foreground">DIY: </span>
            <span className={`font-medium ${
              finding.diyLevel === 'DIY-Safe' ? 'text-green-600' : 
              finding.diyLevel === 'Caution' ? 'text-orange-600' : 'text-red-600'
            }`}>{finding.diyLevel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportDetail({ reportId, onBack }: { reportId: number; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getInspectionReport(reportId),
    refetchInterval: (data) => data?.status === "analyzing" ? 2000 : false,
  });
  
  const analyzeMutation = useMutation({
    mutationFn: () => analyzeInspectionReport(reportId),
    onSuccess: () => {
      toast({ title: "Analysis started", description: "We're analyzing your report..." });
      refetch();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!report) {
    return <div className="text-center text-muted-foreground">Report not found</div>;
  }
  
  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        data-testid="button-back"
      >
        ← Back to reports
      </button>
      
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">{report.fileName}</h2>
          <p className="text-muted-foreground mt-1">
            Uploaded {report.createdAt ? format(new Date(report.createdAt), "MMM d, yyyy") : ""}
          </p>
        </div>
        <StatusBadge status={report.status || "pending"} />
      </div>
      
      {report.status === "pending" && (
        <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Ready to Analyze</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Our AI will review your inspection report and identify issues, estimated costs, and recommended actions.
              </p>
              <Button 
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="mt-4"
                data-testid="button-analyze"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {report.status === "analyzing" && (
        <div className="p-6 rounded-xl bg-secondary/50 border border-border">
          <div className="flex items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">Analyzing Report...</h3>
              <p className="text-sm text-muted-foreground">This may take a moment</p>
            </div>
          </div>
        </div>
      )}
      
      {report.status === "analyzed" && report.summary && (
        <div className="p-6 rounded-xl bg-green-50 border border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-800">Analysis Complete</h3>
              <p className="text-sm text-green-700 mt-1">{report.summary}</p>
            </div>
          </div>
        </div>
      )}
      
      {report.findings && report.findings.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            Findings ({report.findings.length})
          </h3>
          <div className="space-y-3">
            {report.findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Inspections() {
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });
  
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["reports", home?.id],
    queryFn: () => getInspectionReports(home!.id),
    enabled: !!home?.id,
  });
  
  const deleteMutation = useMutation({
    mutationFn: deleteInspectionReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast({ title: "Report deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const handleUploadComplete = async (result: any) => {
    if (!home?.id || !result.successful?.[0]) return;
    
    const file = result.successful[0];
    try {
      const report = await createInspectionReport(home.id, {
        fileName: file.name,
        fileType: file.type,
        objectPath: `/objects/uploads/${file.id}`,
      });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast({ title: "Report uploaded", description: "Your report is ready for analysis." });
      setSelectedReportId(report.id);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save report", variant: "destructive" });
    }
  };
  
  const getUploadParameters = async (file: any) => {
    const response = await fetch("/api/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type,
      }),
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    };
  };
  
  if (homeLoading || reportsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }
  
  if (!home) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please set up your home profile first.</p>
        </div>
      </Layout>
    );
  }
  
  if (selectedReportId) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <ReportDetail 
            reportId={selectedReportId} 
            onBack={() => setSelectedReportId(null)} 
          />
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-heading">
              Inspection Reports
            </h1>
            <p className="text-muted-foreground mt-1">
              Upload and analyze your home inspection reports
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={20971520}
                onGetUploadParameters={getUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="shadow-lg shadow-primary/20"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Report
              </ObjectUploader>
            </TooltipTrigger>
            <TooltipContent>Upload a PDF or image of your inspection report</TooltipContent>
          </Tooltip>
        </header>
        
        {reports.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">No reports yet</h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Upload your home inspection report and our AI will analyze it to identify issues, 
              estimated costs, and recommended actions.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Supports PDF, PNG, JPG up to 20MB</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                className="w-full p-4 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors text-left group"
                data-testid={`button-report-${report.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{report.fileName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {report.createdAt ? format(new Date(report.createdAt), "MMM d, yyyy") : ""}
                        {report.issuesFound ? ` • ${report.issuesFound} issues found` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={report.status || "pending"} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(report.id);
                      }}
                      className="p-2 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-delete-${report.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
