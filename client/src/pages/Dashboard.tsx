import DashboardStats from "@/components/DashboardStats";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Bell, Zap } from "lucide-react";

export default function Dashboard() {
  //todo: remove mock functionality
  const mockStats = {
    totalClaims: 125847,
    pendingClaims: 23456,
    approvedClaims: 89231,
    totalDocuments: 245892,
    processedDocuments: 198432,
    totalArea: "2.47M hectares"
  };

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">FRA Atlas Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor Forest Rights Act claims and document processing across India
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="button-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Alerts
          </Button>
          <Button variant="outline" size="sm" data-testid="button-reports">
            <Download className="h-4 w-4 mr-2" />
            Reports
          </Button>
          <Button size="sm" data-testid="button-process-documents">
            <Zap className="h-4 w-4 mr-2" />
            Process Documents
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <DashboardStats stats={mockStats} />

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">New Claims</h3>
                <p className="text-sm text-muted-foreground">Review pending submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-3/10">
                <Download className="h-6 w-6 text-chart-3" />
              </div>
              <div>
                <h3 className="font-semibold">Export Data</h3>
                <p className="text-sm text-muted-foreground">Download reports</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-4/10">
                <Bell className="h-6 w-6 text-chart-4" />
              </div>
              <div>
                <h3 className="font-semibold">Notifications</h3>
                <p className="text-sm text-muted-foreground">System alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-2/10">
                <Zap className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <h3 className="font-semibold">OCR Processing</h3>
                <p className="text-sm text-muted-foreground">Auto-extract data</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <AnalyticsCharts />

      {/* Recent Activity */}
      <Card data-testid="recent-activity">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest updates on claim processing and document uploads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { 
                time: '2 minutes ago', 
                action: 'Document processed: FRA-MH-2024-001234.pdf', 
                status: 'success' 
              },
              { 
                time: '15 minutes ago', 
                action: 'New claim submitted from Odisha district office', 
                status: 'info' 
              },
              { 
                time: '1 hour ago', 
                action: 'Batch processing completed: 45 documents', 
                status: 'success' 
              },
              { 
                time: '2 hours ago', 
                action: 'System alert: OCR accuracy below threshold', 
                status: 'warning' 
              },
            ].map((activity, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className={`w-2 h-2 rounded-full ${
                  activity.status === 'success' ? 'bg-chart-3' :
                  activity.status === 'warning' ? 'bg-chart-4' : 'bg-chart-2'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}