import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, MapPin, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

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

interface DashboardStatsProps {
  stats: {
    totalClaims: number;
    pendingClaims: number;
    approvedClaims: number;
    totalDocuments: number;
    processedDocuments: number;
    totalArea: string;
  };
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  const approvalRate = Math.round((stats.approvedClaims / stats.totalClaims) * 100);
  const processingRate = Math.round((stats.processedDocuments / stats.totalDocuments) * 100);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Claims"
        value={stats.totalClaims.toLocaleString()}
        subtitle="Across all states"
        icon={<FileText className="h-4 w-4" />}
        trend={{ value: 12, isPositive: true }}
      />
      <StatCard
        title="Pending Review"
        value={stats.pendingClaims.toLocaleString()}
        subtitle={`${Math.round((stats.pendingClaims / stats.totalClaims) * 100)}% of total`}
        icon={<Clock className="h-4 w-4" />}
        trend={{ value: -8, isPositive: false }}
      />
      <StatCard
        title="Approved Claims"
        value={stats.approvedClaims.toLocaleString()}
        subtitle={`${approvalRate}% approval rate`}
        icon={<CheckCircle2 className="h-4 w-4" />}
        trend={{ value: 15, isPositive: true }}
      />
      <StatCard
        title="Forest Area"
        value={stats.totalArea}
        subtitle="Under FRA claims"
        icon={<MapPin className="h-4 w-4" />}
        trend={{ value: 5, isPositive: true }}
      />
    </div>
  );
}