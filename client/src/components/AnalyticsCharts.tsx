import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface AnalyticsChartsProps {
  claimsByState?: Array<{ name: string; claims: number; approved: number; pending: number; rejected: number; }>;
  monthlyTrends?: Array<{ month: string; submitted: number; processed: number; approved: number; }>;
  statusDistribution?: Array<{ name: string; value: number; color: string; }>;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export default function AnalyticsCharts({ 
  claimsByState = [], 
  monthlyTrends = [],
  statusDistribution = [] 
}: AnalyticsChartsProps) {
  const { t } = useLanguage();
  
  // Fetch real analytics data from API
  const { data: claimsData = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/claims'],
    enabled: true,
  });

  // Fetch dashboard stats for status distribution
  const { data: statsData } = useQuery<any>({
    queryKey: ['/api/dashboard/stats'],
    enabled: true,
  });

  // Fetch OCR analytics data
  const { data: ocrData } = useQuery<any>({
    queryKey: ['/api/analytics/ocr'],
    enabled: true,
  });

  // OCR processing chart data (moved before early return to fix hooks order)
  const ocrProcessingData = useMemo(() => {
    if (!ocrData?.summary) return [];
    
    const summary = ocrData.summary;
    return [
      { name: t("components.analyticsCharts.processed", "Processed"), value: summary.processedDocuments, color: '#10b981' },
      { name: t("components.analyticsCharts.processing", "Processing"), value: summary.processingDocuments, color: '#f59e0b' },
      { name: t("components.analyticsCharts.failed", "Failed"), value: summary.failedDocuments, color: '#ef4444' },
    ].filter(item => item.value > 0);
  }, [ocrData, t]);

  // Transform API data into chart-ready format
  const stateData = useMemo(() => {
    if (claimsByState.length > 0) return claimsByState;
    
    // Group claims data by state
    const stateMap = new Map<string, { approved: number; pending: number; rejected: number; total: number }>();
    
    claimsData.forEach((claim: any) => {
      const stateName = claim.state || 'Unknown';
      if (!stateMap.has(stateName)) {
        stateMap.set(stateName, { approved: 0, pending: 0, rejected: 0, total: 0 });
      }
      
      const stateStats = stateMap.get(stateName)!;
      stateStats.total += (claim.ifr_received || 0) + (claim.cfr_received || 0);
      stateStats.approved += (claim.ifr_titles || 0) + (claim.cfr_titles || 0);
      stateStats.rejected += (claim.ifr_rejected || 0) + (claim.cfr_rejected || 0);
      stateStats.pending = stateStats.total - stateStats.approved - stateStats.rejected;
    });

    return Array.from(stateMap.entries())
      .map(([name, stats]) => ({
        name,
        claims: stats.total,
        approved: stats.approved,
        pending: Math.max(0, stats.pending),
        rejected: stats.rejected
      }))
      .sort((a, b) => b.claims - a.claims)
      .slice(0, 6); // Top 6 states
  }, [claimsData, claimsByState]);

  const trendData = useMemo(() => {
    if (monthlyTrends.length > 0) return monthlyTrends;
    
    // Group claims data by month
    const monthMap = new Map<string, { submitted: number; processed: number; approved: number }>();
    
    claimsData.forEach((claim: any) => {
      const year = claim.year || new Date().getFullYear();
      const month = claim.month || new Date().getMonth() + 1;
      const monthKey = `${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { submitted: 0, processed: 0, approved: 0 });
      }
      
      const monthStats = monthMap.get(monthKey)!;
      monthStats.submitted += (claim.ifr_received || 0) + (claim.cfr_received || 0);
      monthStats.approved += (claim.ifr_titles || 0) + (claim.cfr_titles || 0);
      monthStats.processed = monthStats.submitted; // Assume all submitted are processed
    });

    return Array.from(monthMap.entries())
      .map(([month, stats]) => ({ month, ...stats }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-6); // Last 6 months
  }, [claimsData, monthlyTrends]);

  const statusData = useMemo(() => {
    if (statusDistribution.length > 0) return statusDistribution;
    
    // Use stats data if available, otherwise calculate from claims data
    if (statsData && typeof statsData === 'object') {
      return [
        { 
          name: t("components.analyticsCharts.approved", "Approved"), 
          value: statsData.approvedClaims || 0, 
          color: '#10b981' 
        },
        { 
          name: t("components.analyticsCharts.pending", "Pending"), 
          value: statsData.pendingClaims || 0, 
          color: '#f59e0b' 
        },
        { 
          name: t("components.dashboardStats.underReview", "Under Review"), 
          value: statsData.underReviewClaims || 0, 
          color: '#6b7280' 
        },
        { 
          name: t("components.analyticsCharts.rejected", "Rejected"), 
          value: statsData.rejectedClaims || 0, 
          color: '#ef4444' 
        },
      ].filter(item => item.value > 0);
    }
    
    // Fallback: calculate from claims data
    const totals = claimsData.reduce((acc: any, claim: any) => {
      const claimApproved = (claim.ifr_titles || 0) + (claim.cfr_titles || 0);
      const claimRejected = (claim.ifr_rejected || 0) + (claim.cfr_rejected || 0);
      const claimTotal = (claim.ifr_received || 0) + (claim.cfr_received || 0);
      const claimPending = Math.max(0, claimTotal - claimApproved - claimRejected);
      
      acc.approved += claimApproved;
      acc.rejected += claimRejected;
      acc.pending += claimPending;
      return acc;
    }, { approved: 0, pending: 0, rejected: 0, underReview: 0 });

    return [
      { name: t("components.analyticsCharts.approved", "Approved"), value: totals.approved, color: '#10b981' },
      { name: t("components.analyticsCharts.pending", "Pending"), value: totals.pending, color: '#f59e0b' },
      { name: t("components.analyticsCharts.rejected", "Rejected"), value: totals.rejected, color: '#ef4444' },
    ].filter(item => item.value > 0);
  }, [claimsData, statusDistribution, statsData, t]);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardContent className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">{t("components.analyticsCharts.loading", "Loading analytics...")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Claims by State */}
      <Card className="md:col-span-2" data-testid="chart-claims-by-state">
        <CardHeader>
          <CardTitle>{t("components.analyticsCharts.claimsByStateTitle", "Claims by State")}</CardTitle>
          <CardDescription>
            {t("components.analyticsCharts.claimsByStateDescription", "Distribution of FRA claims across major states")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="approved" stackId="a" fill="hsl(var(--chart-3))" name={t("components.analyticsCharts.approved", "Approved")} />
              <Bar dataKey="pending" stackId="a" fill="hsl(var(--chart-4))" name={t("components.analyticsCharts.pending", "Pending")} />
              <Bar dataKey="rejected" stackId="a" fill="hsl(var(--destructive))" name={t("components.analyticsCharts.rejected", "Rejected")} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card data-testid="chart-status-distribution">
        <CardHeader>
          <CardTitle>{t("components.analyticsCharts.statusDistributionTitle", "Claim Status Distribution")}</CardTitle>
          <CardDescription>
            {t("components.analyticsCharts.statusDistributionDescription", "Overall distribution of claim statuses")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card data-testid="chart-monthly-trends">
        <CardHeader>
          <CardTitle>{t("components.analyticsCharts.monthlyTrendsTitle", "Monthly Processing Trends")}</CardTitle>
          <CardDescription>
            {t("components.analyticsCharts.monthlyTrendsDescription", "Claims submission and processing over time")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="submitted" 
                stroke="hsl(var(--chart-1))" 
                strokeWidth={2}
                name={t("components.analyticsCharts.submitted", "Submitted")}
              />
              <Line 
                type="monotone" 
                dataKey="processed" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                name={t("components.analyticsCharts.processed", "Processed")}
              />
              <Line 
                type="monotone" 
                dataKey="approved" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={2}
                name={t("components.analyticsCharts.approved", "Approved")}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* OCR Processing Status */}
      {ocrProcessingData.length > 0 && (
        <Card data-testid="chart-ocr-processing">
          <CardHeader>
            <CardTitle>{t("components.analyticsCharts.ocrProcessingTitle", "Document Processing Status")}</CardTitle>
            <CardDescription>
              {t("components.analyticsCharts.ocrProcessingDescription", "OCR processing status of uploaded documents")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={ocrProcessingData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {ocrProcessingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}