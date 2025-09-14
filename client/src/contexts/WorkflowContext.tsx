import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Workflow types
export interface WorkflowStep {
  id: string;
  stepName: string;
  stepOrder: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  progress: number;
  resourceId?: string;
  resourceType?: string;
  data?: any;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface WorkflowInstance {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'cancelled' | 'paused';
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  userId: string;
  metadata?: any;
  startedAt: string;
  completedAt?: string;
  lastActiveAt: string;
  steps?: WorkflowStep[];
  transitions?: any[];
}

export interface WorkflowTransition {
  id: string;
  workflowId: string;
  fromStepId?: string;
  toStepId: string;
  transitionType: 'auto' | 'manual' | 'conditional';
  data?: any;
  triggeredBy?: string;
}

// Workflow context interface
interface WorkflowContextType {
  // Current workflow state
  currentWorkflow: WorkflowInstance | null;
  isLoading: boolean;
  error: string | null;

  // Available workflows
  workflows: WorkflowInstance[];
  
  // Workflow management
  createWorkflow: (name: string, description?: string) => Promise<WorkflowInstance>;
  selectWorkflow: (workflowId: string) => void;
  continueWorkflow: (workflowId: string, fromStep: string) => Promise<void>;
  pauseWorkflow: (workflowId: string) => Promise<void>;
  
  // Step management
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => Promise<void>;
  completeStep: (stepName: string, data?: any, resourceId?: string, resourceType?: string) => Promise<void>;
  navigateToStep: (stepName: string) => void;
  
  // Data flow
  setStepData: (stepName: string, data: any) => void;
  getStepData: (stepName: string) => any;
  getWorkflowData: () => any;
  
  // Navigation helpers
  canNavigateToStep: (stepName: string) => boolean;
  getStepStatus: (stepName: string) => string;
  getStepProgress: (stepName: string) => number;
  getNextStep: () => string | null;
  getPreviousStep: () => string | null;
  
  // Refresh workflow data
  refreshWorkflow: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

// Step configuration
const WORKFLOW_STEPS = [
  { name: 'upload', label: 'Upload Documents', order: 1 },
  { name: 'process', label: 'OCR Processing', order: 2 },
  { name: 'review', label: 'Review & Approve', order: 3 },
  { name: 'claims', label: 'Claims Management', order: 4 },
  { name: 'map', label: 'Map Visualization', order: 5 },
  { name: 'dss', label: 'Decision Support', order: 6 },
  { name: 'reports', label: 'Generate Reports', order: 7 }
];

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch user workflows
  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<WorkflowInstance[]>({
    queryKey: ['/api/workflows'],
    refetchInterval: 10000, // Refresh every 10 seconds for active workflows
  });

  // Fetch current workflow details with steps
  const { data: workflowDetails, isLoading: detailsLoading } = useQuery<WorkflowInstance>({
    queryKey: ['/api/workflows', currentWorkflow?.id],
    enabled: !!currentWorkflow?.id,
    refetchInterval: 5000, // More frequent refresh for active workflow
  });

  const isLoading = workflowsLoading || detailsLoading;

  // Update current workflow when details change
  useEffect(() => {
    if (workflowDetails) {
      setCurrentWorkflow(workflowDetails);
    }
  }, [workflowDetails]);

  // Auto-select active workflow if none selected
  useEffect(() => {
    if (!currentWorkflow && workflows.length > 0) {
      const activeWorkflow = workflows.find(w => w.status === 'active');
      if (activeWorkflow) {
        setCurrentWorkflow(activeWorkflow);
      }
    }
  }, [workflows, currentWorkflow]);

