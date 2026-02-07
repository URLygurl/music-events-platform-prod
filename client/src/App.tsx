import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import LoginPage from "@/pages/login";
import LandingPage from "@/pages/landing";
import ArtistDetailPage from "@/pages/artist-detail";
import ArtistsDirectoryPage from "@/pages/artists-directory";
import EventsPage from "@/pages/events";
import DSPage from "@/pages/ds";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/artists/:id" component={ArtistDetailPage} />
      <Route path="/artists" component={ArtistsDirectoryPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/ds" component={DSPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthGate />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
