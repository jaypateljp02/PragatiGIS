import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, BarChart3, AlertTriangle } from "lucide-react";
import { Claim } from "@/components/ClaimsTable";
import ReportGenerator from "@/components/ReportGenerator";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ReportsPage() {
  const { t } = useLanguage();
  
  // Fetch claims data for reports - use detailed format to get individual claims
  const { data: claims = [], isLoading: claimsLoading, error: claimsError } = useQuery<Claim[]>({
    queryKey: ['/api/claims', 'detailed'],
    queryFn: async () => {
      const response = await fetch('/api/claims?format=detailed', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch claims: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: true,
  });

  if (claimsLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("pages.reports.loadingData", "Loading report data...")}</p>
        </div>
      </div>
    );
  }

  if (claimsError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t("pages.reports.loadError", "Failed to load claims data for reports. Please check your authentication and try again.")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("pages.reports.title", "Reports")}</h1>
          <p className="text-muted-foreground">
            {t("pages.reports.subtitle", "Generate comprehensive reports and export data from the PragatiGIS Platform")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-2">
            <FileText className="h-3 w-3" />
            {claims.length} {t("pages.reports.claimsAvailable", "Claims Available")}
          </Badge>
          <Badge variant="outline" className="gap-2">
            <BarChart3 className="h-3 w-3" />
            {t("pages.reports.multipleFormats", "Multiple Formats")}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="generate" data-testid="tab-generate">
            <FileText className="h-4 w-4 mr-2" />
            {t("pages.reports.generateReports", "Generate Reports")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <ReportGenerator claims={claims} />
        </TabsContent>

      </Tabs>
    </div>
  );
}