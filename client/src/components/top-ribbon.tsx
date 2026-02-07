import { Menu } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { ImagePlaceholder } from "@/components/image-placeholder";

export function TopRibbon() {
  const { user, isAuthenticated, logout } = useAuth();
  const { get } = useSettings();
  const [open, setOpen] = useState(false);

  const companyName = get("global_company_name", "[ Company Name ]");
  const logoImage = get("global_logo_image");

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="w-full border-b bg-background px-4 py-2">
        <p className="text-center text-xs tracking-widest uppercase text-muted-foreground" data-testid="text-company-name">
          {companyName}
        </p>
      </div>

      <div className="w-full border-b bg-background">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex-1 h-8 rounded-md flex items-center justify-center overflow-visible">
            {logoImage ? (
              <img src={logoImage} alt="Logo" className="h-8 object-contain" data-testid="img-logo" />
            ) : (
              <div
                className="w-full h-8 border border-dashed border-muted-foreground/40 rounded-md flex items-center justify-center"
                data-testid="placeholder-logo"
              >
                <span className="text-xs text-muted-foreground">[ Logo / Image ]</span>
              </div>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-hamburger">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="flex flex-col gap-2 mt-8">
                <Link href="/" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" data-testid="menu-home">
                    Home
                  </Button>
                </Link>
                <Link href="/artists" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" data-testid="menu-artists">
                    Artists
                  </Button>
                </Link>
                <Link href="/events" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" data-testid="menu-events">
                    Events
                  </Button>
                </Link>
                <Link href="/ds" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" data-testid="menu-ds">
                    DS
                  </Button>
                </Link>
                <Link href="/profile" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" data-testid="menu-profile">
                    Profile
                  </Button>
                </Link>
                <Link href="/donate" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" data-testid="menu-donate">
                    Donate
                  </Button>
                </Link>
                <div className="border-t my-2" />
                <Link href="/admin" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" data-testid="menu-admin">
                    Admin
                  </Button>
                </Link>
                <Link href="/admin/integrations" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" data-testid="menu-integrations">
                    Integrations
                  </Button>
                </Link>
                {isAuthenticated && (
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
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
