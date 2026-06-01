import { useLocation, Link } from "wouter";
import { Home, Music, CalendarDays, LayoutGrid, LogIn, ShoppingBag, Heart } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";

export function BottomNav() {
  const [location] = useLocation();
  const { get } = useSettings();
  const { isAuthenticated, isLoading } = useAuth();

  const ALL_NAV_ITEMS = [
    { settingKey: "nav_show_home", labelKey: "nav_home_label", defaultLabel: "Home", icon: Home, path: "/" },
    { settingKey: "nav_show_artists", labelKey: "nav_artists_label", defaultLabel: "Artists", icon: Music, path: "/artists" },
    { settingKey: "nav_show_events", labelKey: "nav_events_label", defaultLabel: "Events", icon: CalendarDays, path: "/events" },
    { settingKey: "nav_show_ds", labelKey: "nav_ds_label", defaultLabel: "DS", icon: LayoutGrid, path: "/ds" },
    { settingKey: "nav_show_shop", labelKey: "nav_shop_label", defaultLabel: "Shop", icon: ShoppingBag, path: "/shop" },
    { settingKey: "nav_show_donate", labelKey: "nav_donate_label", defaultLabel: "Donate", icon: Heart, path: "/donate" },
  ];

  // Default: show home/artists/events/ds, hide shop/donate unless explicitly enabled
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    const defaultVal = ["nav_show_home", "nav_show_artists", "nav_show_events", "nav_show_ds"].includes(item.settingKey)
      ? "true"
      : "false";
    return get(item.settingKey, defaultVal) === "true";
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const label = get(item.labelKey, item.defaultLabel);
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
                data-testid={`nav-${item.defaultLabel.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{label}</span>
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
