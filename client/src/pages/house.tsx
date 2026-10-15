import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getHome, getSystems, getDocuments, getTimeline } from "@/lib/api";
import { DocumentsSection } from "@/pages/documents";
import { InsuranceSection } from "@/pages/insurance";
import { UtilitiesSection } from "@/pages/utilities";
import { WarrantySection } from "@/components/home-graph/warranty-card";
import { trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";
import { Home, Layers, FileText, ShieldCheck, Phone, History, FileDown, ChevronRight, ArrowLeft, Search, Plus, MapPin, AlertTriangle } from "lucide-react";

type HouseSection = "systems" | "files" | "coverage" | "services" | "history" | "tools";
const sections: Record<HouseSection, { title: string; description: string }> = {
  systems: { title: "Systems & appliances", description: "What makes your home work" },
  files: { title: "House files", description: "Documents you can find again, whenever you need them" },
  coverage: { title: "Coverage", description: "Warranties and insurance for your home" },
  services: { title: "Services & contacts", description: "Providers and practical household information" },
  history: { title: "Home history", description: "What has changed and when" },
  tools: { title: "Home tools", description: "Occasional actions for your home's information" },
};
const sectionKeys = Object.keys(sections) as HouseSection[];
const sectionIcon = { systems: Layers, files: FileText, coverage: ShieldCheck, services: Phone, history: History, tools: FileDown };

export default function MyHouse() {
  const search = useSearch();
  const query = new URLSearchParams(search);
  const requested = query.get("section");
  const focus = query.get("focus");
  const section = requested && sectionKeys.includes(requested as HouseSection) ? requested as HouseSection : null;
  const [term, setTerm] = useState("");
  useEffect(() => { trackSlugPageView(PAGE_SLUGS.myHouse); }, []);

  const { data: home, isLoading: homeLoading, isError: homeError } = useQuery({ queryKey: ["home"], queryFn: getHome });
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
            {section === "files" && (!legacyAvailable
              ? <p className="text-sm text-muted-foreground">Home files become available once your home profile is fully saved.</p>
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
                <Link href="/profile" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">Edit details</Link>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {home.builtYear && <span>Built {home.builtYear}</span>}
                {home.sqFt && <span>{home.sqFt.toLocaleString()} sq ft</span>}
                {home.healthScore != null && <span>Home health: {home.healthScore}/100</span>}
              </div>
              {(home.waterShutoffLocation || home.gasShutoffLocation || home.electricalPanelLocation) && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1" aria-label="Emergency home details">
                  <p className="font-semibold text-foreground flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5"/> Essential locations</p>
                  {home.waterShutoffLocation && <p>Water shutoff: {home.waterShutoffLocation}</p>}
                  {home.gasShutoffLocation && <p>Gas shutoff: {home.gasShutoffLocation}</p>}
                  {home.electricalPanelLocation && <p>Electrical panel: {home.electricalPanelLocation}</p>}
                </div>
              )}
            </header>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground"/>
              <Input className="pl-9" aria-label="Search house knowledge" placeholder="Find a system, appliance, or file" value={term} onChange={e => setTerm(e.target.value)} data-testid="input-house-search"/>
            </div>
            {q ? (
              <div className="space-y-5" data-testid="house-search-results">
                <section className="space-y-2"><h2 className="font-heading font-semibold">Systems ({matchedSystems.length})</h2>
                  {matchedSystems.map(s => <Link key={s.id} href={`/systems/${s.id}`} className="flex items-center justify-between border-b py-2 text-sm hover:text-primary">{s.name} <ChevronRight className="h-4 w-4"/></Link>)}
                </section>
                <section className="space-y-2"><h2 className="font-heading font-semibold">Files ({matchedFiles.length})</h2>
                  {matchedFiles.map(d => <Link key={d.id} href={`/house?section=files&q=${encodeURIComponent(term)}`} className="flex items-center justify-between border-b py-2 text-sm hover:text-primary">{d.name} <ChevronRight className="h-4 w-4"/></Link>)}
                </section>
                {!matchedFiles.length && !matchedSystems.length && <p className="text-sm text-muted-foreground">No matching systems or files.</p>}
              </div>
            ) : (
              <>
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
                <section className="space-y-3" data-testid="house-files-preview">
                  <div className="flex items-center justify-between"><h2 className="font-heading font-semibold text-lg">House files</h2><Link href="/house?section=files" className="text-sm text-primary hover:underline">View all</Link></div>
                  {filesError ? <p role="alert" className="text-sm">Files couldn't be loaded.</p> : filesLoading ? <p className="text-sm text-muted-foreground">Loading files…</p> : documents.length ? (
                    <div className="divide-y border-y">{documents.slice(0,3).map(d => <Link key={d.id} href="/house?section=files" className="py-3 flex items-center gap-3 text-sm hover:text-primary"><FileText className="h-4 w-4 text-muted-foreground"/><span className="truncate">{d.name}</span><ChevronRight className="h-4 w-4 ml-auto shrink-0"/></Link>)}</div>
                  ) : <Link href="/house?section=files" className="block text-sm text-muted-foreground hover:text-primary">Upload a warranty, inspection report, or other useful house file.</Link>}
                </section>
                <section className="space-y-3">
                  <h2 className="font-heading font-semibold text-lg">More about your house</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(["coverage", "services", "history", "tools"] as HouseSection[]).map(key => {
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
    </Layout>
  );
}
