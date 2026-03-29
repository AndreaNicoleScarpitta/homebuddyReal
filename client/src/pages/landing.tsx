import { Calendar, MessageSquare, ArrowRight, Sparkles, FileText, Scan, CalendarClock, Shield, Heart, Zap, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { DashboardDemo, ChatDemo, DocumentAnalysisDemo, TaskGenerationDemo } from "@/components/landing-demos";
import { trackEvent, trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";
import { useEffect } from "react";
import { Link } from "wouter";

export default function Landing() {
  useEffect(() => {
    document.title = "Home Buddy — AI Home Maintenance Planner & Tracker";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Home Buddy builds a personalized maintenance schedule for your home. Upload inspection reports, track HVAC, plumbing, roof and electrical systems, and know what's safe to DIY.");
    }
  }, []);

  useEffect(() => { trackSlugPageView(PAGE_SLUGS.landing); }, []);

  const stats = [
    { value: "14", label: "System categories tracked" },
    { value: "50+", label: "Recurring task templates" },
    { value: "19", label: "AI detection patterns" },
    { value: "24/7", label: "AI-powered insights" },
  ];

  const howItWorks = [
    {
      step: "01",
      title: "Add your systems",
      description: "Tell us what's in your home — HVAC, roof, plumbing, electrical, appliances. Takes about 2 minutes.",
    },
    {
      step: "02",
      title: "Get your schedule",
      description: "AI generates a personalized maintenance calendar with the right tasks at the right intervals. No guessing.",
    },
    {
      step: "03",
      title: "Stay ahead of problems",
      description: "See what needs attention now, what's coming up, and what you can safely handle yourself.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-background to-background dark:from-orange-950/20 dark:via-background dark:to-background">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40" role="banner">
        <nav className="container mx-auto px-6 h-16 flex justify-between items-center" aria-label="Main navigation">
          <Link href="/" className="flex items-center gap-2 no-underline" aria-label="Home Buddy - Home">
            <img
              src="/images/home-buddy-icon.webp"
              alt="Home Buddy logo"
              className="h-8 w-8 rounded-lg object-cover"
              width="32"
              height="32"
            />
            <span className="text-xl font-heading font-bold text-foreground">Home Buddy</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              onClick={() => trackEvent('click', 'landing', 'sign_in_header')}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground no-underline transition-colors"
              data-testid="button-login"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => trackEvent('click', 'landing', 'sign_up_header')}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 no-underline transition-colors"
              data-testid="button-signup-header"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      <main className="pt-16">
        <section className="min-h-[90vh] flex items-center relative overflow-hidden" aria-label="Hero - AI Home Maintenance Planner">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl" />

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
                  AI-powered home maintenance
                </div>

                <h1 className="text-5xl md:text-7xl font-heading font-bold text-foreground leading-[1.08] tracking-tight">
                  Stop guessing.<br />
                  <span className="text-primary">Start maintaining.</span>
                </h1>

                <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
                  Home Buddy builds a personalized maintenance schedule for your home, tells you what's safe to DIY, and catches problems before they become expensive emergencies.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="/api/login"
                    target="_top"
                    onClick={() => trackEvent('click', 'landing', 'cta_hero')}
                    className="inline-flex items-center justify-center h-14 px-8 text-lg font-medium rounded-md bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 no-underline transition-all hover:shadow-primary/35 hover:shadow-xl"
                    data-testid="button-cta-hero"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="hidden lg:block"
              >
                <DashboardDemo />
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-12 border-y border-border/40 bg-card/50" aria-label="Key metrics">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="text-center"
                >
                  <div className="text-3xl md:text-4xl font-heading font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-2xl mb-16"
            >
              <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Document Analysis</p>
              <h2 className="text-4xl font-heading font-bold text-foreground mb-4">
                Upload an inspection report.<br />
                Get an action plan in seconds.
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Drop a PDF, photo, or document. Our AI reads it, identifies your home systems, flags safety issues, and creates maintenance tasks — all automatically. No more decoding contractor-speak.
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <DocumentAnalysisDemo />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
                className="space-y-6 lg:py-8"
              >
                {[
                  { icon: Scan, title: "Reads any home document", desc: "Inspection reports, warranties, invoices, permit records, maintenance receipts. PDF, images, or text." },
                  { icon: Zap, title: "Extracts what matters", desc: "Detects equipment models, issue severity, estimated costs, and whether you need a professional or can handle it yourself." },
                  { icon: Shield, title: "Catches what you'd miss", desc: "19 AI patterns detect contractor language for end-of-life warnings, code violations, safety hazards, and hidden recommendations." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-foreground mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary/30">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-2xl mb-16"
            >
              <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Recurring Maintenance</p>
              <h2 className="text-4xl font-heading font-bold text-foreground mb-4">
                Every system gets a schedule.<br />
                You just check things off.
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Add a system. Home Buddy generates the right maintenance tasks with the right cadences — based on manufacturer recommendations and industry best practices. Filter replacement every 90 days? Water heater flush every year? It's all there.
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
                className="space-y-6 lg:py-8 order-2 lg:order-1"
              >
                {[
                  { icon: CalendarClock, title: "Smart cadences, not guesswork", desc: "Task frequencies come from real maintenance standards. Monthly smoke detector tests, quarterly filter changes, annual system inspections — all preset." },
                  { icon: Sparkles, title: "AI-powered for uncommon systems", desc: "Have something unusual? Our AI researches best practices and suggests a maintenance schedule tailored to your specific equipment." },
                  { icon: Heart, title: "Know what you can handle", desc: "Every task gets a DIY safety rating. Green means go. Red means call a pro. No judgment, just clarity." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-foreground mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="order-1 lg:order-2"
              >
                <TaskGenerationDemo />
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-heading font-bold text-foreground mb-4">
                More than a to-do list
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Home Buddy brings together everything you need to take care of your home — without the overwhelm
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                viewport={{ once: true }}
              >
                <ChatDemo />
                <div className="flex items-center gap-3 mt-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground text-lg" data-testid="text-feature-assistant">
                      AI Assistant
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary align-middle">Coming Soon</span>
                    </h3>
                    <p className="text-sm text-muted-foreground">Ask anything. Get real answers with cost estimates, safety guidance, and step-by-step instructions.</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                viewport={{ once: true }}
              >
                <DashboardDemo />
                <div className="flex items-center gap-3 mt-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground text-lg" data-testid="text-feature-scheduling">Priority Dashboard</h3>
                    <p className="text-sm text-muted-foreground">Now, Soon, Later. See what needs attention at a glance. Swipe to complete tasks as you go.</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary/30">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-heading font-bold text-foreground mb-4">
                How it works
              </h2>
              <p className="text-lg text-muted-foreground">
                Set up your home in minutes. Stay on top of maintenance for years.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {howItWorks.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <div className="text-6xl font-heading font-bold text-primary/10 mb-3">{step.step}</div>
                  <h3 className="text-xl font-heading font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  {i < howItWorks.length - 1 && (
                    <ChevronRight className="hidden md:block absolute top-8 -right-4 h-6 w-6 text-primary/20" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Homeowner Guides / Articles Section */}
        <section className="py-24 bg-muted/20">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
                Homeowner Guides
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Honest, practical advice for people who own a house and want to keep it from falling apart.
              </p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              {[
                {
                  title: "Home Maintenance Checklist by Month",
                  description: "A month-by-month breakdown of what your home needs—because your house won't text you.",
                  href: "/guides/home-maintenance-checklist-by-month",
                  trackId: "article_monthly_checklist",
                },
                {
                  title: "First 90 Days After Buying a House",
                  description: "The essential tasks to handle in your first three months as a new homeowner.",
                  href: "/guides/first-90-days-after-buying-a-house",
                  trackId: "article_first_90_days",
                },
                {
                  title: "What to Fix First After a Home Inspection",
                  description: "How to turn an overwhelming inspection report into a clear, manageable plan.",
                  href: "/guides/what-to-fix-after-home-inspection",
                  trackId: "article_home_inspection",
                },
                {
                  title: "How Much Does Home Maintenance Cost?",
                  description: "The real cost of owning a home, where the money goes, and how to stop being surprised.",
                  href: "/guides/how-much-does-home-maintenance-cost",
                  trackId: "article_maintenance_cost",
                },
                {
                  title: "Printable Schedule (And Why It Fails)",
                  description: "Why printable checklists feel great but rarely work—and what actually keeps you on track.",
                  href: "/guides/printable-home-maintenance-schedule",
                  trackId: "article_printable_schedule",
                },
              ].map((article, i) => (
                <motion.div
                  key={article.href}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Link
                    href={article.href}
                    onClick={() => trackEvent('click', 'landing', article.trackId)}
                    className="block rounded-lg bg-card border border-border/50 p-6 hover:border-primary/30 hover:shadow-md transition-all duration-200 no-underline h-full"
                  >
                    <h3 className="font-heading font-semibold text-foreground mb-2 text-lg">
                      {article.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {article.description}
                    </p>
                    <span className="text-sm font-medium text-primary inline-flex items-center gap-1">
                      Read article <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
          <div className="container mx-auto px-6 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center space-y-8"
            >
              <h2 className="text-4xl md:text-5xl font-heading font-bold text-foreground">
                Your home deserves better than a spreadsheet.
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Built by homeowners who got tired of forgetting when they last changed the furnace filter. Takes 2 minutes to set up.
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-12" role="contentinfo">
        <div className="container mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/images/home-buddy-icon.webp" alt="Home Buddy" className="h-6 w-6 rounded" width="24" height="24" />
                <span className="font-heading font-bold text-foreground">Home Buddy</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your AI-powered home maintenance planner. Track systems, schedule tasks, upload inspection reports, and stay ahead of costly repairs.
              </p>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-foreground mb-3">Guides</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/guides/home-maintenance-checklist-by-month" onClick={() => trackEvent('click', 'landing', 'footer_guide_monthly')} className="text-muted-foreground hover:text-foreground no-underline transition-colors" data-testid="link-guide-monthly">Monthly Maintenance Checklist</Link>
                </li>
                <li>
                  <Link href="/guides/annual-home-maintenance-schedule" onClick={() => trackEvent('click', 'landing', 'footer_guide_annual')} className="text-muted-foreground hover:text-foreground no-underline transition-colors" data-testid="link-guide-annual">Annual Maintenance Schedule</Link>
                </li>
                <li>
                  <Link href="/guides/what-to-maintain-in-a-new-house" onClick={() => trackEvent('click', 'landing', 'footer_guide_new_homeowner')} className="text-muted-foreground hover:text-foreground no-underline transition-colors" data-testid="link-guide-new-homeowner">New Homeowner Guide</Link>
                </li>
                <li>
                  <Link href="/guides/first-90-days-after-buying-a-house" onClick={() => trackEvent('click', 'landing', 'footer_guide_first_90')} className="text-muted-foreground hover:text-foreground no-underline transition-colors">First 90 Days</Link>
                </li>
                <li>
                  <Link href="/guides/what-to-fix-after-home-inspection" onClick={() => trackEvent('click', 'landing', 'footer_guide_inspection')} className="text-muted-foreground hover:text-foreground no-underline transition-colors">After a Home Inspection</Link>
                </li>
                <li>
                  <Link href="/guides/how-much-does-home-maintenance-cost" onClick={() => trackEvent('click', 'landing', 'footer_guide_cost')} className="text-muted-foreground hover:text-foreground no-underline transition-colors">Maintenance Costs</Link>
                </li>
                <li>
                  <Link href="/guides/printable-home-maintenance-schedule" onClick={() => trackEvent('click', 'landing', 'footer_guide_printable')} className="text-muted-foreground hover:text-foreground no-underline transition-colors">Printable Schedule</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-foreground mb-3">Links</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/login" className="text-muted-foreground hover:text-foreground no-underline transition-colors">Sign In</Link>
                </li>
                <li>
                  <Link href="/terms" onClick={() => trackEvent('click', 'landing', 'footer_terms')} className="text-muted-foreground hover:text-foreground no-underline transition-colors" data-testid="link-footer-terms">Terms & Conditions</Link>
                </li>
                <li>
                  <Link href="/contact" onClick={() => trackEvent('click', 'landing', 'footer_contact')} className="text-muted-foreground hover:text-foreground no-underline transition-colors" data-testid="link-footer-contact">Contact</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/40 pt-6 text-center text-sm text-muted-foreground">
            <p>&copy; 2026 Home Buddy. AI-powered home maintenance assistant.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
