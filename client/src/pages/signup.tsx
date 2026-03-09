import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Home,
  Shield,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  FileText,
  Zap,
  CalendarClock,
  Paintbrush,
  Wrench,
} from "lucide-react";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const benefits = [
  {
    icon: CalendarClock,
    title: "Personalized schedules",
    description: "AI builds maintenance tasks tailored to your exact systems",
  },
  {
    icon: FileText,
    title: "Upload inspection reports",
    description: "AI reads your documents and extracts every system and finding",
  },
  {
    icon: Zap,
    title: "DIY safety ratings",
    description: "Know what you can fix yourself and what needs a professional",
  },
  {
    icon: Paintbrush,
    title: "Track everything",
    description: "From paint colors to circuit breakers — one place for it all",
  },
];

const socialProof = [
  "14 system categories",
  "50+ task templates",
  "19 AI detection patterns",
  "100% free, forever",
];

export default function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleTestSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Sign up failed", description: data.message || "Something went wrong", variant: "destructive" });
        return;
      }
      trackEvent("signup_complete", "auth", "test");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/";
    } catch {
      toast({ title: "Sign up failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-background dark:from-orange-950/20 dark:via-background dark:to-background">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <nav className="container mx-auto px-6 h-16 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 no-underline" data-testid="link-signup-home">
            <img
              src="/images/home-buddy-icon.png"
              alt="Home Buddy logo"
              className="h-8 w-8 rounded-lg object-cover"
              width="32"
              height="32"
            />
            <span className="text-xl font-heading font-bold text-foreground">Home Buddy</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">Already have an account?</span>
            <Link
              href="/login"
              onClick={() => trackEvent("click", "signup", "sign_in_header")}
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent no-underline transition-colors"
              data-testid="link-signup-signin"
            >
              Sign In
            </Link>
          </div>
        </nav>
      </header>

      <main className="pt-16">
        <div className="container mx-auto px-6 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-10 lg:sticky lg:top-28"
            >
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  Free forever. No credit card needed.
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-[1.08] tracking-tight">
                  Take control of<br />
                  <span className="text-primary">your home.</span>
                </h1>

                <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                  Home Buddy gives you a personalized maintenance plan in minutes. Stop worrying about what you're forgetting.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit) => (
                  <div
                    key={benefit.title}
                    className="flex gap-3 p-4 rounded-xl bg-card border border-border/50"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{benefit.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                {socialProof.map((stat) => (
                  <span
                    key={stat}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-xs font-medium"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {stat}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full max-w-md mx-auto lg:mx-0"
            >
              <div className="bg-card border border-border/50 rounded-2xl shadow-xl shadow-black/5 p-8 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-heading font-bold text-foreground">Create your account</h2>
                  <p className="text-sm text-muted-foreground">Get started in under 2 minutes</p>
                </div>

                <a
                  href="/api/login"
                  target="_top"
                  onClick={() => trackEvent("signup_attempt", "auth", "replit")}
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "w-full h-12 text-base font-medium gap-3 justify-center no-underline"
                  )}
                  data-testid="button-signup-oauth"
                >
                  <UserPlus className="h-5 w-5" />
                  Sign Up with Replit
                </a>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or use test credentials</span>
                  </div>
                </div>

                <form onSubmit={handleTestSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      data-testid="input-signup-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      data-testid="input-signup-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full h-12 text-base font-medium gap-3"
                    disabled={loading || !username || !password}
                    data-testid="button-signup-submit"
                  >
                    <Wrench className="h-5 w-5" />
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>

                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center pt-2">
                  <Shield className="h-4 w-4" />
                  <span>Secure authentication. Your data stays yours.</span>
                </div>

                <p className="text-center text-xs text-muted-foreground leading-relaxed">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="underline hover:text-foreground" data-testid="link-signup-terms">
                    Terms of Service & Privacy Policy
                  </Link>
                </p>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline no-underline" data-testid="link-signup-login">
                  Sign in here
                </Link>
              </p>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
