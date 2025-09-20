import DashboardStats from "@/components/DashboardStats";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'new-claims':
        navigate('/documents');
        break;
      case 'export-data':
        navigate('/reports');
        break;
      case 'ocr-processing':
        navigate('/dss');
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.dashboard.title", "FRA Atlas Dashboard")}</h1>
          <p className="text-muted-foreground">
            {t("pages.dashboard.subtitle", "Monitor Forest Rights Act claims and document processing across India")}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="button-reports">
            <Download className="h-4 w-4 mr-2" />
            {t("common.reports", "Reports")}
          </Button>
          <Button size="sm" data-testid="button-process-documents">
            <Zap className="h-4 w-4 mr-2" />
            {t("pages.dashboard.processDocuments", "Process Documents")}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <DashboardStats />

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover-elevate cursor-pointer" onClick={() => handleQuickAction('new-claims')} data-testid="card-new-claims">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{t("pages.dashboard.newClaims", "New Claims")}</h3>
                <p className="text-sm text-muted-foreground">{t("pages.dashboard.reviewPending", "Review pending submissions")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => handleQuickAction('export-data')} data-testid="card-export-data">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-3/10">
                <Download className="h-6 w-6 text-chart-3" />
              </div>
              <div>
                <h3 className="font-semibold">{t("pages.dashboard.exportData", "Export Data")}</h3>
                <p className="text-sm text-muted-foreground">{t("pages.dashboard.downloadReports", "Download reports")}</p>
              </div>
            </div>
          </CardContent>
        </Card>


        <Card className="hover-elevate cursor-pointer" onClick={() => handleQuickAction('ocr-processing')} data-testid="card-ocr-processing">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-2/10">
                <Zap className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <h3 className="font-semibold">{t("pages.dashboard.aiAnalysis", "AI Analysis")}</h3>
                <p className="text-sm text-muted-foreground">{t("pages.dashboard.decisionSupport", "Decision support system")}</p>
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
          <CardTitle>{t("pages.dashboard.recentActivity", "Recent Activity")}</CardTitle>
          <CardDescription>
            {t("pages.dashboard.latestUpdates", "Latest updates on claim processing and document uploads")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { 
                time: t("pages.recentActivity.activity1Time", "2 minutes ago"), 
                action: t("pages.recentActivity.activity1Action", "Document processed: FRA-MH-2024-001234.pdf"), 
                status: 'success' 
              },
              { 
                time: t("pages.recentActivity.activity2Time", "15 minutes ago"), 
                action: t("pages.recentActivity.activity2Action", "New claim submitted from Odisha district office"), 
                status: 'info' 
              },
              { 
                time: t("pages.recentActivity.activity3Time", "1 hour ago"), 
                action: t("pages.recentActivity.activity3Action", "Batch processing completed: 45 documents"), 
                status: 'success' 
              },
              { 
                time: t("pages.recentActivity.activity4Time", "2 hours ago"), 
                action: t("pages.recentActivity.activity4Action", "System alert: OCR accuracy below threshold"), 
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