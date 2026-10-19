import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight, CheckCircle2, ClipboardList, Clock3, FileText,
  House, MessageCircle, ShieldCheck, Wrench,
} from "lucide-react";
import { trackEvent, trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";

// All preview content is illustrative. It uses the current Home / Plan / My House
// / Assistant navigation and makes no claims about a visitor's actual property.
type PreviewTab = "home" | "plan" | "house" | "assistant";
const previewTabs: { id: PreviewTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "plan", label: "Plan" },
  { id: "house", label: "My House" },
  { id: "assistant", label: "Assistant" },
];

function ProductPreview() {
  const [active, setActive] = useState<PreviewTab>("home");

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[0_18px_60px_-24px_rgba(42,35,28,0.28)]" data-testid="landing-product-preview">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/images/home-buddy-icon.webp" alt="" className="h-7 w-7 shrink-0 rounded-lg" width="28" height="28" />
          <span className="truncate text-sm font-bold text-foreground">HomeBuddy</span>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">Illustrative preview</span>
      </div>
      <div className="grid grid-cols-4 gap-1 border-b border-border px-2 py-2 sm:px-4" role="tablist" aria-label="Explore HomeBuddy">
        {previewTabs.map((tab) => (
          <button
            key={tab.id}
            id={"preview-tab-" + tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls="preview-panel"
            onClick={() => setActive(tab.id)}
            className={"min-h-11 min-w-0 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors sm:text-sm " +
              (active === tab.id ? "bg-primary text-stone-950" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div id="preview-panel" role="tabpanel" aria-labelledby={"preview-tab-" + active} className="min-h-[260px] space-y-4 p-4 sm:min-h-[290px] sm:p-6">
        {active === "home" && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 dark:text-orange-300">Home overview</p>
              <h3 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">Know what needs attention</h3>
              <p className="mt-1 text-sm text-muted-foreground">See what matters next.</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Needs attention</p>
                  <p className="mt-1 text-sm text-foreground">Check your HVAC filter</p>
                  <p className="mt-1 text-xs text-muted-foreground">See the task in Plan.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-3 py-1.5">Systems</span>
              <span className="rounded-full border border-border px-3 py-1.5">Maintenance</span>
              <span className="rounded-full border border-border px-3 py-1.5">Home information</span>
            </div>
          </>
        )}
        {active === "plan" && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 dark:text-orange-300">Maintenance planning</p>
              <h3 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">Your plan, made clear</h3>
              <p className="mt-1 text-sm text-muted-foreground">See what’s due. Log what’s done.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["Upcoming", "Due / Urgent", "Past Due", "Completed"].map((label) => (
                <div key={label} className="flex min-h-14 items-center justify-center rounded-lg border border-border bg-muted/30 p-2 text-center text-xs font-semibold text-foreground">{label}</div>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-4">
              <Wrench className="h-5 w-5 shrink-0 text-orange-700 dark:text-orange-300" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm font-medium text-foreground">Check smoke alarms</span>
              <span className="text-xs text-muted-foreground">Example task</span>
            </div>
          </>
        )}
        {active === "house" && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 dark:text-orange-300">My House</p>
              <h3 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">Find what matters</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your systems, shutoffs, and files in one place.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border p-3"><House className="mb-2 h-5 w-5 text-orange-700 dark:text-orange-300" aria-hidden="true" /><p className="text-sm font-semibold">Systems & appliances</p></div>
              <div className="rounded-xl border border-border p-3"><ShieldCheck className="mb-2 h-5 w-5 text-orange-700 dark:text-orange-300" aria-hidden="true" /><p className="text-sm font-semibold">Emergency & utilities</p></div>
              <div className="col-span-2 flex items-center gap-3 rounded-xl border border-border p-3"><FileText className="h-5 w-5 shrink-0 text-orange-700 dark:text-orange-300" aria-hidden="true" /><div><p className="text-sm font-semibold">Documents</p><p className="text-xs text-muted-foreground">Inspections, manuals, and more</p></div></div>
            </div>
          </>
        )}
        {active === "assistant" && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 dark:text-orange-300">Home Assistant</p>
              <h3 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">Ask HomeBuddy</h3>
              <p className="mt-1 text-sm text-muted-foreground">Practical guidance based on your saved details.</p>
            </div>
            <div className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-stone-950">Where should I keep my water shutoff details?</div>
            <div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">Save the shutoff location under My House → Emergency & utilities, so it's easier to find when needed.</div>
          </>
        )}
      </div>
      <div className="border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Example content · Your home record is created during setup
      </div>
    </div>
  );
}

const benefits = [
  { icon: ClipboardList, title: "Know what’s next", copy: "See what needs attention and what’s coming up." },
  { icon: FileText, title: "Keep it together", copy: "Systems, documents, and shutoffs. One home record." },
  { icon: CheckCircle2, title: "Remember the work", copy: "Track completed maintenance and build a useful history." },
  { icon: MessageCircle, title: "Ask with context", copy: "Get guidance informed by your saved home details." },
];

const steps = [
  { title: "Add your home", copy: "Start with the basics and your main systems." },
  { title: "Get a plan", copy: "Review your starter maintenance tasks." },
  { title: "Build your record", copy: "Save work, files, and details as you go." },
];

const questions = [
  { question: "What happens when I sign up?", answer: "Add a few home details and systems. HomeBuddy creates starter maintenance tasks you can review." },
  { question: "Can I add my own documents?", answer: "Yes. Upload inspection reports, manuals, and other home files." },
  { question: "Can I remove my information?", answer: "You control what you add. Account settings let you request deletion of your account and associated data." },
];

const guideLinks = [
  { label: "Monthly maintenance checklist", href: "/guides/home-maintenance-checklist-by-month" },
  { label: "Annual maintenance schedule", href: "/guides/annual-home-maintenance-schedule" },
  { label: "New homeowner guide", href: "/guides/what-to-maintain-in-a-new-house" },
  { label: "First 90 days after buying", href: "/guides/first-90-days-after-buying-a-house" },
  { label: "After a home inspection", href: "/guides/what-to-fix-after-home-inspection" },
  { label: "Home maintenance costs", href: "/guides/how-much-does-home-maintenance-cost" },
  { label: "Printable maintenance schedule", href: "/guides/printable-home-maintenance-schedule" },
];

function trackSignupClick(placement: "header" | "hero" | "final") {
  trackEvent("landing_signup_click", "conversion", placement);
  // Preserve historic event labels so existing dashboard comparisons remain usable.
  trackEvent("click", "landing", placement === "header" ? "sign_up_header" : placement === "hero" ? "cta_hero" : "cta_final");
}

export default function Landing() {
  useEffect(() => {
    document.title = "HomeBuddy — Know Your Home. Stay Ahead.";
    document.querySelector('meta[name="description"]')?.setAttribute("content", "HomeBuddy connects home maintenance, documents, systems, and history. Know what needs attention and what to do next.");
    trackSlugPageView(PAGE_SLUGS.landing);
    trackEvent("landing_page_view", "conversion", "landing");
  }, []);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-background text-foreground">
      <header className="relative z-10 border-b border-border/70 bg-background/95" role="banner">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6" aria-label="Main navigation">
          <Link href="/" className="flex min-w-0 items-center gap-2 no-underline" aria-label="HomeBuddy homepage">
            <img src="/images/home-buddy-icon.webp" alt="" className="h-9 w-9 shrink-0 rounded-xl" width="36" height="36" />
            <span className="truncate text-base font-bold tracking-tight text-foreground sm:text-xl">HomeBuddy</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-muted-foreground no-underline hover:text-foreground sm:px-3 sm:text-sm" data-testid="button-login" onClick={() => trackEvent("click", "landing", "sign_in_header")}>Sign in</Link>
            <Link href="/signup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-stone-950 no-underline hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-5 sm:text-sm" onClick={() => trackSignupClick("header")} data-testid="button-signup-header">Set Up My Home</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background py-10 dark:from-primary/10 sm:py-16 lg:py-20" aria-labelledby="landing-heading">
          <div className="mx-auto grid max-w-6xl min-w-0 items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.93fr)_minmax(0,1.07fr)] lg:gap-14">
            <div className="min-w-0">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-orange-700 dark:text-orange-300 sm:text-sm">Less guesswork. Better homeownership.</p>
              <h1 id="landing-heading" className="max-w-xl text-[clamp(2.15rem,9vw,3.8rem)] font-extrabold leading-[1.09] tracking-[-0.045em] text-foreground">
                Know your home. <span className="text-orange-600 dark:text-orange-400">Stay ahead.</span>
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Maintenance, documents, and home details—all connected, so you know what's next.
              </p>
              <div className="mt-6 flex flex-col items-start gap-2">
                <Link href="/signup" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-bold text-stone-950 no-underline shadow-sm shadow-primary/15 transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto" onClick={() => trackSignupClick("hero")} data-testid="button-cta-hero">
                  Set Up My Home <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <p className="text-xs leading-5 text-muted-foreground">A few home details. Then your first maintenance plan.</p>
              </div>
            </div>
            <div className="min-w-0" aria-label="Product demonstration">
              <ProductPreview />
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-muted/20 py-10 sm:py-14" aria-labelledby="benefits-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 id="benefits-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">One place. A clearer next step.</h2>
              <p className="mt-3 leading-7 text-muted-foreground">Know what matters. Keep what you learn.</p>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="rounded-2xl border border-border bg-card p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20"><Icon className="h-5 w-5 text-orange-700 dark:text-orange-300" aria-hidden="true" /></div>
                  <h3 className="text-base font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700 dark:text-orange-300">How it works</p>
              <h2 id="how-heading" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Start small. Stay ready.</h2>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {steps.map((step, index) => (
                <article key={step.title} className="border-l-2 border-primary/50 pl-5">
                  <span className="text-sm font-extrabold text-orange-700 dark:text-orange-300">0{index + 1}</span>
                  <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-muted/20 py-10 sm:py-14" aria-labelledby="questions-heading">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 id="questions-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">Good to know</h2>
            <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:px-7">
              {questions.map((item) => (
                <details key={item.question} className="group py-4">
                  <summary className="cursor-pointer rounded-sm py-1 text-sm font-semibold leading-6 text-foreground marker:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-base">{item.question}</summary>
                  <p className="mt-2 pb-1 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16" aria-labelledby="final-heading">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 id="final-heading" className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your home. Better handled.</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">Start with a plan. Build a home record that lasts.</p>
            <Link href="/signup" className="mx-auto mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-bold text-stone-950 no-underline hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto" onClick={() => trackSignupClick("final")} data-testid="button-cta-final">Set Up My Home <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/20 py-10" role="contentinfo">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="text-lg font-bold">HomeBuddy</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">The intelligent operating record of your home.</p>
            <p className="mt-4 text-xs text-muted-foreground">© 2026 HomeBuddy</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Homeowner guides</h2>
            <ul className="mt-3 grid gap-2">
              {guideLinks.map((guide) => (
                <li key={guide.href}><Link href={guide.href} onClick={() => trackEvent("click", "landing", "guide_" + guide.href.split("/").pop())} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{guide.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold">More</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              <li><Link href="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link></li>
              <li><Link href="/support" className="text-muted-foreground hover:text-foreground">Support HomeBuddy</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-foreground">Terms & privacy</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
