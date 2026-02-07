import { useLocation, Link } from "wouter";
import { Home, Music, CalendarDays, LayoutGrid, LogIn } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";

export function BottomNav() {
  const [location] = useLocation();
  const { get } = useSettings();
  const { isAuthenticated, isLoading } = useAuth();

  const navItems = [
    { label: get("nav_home_label", "Home"), icon: Home, path: "/" },
    { label: get("nav_artists_label", "Artists"), icon: Music, path: "/artists" },
    { label: get("nav_events_label", "Events"), icon: CalendarDays, path: "/events" },
    { label: get("nav_ds_label", "DS"), icon: LayoutGrid, path: "/ds" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location === "/"
              : location.startsWith(item.path);
          return (
            <Link key={item.path} href={item.path}>
              <button
                className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            </Link>
          );
        })}
        {!isLoading && !isAuthenticated && (
          <Link href="/login">
            <button
              className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                location === "/login"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
              data-testid="nav-login"
            >
              <LogIn className="w-5 h-5" />
              <span>Log In</span>
            </button>
          </Link>
        )}
      </div>
    </nav>
  );
}
