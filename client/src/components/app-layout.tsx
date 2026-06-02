import { TopRibbon } from "./top-ribbon";
import { BottomNav } from "./bottom-nav";
import { useSettings } from "@/hooks/use-settings";

interface AppLayoutProps {
  children: React.ReactNode;
  showTopRibbon?: boolean;
  bgKey?: string;
}

export function AppLayout({ children, showTopRibbon = true, bgKey }: AppLayoutProps) {
  const { get } = useSettings();
  const bgImage = bgKey ? get(bgKey) : "";

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={bgImage ? {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      } : undefined}
    >
      {bgImage && <div className="fixed inset-0 bg-background/80 z-0" />}
      <div className={`flex flex-col min-h-screen ${bgImage ? "relative z-10" : ""}`}>
        {showTopRibbon && <TopRibbon />}
        <main className="flex-1 pb-24 max-w-lg mx-auto w-full">
          {children}
        </main>
        <div className="fixed bottom-[72px] left-0 right-0 z-50 text-center pointer-events-none" data-testid="text-footer-credit">
          <span className="text-muted-foreground" style={{ fontSize: '9px' }}>made with 🍑 by peachyweb</span>
        </div>
        <BottomNav />
      </div>
    </div>
  );
}
