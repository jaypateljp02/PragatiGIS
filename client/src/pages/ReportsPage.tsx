import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, Download, Calendar, BarChart3, Clock, 
  TrendingUp, AlertTriangle, CheckCircle2 
} from "lucide-react";
import { Claim } from "@/components/ClaimsTable";
import ReportGenerator from "@/components/ReportGenerator";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import DashboardStats from "@/components/DashboardStats";

interface RecentReport {
  id: string;
  name: string;
  type: string;
  format: string;
  generatedAt: string;
  size: string;
  status: 'completed' | 'generating' | 'failed';
}

export default function ReportsPage() {
  // Fetch claims data for reports
  const { data: claims = [], isLoading: claimsLoading, error: claimsError } = useQuery<Claim[]>({
    queryKey: ['/api/claims'],
    enabled: true,
  });

  // Mock recent reports data - in real implementation, this would come from backend
  const recentReports: RecentReport[] = [
    {
      id: '1',
      name: 'Monthly Analytics Report',
      type: 'Analytics',
      format: 'PDF',
      generatedAt: '2024-09-12T10:30:00Z',
      size: '2.4 MB',
      status: 'completed'
    },
    {
      id: '2',
      name: 'Claims Data Export',
      type: 'Data Export',
      format: 'Excel',
      generatedAt: '2024-09-11T15:45:00Z',
      size: '1.8 MB',
      status: 'completed'
    },
    {
      id: '3',
      name: 'DSS Analysis Report',
      type: 'DSS Analysis',
      format: 'PDF',
      generatedAt: '2024-09-10T09:15:00Z',
      size: '3.2 MB',
      status: 'completed'
    },
    {
      id: '4',
      name: 'Compliance Audit',
      type: 'Compliance',
      format: 'PDF',
      generatedAt: '2024-09-09T14:20:00Z',
      size: '1.5 MB',
      status: 'failed'
    }
  ];

  const downloadExistingReport = (reportId: string) => {
    // Mock download functionality - in real implementation, this would trigger actual download
    console.log(`Downloading report ${reportId}`);
    // Could implement actual download via API call to backend
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-chart-3" />;
      case 'generating': return <Clock className="h-4 w-4 text-chart-4" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-chart-3 text-chart-3-foreground">Completed</Badge>;
      case 'generating': return <Badge className="bg-chart-4 text-chart-4-foreground">Generating</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (claimsLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading report data...</p>
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
            Failed to load claims data for reports. Please check your authentication and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Generate comprehensive reports and export data from the FRA Atlas Platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-2">
            <FileText className="h-3 w-3" />
            {claims.length} Claims Available
          </Badge>
          <Badge variant="outline" className="gap-2">
            <BarChart3 className="h-3 w-3" />
            Multiple Formats
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate" data-testid="tab-generate">
            <FileText className="h-4 w-4 mr-2" />
            Generate Reports
          </TabsTrigger>
          <TabsTrigger value="recent" data-testid="tab-recent">
            <Download className="h-4 w-4 mr-2" />
            Recent Reports
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Live Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <ReportGenerator claims={claims} />
        </TabsContent>

        <TabsContent value="recent" className="space-y-6">
          <Card data-testid="recent-reports">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Reports
              </CardTitle>
              <CardDescription>
                View and download previously generated reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentReports.map((report) => (
                  <div 
                    key={report.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                    data-testid={`recent-report-${report.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{report.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{report.type}</span>
                          <span>•</span>
                          <span>{report.format}</span>
                          <span>•</span>
                          <span>{report.size}</span>
                          <span>•</span>
                          <span>{new Date(report.generatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(report.status)}
                      {getStatusBadge(report.status)}
                      {report.status === 'completed' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadExistingReport(report.id)}
                          data-testid={`download-report-${report.id}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                
                {recentReports.length === 0 && (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No reports generated yet</p>
                    <p className="text-sm text-muted-foreground">Use the Generate Reports tab to create your first report</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6">
            {/* Dashboard Stats */}
            <Card data-testid="live-analytics-stats">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Live Dashboard Statistics
                </CardTitle>
                <CardDescription>
                  Real-time data that powers your reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DashboardStats />
              </CardContent>
            </Card>

            {/* Analytics Charts */}
            <Card data-testid="live-analytics-charts">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Interactive Charts
                </CardTitle>
                <CardDescription>
                  Visualizations included in generated reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsCharts />
              </CardContent>
            </Card>

            {/* Data Sources Info */}
            <Card data-testid="data-sources">
              <CardHeader>
                <CardTitle>Data Sources</CardTitle>
                <CardDescription>
                  Information about the data included in reports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-chart-3/10">
                      <FileText className="h-4 w-4 text-chart-3" />
                    </div>
                    <div>
                      <h4 className="font-medium">Claims Data</h4>
                      <p className="text-sm text-muted-foreground">{claims.length} records</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-chart-4/10">
                      <BarChart3 className="h-4 w-4 text-chart-4" />
                    </div>
                    <div>
                      <h4 className="font-medium">Analytics</h4>
                      <p className="text-sm text-muted-foreground">Real-time</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Time Range</h4>
                      <p className="text-sm text-muted-foreground">Configurable</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}