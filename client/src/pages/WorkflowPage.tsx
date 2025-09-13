import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import WorkflowOrchestrator from "@/components/WorkflowOrchestrator";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { 
  Workflow, BarChart3, Clock, CheckCircle2, AlertTriangle, 
  Activity, TrendingUp, Users, FileText, ArrowRight, 
  PlayCircle, PauseCircle, RotateCcw, Info, Lightbulb,
  Upload, MapPin, Brain, Download, Eye, RefreshCw
} from "lucide-react";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  estimatedTime: string;
  complexity: 'simple' | 'moderate' | 'complex';
  icon: any;
  steps: string[];
}

export default function WorkflowPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { workflows, currentWorkflow, isLoading } = useWorkflow();

  // Fetch workflow analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/workflows/analytics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Pre-defined workflow templates
  const workflowTemplates: WorkflowTemplate[] = [
    {
      id: 'standard',
      name: 'Standard FRA Processing',
      description: 'Complete document processing from upload to final report',
      estimatedTime: '2-4 hours',
      complexity: 'moderate',
      icon: FileText,
      steps: ['upload', 'process', 'review', 'claims', 'map', 'dss', 'reports']
    },
    {
      id: 'bulk',
      name: 'Bulk Document Processing',
      description: 'Process large batches of documents efficiently',
      estimatedTime: '4-8 hours',
      complexity: 'complex',
      icon: Upload,
      steps: ['upload', 'process', 'review', 'claims', 'reports']
    },
    {
      id: 'analysis',
      name: 'Data Analysis & Reporting',
      description: 'Focus on analysis and report generation for existing claims',
      estimatedTime: '1-2 hours',
      complexity: 'simple',
      icon: BarChart3,
      steps: ['claims', 'map', 'dss', 'reports']
    },
    {
      id: 'review',
      name: 'Review & Approval',
      description: 'Quick review and approval of processed documents',
      estimatedTime: '30-60 minutes',
      complexity: 'simple',
      icon: CheckCircle2,
      steps: ['review', 'claims', 'reports']
    }
  ];

  const getWorkflowStats = () => {
    const total = workflows.length;
    const active = workflows.filter(w => w.status === 'active').length;
    const completed = workflows.filter(w => w.status === 'completed').length;
    const paused = workflows.filter(w => w.status === 'paused').length;

    return { total, active, completed, paused };
  };

  const getRecentActivity = () => {
    // Mock recent activity - in real app this would come from audit logs
    const activities = [
      {
        id: '1',
        action: 'Workflow completed',
        workflow: 'Maharashtra FRA Claims - Batch 1',
        timestamp: '5 minutes ago',
        type: 'success'
      },
      {
        id: '2', 
        action: 'OCR processing started',
        workflow: 'Odisha Forest Rights - Q4',
        timestamp: '12 minutes ago',
        type: 'info'
      },
      {
        id: '3',
        action: 'Claims generated',
        workflow: 'Karnataka Tribal Claims',
        timestamp: '25 minutes ago',
        type: 'success'
      },
      {
        id: '4',
        action: 'Document review pending',
        workflow: 'West Bengal FRA - Batch 2',
        timestamp: '1 hour ago',
        type: 'warning'
      }
    ];

    return activities;
  };

  const getComplexityBadge = (complexity: string) => {
    switch (complexity) {
      case 'simple': return <Badge className="bg-chart-3">Simple</Badge>;
      case 'moderate': return <Badge className="bg-chart-4">Moderate</Badge>;
      case 'complex': return <Badge variant="destructive">Complex</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-chart-3" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-chart-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <Info className="h-4 w-4 text-chart-2" />;
    }
  };

  const stats = getWorkflowStats();
  const recentActivity = getRecentActivity();

  return (
    <div className="space-y-6" data-testid="workflow-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Management</h1>
          <p className="text-muted-foreground">
            Orchestrate your FRA document processing workflows from start to finish
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-2">
            <Activity className="h-3 w-3" />
            {stats.active} Active Workflows
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="stat-total-workflows">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time workflows created</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-active-workflows">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <PlayCircle className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-completed-workflows">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-3">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Successfully finished</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-average-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.avgCompletionTime ? `${analytics.avgCompletionTime}h` : '—'}
            </div>
            <p className="text-xs text-muted-foreground">Average time to complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">
            <Workflow className="h-4 w-4 mr-2" />
            Active Workflows
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <Lightbulb className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Activity className="h-4 w-4 mr-2" />
            Recent Activity
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Current Workflow Status */}
          {currentWorkflow ? (
            <Alert data-testid="current-workflow-alert">
              <Workflow className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between w-full">
                <span>
                  You have an active workflow: <strong>{currentWorkflow.name}</strong>
                </span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setActiveTab("active")}
                  data-testid="button-view-active"
                >
                  View Details
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert data-testid="no-active-workflow-alert">
              <Info className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between w-full">
                <span>No active workflow. Start a new one to begin processing documents.</span>
                <Button 
                  size="sm"
                  onClick={() => setActiveTab("templates")}
                  data-testid="button-start-workflow"
                >
                  Start New Workflow
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Workflow Process Overview */}
          <Card data-testid="process-overview">
            <CardHeader>
              <CardTitle>FRA Workflow Process</CardTitle>
              <CardDescription>
                Complete document processing workflow from upload to final reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: Upload, title: 'Upload', description: 'Upload FRA documents' },
                  { icon: Eye, title: 'Process & Review', description: 'OCR extraction and validation' },
                  { icon: MapPin, title: 'Visualize', description: 'Map claims and analysis' },
                  { icon: Download, title: 'Report', description: 'Generate final reports' }
                ].map((step, index) => (
                  <div key={index} className="text-center space-y-2">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto">
                      <step.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium">{step.title}</h4>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="success-rate">
              <CardHeader>
                <CardTitle className="text-lg">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-chart-3">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </div>
                <p className="text-sm text-muted-foreground">Workflows completed successfully</p>
              </CardContent>
            </Card>

            <Card data-testid="throughput">
              <CardHeader>
                <CardTitle className="text-lg">Weekly Throughput</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.completed}</div>
                <p className="text-sm text-muted-foreground">Workflows completed this week</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Active Workflows Tab */}
        <TabsContent value="active" className="space-y-6">
          <WorkflowOrchestrator 
            showControls={true} 
            showProgress={true}
            data-testid="workflow-orchestrator"
          />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card data-testid="workflow-templates">
            <CardHeader>
              <CardTitle>Workflow Templates</CardTitle>
              <CardDescription>
                Pre-configured workflows for common FRA processing scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {workflowTemplates.map((template) => (
                  <Card 
                    key={template.id} 
                    className="hover-elevate cursor-pointer"
                    data-testid={`template-${template.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <template.icon className="h-5 w-5 text-primary" />
                            <h4 className="font-medium">{template.name}</h4>
                          </div>
                          {getComplexityBadge(template.complexity)}
                        </div>
                        
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Est. Time: {template.estimatedTime}</span>
                          <span>{template.steps.length} steps</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {template.steps.map((step, index) => (
                            <div 
                              key={step}
                              className="w-2 h-2 rounded-full bg-primary/20"
                            />
                          ))}
                        </div>
                        
                        <Button className="w-full" size="sm">
                          <PlayCircle className="h-3 w-3 mr-1" />
                          Start Workflow
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card data-testid="recent-activity">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest workflow events and updates</CardDescription>
              </div>
              <Button variant="outline" size="sm" data-testid="button-refresh-activity">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div 
                    key={activity.id} 
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    data-testid={`activity-${activity.id}`}
                  >
                    {getActivityIcon(activity.type)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.workflow}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                  </div>
                ))}
                
                {recentActivity.length === 0 && (
                  <div className="text-center py-8">
                    <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}