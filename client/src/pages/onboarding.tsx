import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, Home, Shield } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { createHome } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC",
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [builtYear, setBuiltYear] = useState("");
  const [sqFt, setSqFt] = useState("");

  const createHomeMutation = useMutation({
    mutationFn: createHome,
    onSuccess: () => {
      toast({
        title: "Home profile created!",
        description: "Your home maintenance plan is ready.",
      });
      setLocation("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create home profile",
        variant: "destructive",
      });
    },
  });

  const validateStep1 = (): string[] => {
    const errors: string[] = [];
    if (!addressLine1.trim()) errors.push("Address line 1 is required.");
    if (!city.trim()) errors.push("City is required.");
    if (!state) errors.push("State is required.");
    if (!zipCode.trim()) {
      errors.push("ZIP code is required.");
    } else if (!/^\d{5}(-\d{4})?$/.test(zipCode.trim())) {
      errors.push("ZIP code must be 5 digits (e.g., 90210) or ZIP+4 (e.g., 90210-1234).");
    }
    return errors;
  };

  const handleNext = () => {
    if (step === 1) {
      const errors = validateStep1();
      if (errors.length > 0) {
        toast({ title: "Please fix the following", description: errors.join(" "), variant: "destructive" });
        return;
      }
      trackEvent('onboarding_step', 'onboarding', 'address_completed');
      setStep(2);
    } else if (step === 2) {
      const errors: string[] = [];
      const currentYear = new Date().getFullYear();
      if (builtYear) {
        const year = parseInt(builtYear);
        if (isNaN(year) || year < 1600 || year > currentYear) {
          errors.push(`Year built must be between 1600 and ${currentYear}.`);
        }
      }
      if (sqFt) {
        const sq = parseInt(sqFt);
        if (isNaN(sq) || sq < 100 || sq > 100000) {
          errors.push("Square feet must be between 100 and 100,000.");
        }
      }
      if (errors.length > 0) {
        toast({ title: "Validation Error", description: errors.join(" "), variant: "destructive" });
        return;
      }
      trackEvent('onboarding_step', 'onboarding', 'create_home');
      createHomeMutation.mutate({
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state,
        zipCode: zipCode.trim(),
        builtYear: builtYear ? parseInt(builtYear) : undefined,
        sqFt: sqFt ? parseInt(sqFt) : undefined,
        type: "Single Family Home",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center">
            <Home className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-4xl font-heading font-bold text-foreground">
            Let's set up your home.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We'll create a personalized maintenance plan based on your home's location, age, and systems.
          </p>
          <div className="flex gap-2 pt-4">
            <div className={`h-2 w-12 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
            <div className={`h-2 w-12 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-border'}`} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-heading font-bold">Home Buddy</span>
          </div>

          <div className="lg:hidden flex gap-2 mb-6">
            <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
            <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-border'}`} />
          </div>

          {step === 1 ? (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-welcome">
                  Where is your home?
                </h1>
                <p className="text-muted-foreground mt-1">
                  We'll use this for local codes and costs
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address1" className="text-sm font-medium">
                    Address Line 1 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="address1"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="123 Main Street"
                    className="h-12 bg-secondary/30 border-border/50 focus:bg-background"
                    data-testid="input-address-line1"
                    autoComplete="address-line1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address2" className="text-sm font-medium">
                    Address Line 2 <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="address2"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="Apt, Suite, Unit, etc."
                    className="h-12 bg-secondary/30 border-border/50 focus:bg-background"
                    data-testid="input-address-line2"
                    autoComplete="address-line2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-sm font-medium">
                      City <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Springfield"
                      className="h-12 bg-secondary/30 border-border/50 focus:bg-background"
                      data-testid="input-city"
                      autoComplete="address-level2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-sm font-medium">
                      State <span className="text-destructive">*</span>
                    </Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger className="h-12 bg-secondary/30 border-border/50 focus:bg-background" data-testid="select-state">
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 max-w-[200px]">
                  <Label htmlFor="zip" className="text-sm font-medium">
                    ZIP Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="zip"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="90210"
                    className="h-12 bg-secondary/30 border-border/50 focus:bg-background"
                    maxLength={10}
                    data-testid="input-zip"
                    autoComplete="postal-code"
                  />
                </div>
                
                <div className="flex items-start gap-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Shield className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>
                    Your full address is private. Home Buddy uses it only to personalize your home profile (like local climate and permit guidance). The Home Buddy team can't view your full address. We only use generalized location (e.g., city/region) for analytics. Data is encrypted in transit and at rest.
                  </span>
                </div>
              </div>

              <Button 
                className="w-full h-12 font-medium" 
                onClick={handleNext}
                disabled={!addressLine1.trim() || !city.trim() || !state || !zipCode.trim()}
                data-testid="button-continue"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  Tell us more
                </h1>
                <p className="text-muted-foreground mt-1">
                  Optional details for a better maintenance plan
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="year" className="text-sm font-medium">
                    Year Built <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input 
                    id="year"
                    type="number"
                    min={1600}
                    max={new Date().getFullYear()}
                    placeholder="e.g., 1985"
                    className="h-12 bg-secondary/30 border-border/50 focus:bg-background"
                    value={builtYear}
                    onChange={(e) => setBuiltYear(e.target.value)}
                    data-testid="input-year"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sqft" className="text-sm font-medium">
                    Square Footage <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input 
                    id="sqft"
                    type="number"
                    min={100}
                    max={100000}
                    placeholder="e.g., 2400"
                    className="h-12 bg-secondary/30 border-border/50 focus:bg-background"
                    value={sqFt}
                    onChange={(e) => setSqFt(e.target.value)}
                    data-testid="input-sqft"
                  />
                </div>
              </div>

              <Button 
                className="w-full h-12 font-medium" 
                onClick={handleNext}
                disabled={createHomeMutation.isPending}
                data-testid="button-create-plan"
              >
                {createHomeMutation.isPending ? "Creating..." : "Create My Plan"}
                {!createHomeMutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                You can skip these fields and add them later
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
