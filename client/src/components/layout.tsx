import { Link, useLocation } from "wouter";
import { Home, MessageSquare, User, Wallet, Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import logoImage from "@assets/generated_images/orange_house_logo_with_grey_gear..png";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const navItems = [
    { href: "/dashboard", icon: Home, label: "Home" },
    { href: "/budget", icon: Wallet, label: "Budget" },
    { href: "/chat", icon: MessageSquare, label: "Assistant" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card z-50 sticky top-0">
        <div className="flex items-center gap-2">
           <img src={logoImage} alt="Home Buddy Logo" className="w-8 h-8 rounded-lg" />
           <span className="font-heading font-bold text-lg text-primary">Home Buddy</span>
        </div>
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
            <nav className="flex flex-col p-4 gap-2">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <a 
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                      location === item.href 
                        ? "bg-primary text-primary-foreground font-medium" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </a>
                </Link>
              ))}
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="justify-start px-4 py-3 text-muted-foreground hover:bg-muted hover:text-foreground"
                data-testid="button-logout-mobile"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Logout
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card h-screen sticky top-0">
        <div className="p-6 border-b">
           <div className="flex items-center gap-3">
             <img src={logoImage} alt="Home Buddy Logo" className="w-10 h-10 rounded-xl" />
             <span className="font-heading font-bold text-xl text-primary">Home Buddy</span>
           </div>
        </div>
        <nav className="flex-1 p-4 gap-2 flex flex-col">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a 
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  location === item.href 
                    ? "bg-primary text-primary-foreground font-medium shadow-sm translate-x-1" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </a>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t space-y-3">
          {user && (
            <div className="px-3 py-2 text-sm">
              <p className="font-medium text-foreground truncate">{user.email || "User"}</p>
            </div>
          )}
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="w-full justify-start"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
