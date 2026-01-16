import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, LogIn } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  console.log('ProtectedRoute render:', { user: !!user, isLoading, isAuthenticated });

  useEffect(() => {
    // Add a small delay before redirecting to prevent race conditions
    const timer = setTimeout(() => {
      if (!isLoading && !isAuthenticated) {
        console.log('Redirecting to login - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'user:', !!user);
        setLocation('/login');
      }
    }, 100); // Small delay to let auth state settle

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, setLocation]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-96 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access the PragatiGIS Platform
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setLocation('/login')} data-testid="button-go-to-login">
              <LogIn className="h-4 w-4 mr-2" />
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}