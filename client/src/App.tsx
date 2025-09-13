import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import AppSidebar from "@/components/AppSidebar";
import Dashboard from "@/pages/Dashboard";
import ClaimsPage from "@/pages/ClaimsPage";
import MapPage from "@/pages/MapPage";
import UploadPage from "@/pages/UploadPage";
import LoginPage from "@/pages/LoginPage";
import ClaimDetailPage from "@/pages/ClaimDetailPage";
import OCRReviewPage from "@/pages/OCRReviewPage";
import StateDashboard from "@/pages/StateDashboard";
import SettingsPage from "@/pages/SettingsPage";
import BulkUploadPage from "@/pages/BulkUploadPage";
import NotFound from "@/pages/not-found";
import { Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = theme === 'dark' || (!theme && systemPrefersDark);
    
    setIsDark(initialDark);
    document.documentElement.classList.toggle('dark', initialDark);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newTheme);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={() => <ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/state-dashboard" component={() => <ProtectedRoute><StateDashboard /></ProtectedRoute>} />
      <Route path="/claims/:id" component={() => <ProtectedRoute><ClaimDetailPage /></ProtectedRoute>} />
      <Route path="/claims" component={() => <ProtectedRoute><ClaimsPage /></ProtectedRoute>} />
      <Route path="/bulk-upload" component={() => <ProtectedRoute><BulkUploadPage /></ProtectedRoute>} />
      <Route path="/ocr-review" component={() => <ProtectedRoute><OCRReviewPage /></ProtectedRoute>} />
      <Route path="/maps" component={() => <ProtectedRoute><MapPage /></ProtectedRoute>} />
      <Route path="/upload" component={() => <ProtectedRoute><UploadPage /></ProtectedRoute>} />
      <Route path="/settings" component={() => <ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto p-6">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
