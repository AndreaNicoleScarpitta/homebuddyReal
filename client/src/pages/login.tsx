import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, Shield, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleTestLogin = async (e: React.FormEvent) => {
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
        toast({ title: "Login failed", description: data.message || "Invalid credentials", variant: "destructive" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/";
    } catch {
      toast({ title: "Login failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
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
            <h1 className="text-2xl font-heading font-bold text-foreground">Welcome</h1>
            <p className="text-muted-foreground mt-1">Sign in to manage your home</p>
          </div>

          <form onSubmit={handleTestLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                data-testid="input-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium gap-3"
              disabled={loading || !username || !password}
              data-testid="button-login-submit"
            >
              <LogIn className="h-5 w-5" />
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <a
            href="/api/login"
            target="_top"
            onClick={() => trackEvent('login_attempt', 'auth', 'replit')}
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "w-full h-12 text-base font-medium gap-3 justify-center no-underline"
            )}
            data-testid="button-login-oauth"
          >
            Sign In with Replit
          </a>

          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
            <Shield className="h-4 w-4" />
            <span>Secure authentication</span>
          </div>

          <p className="text-center text-xs text-muted-foreground leading-relaxed pt-4">
            By continuing, you agree to our{" "}
            <a href="/terms" className="underline hover:text-foreground" data-testid="link-terms">
              Terms of Service & Privacy Policy
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
