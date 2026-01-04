import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Mail, Lock, Home } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setShowOtp(true);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp) {
      setLocation("/onboarding");
    }
  };

  const socialProviders = [
    { name: "Google", icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
    )},
    { name: "Facebook", icon: (
      <svg className="h-5 w-5" fill="#1877F2" viewBox="0 0 24 24"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.048 0-2.73 1.056-2.73 2.809v1.162h4.438l-.66 3.667h-3.778v7.98h-5.084Z"/></svg>
    )},
    { name: "Twitter", icon: (
      <svg className="h-5 w-5" fill="#1D9BF0" viewBox="0 0 24 24"><path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23Z"/></svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center">
            <Home className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-4xl font-heading font-bold text-foreground">
            Your home maintenance, simplified.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Join thousands of homeowners who trust Home Buddy to keep their homes in perfect condition.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-heading font-bold">Home Buddy</span>
          </div>

          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          <div className="space-y-3">
            {socialProviders.map((provider) => (
              <button
                key={provider.name}
                type="button"
                onClick={() => setLocation("/onboarding")}
                className="w-full h-12 flex items-center justify-center gap-3 rounded-lg border border-border bg-background hover:bg-secondary/50 transition-colors text-foreground font-medium"
                data-testid={`button-login-${provider.name.toLowerCase()}`}
              >
                {provider.icon}
                Continue with {provider.name}
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-4 text-muted-foreground">or</span>
            </div>
          </div>

          {!showOtp ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="you@example.com" 
                    className="pl-10 h-12 bg-secondary/30 border-border/50 focus:bg-background" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 font-medium" disabled={!email} data-testid="button-send-code">
                Send Login Code
              </Button>
            </form>
          ) : (
            <motion.form 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleVerifyOtp} 
              className="space-y-4"
            >
              <button 
                type="button"
                onClick={() => setShowOtp(false)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-sm font-medium">
                  Enter code sent to {email}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="otp" 
                    type="text" 
                    placeholder="000000" 
                    className="pl-10 h-12 bg-secondary/30 border-border/50 focus:bg-background tracking-[0.5em] text-center font-mono" 
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    data-testid="input-otp"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 font-medium" disabled={otp.length < 6} data-testid="button-verify">
                Verify & Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Didn't receive it?{" "}
                <button type="button" className="text-primary hover:underline">Resend</button>
              </p>
            </motion.form>
          )}

          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            By continuing, you agree to our{" "}
            <a href="#" className="underline hover:text-foreground">Terms</a>
            {" "}and{" "}
            <a href="#" className="underline hover:text-foreground">Privacy Policy</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
