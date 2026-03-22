import { Link, useLocation } from "wouter";
import { Home, FileSearch, Mail, Menu, LogOut, ClipboardList, User, FolderOpen, HelpCircle, Settings2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDefinitions } from "@/hooks/use-definitions";
import logoImage from "@assets/generated_images/orange_house_logo_with_grey_gear..png";
import { trackEvent, trackModalOpen } from "@/lib/analytics";
import { MODAL_SLUGS } from "@/lib/slug-registry";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Overview", sublabel: "What needs attention", tourId: "nav-overview" },
  { href: "/systems", icon: Settings2, label: "Systems", sublabel: "Your home systems", tourId: "nav-systems" },
  { href: "/maintenance-log", icon: ClipboardList, label: "Maintenance Log", sublabel: "What you've done", tourId: "nav-history" },
  { href: "/document-analysis", icon: FileSearch, label: "Document Analysis (Beta)", sublabel: "Analyze files", tourId: "nav-file-upload" },
  { href: "/documents", icon: FolderOpen, label: "Documents", sublabel: "Your files", tourId: "nav-documents" },
  { href: "/profile", icon: User, label: "Profile", sublabel: "Your settings", tourId: "nav-profile" },
  { href: "/profile?section=support", icon: Heart, label: "Support Home Buddy", sublabel: "Help keep it running", tourId: "nav-donate" },
  { href: "/contact", icon: Mail, label: "Contact", sublabel: "Reach us", tourId: "nav-contact" },
];

const bottomNavItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/systems", icon: Settings2, label: "Systems" },
  { href: "/maintenance-log", icon: ClipboardList, label: "Log" },
  { href: "/document-analysis", icon: FileSearch, label: "Analyze" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { openDefinitions } = useDefinitions();

  useEffect(() => { if (isOpen) trackModalOpen(MODAL_SLUGS.mobileNav); }, [isOpen]);

  const handleLogout = () => {
    trackEvent('logout', 'auth', 'logout_button');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card z-50 sticky top-0">
        <div className="flex items-center gap-2">
           <img src={logoImage} alt="Home Buddy Logo" className="w-8 h-8 rounded-lg" />
           <span className="font-heading font-bold text-lg text-primary">Home Buddy</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { trackEvent('click', 'layout', 'definitions_help'); openDefinitions(); }}
            aria-label="Definitions & Help"
            data-testid="button-help-mobile"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="p-6 border-b">
               <div className="flex items-center gap-2 mb-6">
                 <img src={logoImage} alt="Home Buddy Logo" className="w-10 h-10 rounded-lg" />
                 <span className="font-heading font-bold text-xl text-primary">Home Buddy</span>
               </div>
               {user && (
                 <div className="text-sm">
                   <p className="font-medium text-foreground">{user.email || "User"}</p>
                 </div>
               )}
            </div>
            <nav className="flex flex-col p-4 gap-1">
              {navItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => { trackEvent('navigate', 'sidebar', item.label.toLowerCase()); setIsOpen(false); }}
                  data-tour={`mobile-${item.tourId}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                    location === item.href 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{item.label}</span>
                    <span className={`text-[10px] leading-tight ${location === item.href ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                      {item.sublabel}
                    </span>
                  </div>
                </Link>
              ))}
              <a 
                href="/api/logout" 
                target="_top"
                onClick={handleLogout}
                className="flex items-center justify-start px-4 py-3 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
                data-testid="button-logout-mobile"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Logout
              </a>
            </nav>
          </SheetContent>
        </Sheet>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card h-screen sticky top-0">
        <div className="p-6 border-b">
           <div className="flex items-center gap-3">
             <img src={logoImage} alt="Home Buddy Logo" className="w-10 h-10 rounded-xl" />
             <span className="font-heading font-bold text-xl text-primary">Home Buddy</span>
           </div>
        </div>
        <nav className="flex-1 p-4 gap-1 flex flex-col">
          {navItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              onClick={() => trackEvent('navigate', 'sidebar', item.label.toLowerCase())}
              data-tour={item.tourId}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                location === item.href 
                  ? "bg-primary text-primary-foreground shadow-sm translate-x-1" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium text-sm">{item.label}</span>
                <span className={`text-[10px] leading-tight ${location === item.href ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                  {item.sublabel}
                </span>
              </div>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t space-y-3">
          <button
            type="button"
            onClick={() => { trackEvent('click', 'layout', 'definitions_help'); openDefinitions(); }}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Definitions & Help"
            data-testid="button-help-desktop"
          >
            <HelpCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">Definitions</span>
          </button>
          {user && (
            <div className="px-3 py-2 text-sm">
              <p className="font-medium text-foreground truncate">{user.email || "User"}</p>
            </div>
          )}
          <a 
            href="/api/logout" 
            target="_top"
            onClick={handleLogout}
            className="flex items-center w-full justify-start px-4 py-2 border rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => trackEvent('navigate', 'bottom_nav', item.label.toLowerCase())}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground"
                }`}
                data-testid={`bottom-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : ''}`}>
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
