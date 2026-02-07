import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";

export function TopRibbon() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="w-full border-b bg-background px-4 py-2">
        <p className="text-center text-xs tracking-widest uppercase text-muted-foreground" data-testid="text-company-name">
          [ Company Name ]
        </p>
      </div>

      <div className="w-full border-b bg-background">
        <div className="flex items-center justify-between px-4 h-14">
          <div
            className="flex-1 h-8 border border-dashed border-muted-foreground/40 rounded-md flex items-center justify-center"
            data-testid="placeholder-logo"
          >
            <span className="text-xs text-muted-foreground">[ Logo / Image ]</span>
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
