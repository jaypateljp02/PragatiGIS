import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Eye, CheckCircle2, Zap, RefreshCw } from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

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
          <Badge variant="outline" className="bg-chart-4/10">
            {pendingReviewCount} Pending Review
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

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
                                  onChange={(e) => setEditedData((prev: any) => ({ ...prev, area: e.target.value })))
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
                              {isProcessing ? 'Processing...' : 'Approve'}
                            </Button>
                          </div>
                        </div>
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