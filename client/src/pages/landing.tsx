import { Button } from "@/components/ui/button";
import { Calendar, MessageSquare, ArrowRight, Sparkles, Wallet, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { DashboardDemo, ChatDemo, BudgetDemo } from "@/components/landing-demos";

export default function Landing() {
  const [, navigate] = useLocation();

  const benefits = [
    "Track all your home systems in one place",
    "Get reminders before issues become emergencies",
    "Know when to DIY vs. call a pro",
    "See estimated costs before you commit",
    "Access permit requirements for your area",
    "Build trust with transparent safety guidance"
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img
              src="/images/home-buddy-icon.png"
              alt="Home Buddy"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="text-xl font-heading font-bold">Home Buddy</span>
          </div>
          <Button
            variant="outline"
            className="font-medium"
            onClick={() => navigate("/login")}
            data-testid="button-login"
          >
            Sign In
          </Button>
        </div>
      </header>

      <main className="pt-16">
        <section className="min-h-[90vh] flex items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          
          <div className="container mx-auto px-6 py-20">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  AI-Powered Home Maintenance
                </div>
                
                <h1 className="text-5xl md:text-7xl font-heading font-bold text-foreground leading-tight tracking-tight">
                  Your home,<br />
                  <span className="text-primary">perfectly maintained.</span>
                </h1>
                
                <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
                  Never miss a maintenance task. Get personalized guidance, safety alerts, and expert recommendations tailored to your home.
                </p>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4">
                  <Button
                    size="lg"
                    className="h-14 px-8 text-lg font-medium shadow-lg shadow-primary/25 cursor-pointer"
                    onClick={() => navigate("/signup")}
                    data-testid="button-hero-login"
                  >
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <span className="text-sm text-muted-foreground">No credit card required</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="hidden lg:block relative"
              >
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 border border-border/40 ring-1 ring-black/5">
                  <img
                    src="/images/app-dashboard-preview.png"
                    alt="Home Buddy Dashboard"
                    className="w-full h-auto transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="absolute -bottom-6 -left-6 bg-card rounded-xl shadow-lg border border-border/40 p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Tasks Completed</p>
                    <p className="text-xs text-muted-foreground">12 this month</p>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-24 border-t border-border/40">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-heading font-bold text-foreground mb-4">
                See it in action
              </h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to keep your home running smoothly
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                viewport={{ once: true }}
              >
                <DashboardDemo />
                <div className="flex items-center gap-3 mt-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground text-lg" data-testid="text-feature-scheduling">Smart Scheduling</h3>
                    <p className="text-sm text-muted-foreground">Now, Soon, Later priorities</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                viewport={{ once: true }}
              >
                <ChatDemo />
                <div className="flex items-center gap-3 mt-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground text-lg" data-testid="text-feature-assistant">AI Assistant</h3>
                    <p className="text-sm text-muted-foreground">24/7 expert advice</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                viewport={{ once: true }}
              >
                <BudgetDemo />
                <div className="flex items-center gap-3 mt-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground text-lg" data-testid="text-feature-budget">Budget Tracking</h3>
                    <p className="text-sm text-muted-foreground">No-shame financial planning</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary/30">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <h2 className="text-4xl font-heading font-bold text-foreground mb-4">
                  Why Home Buddy?
                </h2>
                <p className="text-lg text-muted-foreground">
                  Built for homeowners who want peace of mind
                </p>
              </motion.div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {benefits.map((benefit, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-4 p-4"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    <span className="text-foreground">{benefit}</span>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mt-12"
              >
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg font-medium shadow-lg shadow-primary/25 cursor-pointer"
                  onClick={() => navigate("/signup")}
                  data-testid="button-cta-bottom"
                >
                  Start Managing Your Home
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <span>&copy; 2026 Home Buddy. Your trusted home maintenance assistant.</span>
          <a href="/terms" className="underline hover:text-foreground" data-testid="link-footer-terms">
            Terms & Conditions
          </a>
        </div>
      </footer>
    </div>
  );
}
