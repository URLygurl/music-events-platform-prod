import { Menu, LogIn } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { ImagePlaceholder } from "@/components/image-placeholder";

const PUBLIC_MENU_ITEMS = [
  { key: "home", href: "/", settingKey: "menu_show_home", labelKey: "nav_home_label", defaultLabel: "Home" },
  { key: "artists", href: "/artists", settingKey: "menu_show_artists", labelKey: "nav_artists_label", defaultLabel: "Artists" },
  { key: "events", href: "/events", settingKey: "menu_show_events", labelKey: "nav_events_label", defaultLabel: "Events" },
  { key: "ds", href: "/ds", settingKey: "menu_show_ds", labelKey: "nav_ds_label", defaultLabel: "DS" },
  { key: "shop", href: "/shop", settingKey: "menu_show_shop", labelKey: "nav_shop_label", defaultLabel: "Shop" },
  { key: "donate", href: "/donate", settingKey: "menu_show_donate", labelKey: "nav_donate_label", defaultLabel: "Donate" },
];

const ADMIN_MENU_ITEMS = [
  { key: "profile", href: "/profile", settingKey: "menu_show_profile", labelKey: "nav_profile_label", defaultLabel: "Profile" },
  { key: "admin", href: "/admin", settingKey: "menu_show_admin", defaultLabel: "Admin" },
  { key: "integrations", href: "/admin/integrations", settingKey: "menu_show_integrations", defaultLabel: "Integrations" },
];

export function TopRibbon() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { get } = useSettings();
  const [open, setOpen] = useState(false);

  const companyName = get("global_company_name", "[ Company Name ]");
  const logoImage = get("global_logo_image");

  const visiblePublicItems = PUBLIC_MENU_ITEMS.filter((item) => get(item.settingKey, "true") === "true");
  const visibleAdminItems = isAdmin
    ? ADMIN_MENU_ITEMS.filter((item) => get(item.settingKey, "true") === "true")
    : [];

  return (
    <header className="sticky top-0 z-50 w-full shadow-md">
      <div className="w-full border-b bg-background/90 backdrop-blur-md px-4 py-2">
        <p className="text-center text-xs tracking-widest uppercase text-muted-foreground" data-testid="text-company-name">
          {companyName}
        </p>
      </div>

      <div className="w-full border-b bg-background/90 backdrop-blur-md">
        <div className="relative w-full">
          {logoImage ? (
            <img src={logoImage} alt="Logo" className="w-full h-24 object-cover" data-testid="img-logo" />
          ) : (
            <div
              className="w-full h-32 border-b border-dashed border-muted-foreground/40 flex items-center justify-center"
              data-testid="placeholder-logo"
            >
              <span className="text-xs text-muted-foreground">[ Logo / Image ]</span>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="bg-background/60 backdrop-blur-sm" data-testid="button-hamburger">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="flex flex-col gap-2 mt-8">
                {visiblePublicItems.map((item) => (
                  <Link key={item.key} href={item.href} onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start" data-testid={`menu-${item.key}`}>
                      {item.labelKey ? get(item.labelKey, item.defaultLabel) : item.defaultLabel}
                    </Button>
                  </Link>
                ))}
                {visibleAdminItems.length > 0 && (
                  <>
                    <div className="border-t my-2" />
                    {visibleAdminItems.map((item) => (
                      <Link key={item.key} href={item.href} onClick={() => setOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start" data-testid={`menu-${item.key}`}>
                          {item.labelKey ? get(item.labelKey, item.defaultLabel) : item.defaultLabel}
                        </Button>
                      </Link>
                    ))}
                  </>
                )}
                {isAuthenticated ? (
                  <>
                    <div className="border-t my-2" />
                    <div className="px-3 py-1">
                      <p className="text-sm text-muted-foreground" data-testid="text-user-name">
                        {user?.firstName} {user?.lastName}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => logout()}
                      data-testid="button-logout"
                    >
                      Log out
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="border-t my-2" />
                    <Link href="/login" onClick={() => setOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start" data-testid="button-login">
                        <LogIn className="w-4 h-4 mr-2" />
                        Log In
                      </Button>
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
