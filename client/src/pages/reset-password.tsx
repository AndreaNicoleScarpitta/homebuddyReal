import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token")
    : null;

  useEffect(() => { trackSlugPageView(PAGE_SLUGS.resetPassword); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setMismatch(true); return; }
    setMismatch(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reset failed");

      // Prime auth cache so the app knows the user is signed in
      if (data.user) queryClient.setQueryData(["/api/auth/user"], data.user);
      setDone(true);
      // Give user a moment to see the success state, then redirect
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      toast({ title: "Couldn't reset password", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Invalid reset link</h1>
          <p className="text-sm text-muted-foreground">
            This link is missing a reset token. Please request a new one.
          </p>
          <Link href="/forgot-password" className="inline-block text-primary font-medium text-sm no-underline hover:underline">
            Request a new link →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="flex items-center gap-2 no-underline mb-8">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Home className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-heading font-bold">Home Buddy</span>
        </Link>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Password updated</h1>
            <p className="text-sm text-muted-foreground">You're signed in. Redirecting…</p>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Set a new password</h1>
              <p className="text-muted-foreground mt-1 text-sm">Choose something strong — at least 8 characters.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">New password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setMismatch(false); }}
                  data-testid="input-reset-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm">Confirm new password</Label>
                <Input
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setMismatch(false); }}
                  className={mismatch ? "border-destructive focus-visible:ring-destructive" : ""}
                  data-testid="input-reset-confirm"
                />
                {mismatch && (
                  <p className="text-xs text-destructive">Passwords don't match.</p>
                )}
              </div>
              <Button type="submit" className="w-full h-11" disabled={submitting} data-testid="button-reset-submit">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating…
                  </span>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
