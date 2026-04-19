import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, Shield, Mail, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { trackEvent, trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { trackSlugPageView(PAGE_SLUGS.login); }, []);

  useEffect(() => {
    // Surface OAuth errors from query string
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      const msg: Record<string, string> = {
        google_unavailable: "Google sign-in is not configured yet.",
        google_no_email: "Google didn't return an email — try again.",
        auth_failed: "Sign-in failed. Please try again.",
        session_failed: "Session couldn't be saved. Please try again.",
      };
      toast({ title: "Sign-in error", description: msg[err] || err, variant: "destructive" });
      window.history.replaceState({}, "", "/login");
    }
  }, [toast]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    trackEvent("login_attempt", "auth", "email");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invalid email or password");
      trackEvent("login_success", "auth", "email");
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Couldn't sign you in", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

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
            Sign in to manage your home systems, track maintenance tasks, and stay ahead of costly repairs.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-heading font-bold">Home Buddy</span>
          </div>

          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground mt-1">Sign in to manage your home</p>
          </div>

          {!showEmailForm ? (
            <div className="space-y-3">
              <a
                href="/auth/google"
                onClick={() => trackEvent("login_attempt", "auth", "google")}
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "w-full h-11 text-sm font-medium gap-3 justify-center no-underline",
                )}
                data-testid="button-login-google"
              >
                <GoogleIcon />
                Continue with Google
              </a>

              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "w-full h-11 text-sm font-medium gap-3 justify-center",
                )}
                data-testid="button-login-email"
              >
                <Mail className="h-5 w-5" />
                Continue with email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4" data-testid="form-login-email">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} data-testid="input-login-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input id="login-password" type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-login-password" />
              </div>
              <Button type="submit" className="w-full h-11" disabled={submitting} data-testid="button-submit-login">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
              <button type="button" onClick={() => setShowEmailForm(false)}
                className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
                ← Other sign-in options
              </button>
            </form>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
            <Shield className="h-4 w-4" />
            <span>Secure authentication</span>
          </div>

          <p className="text-center text-xs text-muted-foreground leading-relaxed pt-4">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground" data-testid="link-terms">
              Terms of Service & Privacy Policy
            </Link>
          </p>

          <p className="text-center text-sm text-muted-foreground pt-2">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary font-medium hover:underline no-underline" data-testid="link-login-signup">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
