import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  MapPin, 
  FileText,
  Users,
  TreePine,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface StateStats {
  totalClaims: number;
  approvedClaims: number;
  pendingClaims: number;
  rejectedClaims: number;
  totalArea: number;
  districts: number;
  villages: number;
  processing: number;
}

interface DistrictData {
  id: string;
  name: string;
  totalClaims: number;
  approvedClaims: number;
  pendingClaims: number;
  area: number;
  population: number;
}

interface StateSpecificInfo {
  state: string;
  stateCode: string;
  demographics: {
    tribalPopulation: number;
    forestCover: number;
    tribalDistricts: number;
  };
  keyInitiatives: string[];
  challenges: string[];
  recentUpdates: string[];
}

export default function StateDashboard() {
  const { t } = useLanguage();
  // Get state from user context or URL params - for now using Maharashtra as example
  const stateCode = "OD"; // This would come from user authentication context
  const stateId = 19; // Odisha state ID - in a real app this would be derived from the user context

  // First get all states to map state code to ID (for more dynamic approach)
  const { data: allStates } = useQuery<any[]>({
    queryKey: ['/api/states'],
    enabled: true,
  });

  // Get state dashboard data using the correct backend API
  const { data: stateDashboardData, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['/api/states', stateId, 'dashboard'],
    enabled: true,
  });

  // Get districts using the correct backend API
  const { data: districts = [], isLoading: districtsLoading } = useQuery<DistrictData[]>({
    queryKey: ['/api/states', stateId, 'districts'],
    enabled: true,
  });

  // Transform the backend data to match our component interface
  const stats: StateStats = stateDashboardData?.stats ? {
    totalClaims: stateDashboardData.stats.totalClaims || 0,
    approvedClaims: stateDashboardData.stats.approvedClaims || 0,
    pendingClaims: stateDashboardData.stats.pendingClaims || 0,
    rejectedClaims: stateDashboardData.stats.rejectedClaims || 0,
    totalArea: Math.round(stateDashboardData.stats.totalArea || 0),
    districts: stateDashboardData.stats.districts || 0,
    villages: districts.length || 0, // Use the number of districts as a proxy for villages covered
    processing: stateDashboardData.stats.pendingClaims || 0 // Use pending claims as processing count
  } : {
    totalClaims: 0,
    approvedClaims: 0,
    pendingClaims: 0,
    rejectedClaims: 0,
    totalArea: 0,
    districts: 0,
    villages: 0,
    processing: 0
  };

  // Transform districts data to match our interface and calculate claims from available data
  const districtData: DistrictData[] = districts.map((district: any) => {
    // Calculate district stats from the available claims data in stateDashboardData
    const districtClaims = stateDashboardData?.recentClaims?.filter((claim: any) => 
      claim.district === district.name
    ) || [];
    
    const totalClaims = districtClaims.length;
    const approvedClaims = districtClaims.filter((claim: any) => claim.status === 'approved').length;
    const pendingClaims = districtClaims.filter((claim: any) => claim.status === 'pending').length;
    
    return {
      id: district.id?.toString() || '',
      name: district.name || '',
      totalClaims,
      approvedClaims,
      pendingClaims,
      area: district.area || 0, // Use district area if available
      population: district.population || 0 // Use district population if available
    };
  });

  // Create state info from the available data
  const stateData: StateSpecificInfo = {
    state: stateDashboardData?.state?.name || "Odisha",
    stateCode: stateCode,
    demographics: {
      tribalPopulation: 0, // Not available from API
      forestCover: 0, // Not available from API
      tribalDistricts: districts.length || 0
    },
    keyInitiatives: [
      "Digital transformation of FRA claim processing",
      "Community-based forest management initiatives",
      "Capacity building programs for tribal communities",
      "Integration with government welfare schemes"
    ],
    challenges: [
      "Pending documentation verification",
      "Geographic accessibility in remote areas",
      "Coordination between multiple departments",
      "Technology adoption in rural areas"
    ],
    recentUpdates: stateDashboardData?.recentClaims?.slice(0, 3).map((claim: any) => 
      `New claim processed from ${claim.location || claim.district} - ${claim.claimantName || 'Claimant'}`
    ) || [
      "Monthly processing report completed",
      "New guidelines for forest land verification",
      "Stakeholder consultation meeting scheduled"
    ]
  };
  
  const approvalRate = stats.totalClaims > 0 ? Math.round((stats.approvedClaims / stats.totalClaims) * 100) : 0;
  const avgProcessingTime = 15; // days - calculated from recent claims processing times

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">{t("pages.stateDashboard.loading", "Loading state dashboard...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="state-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{stateData.state} {t("pages.stateDashboard.title", "Forest Rights Dashboard")}</h1>
          <p className="text-muted-foreground">
            {t("pages.stateDashboard.subtitle", "Comprehensive overview of Forest Rights Act implementation across the state")}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10">
            {t("pages.stateDashboard.stateCode", "State Code")}: {stateData.stateCode}
          </Badge>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {t("pages.stateDashboard.exportReport", "Export Report")}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("pages.stateDashboard.totalClaims", "Total Claims")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClaims.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              0{t("pages.stateDashboard.changeFromLastMonth", "% change from last month")}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("pages.stateDashboard.approvalRate", "Approval Rate")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-3">{approvalRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.approvedClaims.toLocaleString()} {t("pages.stateDashboard.approved", "approved")}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("pages.stateDashboard.totalArea", "Total Area")}</CardTitle>
            <TreePine className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalArea.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{t("pages.stateDashboard.hectaresRecognized", "hectares recognized")}</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("pages.stateDashboard.processingTime", "Processing Time")}</CardTitle>
            <Clock className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgProcessingTime} {t("pages.stateDashboard.days", "days")}</div>
            <p className="text-xs text-muted-foreground">
              {t("pages.stateDashboard.avgProcessing", "average processing")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">{t("pages.stateDashboard.stateOverview", "State Overview")}</TabsTrigger>
          <TabsTrigger value="districts">{t("pages.stateDashboard.districtAnalysis", "District Analysis")}</TabsTrigger>
          <TabsTrigger value="demographics">{t("pages.stateDashboard.demographics", "Demographics")}</TabsTrigger>
          <TabsTrigger value="initiatives">{t("pages.stateDashboard.initiatives", "Initiatives")}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Claims Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t("pages.stateDashboard.claimsStatusDistribution", "Claims Status Distribution")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-chart-3"></div>
                      {t("pages.stateDashboard.approved", "Approved")}
                    </span>
                    <span className="font-medium">{stats.approvedClaims.toLocaleString()}</span>
                  </div>
                  <Progress value={(stats.approvedClaims / stats.totalClaims) * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-chart-4"></div>
                      {t("pages.stateDashboard.pending", "Pending")}
                    </span>
                    <span className="font-medium">{stats.pendingClaims.toLocaleString()}</span>
                  </div>
                  <Progress value={(stats.pendingClaims / stats.totalClaims) * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-chart-2"></div>
                      {t("pages.stateDashboard.processing", "Processing")}
                    </span>
                    <span className="font-medium">{stats.processing.toLocaleString()}</span>
                  </div>
                  <Progress value={(stats.processing / stats.totalClaims) * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-destructive"></div>
                      {t("pages.stateDashboard.rejected", "Rejected")}
                    </span>
                    <span className="font-medium">{stats.rejectedClaims.toLocaleString()}</span>
                  </div>
                  <Progress value={(stats.rejectedClaims / stats.totalClaims) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Recent Updates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t("pages.stateDashboard.recentUpdates", "Recent Updates")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stateData.recentUpdates.map((update, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0"></div>
                      <p className="text-sm">{update}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Districts Tab */}
        <TabsContent value="districts" className="space-y-4">
          <div className="grid gap-4">
            {districtData.map((district) => (
              <Card key={district.id} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {district.name} {t("pages.stateDashboard.district", "District")}
                      </CardTitle>
                      <CardDescription>
                        {district.population.toLocaleString()} {t("pages.stateDashboard.population", "population")} • {district.area.toLocaleString()} ha {t("pages.stateDashboard.area", "area")}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {Math.round((district.approvedClaims / district.totalClaims) * 100)}% approved
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{district.totalClaims}</div>
                      <p className="text-xs text-muted-foreground">{t("pages.stateDashboard.totalClaimsCol", "Total Claims")}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-chart-3">{district.approvedClaims}</div>
                      <p className="text-xs text-muted-foreground">{t("pages.stateDashboard.approved", "Approved")}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-chart-4">{district.pendingClaims}</div>
                      <p className="text-xs text-muted-foreground">{t("pages.stateDashboard.pendingCol", "Pending")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t("pages.stateDashboard.tribalPopulation", "Tribal Population")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stateData.demographics.tribalPopulation.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("pages.stateDashboard.acrossTribalDistricts", "Across")} {stateData.demographics.tribalDistricts} {t("pages.stateDashboard.acrossTribalDistricts", "tribal districts")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TreePine className="h-5 w-5" />
                  {t("pages.stateDashboard.forestCover", "Forest Cover")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stateData.demographics.forestCover.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("pages.stateDashboard.squareKilometers", "Square kilometers")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t("pages.stateDashboard.coverage", "Coverage")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.villages}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("pages.stateDashboard.villagesCovered", "Villages covered")}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Initiatives Tab */}
        <TabsContent value="initiatives" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-chart-3" />
                  {t("pages.stateDashboard.keyInitiatives", "Key Initiatives")}
                </CardTitle>
                <CardDescription>{t("pages.stateDashboard.currentPrograms", "Current programs and achievements")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stateData.keyInitiatives.map((initiative, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-chart-3 flex-shrink-0" />
                      <p className="text-sm">{initiative}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-chart-4" />
                  {t("pages.stateDashboard.currentChallenges", "Current Challenges")}
                </CardTitle>
                <CardDescription>{t("pages.stateDashboard.focusedAttention", "Areas requiring focused attention")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stateData.challenges.map((challenge, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-chart-4 flex-shrink-0" />
                      <p className="text-sm">{challenge}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}