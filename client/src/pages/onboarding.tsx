import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Home, Info } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { createHome } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete, type AddressComponents } from "@/components/address-autocomplete";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState("");
  const [addressComponents, setAddressComponents] = useState<AddressComponents | null>(null);
  const [addressVerified, setAddressVerified] = useState(false);
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

  const handleAddressChange = (addr: string, components?: AddressComponents) => {
    setAddress(addr);
    if (components) {
      setAddressComponents(components);
    }
  };

  const handleAddressVerified = (verified: boolean, components?: AddressComponents) => {
    setAddressVerified(verified);
    if (verified && components) {
      setAddressComponents(components);
    }
  };

  const handleNext = () => {
    if (step === 1 && address) {
      setStep(2);
    } else if (step === 2) {
      createHomeMutation.mutate({
        address: addressComponents?.fullAddress || address,
        streetAddress: addressComponents?.streetAddress,
        city: addressComponents?.city,
        state: addressComponents?.state,
        zipCode: addressComponents?.zipCode,
        zipPlus4: addressComponents?.zipPlus4,
        addressVerified,
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
                <AddressAutocomplete
                  value={address}
                  onChange={handleAddressChange}
                  onVerified={handleAddressVerified}
                  placeholder="Enter your home address..."
                />
                
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>
                    Your address helps us identify building codes, permit requirements, and regional maintenance costs.
                  </span>
                </div>
              </div>

              <Button 
                className="w-full h-12 font-medium" 
                onClick={handleNext}
                disabled={!address}
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
                  <Label htmlFor="year" className="text-sm font-medium">Year Built</Label>
                  <Input 
                    id="year"
                    type="number"
                    placeholder="e.g., 1985"
                    className="h-12 bg-secondary/30 border-border/50 focus:bg-background"
                    value={builtYear}
                    onChange={(e) => setBuiltYear(e.target.value)}
                    data-testid="input-year"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sqft" className="text-sm font-medium">Square Footage</Label>
                  <Input 
                    id="sqft"
                    type="number"
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
