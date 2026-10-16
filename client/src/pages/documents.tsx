import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { getHome, getDocuments, createDocument, deleteDocument, getSystems, updateDocumentSystem } from "@/lib/api";
import {
  FolderOpen,
  Upload,
  Loader2,
  Trash2,
  FileText,
  FileImage,
  File,
  Download,
  Eye,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { trackEvent } from "@/lib/analytics";
import { FieldTooltip } from "@/components/field-tooltip";
import type { HomeDocument } from "@shared/schema";

const documentCategories = [
  "General",
  "Insurance",
  "Warranty",
  "Permit",
  "Contract",
  "Receipt",
  "Other",
] as const;

function getCategoryColor(category: string | null): string {
  const colors: Record<string, string> = {
    general: "bg-gray-100 text-gray-700 border-gray-200",
    insurance: "bg-blue-100 text-blue-700 border-blue-200",
    warranty: "bg-green-100 text-green-700 border-green-200",
    permit: "bg-purple-100 text-purple-700 border-purple-200",
    contract: "bg-orange-100 text-orange-700 border-orange-200",
    receipt: "bg-yellow-100 text-yellow-700 border-yellow-200",
    other: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return colors[(category || "general").toLowerCase()] || colors.general;
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType === "application/pdf") return FileText;
  return File;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreview(fileType: string | null): boolean {
  if (!fileType) return false;
  return fileType.startsWith("image/") || fileType === "application/pdf";
}

function DocumentRow({
  doc,
  onDelete,
  onView,
}: {
  doc: HomeDocument;
  onDelete: (id: number) => void;
  onView: (doc: HomeDocument) => void;
}) {
  const Icon = getFileIcon(doc.fileType);
  const previewable = canPreview(doc.fileType);

  return (
    <div
      className={`flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 sm:p-4 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors group ${previewable && doc.objectPath ? "cursor-pointer" : ""}`}
      data-testid={`card-document-${doc.id}`}
      onClick={() => previewable && doc.objectPath && onView(doc)}
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-24">
        <h3 className="font-medium text-foreground break-words" data-testid={`text-document-name-${doc.id}`}>
          {doc.name}
        </h3>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getCategoryColor(doc.category)}`}
            data-testid={`badge-category-${doc.id}`}
          >
            {doc.category || "General"}
          </span>
          {doc.fileSize && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(doc.fileSize)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {doc.createdAt
              ? format(new Date(doc.createdAt), "MMM d, yyyy")
              : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {doc.objectPath && previewable && (
          <button
            onClick={() => onView(doc)}
            className="p-3 min-h-11 min-w-11 text-muted-foreground hover:text-primary transition-colors md:opacity-50 md:group-hover:opacity-100"
            aria-label={`View ${doc.name}`}
            data-testid={`button-view-${doc.id}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        {doc.objectPath && (
          <a
            href={doc.objectPath}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 min-h-11 min-w-11 text-muted-foreground hover:text-foreground transition-colors md:opacity-50 md:group-hover:opacity-100"
            aria-label={`Download ${doc.name}`}
            data-testid={`link-download-${doc.id}`}
          >
            <Download className="h-4 w-4" />
          </a>
        )}
        <button
          onClick={() => onDelete(doc.id)}
          className="p-3 min-h-11 min-w-11 text-muted-foreground hover:text-red-600 transition-colors md:opacity-50 md:group-hover:opacity-100"
          aria-label={`Delete ${doc.name}`}
          data-testid={`button-delete-${doc.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DocumentsSection({ systemId }: { systemId?: number }) {
  // An omitted systemId means the house-wide library. A provided systemId
  // filters the same underlying records; files are never duplicated.
  useEffect(() => { trackEvent("documents_opened", "documents", "storage"); }, []);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>("General");
  const searchParams = new URLSearchParams(useSearch());
  const [fileSearch, setFileSearch] = useState(searchParams.get("q") || "");
  const [pendingDocument, setPendingDocument] = useState<any>(null);
  const [savingDocument, setSavingDocument] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<HomeDocument | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: home, isLoading: homeLoading, isError: homeError, refetch: retryHome } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });

  const homeId = home?.legacyId ?? null;
  const { data: systems = [] } = useQuery({
    queryKey: ["systems", home?.id],
    queryFn: () => getSystems(home!.id),
    enabled: !!home?.id && systemId === undefined,
  });
  const associableSystems = systems.filter(s => typeof s.legacyId === "number");


  const { data: documents = [], isLoading: docsLoading, isError: docsError, refetch: retryDocs } = useQuery({
    queryKey: ["documents", homeId],
    queryFn: () => getDocuments(homeId!),
    enabled: typeof homeId === "number",
  });
  const visibleDocuments = documents.filter(doc => (systemId === undefined || doc.systemId === systemId) &&
    [doc.name, doc.category, doc.notes].some(v => v?.toLowerCase().includes(fileSearch.toLowerCase().trim())));

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document deleted" });
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const associateMutation = useMutation({
    mutationFn: ({ id, target }: { id: number; target: number | null }) => updateDocumentSystem(id, target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document linked" });
    },
    onError: (error: Error) => toast({ title: "Could not link document", description: error.message, variant: "destructive" }),
  });

  const handleUploadComplete = async (result: any, retry = false) => {
    if (!homeId || !result.successful?.[0]) return;
    const file = result.successful[0];
    const payload = { name: file.name, fileType: file.type, fileSize: file.size || 0,
      objectPath: file.objectPath, category: result.category ?? uploadCategory.toLowerCase(), systemId: systemId ?? null };
    setSavingDocument(true);
    setPendingDocument({ ...result, category: payload.category });
    try {
      if (!file.objectPath) throw new Error("Document storage was not confirmed");
      // An uncertain metadata response must be reconciled before retrying the
      // same uploaded object. Never upload a second object to retry metadata.
      const existing = retry ? await getDocuments(homeId) : [];
      const saved = existing.find(doc => doc.objectPath === file.objectPath) ?? await createDocument(homeId, payload);
      queryClient.setQueryData<HomeDocument[]>(["documents", homeId], old => [...(old ?? []).filter(doc => doc.id !== saved.id), saved]);
      void queryClient.invalidateQueries({ queryKey: ["documents", homeId] });
      setPendingDocument(null);
      trackEvent("document_storage_confirmed", "documents", "saved");
      toast({ title: "Document saved", description: `${file.name} is in My House → Documents.` });
    } catch {
      trackEvent("document_storage_failed", "documents", "metadata_write");
      toast({ title: "We could not save this document. Try again.", variant: "destructive" });
    } finally { setSavingDocument(false); }
  };

  if (homeLoading || docsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (homeError || docsError) return <div role="alert" className="space-y-3 p-4"><p>We could not load your documents.</p><Button onClick={() => { void retryHome(); void retryDocs(); }}>Try again</Button></div>;
  if (home && !homeId) return <div role="alert">Documents are temporarily unavailable. <Button onClick={() => retryHome()}>Try again</Button></div>;

  if (!home) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Please set up your home profile first.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <p className="text-muted-foreground">
              Keep your documents findable and connected to your house
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FieldTooltip termSlug="doc-insurance" screenName="documents" />
            <Select
              value={uploadCategory}
              onValueChange={setUploadCategory}
            >
              <SelectTrigger
                className="w-[130px]"
                data-testid="select-category"
              >
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {documentCategories.map((cat) => (
                  <SelectItem key={cat} value={cat} data-testid={`option-category-${cat.toLowerCase()}`}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ObjectUploader
              disabled={!!pendingDocument}
              maxNumberOfFiles={1}
              maxFileSize={10485760}
              onComplete={handleUploadComplete}
              buttonClassName="shadow-lg shadow-primary/20 min-h-11 text-stone-950"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </ObjectUploader>
          </div>
        </header>

        {pendingDocument && <div role="status" className="rounded-xl border p-4 space-y-2"><p>{savingDocument ? "Saving document…" : "We could not save this document. Try again."}</p>{!savingDocument && <Button onClick={() => handleUploadComplete(pendingDocument, true)}>Retry saving document</Button>}</div>}
        <input
          type="search"
          aria-label="Search documents"
          placeholder="Search documents by name or category"
          value={fileSearch}
          onChange={e => setFileSearch(e.target.value)}
          className="w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base"
          data-testid="input-files-search"
        />
        {visibleDocuments.length === 0 ? (
          <div className="py-16 text-center" data-testid="empty-state">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {fileSearch ? "No documents match that search" : systemId !== undefined ? "No documents linked to this system yet" : "No documents yet"}
            </h2>
            {fileSearch && <Button variant="ghost" onClick={() => setFileSearch("")}>Clear search</Button>}
            <p className="text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              Upload insurance policies, warranties, permits, contracts, and
              other important home documents to keep them organized in one
              place.
            </p>
            <p className="text-sm text-muted-foreground mt-4 max-w-sm mx-auto">
              Accepts PDF, images, Word, Excel, and text files up to 10MB
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="document-list">
            {visibleDocuments.map((doc) => (
              <div key={doc.id} className="space-y-1">
                <DocumentRow
                  doc={doc}
                  onDelete={(id) => setDeleteConfirmId(id)}
                  onView={(d) => setPreviewDoc(d)}
                />
                {systemId === undefined && associableSystems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 px-3 pb-1">
                    <label htmlFor={`file-system-${doc.id}`} className="text-xs text-muted-foreground">Associated system</label>
                    <select
                      id={`file-system-${doc.id}`}
                      className="rounded-md border bg-background px-2 py-1 text-xs max-w-[220px]"
                      value={doc.systemId ?? ""}
                      disabled={associateMutation.isPending}
                      onChange={e => associateMutation.mutate({ id: doc.id, target: e.target.value ? Number(e.target.value) : null })}
                      data-testid={`select-file-system-${doc.id}`}
                    >
                      <option value="">Whole house / unassigned</option>
                      {associableSystems.map(s => <option key={s.id} value={s.legacyId!}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <AlertDialog
          open={!!deleteConfirmId}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this document?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the document record. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirmId) {
                    trackEvent("click", "documents", "delete_document");
                    deleteMutation.mutate(deleteConfirmId);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2 truncate pr-8" data-testid="text-preview-title">
                <Eye className="h-4 w-4 shrink-0" />
                <span className="truncate">{previewDoc?.name}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden px-6 pb-6" data-testid="document-preview-content">
              {previewDoc?.fileType?.startsWith("image/") && previewDoc.objectPath && (
                <div className="flex items-center justify-center h-full max-h-[70vh] overflow-auto">
                  <img
                    src={previewDoc.objectPath}
                    alt={previewDoc.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    data-testid="img-document-preview"
                  />
                </div>
              )}
              {previewDoc?.fileType === "application/pdf" && previewDoc.objectPath && (
                <iframe
                  src={previewDoc.objectPath}
                  className="w-full h-[70vh] rounded-lg border"
                  title={previewDoc.name}
                  data-testid="iframe-document-preview"
                />
              )}
            </div>
            <div className="px-6 pb-4 flex justify-end gap-2">
              {previewDoc?.objectPath && (
                <a
                  href={previewDoc.objectPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md border hover:bg-secondary transition-colors"
                  data-testid="link-preview-download"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              )}
              <Button variant="outline" onClick={() => setPreviewDoc(null)} data-testid="button-close-preview">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
