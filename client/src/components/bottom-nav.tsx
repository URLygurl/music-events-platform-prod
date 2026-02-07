import { useLocation, Link } from "wouter";
import { Home, Music, CalendarDays, LayoutGrid, User } from "lucide-react";

const navItems = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Artists", icon: Music, path: "/artists" },
  { label: "Events", icon: CalendarDays, path: "/events" },
  { label: "DS", icon: LayoutGrid, path: "/ds" },
  { label: "Profile", icon: User, path: "/profile" },
];

export function BottomNav() {
  const [location] = useLocation();

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
    </nav>
  );
}
