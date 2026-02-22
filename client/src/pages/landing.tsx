import { buttonVariants } from "@/components/ui/button";
import { Calendar, MessageSquare, Shield, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Landing() {
  const features = [
    { icon: Calendar, title: "Smart Scheduling", desc: "Now, Soon, Later priorities" },
    { icon: Shield, title: "Safety First", desc: "DIY vs Pro guidance" },
    { icon: MessageSquare, title: "AI Assistant", desc: "24/7 expert advice" },
  ];

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
          <a
            href="/login"
            className={cn(buttonVariants({ variant: "outline" }), "font-medium")}
            data-testid="button-login"
          >
            Sign In
          </a>
        </div>
      </header>

      <main className="pt-16">
        <section className="min-h-[90vh] flex items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          
          <div className="container mx-auto px-6 py-20">
            <div className="max-w-3xl">
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
                
                <div className="flex items-center gap-4 pt-4">
                  <a
                    href="/login"
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "h-14 px-8 text-lg font-medium shadow-lg shadow-primary/25 no-underline"
                    )}
                    data-testid="button-hero-login"
                  >
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                  <span className="text-sm text-muted-foreground">No credit card required</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-24 border-t border-border/40">
          <div className="container mx-auto px-6">
            <div className="flex flex-wrap gap-4 justify-center mb-16">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-3 px-6 py-4 rounded-full bg-secondary/50 border border-border/40"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{feature.title}</div>
                    <div className="text-sm text-muted-foreground">{feature.desc}</div>
                  </div>
                </motion.div>
              ))}
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
