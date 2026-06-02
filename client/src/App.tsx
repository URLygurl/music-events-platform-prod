import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CustomFontLoader } from "@/components/custom-font-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { ConciergeWidget } from "@/components/concierge-widget";
import { CartDrawer } from "@/components/cart-drawer";

// Eagerly load the landing page (first paint)
import LandingPage from "@/pages/landing";

// Lazy-load all other routes — each becomes its own JS chunk
const LoginPage            = lazy(() => import("@/pages/login"));
const ArtistDetailPage     = lazy(() => import("@/pages/artist-detail"));
const ArtistsDirectoryPage = lazy(() => import("@/pages/artists-directory"));
const EventsPage           = lazy(() => import("@/pages/events"));
const EventDetailPage      = lazy(() => import("@/pages/event-detail"));
const DSPage               = lazy(() => import("@/pages/ds"));
const ProfilePage          = lazy(() => import("@/pages/profile"));
const AdminPage            = lazy(() => import("@/pages/admin"));
const IntegrationsPage     = lazy(() => import("@/pages/integrations"));
const DonatePage           = lazy(() => import("@/pages/donate"));
const ShopPage             = lazy(() => import("@/pages/shop"));
const ProductDetailPage    = lazy(() => import("@/pages/product-detail"));
const NotFound             = lazy(() => import("@/pages/not-found"));
const HermesLoginPage      = lazy(() => import("@/pages/hermes-login"));
const HermesDashboard      = lazy(() => import("@/pages/hermes"));

function PageLoader() {
  return (
    <div className="flex flex-col gap-4 p-6 max-w-lg mx-auto mt-12">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/shop/:id" component={ProductDetailPage} />
        <Route path="/shop" component={ShopPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/hermes/login" component={HermesLoginPage} />
        <Route path="/hermes" component={HermesDashboard} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CustomFontLoader />
        <Toaster />
        <Router />
        <CartDrawer />
        <ConciergeWidget />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
