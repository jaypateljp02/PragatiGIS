import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle2, Clock, AlertTriangle, MapPin, Users } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <Card className="hover-elevate" data-testid={`stat-card-${title.toLowerCase().replace(' ', '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-4 w-4 text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-value-${title.toLowerCase().replace(' ', '-')}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>
        )}
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className={trend.isPositive ? "text-chart-3" : "text-destructive"}>
              {trend.isPositive ? "+" : ""}{trend.value}%
            </span>{" "}
            from last month
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface StatsData {
  totalClaims: number;
  approvedClaims: number;
  pendingClaims: number;
  underReviewClaims: number;
  rejectedClaims: number;
  totalArea: string;
  totalDocuments?: number;
  processedDocuments?: number;
}

interface DashboardStatsProps {
  stats?: StatsData;
}

export default function DashboardStats({ stats: propStats }: DashboardStatsProps) {
  // Fetch real stats from API
  const { data: apiStats, isLoading, error } = useQuery<StatsData>({
    queryKey: ['/api/dashboard/stats'],
    enabled: true,
  });

  // Use API stats if available, otherwise fall back to prop stats or defaults
  const stats = apiStats || propStats || {
    totalClaims: 0,
    approvedClaims: 0,
    pendingClaims: 0,
    underReviewClaims: 0,
    rejectedClaims: 0,
    totalArea: "0 hectares",
    totalDocuments: 0,
    processedDocuments: 0,
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-8 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Unable to load dashboard statistics</p>
        </CardContent>
      </Card>
    );
  }

  const approvalRate = stats.totalClaims > 0 ? Math.round((stats.approvedClaims / stats.totalClaims) * 100) : 0;
  const pendingTotal = stats.pendingClaims + stats.underReviewClaims;
  const processingRate = stats.totalDocuments && stats.totalDocuments > 0 
    ? Math.round(((stats.processedDocuments || 0) / stats.totalDocuments) * 100) 
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <StatCard
        title="Total Claims"
        value={stats.totalClaims.toLocaleString()}
        subtitle="Across all states"
        icon={<FileText className="h-4 w-4" />}
        trend={{ value: 12, isPositive: true }}
      />
      <StatCard
        title="Approved Claims"
        value={stats.approvedClaims.toLocaleString()}
        subtitle={`${approvalRate}% approval rate`}
        icon={<CheckCircle2 className="h-4 w-4" />}
        trend={{ value: 15, isPositive: true }}
      />
      <StatCard
        title="Pending Review"
        value={pendingTotal.toLocaleString()}
        subtitle={`${stats.pendingClaims} pending, ${stats.underReviewClaims} under review`}
        icon={<Clock className="h-4 w-4" />}
        trend={{ value: -8, isPositive: false }}
      />
      <StatCard
        title="Rejected Claims"
        value={stats.rejectedClaims.toLocaleString()}
        subtitle={`${stats.totalClaims > 0 ? Math.round((stats.rejectedClaims / stats.totalClaims) * 100) : 0}% rejection rate`}
        icon={<AlertTriangle className="h-4 w-4" />}
      />
      <StatCard
        title="Forest Area"
        value={stats.totalArea}
        subtitle="Under FRA claims"
        icon={<MapPin className="h-4 w-4" />}
        trend={{ value: 5, isPositive: true }}
      />
      <StatCard
        title="Documents"
        value={(stats.totalDocuments || 0).toLocaleString()}
        subtitle={`${processingRate}% processed`}
        icon={<Users className="h-4 w-4" />}
      />
    </div>
  );
}