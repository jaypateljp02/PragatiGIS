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
  const [documents, setDocuments] = useState<OCRDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<OCRDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [editedData, setEditedData] = useState<any>({});
  const { toast } = useToast();

  useEffect(() => {
    // Simulate loading OCR documents
    setTimeout(() => {
      const mockDocuments: OCRDocument[] = [
        {
          id: "doc-1",
          filename: "fra-claim-mp-001.pdf",
          originalFilename: "claim_form_ramesh_kumar.pdf",
          ocrText: "वन अधिकार दावा फॉर्म\nदावेदार का नाम: रमेश कुमार\nगाँव: मर्केगाँव\nजिला: गड़चिरौली\nराज्य: महाराष्ट्र\nभूमि क्षेत्रफल: 15.75 हेक्टेयर\nपारिवारिक सदस्य: 45\nदावा प्रकार: सामुदायिक वन अधिकार",
          extractedData: {
            claimId: "FRA-MH-2024-001234",
            claimantName: "रमेश कुमार", 
            location: "मर्केगाँव, गड़चिरौली",
            area: "15.75 हेक्टेयर",
            landType: "सामुदायिक",
            dateSubmitted: "2024-03-15"
          },
          confidence: 92.5,
          reviewStatus: "pending",
          claimId: "claim-1"
        },
        {
          id: "doc-2", 
          filename: "forest-certificate-or-002.jpg",
          originalFilename: "forest_rights_certificate.jpg",
          ocrText: "FOREST RIGHTS CERTIFICATE\nClaimant: Sita Devi\nVillage: Koraput Settlement\nDistrict: Koraput\nState: Odisha\nLand Area: 2.50 hectares\nFamily Members: 8\nType: Individual Forest Rights",
          extractedData: {
            claimId: "FRA-OR-2024-005678",
            claimantName: "Sita Devi",
            location: "Koraput Settlement, Koraput", 
            area: "2.50 hectares",
            landType: "Individual",
            dateSubmitted: "2024-06-22"
          },
          confidence: 88.3,
          reviewStatus: "pending",
          claimId: "claim-2"
        },
        {
          id: "doc-3",
          filename: "community-rights-tg-003.pdf", 
          originalFilename: "tribal_community_application.pdf",
          ocrText: "త్రైబల్ కమ్యూనిటీ అప్లికేషన్\nదరఖాస్తుదారుని పేరు: త్రైబల్ డెవలప్మెంట్ సొసైటీ\nగ్రామం: అదిలాబాద్ ఫారెస్ట్ ఏరియా\nజిల్లా: అదిలాబాద్\nరాష్ట్రం: తెలంగాణ\nభూమి విస్తీర్ణం: 45.20 హెక్టార్లు",
          extractedData: {
            claimId: "FRA-TG-2024-009876",
            claimantName: "Tribal Development Society",
            location: "Adilabad Forest Area, Adilabad",
            area: "45.20 hectares", 
            landType: "Community",
            dateSubmitted: "2024-02-10"
          },
          confidence: 76.8,
          reviewStatus: "pending",
          claimId: "claim-3"
        }
      ];

      setDocuments(mockDocuments);
      setSelectedDoc(mockDocuments[0]);
      setEditedText(mockDocuments[0].ocrText);
      setEditedData(mockDocuments[0].extractedData);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleDocumentSelect = (doc: OCRDocument) => {
    setSelectedDoc(doc);
    setEditedText(doc.ocrText);
    setEditedData(doc.extractedData);
  };

  const handleApprove = async () => {
    if (!selectedDoc) return;
    
    setIsProcessing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const updatedDocuments = documents.map(doc => 
      doc.id === selectedDoc.id 
        ? { ...doc, reviewStatus: 'approved', ocrText: editedText, extractedData: editedData }
        : doc
    );
    
    setDocuments(updatedDocuments);
    setSelectedDoc(prev => prev ? { ...prev, reviewStatus: 'approved', ocrText: editedText, extractedData: editedData } : null);
    setIsProcessing(false);
    
    toast({
      title: "Document Approved",
      description: "OCR data has been approved and saved to the claim record.",
    });
  };

  const handleReject = async () => {
    if (!selectedDoc) return;
    
    setIsProcessing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updatedDocuments = documents.map(doc => 
      doc.id === selectedDoc.id 
        ? { ...doc, reviewStatus: 'rejected' }
        : doc
    );
    
    setDocuments(updatedDocuments);
    setSelectedDoc(prev => prev ? { ...prev, reviewStatus: 'rejected' } : null);
    setIsProcessing(false);
    
    toast({
      variant: "destructive",
      title: "Document Rejected",
      description: "OCR data has been rejected and marked for re-processing.",
    });
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
            {documents.filter(d => d.reviewStatus === 'pending').length} Pending Review
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
                {documents.map((doc) => (
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