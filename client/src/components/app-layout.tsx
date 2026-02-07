import { TopRibbon } from "./top-ribbon";
import { BottomNav } from "./bottom-nav";

interface AppLayoutProps {
  children: React.ReactNode;
  showTopRibbon?: boolean;
}

export function AppLayout({ children, showTopRibbon = true }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showTopRibbon && <TopRibbon />}
      <main className="flex-1 pb-20 max-w-lg mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
