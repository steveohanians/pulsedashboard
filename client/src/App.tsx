import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import AdminPanel from "@/pages/admin-panel";
import BrandSignals from "@/pages/brand-signals";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import { useEffect } from "react";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useLocation } from "wouter";

// Redirect component for /admin -> /admin-panel
function AdminRedirect() {
  const [, navigate] = useLocation();
  
  useEffect(() => {
    navigate('/admin-panel', { replace: true });
  }, [navigate]);
  
  return null;
}

function Router() {
  // Track page views when routes change
  useAnalytics();
  
  return (
    <ErrorBoundary>
      <Switch>
        <ProtectedRoute path="/" component={Dashboard} />
        <ProtectedRoute path="/admin-panel" component={AdminPanel} />
        <ProtectedRoute path="/admin" component={AdminRedirect} />
        <ProtectedRoute path="/brand-signals" component={BrandSignals} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {

    } else {
      initGA();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