  // Create workflow mutation
  const createWorkflowMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const response = await apiRequest('POST', '/api/workflows', { name, description });
      return response.json();
    },
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      setCurrentWorkflow(workflow);
      toast({
        title: "Workflow Created",
        description: `New workflow "${workflow.name}" has been started.`,
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to Create Workflow",
        description: "Could not create new workflow. Please try again.",
      });
    }
  });

  // Update workflow mutation
  const updateWorkflowMutation = useMutation({
    mutationFn: async ({ workflowId, updates }: { workflowId: string; updates: any }) => {
      const response = await apiRequest('PATCH', `/api/workflows/${workflowId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', currentWorkflow?.id] });
    }
  });

  // Update step mutation
  const updateStepMutation = useMutation({
    mutationFn: async ({ workflowId, stepId, updates }: { workflowId: string; stepId: string; updates: any }) => {
      const response = await apiRequest('PATCH', `/api/workflows/${workflowId}/steps/${stepId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', currentWorkflow?.id] });
    }
  });

  // Continue workflow mutation
  const continueWorkflowMutation = useMutation({
    mutationFn: async ({ workflowId, fromStep }: { workflowId: string; fromStep: string }) => {
      const response = await apiRequest('POST', `/api/workflows/${workflowId}/continue`, { fromStep });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', currentWorkflow?.id] });
      toast({
        title: "Workflow Continued",
        description: "You can now continue from where you left off.",
      });
    }
  });

  // Implementation functions
  const createWorkflow = async (name: string, description?: string): Promise<WorkflowInstance> => {
    const workflow = await createWorkflowMutation.mutateAsync({ name, description });
    return workflow;
  };

  const selectWorkflow = (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (workflow) {
      setCurrentWorkflow(workflow);
    }
  };

  const continueWorkflow = async (workflowId: string, fromStep: string) => {
    await continueWorkflowMutation.mutateAsync({ workflowId, fromStep });
  };

  const pauseWorkflow = async (workflowId: string) => {
    await updateWorkflowMutation.mutateAsync({
      workflowId,
      updates: { status: 'paused' }
    });
  };

  const updateStep = async (stepId: string, updates: Partial<WorkflowStep>) => {
    if (!currentWorkflow) return;
    
    await updateStepMutation.mutateAsync({
      workflowId: currentWorkflow.id,
      stepId,
      updates
    });
  };

  const completeStep = async (stepName: string, data?: any, resourceId?: string, resourceType?: string) => {
    if (!currentWorkflow?.steps) return;

    const step = currentWorkflow.steps.find(s => s.stepName === stepName);
    if (!step) return;

    const updates: any = {
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString()
    };

    if (data) updates.data = data;
    if (resourceId) updates.resourceId = resourceId;
    if (resourceType) updates.resourceType = resourceType;

    await updateStep(step.id, updates);

    // Auto-advance to next step
    const nextStepOrder = step.stepOrder + 1;
    const nextStep = currentWorkflow.steps.find(s => s.stepOrder === nextStepOrder);
    
    if (nextStep && nextStep.status === 'pending') {
      await updateStep(nextStep.id, {
        status: 'in_progress',
        startedAt: new Date().toISOString()
      });

      // Update workflow current step
      await updateWorkflowMutation.mutateAsync({
        workflowId: currentWorkflow.id,
        updates: { currentStep: nextStep.stepName }
      });
    }
  };

  const navigateToStep = (stepName: string) => {
    if (!canNavigateToStep(stepName)) {
      toast({
        variant: "destructive",
        title: "Cannot Navigate",
        description: "This step is not yet available. Complete previous steps first.",
      });
      return;
    }

    // Navigation will be handled by the route system
    const stepPaths: Record<string, string> = {
      'upload': '/documents',
      'process': '/documents',
      'review': '/documents', 
      'claims': '/claims',
      'map': '/maps',
      'dss': '/dss',
      'reports': '/reports'
    };

    const path = stepPaths[stepName];
    if (path) {
      window.location.href = path;
    }
  };

  const setStepData = (stepName: string, data: any) => {
    if (!currentWorkflow?.steps) return;

    const step = currentWorkflow.steps.find(s => s.stepName === stepName);
    if (step) {
      updateStep(step.id, { data: { ...step.data, ...data } });
    }
  };

  const getStepData = (stepName: string): any => {
    if (!currentWorkflow?.steps) return null;

    const step = currentWorkflow.steps.find(s => s.stepName === stepName);
    return step?.data || null;
  };

  const getWorkflowData = (): any => {
    if (!currentWorkflow?.steps) return {};

    const workflowData: any = {};
    currentWorkflow.steps.forEach(step => {
      if (step.data) {
        workflowData[step.stepName] = step.data;
      }
    });

    return workflowData;
  };

  const canNavigateToStep = (stepName: string): boolean => {
    if (!currentWorkflow?.steps) return false;

    const targetStep = currentWorkflow.steps.find(s => s.stepName === stepName);
    if (!targetStep) return false;

    // Can navigate to completed steps or current step
    if (targetStep.status === 'completed' || targetStep.status === 'in_progress') {
      return true;
    }

    // Can navigate to pending step if previous step is completed
    if (targetStep.status === 'pending' && targetStep.stepOrder > 1) {
      const previousStep = currentWorkflow.steps.find(s => s.stepOrder === targetStep.stepOrder - 1);
      return previousStep?.status === 'completed';
    }

    return targetStep.stepOrder === 1; // Can always navigate to first step
  };

  const getStepStatus = (stepName: string): string => {
    if (!currentWorkflow?.steps) return 'pending';

    const step = currentWorkflow.steps.find(s => s.stepName === stepName);
    return step?.status || 'pending';
  };

  const getStepProgress = (stepName: string): number => {
    if (!currentWorkflow?.steps) return 0;

    const step = currentWorkflow.steps.find(s => s.stepName === stepName);
    return step?.progress || 0;
  };

  const getNextStep = (): string | null => {
    if (!currentWorkflow?.steps) return null;

    const currentStepRecord = currentWorkflow.steps.find(s => s.stepName === currentWorkflow.currentStep);
    if (!currentStepRecord) return null;

    const nextStep = currentWorkflow.steps.find(s => s.stepOrder === currentStepRecord.stepOrder + 1);
    return nextStep?.stepName || null;
  };

  const getPreviousStep = (): string | null => {
    if (!currentWorkflow?.steps) return null;

    const currentStepRecord = currentWorkflow.steps.find(s => s.stepName === currentWorkflow.currentStep);
    if (!currentStepRecord || currentStepRecord.stepOrder <= 1) return null;

    const previousStep = currentWorkflow.steps.find(s => s.stepOrder === currentStepRecord.stepOrder - 1);
    return previousStep?.stepName || null;
  };

  const refreshWorkflow = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
    if (currentWorkflow) {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', currentWorkflow.id] });
    }
  };

  const value: WorkflowContextType = {
    currentWorkflow,
    isLoading,
    error,
    workflows,
    createWorkflow,
    selectWorkflow,
    continueWorkflow,
    pauseWorkflow,
    updateStep,
    completeStep,
    navigateToStep,
    setStepData,
    getStepData,
    getWorkflowData,
    canNavigateToStep,
    getStepStatus,
    getStepProgress,
    getNextStep,
    getPreviousStep,
    refreshWorkflow
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}

// Helper hook for step-specific operations
export function useWorkflowStep(stepName: string) {
  const workflow = useWorkflow();
  
  return {
    status: workflow.getStepStatus(stepName),
    progress: workflow.getStepProgress(stepName),
    data: workflow.getStepData(stepName),
    canNavigate: workflow.canNavigateToStep(stepName),
    complete: (data?: any, resourceId?: string, resourceType?: string) => 
      workflow.completeStep(stepName, data, resourceId, resourceType),
    setData: (data: any) => workflow.setStepData(stepName, data),
    navigate: () => workflow.navigateToStep(stepName)
  };
}

export const WORKFLOW_STEP_NAMES = WORKFLOW_STEPS.map(s => s.name);
export const WORKFLOW_STEP_LABELS = WORKFLOW_STEPS.reduce((acc, step) => {
  acc[step.name] = step.label;
  return acc;
}, {} as Record<string, string>);