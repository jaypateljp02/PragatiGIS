import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface BulkUploadResult {
  message: string;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
  results: Array<{
    row: number;
    status: string;
    claimId?: string;
  }>;
  errors: string[];
}

export default function BulkUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<BulkUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/claims/bulk-import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data: BulkUploadResult) => {
      setResults(data);
      toast({
        title: "Bulk Import Completed",
        description: data.message,
      });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message,
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please select a CSV file.",
        });
        return;
      }
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleClear = () => {
    setFile(null);
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6" data-testid="bulk-upload">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Claims Import
          </CardTitle>
          <CardDescription>
            Upload a CSV file to import multiple FRA claims at once. The file should include columns for claimant name, location, district, state, area, and other claim details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileSelect}
              data-testid="input-file"
            />
          </div>

          {file && (
            <Alert data-testid="file-selected">
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <strong>Selected file:</strong> {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
              data-testid="button-upload"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload Claims"}
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={uploadMutation.isPending}
              data-testid="button-clear"
            >
              Clear
            </Button>
          </div>

          {uploadMutation.isPending && (
            <div className="space-y-2" data-testid="upload-progress">
              <Progress value={50} className="w-full" />
              <p className="text-sm text-muted-foreground">Processing claims data...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {results && (
        <Card data-testid="upload-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {results.summary.failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              Import Results
            </CardTitle>
            <CardDescription>
              Summary of the bulk import operation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{results.summary.total}</div>
                <div className="text-sm text-muted-foreground">Total Records</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{results.summary.successful}</div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{results.summary.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="space-y-2">
                <Label>Error Details</Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  {results.errors.map((error, index) => (
                    <div key={index} className="flex items-start gap-2 py-1">
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                {results.message}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>CSV Format Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Required columns:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>claimant_name (or claimantName, name)</li>
              <li>location (or village, village_name)</li>
              <li>district (or district_name)</li>
              <li>state (or state_name)</li>
              <li>area (or area_hectares, land_area) - in hectares</li>
            </ul>
            <p><strong>Optional columns:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>land_type (individual/community, defaults to individual)</li>
              <li>status (pending/approved/rejected, defaults to pending)</li>
              <li>family_members (number)</li>
              <li>date_submitted (YYYY-MM-DD format)</li>
              <li>notes (or remarks)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}