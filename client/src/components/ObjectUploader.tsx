import { trackEvent } from "@/lib/analytics";
import { useState, useRef } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ObjectUploaderProps {
  disabled?: boolean;
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onComplete?: (result: { successful: Array<{ id: string; name: string; type: string; size: number; objectPath?: string }> }) => void | Promise<void>;
  buttonClassName?: string;
  children: ReactNode;
  accept?: string;
}

export function ObjectUploader({
  disabled = false,
  maxFileSize = 10485760,
  onComplete,
  buttonClassName,
  children,
  accept = ".pdf,.png,.jpg,.jpeg",
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize) {
      alert(`File is too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB.`);
      return;
    }

    trackEvent("upload_started", "documents", "object_write");
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      if (!data.objectPath) throw new Error("Upload did not return a saved object");
      setSaving(true);

      await onComplete?.({
        successful: [{
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          objectPath: data.objectPath,
        }],
      });
    } catch (error) {
      console.error("Upload error:", error);
      trackEvent("document_storage_failed", "documents", "object_write");
      setUploadError("We could not save this document. Try again.");
    } finally {
      setIsUploading(false);
      setSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        data-testid="input-file"
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        className={buttonClassName}
        disabled={isUploading || disabled}
        data-testid="button-upload"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {saving ? "Saving document…" : "Uploading document…"}
          </>
        ) : (
          children
        )}
      </Button>
      {uploadError && <p role="alert" className="mt-2 text-sm text-destructive">{uploadError}</p>}
    </div>
  );
}
