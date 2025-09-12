import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import ClaimsTable, { type Claim } from "@/components/ClaimsTable";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function ClaimsPage() {
  const [, setLocation] = useLocation();
  
  const { data: claims = [], isLoading, error } = useQuery<Claim[]>({
    queryKey: ['/api/claims'],
    enabled: true,
  });

  const handleViewClaim = (id: string) => {
    setLocation(`/claims/${id}`);
  };

  const handleExportData = async () => {
    try {
      const response = await fetch('/api/claims/export', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `fra-claims-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96" data-testid="claims-loading">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading claims data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4" data-testid="claims-error">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load claims data. Please check your authentication and try again.
          </AlertDescription>
        </Alert>
        <Button 
          onClick={() => window.location.reload()} 
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="claims-page">
      <ClaimsTable 
        claims={claims}
        onViewClaim={handleViewClaim}
        onExportData={handleExportData}
      />
    </div>
  );
}