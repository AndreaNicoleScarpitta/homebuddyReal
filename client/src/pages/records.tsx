/**
 * Records — the single home for reference data.
 *
 * Documents, warranties, insurance and utilities used to be four separate
 * nav destinations. They are the same shape of thing (a document, a date,
 * and occasionally a reminder), and splitting them across four tabs of the
 * sidebar made the app look like a filing cabinet with no centre. They are
 * now one destination with a type filter.
 *
 * The active type lives in the `?type=` query param rather than component
 * state so the old routes can redirect straight to the right tab and links
 * stay shareable.
 */

import { useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { FileText, Shield, ShieldCheck, Zap, Clock, PackageOpen } from "lucide-react";
import { trackSlugPageView, trackEvent } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";
import { DocumentsSection } from "@/pages/documents";
import { WarrantiesSection } from "@/pages/warranties";
import { InsuranceSection } from "@/pages/insurance";
import { UtilitiesSection } from "@/pages/utilities";

const TABS = [
  { id: "documents", label: "Documents", icon: FileText },
  { id: "warranties", label: "Warranties", icon: Shield },
  { id: "insurance", label: "Insurance", icon: ShieldCheck },
  { id: "utilities", label: "Utilities", icon: Zap },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value);
}

export default function Records() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const requested = new URLSearchParams(searchString).get("type");
  const active: TabId = isTabId(requested) ? requested : "documents";

  useEffect(() => {
    trackSlugPageView(PAGE_SLUGS.records);
  }, []);

  const selectTab = (id: TabId) => {
    trackEvent("navigate", "records", id);
    setLocation(id === "documents" ? "/records" : `/records?type=${id}`);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-heading">
            Records
          </h1>
          <p className="text-muted-foreground mt-1">
            Everything about your home worth keeping — in one place.
          </p>
        </header>

        <nav className="flex flex-wrap gap-2" aria-label="Record types">
          {TABS.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                data-testid={`records-tab-${tab.id}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div>
          {active === "documents" && <DocumentsSection />}
          {active === "warranties" && <WarrantiesSection />}
          {active === "insurance" && <InsuranceSection />}
          {active === "utilities" && <UtilitiesSection />}
        </div>

        <footer className="border-t pt-4 flex flex-wrap gap-4">
          <Link
            href="/timeline"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-timeline"
          >
            <Clock className="h-3.5 w-3.5" />
            Home timeline
          </Link>
          <Link
            href="/transfer-kit"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-transfer-kit"
          >
            <PackageOpen className="h-3.5 w-3.5" />
            Transfer kit
          </Link>
        </footer>
      </div>
    </Layout>
  );
}
