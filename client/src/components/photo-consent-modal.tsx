import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Camera, ExternalLink } from "lucide-react";
import { Link } from "wouter";

interface PhotoConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function PhotoConsentModal({ isOpen, onAccept, onCancel }: PhotoConsentModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Before You Share a Photo
          </DialogTitle>
          <DialogDescription>
            Please read and acknowledge the following before uploading.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-800 dark:text-orange-200 mb-1">
                This is not a professional inspection
              </p>
              <p className="text-orange-700 dark:text-orange-300">
                Our AI assistant provides general observations based on what's visible in photos. It cannot replace a licensed home inspector, contractor, or other qualified professional.
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong className="text-foreground">What we can do:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Describe what we observe in the image</li>
              <li>Suggest possible causes for visible issues</li>
              <li>Recommend whether to investigate further</li>
              <li>Give general guidance on DIY vs. professional help</li>
            </ul>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong className="text-foreground">What we cannot do:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Provide formal diagnoses or inspection reports</li>
              <li>Guarantee accuracy of observations</li>
              <li>Assess hidden damage or structural integrity</li>
              <li>Replace professional advice for safety-critical issues</li>
            </ul>
          </div>

          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            <strong>For emergencies</strong> (gas leaks, electrical fires, flooding, structural damage): Do not use this app. Call 911 or emergency services immediately.
          </div>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              data-testid="checkbox-photo-consent"
            />
            <label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
              I understand that photo analysis is for informational purposes only and I am responsible for verifying any observations with qualified professionals before taking action.
            </label>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Link href="/terms" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            View full Terms & Conditions <ExternalLink className="h-3 w-3" />
          </Link>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-consent">
              Cancel
            </Button>
            <Button 
              onClick={onAccept} 
              disabled={!acknowledged}
              data-testid="button-accept-consent"
            >
              I Understand
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function usePhotoConsent() {
  const [hasConsented, setHasConsented] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("homebuddy_photo_consent");
    setHasConsented(consent === "true");
    setIsLoaded(true);
  }, []);

  const grantConsent = () => {
    localStorage.setItem("homebuddy_photo_consent", "true");
    setHasConsented(true);
  };

  const resetConsent = () => {
    localStorage.removeItem("homebuddy_photo_consent");
    setHasConsented(false);
  };

  return { hasConsented, isLoaded, grantConsent, resetConsent };
}
