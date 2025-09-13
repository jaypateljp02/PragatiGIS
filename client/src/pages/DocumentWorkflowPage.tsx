import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Upload, Eye, CheckCircle2, Zap, RefreshCw, ArrowRight, Workflow, MapPin, Brain, Download, Info } from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import WorkflowOrchestrator from "@/components/WorkflowOrchestrator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useWorkflow, useWorkflowStep } from "@/contexts/WorkflowContext";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OCRDocument {
  id: string;
  originalFilename: string;
  filename: string;
  uploadedAt: string;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  ocrText: string | null;
  extractedData: {
    claimId?: string;
    claimantName?: string;
    location?: string;
    area?: string;
    date?: string;
    status?: string;
  } | null;
  confidence: number;
  reviewStatus: 'pending' | 'approved' | 'rejected';
}

export default function DocumentWorkflowPage() {
  const [activeTab, setActiveTab] = useState("upload");
  const [selectedDoc, setSelectedDoc] = useState<OCRDocument | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedData, setEditedData] = useState<any>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWorkflowIntegration, setShowWorkflowIntegration] = useState(true);
  const { toast } = useToast();

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

  // Auto-create claim mutation
  const createClaimMutation = useMutation({
    mutationFn: async (claimData: any) => {
      const response = await apiRequest('/api/claims', {
        method: 'POST',
        body: JSON.stringify(claimData),
      });
      return response;
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
        title: "Document Rejected",
        description: "OCR data has been rejected and marked for re-processing.",
      });
    } catch (error) {
      console.error('Rejection failed:', error);
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
          processStep.setData({ 
            totalDocuments: totalDocs, 
            processedDocuments: processedDocs,
            progress: processProgress
          });
        }
        
        // Update review step progress
        if (reviewedDocs > 0) {
          const reviewProgress = Math.round((reviewedDocs / totalDocs) * 100);
          reviewStep.setData({
            totalDocuments: totalDocs,
            reviewedDocuments: reviewedDocs,
            progress: reviewProgress
          });
        }
      }
    }
  }, [documents, currentWorkflow, processStep, reviewStep]);

  const handleCreateWorkflow = async () => {
    try {
      const workflow = await createWorkflow(
        `Document Processing - ${new Date().toLocaleDateString()}`,
        'Automated workflow for processing uploaded FRA documents'
      );
      setShowWorkflowIntegration(false);
      toast({
        title: "Workflow Started",
        description: "Document processing workflow has been created.",
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
          <h1 className="text-3xl font-bold tracking-tight">Document Upload & OCR Workflow</h1>
          <p className="text-muted-foreground">
            Upload FRA documents and review automated text extraction results
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Current Workflow: {currentWorkflow.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Step {currentWorkflow.completedSteps + 1} of {currentWorkflow.totalSteps}
                </Badge>
                <Progress 
                  value={(currentWorkflow.completedSteps / currentWorkflow.totalSteps) * 100} 
                  className="w-24 h-2" 
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Documents
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            OCR Review ({pendingReviewCount})
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
                  <CardTitle className="text-lg">1. Upload Documents</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Support for PDF, JPEG, PNG, TIFF formats. Multi-language documents accepted.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-chart-2" />
                  <CardTitle className="text-lg">2. OCR Processing</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Automated text extraction in Hindi, Odia, Telugu, Bengali, Gujarati, and English.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-chart-3" />
                  <CardTitle className="text-lg">3. Data Extraction</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Extract claim IDs, names, locations, areas, and other structured data.
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
                <p className="text-muted-foreground">Loading OCR documents...</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Document List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents ({documents.length})
                  </CardTitle>
                  <CardDescription>
                    Click a document to review its OCR results
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
                              <h4 className="font-medium text-sm truncate">{doc.originalFilename}</h4>
                              <p className="text-xs text-muted-foreground truncate">{doc.filename}</p>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={`${getStatusColor(doc.reviewStatus)} text-white text-xs`}
                            >
                              {doc.reviewStatus}
                            </Badge>
                          </div>
                          
                          <div className="mt-2 flex items-center justify-between">
                            <span className={`text-xs font-medium ${getConfidenceColor(doc.confidence)}`}>
                              {doc.confidence}% confident
                            </span>
                            <Progress value={doc.confidence} className="w-16 h-1" />
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
                    {/* Document Info */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {selectedDoc.originalFilename}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${getStatusColor(selectedDoc.reviewStatus)} text-white`}>
                              {selectedDoc.reviewStatus}
                            </Badge>
                            <span className={`text-sm font-medium ${getConfidenceColor(selectedDoc.confidence)}`}>
                              {selectedDoc.confidence}% Confidence
                            </span>
                          </div>
                        </div>
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
                                  value={editedData.claimId || ""}
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
                                  value={editedData.claimantName || ""}
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
                                  value={editedData.location || ""}
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
                                  value={editedData.area || ""}
                                  onChange={(e) => setEditedData((prev: any) => ({ ...prev, area: e.target.value }))}
                                  placeholder="e.g., 2.5"
                                  className="mt-1"
                                  data-testid="input-area"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
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
                        <h3 className="text-lg font-medium">Select a document to review</h3>
                        <p className="text-muted-foreground">
                          Choose a document from the list to view and edit its OCR results
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}