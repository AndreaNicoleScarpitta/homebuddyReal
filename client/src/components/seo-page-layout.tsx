import { useEffect } from "react";
import { Link } from "wouter";
import { trackEvent, trackSlugPageView } from "@/lib/analytics";
import { ArrowRight } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

interface SeoPageLayoutProps {
  children: React.ReactNode;
  slug: string;
  title: string;
  description: string;
  /** Optional FAQ items — rendered as FAQ schema for rich snippets */
  faq?: FaqItem[];
  /** Published date (ISO string) for Article schema */
  datePublished?: string;
  /** Author name for Article schema */
  author?: string;
}

export function SeoPageLayout({ children, slug, title, description, faq, datePublished = "2026-03-29", author = "Drew" }: SeoPageLayoutProps) {
  const canonicalUrl = `https://home-buddy.replit.app${typeof window !== "undefined" ? window.location.pathname : ""}`;

  useEffect(() => {
    trackSlugPageView(slug);
    document.title = `${title} | Home Buddy`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", description);

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", canonicalUrl);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", canonicalUrl);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", description);
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute("content", title);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute("content", description);
  }, [slug, title, description, canonicalUrl]);

  // Article schema (JSON-LD)
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    author: { "@type": "Person", name: author },
    publisher: {
      "@type": "Organization",
      name: "Home Buddy",
      url: "https://home-buddy.replit.app",
      logo: { "@type": "ImageObject", url: "https://home-buddy.replit.app/images/home-buddy-icon.png" },
    },
    datePublished,
    dateModified: datePublished,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    image: "https://home-buddy.replit.app/opengraph.jpg",
  };

  // BreadcrumbList schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://home-buddy.replit.app/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: "https://home-buddy.replit.app/guides" },
      { "@type": "ListItem", position: 3, name: title, item: canonicalUrl },
    ],
  };

  // FAQ schema (optional)
  const faqSchema = faq?.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  } : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Structured Data — Article + Breadcrumb + optional FAQ */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}

      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <nav className="container mx-auto px-6 h-16 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <img src="/images/home-buddy-icon.webp" alt="Home Buddy logo" className="h-8 w-8 rounded-lg object-cover" width="32" height="32" />
            <span className="text-xl font-heading font-bold text-foreground">Home Buddy</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground no-underline transition-colors">
              Sign In
            </Link>
            <a
              href="/api/login"
              target="_top"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 no-underline transition-colors"
            >
              Sign Up
            </a>
          </div>
        </nav>
      </header>

      <main className="pt-24 pb-16">
        <article className="container mx-auto px-6 max-w-3xl">
          {children}
        </article>

        <section className="container mx-auto px-6 max-w-3xl mt-16 pt-12 border-t border-border/40">
          <div className="bg-primary/5 rounded-2xl p-8 text-center space-y-4">
            <h2 className="text-2xl font-heading font-bold text-foreground">
              Stop relying on memory. Start maintaining with confidence.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Home Buddy builds a personalized maintenance plan for your home — track systems, schedule tasks, and stay ahead of costly repairs.
            </p>
            <a
              href="/api/login"
              target="_top"
              onClick={() => trackEvent('click', 'seo_page', `cta_${slug}`)}
              className="inline-flex items-center justify-center h-12 px-8 text-base font-medium rounded-md bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 no-underline transition-all"
              data-testid="button-seo-cta"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/images/home-buddy-icon.webp" alt="Home Buddy" className="h-6 w-6 rounded" width="24" height="24" />
                <span className="font-heading font-bold text-foreground">Home Buddy</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your AI-powered home maintenance planner. Track systems, schedule tasks, and stay ahead of costly repairs.
              </p>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-foreground mb-3">Guides</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/guides/home-maintenance-checklist-by-month" className="text-muted-foreground hover:text-foreground no-underline transition-colors">Monthly Maintenance Checklist</Link></li>
                <li><Link href="/guides/annual-home-maintenance-schedule" className="text-muted-foreground hover:text-foreground no-underline transition-colors">Annual Maintenance Schedule</Link></li>
                <li><Link href="/guides/what-to-maintain-in-a-new-house" className="text-muted-foreground hover:text-foreground no-underline transition-colors">New Homeowner Guide</Link></li>
                <li><Link href="/guides/first-90-days-after-buying-a-house" className="text-muted-foreground hover:text-foreground no-underline transition-colors">First 90 Days</Link></li>
                <li><Link href="/guides/what-to-fix-after-home-inspection" className="text-muted-foreground hover:text-foreground no-underline transition-colors">After a Home Inspection</Link></li>
                <li><Link href="/guides/how-much-does-home-maintenance-cost" className="text-muted-foreground hover:text-foreground no-underline transition-colors">Maintenance Costs</Link></li>
                <li><Link href="/guides/printable-home-maintenance-schedule" className="text-muted-foreground hover:text-foreground no-underline transition-colors">Printable Schedule</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-foreground mb-3">Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/" className="text-muted-foreground hover:text-foreground no-underline transition-colors">Home</Link></li>
                <li><Link href="/terms" className="text-muted-foreground hover:text-foreground no-underline transition-colors">Terms & Conditions</Link></li>
                <li><Link href="/contact" className="text-muted-foreground hover:text-foreground no-underline transition-colors">Contact</Link></li>
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
