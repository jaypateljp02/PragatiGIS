import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, TreePine, Moon, Sun, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

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

export default function LoginPage() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  const handleGoogleSignIn = async () => {
    if (isLoggingIn) return;
    
    setIsLoggingIn(true);
    try {
      await login();
      toast({
        title: "Signing in...",
        description: "Redirecting to Google for authentication",
      });
    } catch (error) {
      console.error('Login error:', error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Unable to start Google authentication. Please check your Firebase configuration.",
      });
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950">
      {/* Header */}
      <header className="w-full p-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <TreePine className="h-8 w-8 text-green-600" />
          <span className="text-2xl font-bold text-gray-900 dark:text-white">FRA Atlas</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <Shield className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to FRA Atlas Platform
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Forest Rights Act document management and processing system for India's tribal communities
            </p>
          </div>

          {/* Login Card */}
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border border-white/20">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Sign In to Continue</CardTitle>
              <CardDescription>
                Use your Google account to access the FRA Atlas Platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Google Sign In Button */}
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn || isLoading}
                className="w-full h-12 text-base"
                data-testid="button-google-signin"
              >
                {isLoggingIn ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    Sign in with Google
                  </>
                )}
              </Button>

              {/* Information Alert */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  This platform is designed for government officials and authorized personnel managing Forest Rights Act claims. 
                  Sign in with your official Google account to access role-based features.
                </AlertDescription>
              </Alert>

              {/* Features List */}
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Platform Features:</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>• Document processing with OCR support</li>
                  <li>• Geospatial claim visualization</li>
                  <li>• Multi-language support (Hindi, Odia, Telugu, Bengali, Gujarati)</li>
                  <li>• Role-based access control</li>
                  <li>• Analytics and reporting dashboard</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
            <p>Serving Madhya Pradesh, Odisha, Telangana, and Tripura</p>
            <p className="mt-1">Ministry of Tribal Affairs, Government of India</p>
          </div>
        </div>
      </div>
    </div>
  );
}