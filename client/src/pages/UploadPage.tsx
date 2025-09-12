import DocumentUpload from "@/components/DocumentUpload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Zap, CheckCircle2 } from "lucide-react";

export default function UploadPage() {
  return (
    <div className="space-y-6" data-testid="upload-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Document Upload & OCR</h1>
        <p className="text-muted-foreground">
          Upload FRA documents for automated processing and data extraction
        </p>
      </div>

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
        onFilesUploaded={(files) => console.log('Files uploaded for processing:', files)}
        maxFiles={20}
        acceptedTypes={['.pdf', '.jpg', '.jpeg', '.png', '.tiff']}
      />
    </div>
  );
}