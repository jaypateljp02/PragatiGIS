import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Zap,
  Download,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface OCRDocument {
  id: string;
  filename: string;
  originalFilename: string;
  ocrText: string;
  extractedData: {
    claimId?: string;
    claimantName?: string;
    location?: string;
    area?: string;
    landType?: string;
    dateSubmitted?: string;
  };
  confidence: number;
  reviewStatus: string;
  claimId?: string;
}

export default function OCRReviewPage() {
  const [selectedDoc, setSelectedDoc] = useState<OCRDocument | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedData, setEditedData] = useState<any>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch documents for OCR review
  const { data: documents = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/ocr-review'],
    queryFn: async () => {
      const response = await fetch('/api/ocr-review', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch OCR documents');
      }
      return response.json();
    }
  });

  // Update OCR data mutation
  const updateOCRMutation = useMutation({
    mutationFn: async ({ documentId, data }: { documentId: string, data: any }) => {
      const response = await fetch(`/api/documents/${documentId}/correct-ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Failed to update OCR data');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ocr-review'] });
      toast({
        title: "OCR data updated",
        description: "Document has been updated successfully",
      });
      setSelectedDoc(null);
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: "Failed to update OCR data",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (selectedDoc) {
      setEditedText(selectedDoc.ocrText);
      setEditedData(selectedDoc.extractedData);
    }
  }, [selectedDoc]);

  // Auto-select first document when documents load
  useEffect(() => {
    if (!selectedDoc && documents.length > 0) {
      setSelectedDoc(documents[0]);
    }
  }, [documents, selectedDoc]);

  const handleDocumentSelect = (doc: OCRDocument) => {
    setSelectedDoc(doc);
    setEditedText(doc.ocrText);
    setEditedData(doc.extractedData);
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

  const handleReprocess = async () => {
    if (!selectedDoc) return;
    
    setIsProcessing(true);
    
    // Simulate re-processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Re-processing Started",
      description: "Document is being re-processed with updated OCR algorithms.",
    });
    
    setIsProcessing(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading OCR documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ocr-review-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OCR Review & Validation</h1>
          <p className="text-muted-foreground">
            Review and correct automated text extraction from FRA documents
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-chart-4/10">
            {documents.filter((d: OCRDocument) => d.reviewStatus === 'pending').length} Pending Review
          </Badge>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

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

        {/* OCR Review Interface */}
        <div className="lg:col-span-2 space-y-6">
          {selectedDoc && (
            <>
              {/* Document Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        {selectedDoc.originalFilename}
                      </CardTitle>
                      <CardDescription>
                        Confidence: <span className={getConfidenceColor(selectedDoc.confidence)}>
                          {selectedDoc.confidence}%
                        </span> • Status: <span className="capitalize">{selectedDoc.reviewStatus}</span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleReprocess} disabled={isProcessing}>
                        <Zap className="h-4 w-4 mr-2" />
                        Re-process
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* OCR Text Review */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Original OCR Text</CardTitle>
                    <CardDescription>
                      Extracted text from the document (read-only)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64 w-full rounded-md border p-3">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {selectedDoc.ocrText}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Corrected Text</CardTitle>
                    <CardDescription>
                      Edit and correct any OCR mistakes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="h-64 font-mono text-sm resize-none"
                      placeholder="Edit the OCR text here..."
                      data-testid="textarea-ocr-correction"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Extracted Data Review */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extracted Data Fields</CardTitle>
                  <CardDescription>
                    Review and correct the structured data extracted from the document
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="claimId">Claim ID</Label>
                      <Input
                        id="claimId"
                        value={editedData.claimId || ''}
                        onChange={(e) => setEditedData((prev: any) => ({ ...prev, claimId: e.target.value }))}
                        data-testid="input-claim-id"
                      />
                    </div>

                    <div>
                      <Label htmlFor="claimantName">Claimant Name</Label>
                      <Input
                        id="claimantName"
                        value={editedData.claimantName || ''}
                        onChange={(e) => setEditedData((prev: any) => ({ ...prev, claimantName: e.target.value }))}
                        data-testid="input-claimant-name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={editedData.location || ''}
                        onChange={(e) => setEditedData((prev: any) => ({ ...prev, location: e.target.value }))}
                        data-testid="input-location"
                      />
                    </div>

                    <div>
                      <Label htmlFor="area">Area</Label>
                      <Input
                        id="area"
                        value={editedData.area || ''}
                        onChange={(e) => setEditedData((prev: any) => ({ ...prev, area: e.target.value }))}
                        data-testid="input-area"
                      />
                    </div>

                    <div>
                      <Label htmlFor="landType">Land Type</Label>
                      <Input
                        id="landType"
                        value={editedData.landType || ''}
                        onChange={(e) => setEditedData((prev: any) => ({ ...prev, landType: e.target.value }))}
                        data-testid="input-land-type"
                      />
                    </div>

                    <div>
                      <Label htmlFor="dateSubmitted">Date Submitted</Label>
                      <Input
                        id="dateSubmitted"
                        type="date"
                        value={editedData.dateSubmitted || ''}
                        onChange={(e) => setEditedData((prev: any) => ({ ...prev, dateSubmitted: e.target.value }))}
                        data-testid="input-date-submitted"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Button 
                    className="bg-chart-3 hover:bg-chart-3/90" 
                    onClick={handleApprove}
                    disabled={isProcessing}
                    data-testid="button-approve-ocr"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {isProcessing ? "Processing..." : "Approve & Save"}
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleReject}
                    disabled={isProcessing}
                    data-testid="button-reject-ocr"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button 
                    variant="outline"
                    disabled={isProcessing}
                    data-testid="button-flag-issues"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Flag Issues
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground flex items-center">
                  {selectedDoc.confidence < 80 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Low confidence - manual review recommended
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}