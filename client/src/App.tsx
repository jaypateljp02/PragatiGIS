import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WorkflowProvider } from "@/contexts/WorkflowContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import AppSidebar from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Dashboard from "@/pages/Dashboard";
import MapPage from "@/pages/MapPage";
import DSSPage from "@/pages/DSSPage";
import ReportsPage from "@/pages/ReportsPage";
import LoginPage from "@/pages/LoginPage";
import ClaimDetailPage from "@/pages/ClaimDetailPage";
import DocumentWorkflowPage from "@/pages/DocumentWorkflowPage";
import StateDashboard from "@/pages/StateDashboard";
import SettingsPage from "@/pages/SettingsPage";
import BulkUploadPage from "@/pages/BulkUploadPage";
import AIAnalysisPage from "@/pages/AIAnalysisPage";
import NotFound from "@/pages/not-found";
import { useLocation } from "wouter";


function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={() => <ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/state-dashboard" component={() => <ProtectedRoute><StateDashboard /></ProtectedRoute>} />
      <Route path="/state-analytics" component={() => <ProtectedRoute><StateDashboard /></ProtectedRoute>} />
      <Route path="/claims/:id" component={() => <ProtectedRoute><ClaimDetailPage /></ProtectedRoute>} />
      <Route path="/claims" component={() => <ProtectedRoute><DocumentWorkflowPage /></ProtectedRoute>} />
      <Route path="/bulk-upload" component={() => <ProtectedRoute><BulkUploadPage /></ProtectedRoute>} />
      <Route path="/documents" component={() => <ProtectedRoute><DocumentWorkflowPage /></ProtectedRoute>} />
      <Route path="/maps" component={() => <ProtectedRoute><MapPage /></ProtectedRoute>} />
      <Route path="/dss" component={() => <ProtectedRoute><DSSPage /></ProtectedRoute>} />
      <Route path="/ai-analysis" component={() => <ProtectedRoute><DocumentWorkflowPage /></ProtectedRoute>} />
      <Route path="/reports" component={() => <ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/settings" component={() => <ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // ALWAYS show simple layout without sidebar for login page
  if (location === '/login') {
    return <Router />;
  }

  // For unauthenticated users, show simple layout without sidebar
  if (!isAuthenticated) {
    return <Router />;
  }

  // For authenticated users, show full sidebar layout with providers
  return (
    <WebSocketProvider>
      <WorkflowProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1">
              <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-2">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-auto p-6">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </WorkflowProvider>
    </WebSocketProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <AppLayout />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
