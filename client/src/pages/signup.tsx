import { useEffect } from "react";
import {
  Shield,
  CheckCircle2,
  Sparkles,
  FileText,
  Zap,
  CalendarClock,
  Paintbrush,
  Mail,
} from "lucide-react";
import { motion } from "framer-motion";
import { trackEvent, trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { buttonVariants } from "@/components/ui/button";

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const AppleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

const GitHubIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const XIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const authProviders = [
  { name: "Google", icon: GoogleIcon, testId: "button-signup-google" },
  { name: "Apple", icon: AppleIcon, testId: "button-signup-apple" },
  { name: "GitHub", icon: GitHubIcon, testId: "button-signup-github" },
  { name: "X", icon: XIcon, testId: "button-signup-x" },
  { name: "email", icon: Mail, testId: "button-signup-email" },
];

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
  "24/7 AI-powered insights",
];

export default function Signup() {
  useEffect(() => { trackSlugPageView(PAGE_SLUGS.signup); }, []);

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
                  AI-powered home maintenance
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
                  <p className="text-sm text-muted-foreground">Set up your home profile in under 2 minutes</p>
                </div>

                <div className="space-y-3">
                  {authProviders.map((provider) => (
                    <a
                      key={provider.name}
                      href="/api/login"
                      target="_top"
                      onClick={() => trackEvent("signup_attempt", "auth", provider.name.toLowerCase())}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "default" }),
                        "w-full h-11 text-sm font-medium gap-3 justify-center no-underline border-border hover:bg-accent"
                      )}
                      data-testid={provider.testId}
                    >
                      <provider.icon />
                      Continue with {provider.name}
                    </a>
                  ))}
                </div>

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
