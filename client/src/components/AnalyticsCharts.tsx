import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

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
  
  // Mock data for demonstration //todo: remove mock functionality
  const defaultStateData = [
    { name: 'Madhya Pradesh', claims: 28459, approved: 19232, pending: 6847, rejected: 2380 },
    { name: 'Maharashtra', claims: 22134, approved: 15698, pending: 4923, rejected: 1513 },
    { name: 'Odisha', claims: 19876, approved: 13245, pending: 5234, rejected: 1397 },
    { name: 'Gujarat', claims: 15432, approved: 11087, pending: 3298, rejected: 1047 },
    { name: 'Telangana', claims: 12987, approved: 9134, pending: 2845, rejected: 1008 },
    { name: 'Others', claims: 27959, approved: 18836, pending: 7309, rejected: 1814 },
  ];

  const defaultTrendData = [
    { month: 'Jan 2024', submitted: 8234, processed: 7892, approved: 6234 },
    { month: 'Feb 2024', submitted: 9123, processed: 8456, approved: 6789 },
    { month: 'Mar 2024', submitted: 10245, processed: 9234, approved: 7456 },
    { month: 'Apr 2024', submitted: 8976, processed: 8123, approved: 6543 },
    { month: 'May 2024', submitted: 11234, processed: 10456, approved: 8234 },
    { month: 'Jun 2024', submitted: 12456, processed: 11234, approved: 9123 },
  ];

  const defaultStatusData = [
    { name: t("components.analyticsCharts.approved", "Approved"), value: 89231, color: '#10b981' },
    { name: t("components.analyticsCharts.pending", "Pending"), value: 23456, color: '#f59e0b' },
    { name: t("components.dashboardStats.underReview", "Under Review"), value: 8934, color: '#6b7280' },
    { name: t("components.analyticsCharts.rejected", "Rejected"), value: 4226, color: '#ef4444' },
  ];

  const stateData = claimsByState.length > 0 ? claimsByState : defaultStateData;
  const trendData = monthlyTrends.length > 0 ? monthlyTrends : defaultTrendData;
  const statusData = statusDistribution.length > 0 ? statusDistribution : defaultStatusData;

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
    </div>
  );
}