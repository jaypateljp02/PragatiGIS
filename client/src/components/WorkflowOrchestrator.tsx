import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkflow, WORKFLOW_STEP_LABELS } from "@/contexts/WorkflowContext";
import { 
  PlayCircle, PauseCircle, CheckCircle2, Clock, AlertCircle, 
  ArrowRight, ArrowLeft, RotateCcw, Plus, FileText, Upload, 
  Eye, MapPin, Brain, Download, ChevronRight, Workflow,
  RefreshCw, Settings, Info
} from "lucide-react";

interface WorkflowOrchestratorProps {
  className?: string;
  showControls?: boolean;
  showProgress?: boolean;
  compact?: boolean;
}

export default function WorkflowOrchestrator({ 
  className = "", 
  showControls = true, 
  showProgress = true,
  compact = false 
}: WorkflowOrchestratorProps) {
  const {
    currentWorkflow,
    workflows,
    isLoading,
    createWorkflow,
    selectWorkflow,
    continueWorkflow,
    pauseWorkflow,
    navigateToStep,
    canNavigateToStep,
    getStepStatus,
    getStepProgress,
    getNextStep,
    getPreviousStep,
    refreshWorkflow
  } = useWorkflow();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDescription, setNewWorkflowDescription] = useState("");

  // Auto-refresh workflow data
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentWorkflow?.status === 'active') {
        refreshWorkflow();
      }
    }, 10000); // Refresh every 10 seconds for active workflows

    return () => clearInterval(interval);
  }, [currentWorkflow, refreshWorkflow]);

  const workflowSteps = [
    {
      id: 'upload',
      name: 'Upload Documents',
      description: 'Upload FRA documents for processing',
      icon: Upload,
      path: '/documents'
    },
    {
      id: 'process',
      name: 'OCR Processing',
      description: 'Automated text extraction',
      icon: FileText,
      path: '/documents'
    },
    {
      id: 'review',
      name: 'Review & Approve',
      description: 'Review extracted data accuracy',
      icon: Eye,
      path: '/documents'
    },
    {
      id: 'claims',
      name: 'Claims Management',
      description: 'Create and manage FRA claims',
      icon: CheckCircle2,
      path: '/claims'
    },
    {
      id: 'map',
      name: 'Map Visualization',
      description: 'Visualize claims on interactive map',
      icon: MapPin,
      path: '/maps'
    },
    {
      id: 'dss',
      name: 'Decision Support',
      description: 'AI-powered analysis and recommendations',
      icon: Brain,
      path: '/dss'
    },
    {
      id: 'reports',
      name: 'Generate Reports',
      description: 'Create comprehensive reports',
      icon: Download,
      path: '/reports'
    }
  ];

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-chart-3" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-chart-4 animate-pulse" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStepBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) return;

    try {
      await createWorkflow(newWorkflowName, newWorkflowDescription);
      setNewWorkflowName("");
      setNewWorkflowDescription("");
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  };

  const handleStepNavigation = (stepId: string) => {
    if (canNavigateToStep(stepId)) {
      navigateToStep(stepId);
    }
  };

  const calculateOverallProgress = (): number => {
    if (!currentWorkflow) return 0;
    return Math.round((currentWorkflow.completedSteps / currentWorkflow.totalSteps) * 100);
  };

  const getActiveWorkflows = () => workflows.filter(w => w.status === 'active');
  const getPausedWorkflows = () => workflows.filter(w => w.status === 'paused');
  const getCompletedWorkflows = () => workflows.filter(w => w.status === 'completed');

  if (compact) {
    return (
      <Card className={`${className}`} data-testid="workflow-orchestrator-compact">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              Current Workflow
            </CardTitle>
            {currentWorkflow && (
              <Badge variant={getStepBadgeVariant(currentWorkflow.status)}>
                {currentWorkflow.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentWorkflow ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{currentWorkflow.name}</span>
                  <span className="text-muted-foreground">
                    {currentWorkflow.completedSteps}/{currentWorkflow.totalSteps} steps
                  </span>
                </div>
                <Progress value={calculateOverallProgress()} className="h-2" />
              </div>
              
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {WORKFLOW_STEP_LABELS[currentWorkflow.currentStep] || currentWorkflow.currentStep}
                </Badge>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={refreshWorkflow}
                    data-testid="button-refresh-workflow"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => navigateToStep(currentWorkflow.currentStep)}
                    data-testid="button-continue-current-step"
                  >
                    Continue
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-3">No active workflow</p>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-create-workflow">
                    <Plus className="h-3 w-3 mr-1" />
                    Start New Workflow
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-workflow">
                  <DialogHeader>
                    <DialogTitle>Create New Workflow</DialogTitle>
                    <DialogDescription>
                      Start a new document processing workflow
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="workflow-name">Workflow Name</Label>
                      <Input
                        id="workflow-name"
                        value={newWorkflowName}
                        onChange={(e) => setNewWorkflowName(e.target.value)}
                        placeholder="e.g., Maharashtra FRA Claims - Batch 1"
                        data-testid="input-workflow-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="workflow-description">Description (Optional)</Label>
                      <Textarea
                        id="workflow-description"
                        value={newWorkflowDescription}
                        onChange={(e) => setNewWorkflowDescription(e.target.value)}
                        placeholder="Brief description of this workflow..."
                        data-testid="textarea-workflow-description"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCreateDialog(false)}
                        data-testid="button-cancel-create"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateWorkflow}
                        disabled={!newWorkflowName.trim()}
                        data-testid="button-confirm-create"
                      >
                        Create Workflow
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid="workflow-orchestrator">
      {/* Workflow Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-6 w-6" />
                Workflow Management
              </CardTitle>
              <CardDescription>
                Manage your document processing workflows from upload to report generation
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-2">
                <Workflow className="h-3 w-3" />
                {getActiveWorkflows().length} Active
              </Badge>
              {showControls && (
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-workflow">
                      <Plus className="h-4 w-4 mr-2" />
                      New Workflow
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="dialog-new-workflow">
                    <DialogHeader>
                      <DialogTitle>Create New Workflow</DialogTitle>
                      <DialogDescription>
                        Start a new document processing workflow to manage FRA claims
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="new-workflow-name">Workflow Name</Label>
                        <Input
                          id="new-workflow-name"
                          value={newWorkflowName}
                          onChange={(e) => setNewWorkflowName(e.target.value)}
                          placeholder="e.g., Maharashtra FRA Claims Processing - Q4 2024"
                          data-testid="input-new-workflow-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-workflow-description">Description (Optional)</Label>
                        <Textarea
                          id="new-workflow-description"
                          value={newWorkflowDescription}
                          onChange={(e) => setNewWorkflowDescription(e.target.value)}
                          placeholder="Brief description of this workflow batch..."
                          rows={3}
                          data-testid="textarea-new-workflow-description"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowCreateDialog(false)}
                          data-testid="button-cancel-new-workflow"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateWorkflow}
                          disabled={!newWorkflowName.trim()}
                          data-testid="button-create-new-workflow"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Workflow
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Current Workflow Status */}
      {currentWorkflow && (
        <Card data-testid="current-workflow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{currentWorkflow.name}</CardTitle>
                {currentWorkflow.description && (
                  <CardDescription>{currentWorkflow.description}</CardDescription>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={getStepBadgeVariant(currentWorkflow.status)}>
                  {currentWorkflow.status}
                </Badge>
                {showControls && (
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={refreshWorkflow}
                      data-testid="button-refresh"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    
                    {currentWorkflow.status === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => pauseWorkflow(currentWorkflow.id)}
                        data-testid="button-pause"
                      >
                        <PauseCircle className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {currentWorkflow.status === 'paused' && (
                      <Button 
                        size="sm" 
                        onClick={() => continueWorkflow(currentWorkflow.id, currentWorkflow.currentStep)}
                        data-testid="button-resume"
                      >
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Overall Progress */}
            {showProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Overall Progress</span>
                  <span className="text-muted-foreground">
                    {currentWorkflow.completedSteps}/{currentWorkflow.totalSteps} steps completed
                  </span>
                </div>
                <Progress value={calculateOverallProgress()} className="h-3" />
                <div className="text-xs text-muted-foreground">
                  {calculateOverallProgress()}% complete
                </div>
              </div>
            )}

            {/* Workflow Steps */}
            <div className="space-y-4">
              <h4 className="font-medium">Workflow Steps</h4>
              <div className="grid gap-3">
                {workflowSteps.map((step, index) => {
                  const stepStatus = getStepStatus(step.id);
                  const stepProgress = getStepProgress(step.id);
                  const canNavigate = canNavigateToStep(step.id);
                  const isCurrentStep = currentWorkflow.currentStep === step.id;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isCurrentStep 
                          ? 'bg-primary/5 border-primary/20' 
                          : canNavigate 
                            ? 'hover-elevate cursor-pointer' 
                            : 'opacity-60'
                      }`}
                      onClick={() => canNavigate && handleStepNavigation(step.id)}
                      data-testid={`workflow-step-${step.id}`}
                    >
                      {/* Step Number & Icon */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full border">
                          {getStepIcon(stepStatus)}
                        </div>
                        <div className="flex items-center gap-2">
                          <step.icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{step.name}</div>
                            <div className="text-xs text-muted-foreground">{step.description}</div>
                          </div>
                        </div>
                      </div>

                      {/* Step Status & Progress */}
                      <div className="flex items-center gap-2 ml-auto">
                        {stepStatus === 'in_progress' && stepProgress > 0 && (
                          <div className="flex items-center gap-2">
                            <Progress value={stepProgress} className="w-16 h-2" />
                            <span className="text-xs text-muted-foreground">{stepProgress}%</span>
                          </div>
                        )}
                        
                        <Badge variant={getStepBadgeVariant(stepStatus)} className="text-xs">
                          {stepStatus === 'in_progress' ? 'Active' : 
                           stepStatus === 'completed' ? 'Done' :
                           stepStatus === 'failed' ? 'Failed' : 'Pending'}
                        </Badge>
                        
                        {canNavigate && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation Controls */}
            {showControls && (
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    const prev = getPreviousStep();
                    if (prev) navigateToStep(prev);
                  }}
                  disabled={!getPreviousStep()}
                  data-testid="button-previous-step"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous Step
                </Button>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    Current: {WORKFLOW_STEP_LABELS[currentWorkflow.currentStep] || currentWorkflow.currentStep}
                  </Badge>
                </div>

                <Button
                  onClick={() => {
                    const next = getNextStep();
                    if (next) navigateToStep(next);
                  }}
                  disabled={!getNextStep()}
                  data-testid="button-next-step"
                >
                  Next Step
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Workflow Summary */}
      {!currentWorkflow && workflows.length > 0 && (
        <Card data-testid="workflow-summary">
          <CardHeader>
            <CardTitle>Your Workflows</CardTitle>
            <CardDescription>
              Select a workflow to continue or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workflows.map((workflow) => (
                <Card 
                  key={workflow.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => selectWorkflow(workflow.id)}
                  data-testid={`workflow-card-${workflow.id}`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={getStepBadgeVariant(workflow.status)}>
                          {workflow.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {workflow.completedSteps}/{workflow.totalSteps}
                        </span>
                      </div>
                      
                      <h4 className="font-medium">{workflow.name}</h4>
                      
                      {workflow.description && (
                        <p className="text-xs text-muted-foreground">{workflow.description}</p>
                      )}
                      
                      <Progress 
                        value={(workflow.completedSteps / workflow.totalSteps) * 100} 
                        className="h-2" 
                      />
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Current: {WORKFLOW_STEP_LABELS[workflow.currentStep] || workflow.currentStep}
                        </span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Workflows State */}
      {!currentWorkflow && workflows.length === 0 && !isLoading && (
        <Card className="text-center py-12" data-testid="no-workflows-state">
          <CardContent>
            <div className="space-y-4">
              <Workflow className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-medium">No workflows yet</h3>
                <p className="text-muted-foreground">
                  Create your first workflow to start processing FRA documents
                </p>
              </div>
              
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-first-workflow">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Workflow
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Your First Workflow</DialogTitle>
                    <DialogDescription>
                      Start processing FRA documents with a structured workflow
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="first-workflow-name">Workflow Name</Label>
                      <Input
                        id="first-workflow-name"
                        value={newWorkflowName}
                        onChange={(e) => setNewWorkflowName(e.target.value)}
                        placeholder="e.g., FRA Claims Processing - Batch 1"
                        data-testid="input-first-workflow-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="first-workflow-description">Description (Optional)</Label>
                      <Textarea
                        id="first-workflow-description"
                        value={newWorkflowDescription}
                        onChange={(e) => setNewWorkflowDescription(e.target.value)}
                        placeholder="Brief description of this workflow..."
                        rows={3}
                        data-testid="textarea-first-workflow-description"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCreateDialog(false)}
                        data-testid="button-cancel-first-workflow"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateWorkflow}
                        disabled={!newWorkflowName.trim()}
                        data-testid="button-confirm-first-workflow"
                      >
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Start Workflow
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="space-y-4">
              <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto animate-spin" />
              <p className="text-muted-foreground">Loading workflows...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}