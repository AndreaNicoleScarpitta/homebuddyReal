import { Link, useLocation } from "wouter";
import { Home, Settings, Menu, LogOut, HelpCircle, Layers, ClipboardList, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDefinitions } from "@/hooks/use-definitions";
import logoImage from "@assets/generated_images/orange_house_logo_with_grey_gear..png";
import { trackEvent, trackModalOpen } from "@/lib/analytics";
import { MODAL_SLUGS } from "@/lib/slug-registry";
import { PlanBadge } from "@/components/plan-badge";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { OfflineBanner } from "@/components/offline-banner";

// A homeowner's three jobs: understand, recall, and act.
// Supporting capabilities remain available in their property context.
export const primaryNav = [
  { href: "/dashboard", icon: Home, label: "Overview", match: ["/dashboard", "/"] },
  { href: "/house", icon: Layers, label: "My House", match: ["/house", "/systems", "/records", "/documents", "/warranties", "/insurance", "/utilities", "/timeline", "/transfer-kit"] },
  { href: "/maintenance-log", icon: ClipboardList, label: "Plan", match: ["/maintenance-log", "/calendar"] },
];

const bottomNavItems = primaryNav;

function isNavActive(location: string, item: { href: string; match?: string[] }) {
  if (item.match) return item.match.some(m => location === m || location.startsWith(m + "/"));
  return location === item.href || location.startsWith(item.href + "/");
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { openDefinitions } = useDefinitions();

  useEffect(() => { if (isOpen) trackModalOpen(MODAL_SLUGS.mobileNav); }, [isOpen]);

  const handleLogout = () => {
    trackEvent('logout', 'auth', 'logout_button');
  };

  const userInitial = user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      <OfflineBanner />
      {/* Mobile Header — minimal, breathable */}
      <header className="md:hidden flex items-center justify-between px-5 py-3.5 border-b bg-card/80 backdrop-blur-sm z-50 sticky top-0">
        <div className="flex items-center gap-2.5">
          <img src={logoImage} alt="Home Buddy" className="w-7 h-7 rounded-lg" loading="lazy" width="28" height="28" />
          <span className="font-heading font-semibold text-base tracking-tight">Home Buddy</span>
        </div>
        <div className="flex items-center gap-2">
          <PlanBadge compact />
          <Link href="/chat" aria-label="Ask Home Buddy" title="Ask Home Buddy" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-muted" data-testid="button-ask-ai-mobile">
            <MessageSquare className="h-5 w-5" />
          </Link>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="h-11 w-11" data-testid="button-menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="p-6 pb-4">
              <div className="flex items-center gap-2.5 mb-6">
                <img src={logoImage} alt="Home Buddy" className="w-9 h-9 rounded-lg" loading="lazy" width="36" height="36" />
                <span className="font-heading font-semibold text-lg tracking-tight">Home Buddy</span>
              </div>
              {user && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                    {userInitial}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email || "User"}</p>
                </div>
              )}
            </div>
            <nav className="flex flex-col px-3 pb-3">
              {primaryNav.map((item) => {
                const active = isNavActive(location, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => { trackEvent('navigate', 'sidebar', item.label.toLowerCase()); setIsOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                      active
                        ? "bg-primary/8 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <item.icon className={`h-[18px] w-[18px] ${active ? "text-primary" : ""}`} />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}

              <div className="my-2 mx-4 border-t" />

              <Link
                href="/profile"
                onClick={() => { setIsOpen(false); }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Settings className="h-[18px] w-[18px]" />
                <span className="text-sm">Settings</span>
              </Link>
              <button
                type="button"
                onClick={() => { openDefinitions(); setIsOpen(false); }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full text-left"
                data-testid="button-help-mobile"
              >
                <HelpCircle className="h-[18px] w-[18px]" />
                <span className="text-sm">Help</span>
              </button>
              <a
                href="/api/logout"
                target="_top"
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                data-testid="button-logout-mobile"
              >
                <LogOut className="h-[18px] w-[18px]" />
                <span className="text-sm">Sign out</span>
              </a>
            </nav>
          </SheetContent>
        </Sheet>
        </div>
      </header>

      {/* Desktop Sidebar — calm, spacious, minimal */}
      <aside className="hidden md:flex flex-col w-52 border-r bg-card h-screen sticky top-0">
        {/* Logo */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <img src={logoImage} alt="Home Buddy" className="w-8 h-8 rounded-lg" loading="lazy" width="32" height="32" />
              <span className="font-heading font-semibold text-lg tracking-tight">Home Buddy</span>
            </div>
            <PlanBadge compact />
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-3 pt-2">
          <div className="space-y-0.5">
            {primaryNav.map((item) => {
              const active = isNavActive(location, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => trackEvent('navigate', 'sidebar', item.label.toLowerCase())}
                  data-tour={item.href === "/house" ? "nav-house" : item.href === "/dashboard" ? "nav-overview" : "nav-plan"}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
                    active
                      ? "bg-primary/8 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                    active ? "bg-primary/12" : "group-hover:bg-muted"
                  }`}>
                    <item.icon className={`h-[18px] w-[18px] transition-colors ${active ? "text-primary" : ""}`} />
                  </div>
                  <span className={`text-sm ${active ? "font-medium" : ""}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-5 px-1 pt-4 border-t">
            <Link href="/chat" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10" data-testid="button-ask-ai-desktop">
              <MessageSquare className="h-[18px] w-[18px]" />
              Ask Home Buddy
            </Link>
          </div>
        </nav>

        {/* Footer — quiet, minimal */}
        <div className="px-3 pb-4 pt-2 border-t mt-auto">
          <div className="space-y-0.5">
            <Link
              href="/profile"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                location.startsWith("/profile")
                  ? "bg-primary/8 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8">
                <Settings className={`h-[18px] w-[18px] ${location.startsWith("/profile") ? "text-primary" : ""}`} />
              </div>
              <span className="text-sm">Settings</span>
            </Link>
            <button
              type="button"
              onClick={() => { trackEvent('click', 'layout', 'definitions_help'); openDefinitions(); }}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              data-testid="button-help-desktop"
            >
              <div className="flex items-center justify-center w-8 h-8">
                <HelpCircle className="h-[18px] w-[18px]" />
              </div>
              <span className="text-sm">Help</span>
            </button>
            <a
              href="/api/logout"
              target="_top"
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              data-testid="button-logout"
            >
              <div className="flex items-center justify-center w-8 h-8">
                <LogOut className="h-[18px] w-[18px]" />
              </div>
              <span className="text-sm">Sign out</span>
            </a>
          </div>

          {/* User identity */}
          <div className="flex items-center gap-2.5 mt-3 px-3 py-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {userInitial}
            </div>
            <span className="text-xs text-muted-foreground truncate">{user?.email || ""}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>

      {/* PWA install banner — appears above bottom nav after 20 s */}
      <PwaInstallPrompt />

      {/* Mobile Bottom Navigation — the same three jobs as desktop */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {bottomNavItems.map((item) => {
            const active = isNavActive(location, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => trackEvent('navigate', 'bottom_nav', item.label.toLowerCase())}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  active ? "text-primary" : "text-muted-foreground/60"
                }`}
                data-testid={`bottom-nav-${item.href === "/house" ? "house" : item.href === "/dashboard" ? "overview" : "plan"}`}
                data-tour={item.href === "/house" ? "nav-house-mobile" : undefined}
              >
                <item.icon className="h-5 w-5" />
                <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
