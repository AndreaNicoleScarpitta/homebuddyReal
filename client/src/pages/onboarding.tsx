import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowRight, Home, Search } from "lucide-react";
import logoImage from "@assets/generated_images/orange_house_logo_with_grey_gear..png";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState("");

  const handleNext = () => {
    if (step === 1 && address) {
      setStep(2);
    } else {
      setLocation("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-3xl" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <img src={logoImage} alt="HomeWise" className="w-20 h-20 mx-auto rounded-2xl shadow-xl mb-6" />
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Welcome to HomeWise</h1>
          <p className="text-muted-foreground">Your personal AI home maintenance expert.</p>
        </div>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            {step === 1 ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-base font-medium">Where do you live?</Label>
                  <p className="text-xs text-muted-foreground">We'll pull public records to build your home profile.</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="address"
                      placeholder="Enter your home address..." 
                      className="pl-9 h-12 text-lg"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
                <Button 
                  className="w-full h-12 text-lg" 
                  onClick={handleNext}
                  disabled={!address}
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                 <div className="text-center py-6">
                   <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                     <Home className="h-8 w-8" />
                   </div>
                   <h3 className="text-xl font-heading font-semibold mb-2">Found it!</h3>
                   <p className="text-muted-foreground text-sm">
                     1985 Single Family Home<br/>
                     2,400 sq ft • 4 Bed / 3 Bath
                   </p>
                 </div>
                 <Button className="w-full h-12 text-lg" onClick={handleNext}>
                  Create My Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
