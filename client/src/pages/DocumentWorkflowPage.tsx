import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Upload, Eye, CheckCircle2, Zap, RefreshCw, ArrowRight, Workflow, MapPin, Brain, Download, Info, Globe, Sparkles, FileSearch, Languages } from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import WorkflowOrchestrator from "@/components/WorkflowOrchestrator";
import ClaimsTable, { type Claim } from "@/components/ClaimsTable";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useWorkflow, useWorkflowStep } from "@/contexts/WorkflowContext";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";

interface OCRDocument {
  id: string;
  originalFilename: string;
  filename: string;
  uploadedAt: string;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  ocrText: string | null;
  extractedData: {
    // Legacy fields
    claimId?: string;
    claimantName?: string;
    location?: string;
    area?: string;
    date?: string;
    status?: string;
    // AI-enhanced fields
    documentType?: string;
    language?: string;
    confidence?: number;
    processingDate?: string;
    validationStatus?: string;
    fileInfo?: {
      originalName: string;
      fileType: string;
      fileSize: number;
    };
    extractedFields?: {
      claimNumber?: string;
      applicantName?: string;
      state?: string;
      district?: string;
      village?: string;
      area?: number;
      landType?: string;
      submissionDate?: string;
      status?: string;
    };
    extractedText?: string;
    summary?: string;
  } | null;
  confidence: number;
  reviewStatus: 'pending' | 'approved' | 'rejected';
}

