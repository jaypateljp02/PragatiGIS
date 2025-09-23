import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Brain, FileText, Globe, MapPin, User, Calendar, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AIAnalysisResult {
  success: boolean;
  analysis?: {
    extractedText: string;
    documentType: string;
    confidence: number;
    language: string;
    extractedFields: {
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
    filename: string;
    fileType: string;
    summary: string;
  };
  error?: string;
}

export default function AIDocumentAnalyzer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file (JPG, PNG, TIFF)",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
      setAnalysis(null);
    }
  };

  const analyzeDocument = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    
    try {
      const formData = new FormData();
      formData.append('document', selectedFile);

      const response = await fetch('/api/ai/analyze-document', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      const result = await response.json() as AIAnalysisResult;

      setAnalysis(result);
      
      if (result.success) {
        toast({
          title: "Analysis complete",
          description: `Document analyzed with ${Math.round(result.analysis!.confidence * 100)}% confidence`,
        });
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      setAnalysis({
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      });
      toast({
        title: "Analysis failed",
        description: "Could not analyze the document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getLanguageBadgeColor = (language: string) => {
    const colors: Record<string, string> = {
      'English': 'bg-blue-100 text-blue-800',
      'Hindi': 'bg-orange-100 text-orange-800',
      'Odia': 'bg-purple-100 text-purple-800',
      'Telugu': 'bg-green-100 text-green-800',
      'Bengali': 'bg-pink-100 text-pink-800',
      'Gujarati': 'bg-yellow-100 text-yellow-800'
    };
    return colors[language] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="ai-document-analyzer">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Document Analyzer
          </CardTitle>
          <CardDescription>
            Upload FRA documents for intelligent analysis using Google Gemini AI. 
            Supports multi-language extraction in Hindi, Odia, Telugu, Bengali, Gujarati, and English.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
                data-testid="input-file-upload"
              />
            </div>
            <Button 
              onClick={analyzeDocument}
              disabled={!selectedFile || isAnalyzing}
              className="flex items-center gap-2"
              data-testid="button-analyze"
            >
              {isAnalyzing ? (
                <>
                  <Zap className="h-4 w-4 animate-pulse" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Analyze with AI
                </>
              )}
            </Button>
          </div>

          {selectedFile && (
            <div className="text-sm text-gray-600" data-testid="text-selected-file">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}

          {isAnalyzing && (
            <div className="space-y-2">
              <Progress value={undefined} className="w-full" />
              <p className="text-sm text-gray-600 text-center">
                AI is analyzing your document using advanced multi-language processing...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <Card data-testid="card-analysis-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Analysis Results
              {analysis.success && (
                <Badge variant="outline" className={getConfidenceColor(analysis.analysis!.confidence)}>
                  {Math.round(analysis.analysis!.confidence * 100)}% confidence
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {analysis.success && analysis.analysis ? (
              <>
                {/* Document Classification */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      Document Type
                    </div>
                    <Badge variant="secondary" data-testid="badge-document-type">
                      {analysis.analysis.documentType}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Globe className="h-4 w-4" />
                      Language
                    </div>
                    <Badge 
                      className={getLanguageBadgeColor(analysis.analysis.language)}
                      data-testid="badge-language"
                    >
                      {analysis.analysis.language}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Zap className="h-4 w-4" />
                      AI Confidence
                    </div>
                    <div className={`font-semibold ${getConfidenceColor(analysis.analysis.confidence)}`}>
                      {Math.round(analysis.analysis.confidence * 100)}%
                    </div>
                  </div>
                </div>

                {/* Extracted Fields */}
                {Object.keys(analysis.analysis.extractedFields).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Extracted Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analysis.analysis.extractedFields.claimNumber && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-600">Claim Number</div>
                          <div className="font-mono text-sm bg-gray-50 p-2 rounded" data-testid="text-claim-number">
                            {analysis.analysis.extractedFields.claimNumber}
                          </div>
                        </div>
                      )}
                      
                      {analysis.analysis.extractedFields.applicantName && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm font-medium text-gray-600">
                            <User className="h-3 w-3" />
                            Applicant Name
                          </div>
                          <div className="text-sm bg-gray-50 p-2 rounded" data-testid="text-applicant-name">
                            {analysis.analysis.extractedFields.applicantName}
                          </div>
                        </div>
                      )}
                      
                      {(analysis.analysis.extractedFields.state || analysis.analysis.extractedFields.district || analysis.analysis.extractedFields.village) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm font-medium text-gray-600">
                            <MapPin className="h-3 w-3" />
                            Location
                          </div>
                          <div className="text-sm bg-gray-50 p-2 rounded" data-testid="text-location">
                            {[
                              analysis.analysis.extractedFields.village,
                              analysis.analysis.extractedFields.district,
                              analysis.analysis.extractedFields.state
                            ].filter(Boolean).join(', ')}
                          </div>
                        </div>
                      )}
                      
                      {analysis.analysis.extractedFields.area && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-600">Land Area</div>
                          <div className="text-sm bg-gray-50 p-2 rounded" data-testid="text-area">
                            {analysis.analysis.extractedFields.area} hectares
                          </div>
                        </div>
                      )}
                      
                      {analysis.analysis.extractedFields.landType && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-600">Land Type</div>
                          <Badge variant="outline" data-testid="badge-land-type">
                            {analysis.analysis.extractedFields.landType}
                          </Badge>
                        </div>
                      )}
                      
                      {analysis.analysis.extractedFields.submissionDate && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm font-medium text-gray-600">
                            <Calendar className="h-3 w-3" />
                            Submission Date
                          </div>
                          <div className="text-sm bg-gray-50 p-2 rounded" data-testid="text-submission-date">
                            {analysis.analysis.extractedFields.submissionDate}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Document Summary */}
                {analysis.analysis.summary && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">AI Summary</h3>
                    <div className="bg-blue-50 p-4 rounded-lg" data-testid="text-summary">
                      <p className="text-sm leading-relaxed">{analysis.analysis.summary}</p>
                    </div>
                  </div>
                )}

                {/* Raw Extracted Text */}
                <details className="space-y-3">
                  <summary className="text-lg font-semibold cursor-pointer hover:text-blue-600">
                    View Extracted Text
                  </summary>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap" data-testid="text-extracted-text">
                      {analysis.analysis.extractedText}
                    </pre>
                  </div>
                </details>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-red-600 font-medium">Analysis Failed</div>
                <div className="text-sm text-gray-600 mt-2" data-testid="text-error">
                  {analysis.error || 'Unknown error occurred'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}