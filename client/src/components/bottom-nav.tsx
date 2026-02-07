import { useLocation, Link } from "wouter";
import { Home, Music, CalendarDays, LayoutGrid, User } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

export function BottomNav() {
  const [location] = useLocation();
  const { get } = useSettings();

  const navItems = [
    { label: get("nav_home_label", "Home"), icon: Home, path: "/" },
    { label: get("nav_artists_label", "Artists"), icon: Music, path: "/artists" },
    { label: get("nav_events_label", "Events"), icon: CalendarDays, path: "/events" },
    { label: get("nav_ds_label", "DS"), icon: LayoutGrid, path: "/ds" },
    { label: get("nav_profile_label", "Profile"), icon: User, path: "/profile" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background"
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
      </div>
      <div className="text-center pb-1" data-testid="text-footer-credit">
        <span className="text-muted-foreground" style={{ fontSize: '6px' }}>made with 🍑 by peachyweb</span>
      </div>
    </nav>
  );
}