export default function DocumentWorkflowPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("upload");
  const [selectedDoc, setSelectedDoc] = useState<OCRDocument | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedData, setEditedData] = useState<any>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWorkflowIntegration, setShowWorkflowIntegration] = useState(true);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Workflow integration
  const {
    currentWorkflow,
    canNavigateToStep,
    navigateToStep,
    getNextStep,
    completeStep,
    createWorkflow
  } = useWorkflow();

  // Workflow step hooks for different phases
  const uploadStep = useWorkflowStep('upload');
  const processStep = useWorkflowStep('process');
  const reviewStep = useWorkflowStep('review');

  // Fetch documents for OCR review
  const { data: documents = [], isLoading, refetch } = useQuery<OCRDocument[]>({
    queryKey: ['/api/ocr-review'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch claims data for claims management
  const { data: claims = [], isLoading: claimsLoading, error: claimsError } = useQuery<Claim[]>({
    queryKey: ['/api/claims', 'detailed'],
    queryFn: async () => {
      const response = await fetch('/api/claims?format=detailed', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch claims');
      return response.json();
    },
    enabled: true,
  });

  // Update OCR results mutation
  const updateOCRMutation = {
    mutateAsync: async ({ documentId, data }: { documentId: string; data: any }) => {
      const response = await fetch(`/api/documents/${documentId}/correct-ocr`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to update OCR data');
      }
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/ocr-review'] });
    }
  };

  const handleDocumentSelect = (doc: OCRDocument) => {
    setSelectedDoc(doc);
    setEditedText(doc.ocrText || "");
    setEditedData(doc.extractedData || {});
  };

  // Claims management functions
  const handleViewClaim = (id: string) => {
    setLocation(`/claims/${id}`);
  };

  const handleExportData = async () => {
    try {
      const response = await fetch('/api/claims/export', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `fra-claims-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Auto-create claim mutation
  const createClaimMutation = useMutation({
    mutationFn: async (claimData: any) => {
      const response = await apiRequest('POST', '/api/claims', claimData);
      return response.json();
    },
    onSuccess: (claim) => {
      toast({
        title: "Claim Created",
        description: `Claim ${claim.claimId} has been automatically created from approved document.`,
      });
      // Complete the review step and link the claim
      if (currentWorkflow) {
        reviewStep.complete(
          { claimId: claim.id, extractedData: editedData },
          claim.id,
          'claim'
        );
      }
    },
    onError: (error) => {
      console.error('Auto-claim creation failed:', error);
      toast({
        variant: "destructive",
        title: "Claim Creation Failed",
        description: "Could not automatically create claim. You can create it manually in the Claims section.",
      });
    }
  });

  const handleApprove = async () => {
    if (!selectedDoc) return;
    
    setIsProcessing(true);
    try {
      await updateOCRMutation.mutateAsync({
        documentId: selectedDoc.id,
        data: {
          ocrText: editedText,
          extractedData: editedData,
          reviewStatus: 'approved'
        }
      });
      
      toast({
        title: "Document Approved",
        description: "OCR data has been approved and saved.",
      });

      // Auto-create claim if data is complete and workflow is active
      if (currentWorkflow && editedData.claimId && editedData.claimantName) {
        const claimData = {
          claimId: editedData.claimId,
          claimantName: editedData.claimantName,
          location: editedData.location || '',
          area: parseFloat(editedData.area || '0') || 0,
          status: 'pending_review',
          documentId: selectedDoc.id,
          source: 'ocr_extraction',
          extractedData: editedData
        };
        
        await createClaimMutation.mutateAsync(claimData);
      } else if (currentWorkflow) {
        // Just complete the review step without creating claim
        reviewStep.complete({ documentId: selectedDoc.id, extractedData: editedData });
      }
      
    } catch (error) {
      console.error('Approval failed:', error);
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: "Failed to approve the document. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDoc) return;
    
    setIsProcessing(true);
    try {
      await updateOCRMutation.mutateAsync({
        documentId: selectedDoc.id,
        data: {
          ocrText: editedText,
          extractedData: editedData,
          reviewStatus: 'rejected'
        }
      });
      toast({
        variant: "destructive",
        title: t("pages.documentWorkflow.documentRejected", "Document Rejected"),
        description: t("pages.documentWorkflow.rejectedMessage", "OCR data has been rejected and marked for re-processing."),
      });
    } catch (error) {
      console.error('Rejection failed:', error);
      toast({
        variant: "destructive",
        title: "Rejection Failed",
        description: "Failed to reject the document. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-chart-3";
    if (confidence >= 75) return "text-chart-4";
    return "text-destructive";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-chart-3';
      case 'rejected': return 'bg-destructive';
      default: return 'bg-chart-4';
    }
  };

  const getLanguageBadgeColor = (language: string) => {
    const colors: Record<string, string> = {
      'English': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'Hindi': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'Odia': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'Telugu': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'Bengali': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      'Gujarati': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    };
    return colors[language] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const isAIProcessed = (doc: OCRDocument) => {
    return doc.extractedData?.validationStatus === 'ai_processed' || 
           (doc.extractedData?.documentType && doc.extractedData?.documentType !== 'Unknown');
  };

  const getProcessingMethodIcon = (doc: OCRDocument) => {
    return isAIProcessed(doc) ? Brain : FileSearch;
  };

  const getProcessingMethodLabel = (doc: OCRDocument) => {
    return isAIProcessed(doc) ? 'AI Analysis' : 'Traditional OCR';
  };

  // Normalize confidence values to 0-100 scale consistently
  const getConfidencePercent = (doc: OCRDocument): number => {
    // Prefer AI confidence from extractedData (0-1 scale)
    if (doc.extractedData?.confidence !== undefined) {
      return Math.round(doc.extractedData.confidence * 100);
    }
    // Fallback to document confidence - handle both scales
    if (doc.confidence !== undefined) {
      return doc.confidence <= 1 ? Math.round(doc.confidence * 100) : Math.min(Math.max(doc.confidence, 0), 100);
    }
    return 0;
  };

  const pendingReviewCount = documents.filter((d: OCRDocument) => d.reviewStatus === 'pending').length;

  // Auto-create workflow if none exists and user uploads documents
  useEffect(() => {
    if (!currentWorkflow && documents.length > 0) {
      const hasNewDocuments = documents.some(d => d.ocrStatus === 'completed' && d.reviewStatus === 'pending');
      if (hasNewDocuments) {
        // Suggest creating a workflow
        setShowWorkflowIntegration(true);
      }
    }
  }, [documents, currentWorkflow]);

  // Update workflow step progress based on document processing
  useEffect(() => {
    if (currentWorkflow) {
      const totalDocs = documents.length;
      const processedDocs = documents.filter(d => d.ocrStatus === 'completed').length;
      const reviewedDocs = documents.filter(d => d.reviewStatus !== 'pending').length;
      
      if (totalDocs > 0) {
        // Update process step progress
        if (processedDocs > 0) {
          const processProgress = Math.round((processedDocs / totalDocs) * 100);
          const newProcessData = { 
            totalDocuments: totalDocs, 
            processedDocuments: processedDocs,
            progress: processProgress
          };
          
          // Only update if data has changed
          const currentProcessData = processStep.data;
          if (!currentProcessData || 
              currentProcessData.totalDocuments !== totalDocs ||
              currentProcessData.processedDocuments !== processedDocs ||
              currentProcessData.progress !== processProgress) {
            processStep.setData(newProcessData);
          }
        }
        
        // Update review step progress
        if (reviewedDocs > 0) {
          const reviewProgress = Math.round((reviewedDocs / totalDocs) * 100);
          const newReviewData = {
            totalDocuments: totalDocs,
            reviewedDocuments: reviewedDocs,
            progress: reviewProgress
          };
          
          // Only update if data has changed
          const currentReviewData = reviewStep.data;
          if (!currentReviewData ||
              currentReviewData.totalDocuments !== totalDocs ||
              currentReviewData.reviewedDocuments !== reviewedDocs ||
              currentReviewData.progress !== reviewProgress) {
            reviewStep.setData(newReviewData);
          }
        }
      }
    }
  }, [documents, currentWorkflow]);

  const handleCreateWorkflow = async () => {
    try {
      const workflow = await createWorkflow(
        `Document Processing - ${new Date().toLocaleDateString()}`,
        'Automated workflow for processing uploaded FRA documents'
      );
      setShowWorkflowIntegration(false);
      toast({
        title: t("pages.documentWorkflow.workflowStarted", "Workflow Started"),
        description: t("pages.documentWorkflow.workflowMessage", "Document processing workflow has been created."),
      });
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  };

  const getWorkflowStepStatus = () => {
    if (!currentWorkflow) return null;
    
    return {
      upload: uploadStep.status,
      process: processStep.status,
      review: reviewStep.status
    };
  };

  const getNextStepInfo = () => {
    const nextStep = getNextStep();
    const nextStepLabels = {
      'claims': { label: 'Claims Management', icon: CheckCircle2, path: '/claims' },
      'map': { label: 'Map Visualization', icon: MapPin, path: '/maps' },
      'dss': { label: 'Decision Support', icon: Brain, path: '/dss' },
      'reports': { label: 'Generate Reports', icon: Download, path: '/reports' }
    };
    
    return nextStep ? nextStepLabels[nextStep as keyof typeof nextStepLabels] : null;
  };

  return (
    <div className="space-y-6" data-testid="document-workflow-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.documentWorkflow.title", "Documents & Claims Management")}</h1>
          <p className="text-muted-foreground">
            {t("pages.documentWorkflow.subtitle", "Upload FRA documents, review OCR results, and manage claims in one unified workflow")}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {currentWorkflow && (
            <Badge variant="outline" className="gap-2">
              <Workflow className="h-3 w-3" />
              Workflow Active
            </Badge>
          )}
          <Badge variant="outline" className="bg-chart-4/10">
            {pendingReviewCount} Pending Review
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-documents">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Workflow Integration Panel */}
      {showWorkflowIntegration && !currentWorkflow && documents.length > 0 && (
        <Alert data-testid="workflow-suggestion-alert">
          <Workflow className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span>
              You have documents ready for processing. Create a workflow to track progress and enable seamless navigation to claims, mapping, and reports.
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowWorkflowIntegration(false)}
                data-testid="button-dismiss-workflow"
              >
                Dismiss
              </Button>
              <Button 
                size="sm" 
                onClick={handleCreateWorkflow}
                data-testid="button-create-workflow"
              >
                <Workflow className="h-3 w-3 mr-1" />
                Start Workflow
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Current Workflow Status */}
      {currentWorkflow && (
        <Card data-testid="workflow-status-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Processing documents through workflow steps
                </p>
                <div className="flex items-center gap-4 text-xs">
                  <span className={uploadStep.status === 'completed' ? 'text-chart-3' : 'text-muted-foreground'}>
                    ✓ Upload ({uploadStep.status})
                  </span>
                  <span className={processStep.status === 'completed' ? 'text-chart-3' : 'text-muted-foreground'}>
                    {processStep.status === 'completed' ? '✓' : '⋯'} Process ({processStep.status})
                  </span>
                  <span className={reviewStep.status === 'completed' ? 'text-chart-3' : 'text-muted-foreground'}>
                    {reviewStep.status === 'completed' ? '✓' : '⋯'} Review ({reviewStep.status})
                  </span>
                </div>
              </div>
              
              {getNextStepInfo() && canNavigateToStep(getNextStep()!) && (
                <Button 
                  onClick={() => navigateToStep(getNextStep()!)}
                  data-testid="button-next-workflow-step"
                >
                  Next: {getNextStepInfo()!.label}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Workflow Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {t("pages.documentWorkflow.uploadDocuments", "Upload Documents")}
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            OCR Review ({pendingReviewCount})
          </TabsTrigger>
          <TabsTrigger value="claims" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("pages.documentWorkflow.claimsManagement", "Claims Management")}
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-6">
          {/* Processing Steps */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">1. {t("pages.documentWorkflow.uploadDocuments", "Upload Documents")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t("pages.documentWorkflow.uploadDescription", "Support for PDF, JPEG, PNG, TIFF formats. Multi-language documents accepted.")}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-chart-2" />
                  <CardTitle className="text-lg">2. {t("pages.documentWorkflow.ocrProcessing", "OCR Processing")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t("pages.documentWorkflow.ocrDescription", "Automated text extraction in Hindi, Odia, Telugu, Bengali, Gujarati, and English.")}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-chart-3" />
                  <CardTitle className="text-lg">3. {t("pages.documentWorkflow.dataExtraction", "Data Extraction")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t("pages.documentWorkflow.extractionDescription", "Extract claim IDs, names, locations, areas, and other structured data.")}
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Upload Interface */}
          <DocumentUpload 
            onFilesUploaded={(files) => {
              console.log('Files uploaded for processing:', files);
              // Auto-switch to review tab after upload
              setTimeout(() => {
                setActiveTab("review");
                refetch(); // Refresh the documents list
              }, 2000);
            }}
            maxFiles={20}
            acceptedTypes={['.pdf', '.jpg', '.jpeg', '.png', '.tiff']}
          />
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review" className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">{t("pages.documentWorkflow.loadingDocuments", "Loading OCR documents...")}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Document List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t("pages.documentWorkflow.documents", "Documents")} ({documents.length})
                  </CardTitle>
                  <CardDescription>
                    {t("pages.documentWorkflow.clickToReview", "Click a document to review its OCR results")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {documents.map((doc: OCRDocument) => (
                        <div
                          key={doc.id}
                          className={`p-3 rounded-lg border cursor-pointer hover-elevate transition-colors ${
                            selectedDoc?.id === doc.id ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleDocumentSelect(doc)}
                          data-testid={`document-${doc.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm truncate">{doc.originalFilename}</h4>
                                {isAIProcessed(doc) && (
                                  <span title="AI Processed">
                                    <Sparkles className="h-3 w-3 text-purple-500 flex-shrink-0" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{doc.filename}</p>
                              
                              {/* AI Analysis Indicators */}
                              <div className="flex items-center gap-2 mt-1">
                                {doc.extractedData?.documentType && (
                                  <Badge variant="secondary" className="text-xs h-4 px-1" data-testid={`badge-document-type-${doc.id}`}>
                                    <FileText className="h-2 w-2 mr-1" />
                                    {doc.extractedData.documentType}
                                  </Badge>
                                )}
                                {doc.extractedData?.language && (
                                  <Badge variant="outline" className={`text-xs h-4 px-1 ${getLanguageBadgeColor(doc.extractedData.language)}`} data-testid={`badge-language-${doc.id}`}>
                                    <Globe className="h-2 w-2 mr-1" />
                                    {doc.extractedData.language}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge 
                                variant="outline" 
                                className={`${getStatusColor(doc.reviewStatus)} text-white text-xs`}
                              >
                                {doc.reviewStatus}
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {React.createElement(getProcessingMethodIcon(doc), { className: "h-3 w-3" })}
                                <span>{getProcessingMethodLabel(doc)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-2 flex items-center justify-between">
                            <span className={`text-xs font-medium ${getConfidenceColor(getConfidencePercent(doc))}`} data-testid={`text-confidence-${doc.id}`}>
                              {getConfidencePercent(doc)}{t("pages.documentWorkflow.confident", "% confident")}
                            </span>
                            <Progress value={getConfidencePercent(doc)} className="w-16 h-1" data-testid={`progress-confidence-${doc.id}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* OCR Review Panel */}
              <div className="lg:col-span-2 space-y-6">
                {selectedDoc ? (
                  <>
                    {/* Document Info with AI Analysis Results */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            {React.createElement(getProcessingMethodIcon(selectedDoc), { className: "h-5 w-5" })}
                            {selectedDoc.originalFilename}
                            {isAIProcessed(selectedDoc) && (
                              <span title="AI Processed">
                                <Sparkles className="h-4 w-4 text-purple-500" />
                              </span>
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${getStatusColor(selectedDoc.reviewStatus)} text-white`}>
                              {selectedDoc.reviewStatus}
                            </Badge>
                            <span className={`text-sm font-medium ${getConfidenceColor(getConfidencePercent(selectedDoc))}`} data-testid="text-confidence-detail">
                              {getConfidencePercent(selectedDoc)}% Confidence
                            </span>
                          </div>
                        </div>
                        
                        {/* AI Analysis Summary */}
                        {selectedDoc.extractedData && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                            {selectedDoc.extractedData.documentType && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                  <FileText className="h-3 w-3" />
                                  Document Type
                                </div>
                                <Badge variant="secondary" className="w-full justify-center" data-testid="badge-document-type-detail">
                                  {selectedDoc.extractedData.documentType}
                                </Badge>
                              </div>
                            )}
                            
                            {selectedDoc.extractedData.language && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                  <Globe className="h-3 w-3" />
                                  Language
                                </div>
                                <Badge className={`w-full justify-center ${getLanguageBadgeColor(selectedDoc.extractedData.language)}`} data-testid="badge-language-detail">
                                  {selectedDoc.extractedData.language}
                                </Badge>
                              </div>
                            )}
                            
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Zap className="h-3 w-3" />
                                Processing Method
                              </div>
                              <Badge variant="outline" className={`w-full justify-center ${isAIProcessed(selectedDoc) ? 'text-purple-700 border-purple-300 bg-purple-50' : 'text-blue-700 border-blue-300 bg-blue-50'}`} data-testid="badge-processing-method">
                                {getProcessingMethodLabel(selectedDoc)}
                              </Badge>
                            </div>
                            
                            {isAIProcessed(selectedDoc) && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                  <Brain className="h-3 w-3" />
                                  AI Confidence
                                </div>
                                <div className={`text-center font-semibold ${getConfidenceColor(getConfidencePercent(selectedDoc))}`} data-testid="text-ai-confidence">
                                  {getConfidencePercent(selectedDoc)}%
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="ocr-text">Extracted Text</Label>
                            <Textarea
                              id="ocr-text"
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              placeholder="OCR extracted text will appear here..."
                              className="min-h-32 mt-2"
                              data-testid="textarea-ocr-text"
                            />
                          </div>
                          
                          <div className="space-y-4">
                            <Label>Extracted Data</Label>
                            <div className="grid gap-3">
                              <div>
                                <Label htmlFor="claim-id" className="text-sm">Claim ID</Label>
                                <Input
                                  id="claim-id"
                                  value={editedData.claimId || editedData.extractedFields?.claimNumber || ""}
                                  onChange={(e) => setEditedData((prev: any) => ({ ...prev, claimId: e.target.value }))}
                                  placeholder="e.g., FRA/2024/001"
                                  className="mt-1"
                                  data-testid="input-claim-id"
                                />
                              </div>
                              <div>
                                <Label htmlFor="claimant-name" className="text-sm">Claimant Name</Label>
                                <Input
                                  id="claimant-name"
                                  value={editedData.claimantName || editedData.extractedFields?.applicantName || ""}
                                  onChange={(e) => setEditedData((prev: any) => ({ ...prev, claimantName: e.target.value }))}
                                  placeholder="Full name of claimant"
                                  className="mt-1"
                                  data-testid="input-claimant-name"
                                />
                              </div>
                              <div>
                                <Label htmlFor="location" className="text-sm">Location</Label>
                                <Input
                                  id="location"
                                  value={editedData.location || [
                                    editedData.extractedFields?.village,
                                    editedData.extractedFields?.district,
                                    editedData.extractedFields?.state
                                  ].filter(Boolean).join(', ') || ""}
                                  onChange={(e) => setEditedData((prev: any) => ({ ...prev, location: e.target.value }))}
                                  placeholder="Village, District, State"
                                  className="mt-1"
                                  data-testid="input-location"
                                />
                              </div>
                              <div>
                                <Label htmlFor="area" className="text-sm">Area (hectares)</Label>
                                <Input
                                  id="area"
                                  value={editedData.area || editedData.extractedFields?.area || ""}
                                  onChange={(e) => setEditedData((prev: any) => ({ ...prev, area: e.target.value }))}
                                  placeholder="e.g., 2.5"
                                  className="mt-1"
                                  data-testid="input-area"
                                />
                              </div>
                              
                              {/* Additional AI-extracted fields */}
                              {editedData.extractedFields?.landType && (
                                <div>
                                  <Label htmlFor="land-type" className="text-sm">Land Type</Label>
                                  <Input
                                    id="land-type"
                                    value={editedData.extractedFields.landType}
                                    onChange={(e) => setEditedData((prev: any) => ({ 
                                      ...prev, 
                                      extractedFields: { ...prev.extractedFields, landType: e.target.value }
                                    }))}
                                    placeholder="Individual/Community"
                                    className="mt-1"
                                    data-testid="input-land-type"
                                  />
                                </div>
                              )}
                              
                              {editedData.extractedFields?.submissionDate && (
                                <div>
                                  <Label htmlFor="submission-date" className="text-sm">Submission Date</Label>
                                  <Input
                                    id="submission-date"
                                    value={editedData.extractedFields.submissionDate}
                                    onChange={(e) => setEditedData((prev: any) => ({ 
                                      ...prev, 
                                      extractedFields: { ...prev.extractedFields, submissionDate: e.target.value }
                                    }))}
                                    placeholder="YYYY-MM-DD"
                                    className="mt-1"
                                    data-testid="input-submission-date"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* AI Summary Section */}
                        {selectedDoc.extractedData?.summary && (
                          <div className="mt-6 space-y-3">
                            <Label className="flex items-center gap-2 text-base font-semibold">
                              <Brain className="h-4 w-4 text-purple-500" />
                              AI Document Summary
                            </Label>
                            <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                              <p className="text-sm leading-relaxed text-purple-900 dark:text-purple-100" data-testid="text-ai-summary">
                                {selectedDoc.extractedData.summary}
                              </p>
                            </div>
                          </div>
                        )}
                        
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            Review the extracted text and data, make corrections if needed, then approve or reject.
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="destructive" 
                              onClick={handleReject}
                              disabled={isProcessing}
                              data-testid="button-reject"
                            >
                              {isProcessing ? 'Processing...' : 'Reject'}
                            </Button>
                            <Button 
                              onClick={handleApprove}
                              disabled={isProcessing}
                              data-testid="button-approve"
                            >
                              {isProcessing ? 'Processing...' : (currentWorkflow && editedData.claimId ? 'Approve & Create Claim' : 'Approve')}
                            </Button>
                          </div>
                        </div>
                        
                        {/* Workflow Integration Info */}
                        {currentWorkflow && selectedDoc && (
                          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2 text-sm">
                              <Info className="h-4 w-4 text-chart-2" />
                              <span className="font-medium">Workflow Integration:</span>
                              <span className="text-muted-foreground">
                                {editedData.claimId && editedData.claimantName 
                                  ? 'Approving will automatically create a new claim and advance to the next workflow step.'
                                  : 'Complete the extracted data to enable automatic claim creation.'
                                }
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">{t("pages.documentWorkflow.selectDocumentToReview", "Select a document to review")}</h3>
                        <p className="text-muted-foreground">
                          {t("pages.documentWorkflow.chooseFromList", "Choose a document from the list to view and edit its OCR results")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Claims Management Tab */}
        <TabsContent value="claims" className="space-y-6">
          {claimsLoading ? (
            <div className="flex items-center justify-center min-h-96" data-testid="claims-loading">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">{t("pages.documentWorkflow.loadingClaims", "Loading claims data...")}</p>
              </div>
            </div>
          ) : claimsError ? (
            <div className="space-y-4" data-testid="claims-error">
              <Alert variant="destructive">
                <AlertDescription>
                  {t("pages.documentWorkflow.failedToLoad", "Failed to load claims data. Please check your authentication and try again.")}
                </AlertDescription>
              </Alert>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
              >
                {t("pages.documentWorkflow.retry", "Retry")}
              </Button>
            </div>
          ) : (
            <div data-testid="claims-page" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{t("pages.documentWorkflow.claimsManagement", "Claims Management")}</h2>
                  <p className="text-muted-foreground">{t("pages.documentWorkflow.manageClaims", "Manage and review FRA claims across states")}</p>
                </div>
                <Button onClick={() => setLocation('/bulk-upload')} data-testid="button-bulk-upload">
                  <Upload className="h-4 w-4 mr-2" />
                  {t("pages.documentWorkflow.bulkUpload", "Bulk Upload")}
                </Button>
              </div>
              
              <ClaimsTable 
                claims={claims}
                onViewClaim={handleViewClaim}
                onExportData={handleExportData}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}