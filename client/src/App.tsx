import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CustomFontLoader } from "@/components/custom-font-loader";
import { useAuth } from "@/hooks/use-auth";
import LoginPage from "@/pages/login";
import LandingPage from "@/pages/landing";
import ArtistDetailPage from "@/pages/artist-detail";
import ArtistsDirectoryPage from "@/pages/artists-directory";
import EventsPage from "@/pages/events";
import EventDetailPage from "@/pages/event-detail";
import DSPage from "@/pages/ds";
import ProfilePage from "@/pages/profile";
import AdminPage from "@/pages/admin";
import IntegrationsPage from "@/pages/integrations";
import DonatePage from "@/pages/donate";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/integrations" component={IntegrationsPage} />
      <Route path="/artists/:id" component={ArtistDetailPage} />
      <Route path="/artists" component={ArtistsDirectoryPage} />
      <Route path="/events/:id" component={EventDetailPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/ds" component={DSPage} />
      <Route path="/donate" component={DonatePage} />
      <Route path="/profile" component={ProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CustomFontLoader />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
