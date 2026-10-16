import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { EmergencyShutoffs } from "@/components/emergency-shutoffs";
import { HomeInfoCard } from "@/components/home-info-card";
import { CircuitMapDialog } from "@/components/circuit-map";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getHome, getSystems, getDocuments, getTimeline } from "@/lib/api";
import { DocumentsSection } from "@/pages/documents";
import { InsuranceSection } from "@/pages/insurance";
import { UtilitiesSection } from "@/pages/utilities";
import { WarrantySection } from "@/components/home-graph/warranty-card";
import { trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";
import { Home, Layers, FileText, ShieldCheck, Phone, History, FileDown, ChevronRight, ArrowLeft, Search, Plus, MapPin, AlertTriangle, Zap } from "lucide-react";

type HouseSection = "systems" | "details" | "emergency" | "electrical" | "files" | "coverage" | "services" | "history" | "tools";
const sections: Record<HouseSection, { title: string; description: string }> = {
  systems: { title: "Systems & appliances", description: "What makes your home work" },
  details: { title: "Property details", description: "The facts and specifications of your home" },
  emergency: { title: "Emergency & utilities", description: "Shutoffs, utility locations, and important access information" },
  electrical: { title: "Electrical & circuits", description: "Your electrical system and circuit panel map" },
  files: { title: "Documents", description: "Documents you can find again, whenever you need them" },
  coverage: { title: "Coverage", description: "Warranties and insurance for your home" },
  services: { title: "Services & contacts", description: "Providers and practical household information" },
  history: { title: "Home history", description: "What has changed and when" },
  tools: { title: "Home tools", description: "Occasional actions for your home's information" },
};
const sectionKeys = Object.keys(sections) as HouseSection[];
const sectionIcon = { systems: Layers, details: Home, emergency: AlertTriangle, electrical: Zap, files: FileText, coverage: ShieldCheck, services: Phone, history: History, tools: FileDown };

export default function MyHouse() {
  const search = useSearch();
  const query = new URLSearchParams(search);
  const requested = query.get("section");
  const focus = query.get("focus");
  const section = requested && sectionKeys.includes(requested as HouseSection) ? requested as HouseSection : null;
  const [term, setTerm] = useState("");
  const [showCircuitMap, setShowCircuitMap] = useState(false);
  useEffect(() => { trackSlugPageView(PAGE_SLUGS.myHouse); }, []);

  const { data: home, isLoading: homeLoading, isError: homeError, refetch: retryHome } = useQuery({ queryKey: ["home"], queryFn: getHome });
  const legacyId = home?.legacyId;
  const { data: systems = [], isLoading: systemsLoading, isError: systemsError } = useQuery({
    queryKey: ["systems", home?.id], queryFn: () => getSystems(home!.id), enabled: !!home?.id,
  });
  const { data: documents = [], isLoading: filesLoading, isError: filesError } = useQuery({
    queryKey: ["documents", legacyId], queryFn: () => getDocuments(legacyId!), enabled: typeof legacyId === "number",
  });
  const { data: timeline = [], isError: historyError } = useQuery({
    queryKey: ["timeline", legacyId ?? home?.id, ""],
    queryFn: () => getTimeline(legacyId ?? home!.id, { limit: 100 }),
    enabled: !!home?.id,
  });

  const q = term.trim().toLowerCase();
  const matchedSystems = systems.filter(s => [s.name, s.category, s.make, s.model].some(v => v?.toLowerCase().includes(q)));
  const matchedFiles = documents.filter(d => [d.name, d.category, d.notes].some(v => v?.toLowerCase().includes(q)));
  const electricalSystem = systems.find(s => s.category?.toLowerCase() === "electrical");

  const description = home ? [home.streetAddress || home.address, home.city, home.state].filter(Boolean).join(", ") : "";
  const legacyAvailable = typeof legacyId === "number";

  const back = <Link href="/house" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-house-back">
    <ArrowLeft className="h-4 w-4" /> My House
  </Link>;
  const historyItems = (count: number) => timeline.slice(0, count).map(event => (
    <div key={event.id} className="flex justify-between gap-4 py-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{event.title}</p>
        {event.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{event.description}</p>}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {event.eventDate && !isNaN(new Date(event.eventDate).getTime()) ? new Date(event.eventDate).toLocaleDateString() : ""}
      </span>
    </div>
  ));

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-7" data-testid="page-my-house">
        {homeLoading ? <p className="text-muted-foreground">Loading your house…</p> : homeError ? (
          <div role="alert" className="rounded-xl border p-5">Could not load your home. Please refresh to retry.</div>
        ) : !home ? (
          <div className="space-y-3"><h1 className="text-2xl font-heading font-semibold">Set up your house</h1>
            <p className="text-muted-foreground">Add your home to start building its operating record.</p>
            <Link href="/onboarding" className="text-primary underline">Get started</Link></div>
        ) : section ? (
          <>
            {back}
            <header className="space-y-1">
              <h1 className="text-2xl font-heading font-semibold" data-testid="text-house-section">{sections[section].title}</h1>
              <p className="text-sm text-muted-foreground">{sections[section].description}</p>
            </header>
            {section === "systems" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <Input aria-label="Search systems" placeholder="Find a system or appliance" value={term} onChange={e => setTerm(e.target.value)} className="sm:max-w-sm" />
                  <Link href="/house/systems" className="text-sm font-medium text-primary hover:underline">Manage systems & add new <ChevronRight className="inline h-4 w-4" /></Link>
                </div>
                {systemsError ? <p role="alert">Systems couldn't be loaded.</p> : systemsLoading ? <p className="text-sm text-muted-foreground">Loading systems…</p> : matchedSystems.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchedSystems.map(s => <Link key={s.id} href={`/systems/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 hover:border-primary/50" data-testid={`house-system-${s.id}`}>
                      <div><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-muted-foreground">{s.category}{s.condition && s.condition !== "Unknown" ? ` · ${s.condition}` : ""}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>)}
                  </div>
                ) : <p className="text-sm text-muted-foreground">{q ? "No systems match that search." : "No systems saved yet. Add your first system."}</p>}
              </div>
            )}
            {section === "details" && <HomeInfoCard home={home} systems={systems} />}
            {section === "emergency" && (
              <div className="space-y-4">
                <section className="rounded-xl border p-4 sm:p-5" aria-label="Shutoff locations" data-testid="house-emergency-shutoffs">
                  <p className="text-sm text-muted-foreground">Store the locations of your main shutoffs so you can find them quickly when they matter.</p>
                  <EmergencyShutoffs home={home} />
                </section>
                <Link href="/house?section=services" className="flex items-center justify-between gap-3 rounded-xl border p-4 text-sm font-medium hover:border-primary/50">
                  Utility providers and accounts <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </div>
            )}
            {section === "electrical" && (
              <div className="space-y-4" data-testid="house-electrical-reference">
                {electricalSystem ? (
                  <section className="space-y-4 rounded-xl border p-4 sm:p-5">
                    <p className="text-sm text-muted-foreground">Keep your breaker labels and circuit assignments in one place.</p>
                    <Button variant="outline" className="w-full justify-start gap-2 sm:w-auto" onClick={() => setShowCircuitMap(true)} data-testid="button-open-circuit-map-house">
                      <Zap className="h-4 w-4 text-primary" /> Circuit Panel Map
                    </Button>
                    <Link href={`/systems/${electricalSystem.id}`} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      View electrical system details <ChevronRight className="h-4 w-4" />
                    </Link>
                  </section>
                ) : (
                  <div className="rounded-xl border p-4 sm:p-5 space-y-2">
                    <p className="text-sm text-muted-foreground">Add your electrical system to create a circuit panel map.</p>
                    <Link href="/house/systems?type=Electrical" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      Add electrical system <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            )}
            {section === "files" && (!legacyAvailable
              ? <div role="alert"><p className="text-sm text-muted-foreground">Documents are temporarily unavailable.</p><Button onClick={() => retryHome()}>Try again</Button></div>
              : <DocumentsSection />)}
            {section === "coverage" && <div className="flex flex-col gap-8">
              <section aria-label="Warranties" className={focus === "insurance" ? "order-2" : "order-1"}>
                <WarrantySection homeId={legacyId ?? home.id} />
              </section>
              <section className={focus === "insurance" ? "order-1" : "order-2 border-t pt-6"} aria-label="Insurance">
                <h2 className="font-heading font-semibold text-lg mb-4">Insurance</h2>
                <InsuranceSection />
              </section>
            </div>}
            {section === "services" && <UtilitiesSection />}
            {section === "history" && <div className="space-y-2">
              {historyError ? <p role="alert">Home history is unavailable right now.</p> : timeline.length ? historyItems(100) : <p className="text-sm text-muted-foreground">Your history will grow as you record repairs, documents, and maintenance.</p>}
            </div>}
            {section === "tools" && <div className="space-y-3">
              <Link href="/transfer-kit" className="flex items-center justify-between rounded-xl border p-4 hover:border-primary/50">
                <div><p className="font-medium">Export home information</p><p className="text-sm text-muted-foreground">Prepare the existing printable Home Transfer Kit</p></div><ChevronRight className="h-4 w-4"/>
              </Link>
              <Link href="/document-analysis" className="flex items-center justify-between rounded-xl border p-4 hover:border-primary/50">
                <div><p className="font-medium">Analyze an inspection report</p><p className="text-sm text-muted-foreground">Review suggested system information and maintenance work</p></div><ChevronRight className="h-4 w-4"/>
              </Link>
            </div>}
          </>
        ) : (
          <>
            <header className="space-y-2">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-primary">Your home's operating record</p>
                  <h1 className="font-heading text-3xl font-bold mt-1">My House</h1>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5"/>{description || "Your property"}</p>
                </div>
                <Link href="/house?section=details" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">Edit details</Link>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {home.builtYear && <span>Built {home.builtYear}</span>}
                {home.sqFt && <span>{home.sqFt.toLocaleString()} sq ft</span>}
                {home.healthScore != null && <span>Home health: {home.healthScore}/100</span>}
              </div>
            </header>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground"/>
              <Input className="pl-9" aria-label="Search house knowledge" placeholder="Find a system or document" value={term} onChange={e => setTerm(e.target.value)} data-testid="input-house-search"/>
            </div>
            {q ? (
              <div className="space-y-5" data-testid="house-search-results">
                <section className="space-y-2"><h2 className="font-heading font-semibold">Systems ({matchedSystems.length})</h2>
                  {matchedSystems.map(s => <Link key={s.id} href={`/systems/${s.id}`} className="flex items-center justify-between border-b py-2 text-sm hover:text-primary">{s.name} <ChevronRight className="h-4 w-4"/></Link>)}
                </section>
                <section className="space-y-2"><h2 className="font-heading font-semibold">Documents ({matchedFiles.length})</h2>
                  {matchedFiles.map(d => <Link key={d.id} href={`/house?section=files&q=${encodeURIComponent(term)}`} className="flex items-center justify-between border-b py-2 text-sm hover:text-primary">{d.name} <ChevronRight className="h-4 w-4"/></Link>)}
                </section>
                {!matchedFiles.length && !matchedSystems.length && <p className="text-sm text-muted-foreground">No matching systems or documents.</p>}
              </div>
            ) : (
              <>
                <Link href="/house?section=files" className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary/50 min-h-11" data-testid="house-files-preview">
                  <FileText className="h-5 w-5 shrink-0"/><div className="min-w-0 flex-1"><h2 className="font-heading font-semibold text-lg">Documents</h2><p className="text-sm text-muted-foreground">Warranties, reports, receipts</p></div><ChevronRight className="h-5 w-5 shrink-0"/>
                </Link>
                <section className="space-y-3" data-testid="house-reference">
                  <h2 className="font-heading font-semibold text-lg">Home reference</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(["emergency", "electrical"] as HouseSection[]).map(key => {
                      const Icon = sectionIcon[key];
                      return <Link key={key} href={`/house?section=${key}`} className="flex items-center gap-3 rounded-xl border p-3 hover:border-primary/50" data-testid={`house-section-${key}`}>
                        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0"><p className="text-sm font-medium">{sections[key].title}</p><p className="text-xs text-muted-foreground line-clamp-1">{sections[key].description}</p></div>
                        <ChevronRight className="h-4 w-4 ml-auto shrink-0 text-muted-foreground" />
                      </Link>;
                    })}
                  </div>
                </section>
                <section className="space-y-3" data-testid="house-systems-preview">
                  <div className="flex items-center justify-between">
                    <div><h2 className="font-heading font-semibold text-lg">Systems & appliances</h2><p className="text-xs text-muted-foreground">{systems.length} known systems</p></div>
                    <Link href="/house/systems" className="text-sm text-primary hover:underline">View & add <Plus className="h-4 w-4 inline"/></Link>
                  </div>
                  {systemsError ? <p role="alert">Systems couldn't be loaded.</p> : systemsLoading ? <p className="text-sm text-muted-foreground">Loading systems…</p> : systems.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{systems.slice(0,6).map(s => <Link href={`/systems/${s.id}`} key={s.id} className="flex items-center justify-between rounded-xl border p-3 hover:border-primary/50">
                      <div className="min-w-0"><p className="font-medium text-sm truncate">{s.name}</p><p className="text-xs text-muted-foreground">{s.category}{s.condition && s.condition !== "Unknown" ? ` · ${s.condition}` : ""}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground shrink-0"/></Link>)}</div>
                  ) : <Link href="/house/systems" className="block rounded-lg border border-dashed p-5 text-sm text-muted-foreground hover:text-primary">Add your first system to start connecting information about your home.</Link>}
                </section>
                <section className="space-y-3">
                  <h2 className="font-heading font-semibold text-lg">More about your house</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(["details", "coverage", "services", "history", "tools"] as HouseSection[]).map(key => {
                      const Icon = sectionIcon[key];
                      return <Link key={key} href={`/house?section=${key}`} className="flex items-center gap-3 rounded-lg border px-3 py-3 hover:border-primary/50" data-testid={`house-section-${key}`}>
                        <Icon className="h-5 w-5 text-muted-foreground shrink-0"/>
                        <div className="min-w-0"><p className="font-medium text-sm">{sections[key].title}</p><p className="text-xs text-muted-foreground line-clamp-1">{sections[key].description}</p></div>
                        <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground shrink-0"/>
                      </Link>;
                    })}
                  </div>
                </section>
                {timeline.length > 0 && <section className="space-y-2"><div className="flex items-center justify-between"><h2 className="font-heading font-semibold text-lg">Recent activity</h2><Link href="/house?section=history" className="text-sm text-primary hover:underline">Full history</Link></div>{historyItems(3)}</section>}
              </>
            )}
          </>
        )}
      </div>
      {home && electricalSystem && (
        <CircuitMapDialog homeId={home.id} systemId={electricalSystem.id} isOpen={showCircuitMap} onClose={() => setShowCircuitMap(false)} />
      )}
    </Layout>
  );
}
