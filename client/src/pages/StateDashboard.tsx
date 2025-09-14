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
  // Get state from user context or URL params - for now using Maharashtra as example
  const stateCode = "OD"; // This would come from user authentication context

  const { data: stateStats, isLoading: statsLoading } = useQuery<StateStats>({
    queryKey: ['/api/dashboard/state', stateCode],
    enabled: true,
  });

  const { data: districts = [], isLoading: districtsLoading } = useQuery<DistrictData[]>({
    queryKey: ['/api/districts', stateCode],
    enabled: true,
  });

  const { data: stateInfo } = useQuery<StateSpecificInfo>({
    queryKey: ['/api/state-info', stateCode],
    enabled: true,
  });

  // Empty data - will be replaced with real data from API
  const mockStateStats: StateStats = {
    totalClaims: 0,
    approvedClaims: 0,
    pendingClaims: 0,
    rejectedClaims: 0,
    totalArea: 0,
    districts: 0,
    villages: 0,
    processing: 0
  };

  const mockDistricts: DistrictData[] = [];

  const mockStateInfo: StateSpecificInfo = {
    state: "Odisha",
    stateCode: "OD",
    demographics: {
      tribalPopulation: 0,
      forestCover: 0,
      tribalDistricts: 0
    },
    keyInitiatives: [],
    challenges: [],
    recentUpdates: []
  };

  const stats = stateStats || mockStateStats;
  const districtData = districts.length > 0 ? districts : mockDistricts;
  const stateData = stateInfo || mockStateInfo;
  
  const approvalRate = stats.totalClaims > 0 ? Math.round((stats.approvedClaims / stats.totalClaims) * 100) : 0;
  const avgProcessingTime = 0; // days - will come from API

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading state dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="state-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{stateData.state} Forest Rights Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive overview of Forest Rights Act implementation across the state
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10">
            State Code: {stateData.stateCode}
          </Badge>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClaims.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              0% change from last month
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-3">{approvalRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.approvedClaims.toLocaleString()} approved
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Area</CardTitle>
            <TreePine className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalArea.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">hectares recognized</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgProcessingTime} days</div>
            <p className="text-xs text-muted-foreground">
              average processing
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">State Overview</TabsTrigger>
          <TabsTrigger value="districts">District Analysis</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="initiatives">Initiatives</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Claims Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Claims Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-chart-3"></div>
                      Approved
                    </span>
                    <span className="font-medium">{stats.approvedClaims.toLocaleString()}</span>
                  </div>
                  <Progress value={(stats.approvedClaims / stats.totalClaims) * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-chart-4"></div>
                      Pending
                    </span>
                    <span className="font-medium">{stats.pendingClaims.toLocaleString()}</span>
                  </div>
                  <Progress value={(stats.pendingClaims / stats.totalClaims) * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-chart-2"></div>
                      Processing
                    </span>
                    <span className="font-medium">{stats.processing.toLocaleString()}</span>
                  </div>
                  <Progress value={(stats.processing / stats.totalClaims) * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-destructive"></div>
                      Rejected
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
                  Recent Updates
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
                        {district.name} District
                      </CardTitle>
                      <CardDescription>
                        {district.population.toLocaleString()} population • {district.area.toLocaleString()} ha area
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
                      <p className="text-xs text-muted-foreground">Total Claims</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-chart-3">{district.approvedClaims}</div>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-chart-4">{district.pendingClaims}</div>
                      <p className="text-xs text-muted-foreground">Pending</p>
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
                  Tribal Population
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stateData.demographics.tribalPopulation.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Across {stateData.demographics.tribalDistricts} tribal districts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TreePine className="h-5 w-5" />
                  Forest Cover
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stateData.demographics.forestCover.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Square kilometers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.villages}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Villages covered
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
                  Key Initiatives
                </CardTitle>
                <CardDescription>Current programs and achievements</CardDescription>
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
                  Current Challenges
                </CardTitle>
                <CardDescription>Areas requiring focused attention</CardDescription>
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