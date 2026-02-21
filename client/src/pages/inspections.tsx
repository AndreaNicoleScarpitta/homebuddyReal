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
import type { V2Report } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

interface InspectionFinding {
  id: string;
  reportId: string;
  state: string;
  title?: string;
  description?: string;
  severity?: string | null;
  urgency?: string | null;
  category?: string | null;
  location?: string | null;
  estimatedCost?: string | null;
  diyLevel?: string | null;
}

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
  const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string; spin?: boolean }> = {
    pending: { icon: Clock, color: "text-muted-foreground", label: "Pending Analysis" },
    analyzing: { icon: Loader2, color: "text-primary", label: "Analyzing...", spin: true },
    analyzed: { icon: CheckCircle2, color: "text-green-600", label: "Analyzed" },
    error: { icon: AlertTriangle, color: "text-red-600", label: "Error" },
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  
  return (
    <div className={`flex items-center gap-1.5 text-sm ${config.color}`}>
      <Icon className={`h-4 w-4 ${config.spin ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </div>
  );
}

function getWhyThisMatters(category: string | null, severity: string | null): string {
  const impacts: Record<string, Record<string, string>> = {
    Plumbing: {
      critical: "Active leaks can cause major water damage to floors, walls, and foundations within days.",
      major: "Plumbing issues often worsen quickly and can lead to mold or structural damage if left untreated.",
      moderate: "Small leaks can damage cabinets and flooring over time if not addressed.",
      minor: "Minor plumbing issues are easy to fix now but can become larger problems if ignored."
    },
    Roof: {
      critical: "Roof failures can cause extensive interior damage and may require emergency repairs.",
      major: "Roof issues left unaddressed often lead to leaks, insulation damage, and higher repair costs.",
      moderate: "Addressing roof wear early prevents more costly repairs and protects your home's interior.",
      minor: "Regular roof maintenance extends its lifespan and prevents surprise expenses."
    },
    HVAC: {
      critical: "HVAC failures can affect air quality and comfort, especially in extreme weather.",
      major: "Inefficient HVAC systems increase utility costs and may fail when you need them most.",
      moderate: "Regular HVAC maintenance improves efficiency and extends equipment life.",
      minor: "Small HVAC issues are inexpensive to fix now but can compound over time."
    },
    Electrical: {
      critical: "Electrical hazards pose fire and safety risks that require immediate professional attention.",
      major: "Electrical issues can be safety hazards and may not meet code requirements.",
      moderate: "Addressing electrical concerns prevents potential hazards and improves home safety.",
      minor: "Minor electrical updates improve convenience and help maintain your home's value."
    },
    default: {
      critical: "This issue needs prompt attention to prevent further damage or safety concerns.",
      major: "Addressing this soon helps prevent more extensive repairs later.",
      moderate: "Fixing this in the near term protects your home and avoids escalating costs.",
      minor: "This is a low priority but worth keeping on your radar for future planning."
    }
  };
  
  const categoryImpacts = impacts[category || "default"] || impacts.default;
  return categoryImpacts[severity || "minor"] || categoryImpacts.minor;
}

function FindingCard({ finding }: { finding: InspectionFinding }) {
  const [showWhy, setShowWhy] = useState(false);
  const whyText = getWhyThisMatters(finding.category ?? null, finding.severity ?? null);
  
  return (
    <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-foreground">{finding.title}</h4>
          {finding.location && (
            <p className="text-sm text-muted-foreground">{finding.location}</p>
          )}
        </div>
        <SeverityBadge severity={finding.severity || "minor"} />
      </div>
      
      {finding.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{finding.description}</p>
      )}
      
      <div className="flex flex-wrap gap-4 text-sm">
        {finding.estimatedCost && (
          <div>
            <span className="text-muted-foreground">Est. Cost: </span>
            <span className="font-medium text-foreground">{finding.estimatedCost}</span>
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
      
      <div className="flex items-center gap-4">
        <button
          onClick={() => { trackEvent('click', 'inspections', 'why_this_matters'); setShowWhy(!showWhy); }}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          data-testid="button-why-matters"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showWhy ? 'rotate-90' : ''}`} />
          Why this matters
        </button>
        
        {finding.diyLevel === 'Pro-Only' && (
          <a
            href={`https://www.angi.com/search/${encodeURIComponent((finding.category || 'home') + ' repair')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-find-pro"
          >
            Find a pro
            <span className="text-[10px] text-muted-foreground">(via Angi)</span>
          </a>
        )}
      </div>
      
      {showWhy && (
        <div className="p-3 bg-white/60 rounded border border-muted text-sm text-muted-foreground leading-relaxed">
          {whyText}
        </div>
      )}
    </div>
  );
}

function ReportDetail({ reportId, onBack }: { reportId: string | number; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getInspectionReport(reportId),
    refetchInterval: (query) => query.state.data?.status === "analyzing" ? 2000 : false,
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
                onClick={() => { trackEvent('click', 'inspections', 'analyze_report'); analyzeMutation.mutate(); }}
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
        <div className="space-y-6">
          {/* Group findings by urgency */}
          {(() => {
            const fixNow = report.findings.filter(f => f.urgency === 'now' || f.severity === 'critical');
            const planSoon = report.findings.filter(f => (f.urgency === 'soon' || f.severity === 'major') && f.urgency !== 'now' && f.severity !== 'critical');
            const addressLater = report.findings.filter(f => f.urgency !== 'now' && f.urgency !== 'soon' && f.severity !== 'critical' && f.severity !== 'major');
            
            return (
              <>
                {fixNow.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      Fix Now ({fixNow.length})
                    </h3>
                    <p className="text-sm text-muted-foreground -mt-1">
                      These should be addressed promptly to prevent further damage.
                    </p>
                    <div className="space-y-3">
                      {fixNow.map((finding) => (
                        <FindingCard key={finding.id} finding={finding} />
                      ))}
                    </div>
                  </div>
                )}
                
                {planSoon.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Clock className="h-5 w-5 text-orange-500" />
                      Plan for Soon ({planSoon.length})
                    </h3>
                    <p className="text-sm text-muted-foreground -mt-1">
                      Worth scheduling in the coming months—not emergencies, but don't ignore.
                    </p>
                    <div className="space-y-3">
                      {planSoon.map((finding) => (
                        <FindingCard key={finding.id} finding={finding} />
                      ))}
                    </div>
                  </div>
                )}
                
                {addressLater.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Address When Ready ({addressLater.length})
                    </h3>
                    <p className="text-sm text-muted-foreground -mt-1">
                      Low priority—tackle these when convenient or as part of larger projects.
                    </p>
                    <div className="space-y-3">
                      {addressLater.map((finding) => (
                        <FindingCard key={finding.id} finding={finding} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          
          <div className="p-4 bg-muted/30 rounded-lg border border-muted">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Note:</span> Cost estimates are typical ranges for this type of repair. 
              Actual costs vary by location, contractor, and specific conditions. Get quotes before committing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Inspections() {
  const [selectedReportId, setSelectedReportId] = useState<string | number | null>(null);
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
              Understand what needs attention and what can wait
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
            <h2 className="text-xl font-semibold text-foreground">Upload Your Inspection Report</h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              We'll summarize issues, estimate costs, and help you decide what to fix now versus later.
            </p>
            <p className="text-sm text-muted-foreground mt-4 max-w-sm mx-auto">
              Estimates are ranges, not quotes. You stay in control of every decision.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-4 py-2 w-fit mx-auto">
              <Info className="h-3.5 w-3.5" />
              <span>Accepts PDF, PNG, JPG up to 20MB</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => { trackEvent('click', 'inspections', 'view_report'); setSelectedReportId(report.id); }}
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
                        trackEvent('click', 'inspections', 'delete_report');
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
