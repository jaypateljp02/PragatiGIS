import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Image, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  extractedData?: {
    claimId?: string;
    claimantName?: string;
    location?: string;
    area?: string;
  };
}

interface DocumentUploadProps {
  onFilesUploaded?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
}

export default function DocumentUpload({ 
  onFilesUploaded, 
  maxFiles = 10,
  acceptedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff']
}: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    // Process files one by one
    for (const file of Array.from(selectedFiles)) {
      const fileId = Math.random().toString(36).substr(2, 9);
      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
        progress: 0
      };

      // Add file to state
      setFiles(prev => [...prev, newFile]);

      try {
        // Upload file to backend
        await uploadFileToBackend(file, fileId);
      } catch (error) {
        console.error('File upload failed:', error);
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'error', progress: 0 }
            : f
        ));
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive"
        });
      }
    }

    toast({
      title: "Files uploaded",
      description: `${selectedFiles.length} file(s) are being processed`,
    });

    onFilesUploaded?.(Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      progress: 0
    })));
  };

  const uploadFileToBackend = async (file: File, fileId: string) => {
    // Update progress to show upload starting
    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, progress: 10, status: 'uploading' }
        : f
    ));

    try {
      // Create form data for file upload
      const formData = new FormData();
      formData.append('document', file);

      // Upload the file using fetch directly since apiRequest may not handle FormData
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include' // Include cookies for authentication
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const uploadResponse = await response.json();

      // Update progress to show upload complete
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, progress: 50, status: 'processing' }
          : f
      ));

      // Start polling for OCR completion
      const documentId = uploadResponse.id;
      pollForOCRCompletion(documentId, fileId);

    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const pollForOCRCompletion = async (documentId: string, fileId: string) => {
    const maxAttempts = 30; // 30 seconds max
    let attempts = 0;

    const checkOCRStatus = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/ocr-results`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to check OCR status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.ocrStatus === 'completed') {
          // OCR is complete, update the file with extracted data
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { 
                  ...f, 
                  progress: 100, 
                  status: 'completed',
                  extractedData: result.extractedData
                }
              : f
          ));
          return;
        } else if (result.ocrStatus === 'failed') {
          // OCR failed
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error' }
              : f
          ));
          return;
        } else if (result.ocrStatus === 'processing') {
          // Still processing, update progress
          const progress = Math.min(50 + (attempts * 2), 90);
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, progress }
              : f
          ));
        }

        // Continue polling if not complete and haven't exceeded max attempts
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkOCRStatus, 1000); // Check every second
        } else {
          // Timeout
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error' }
              : f
          ));
        }
      } catch (error) {
        console.error('Error checking OCR status:', error);
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'error' }
            : f
        ));
      }
    };

    // Start the polling
    setTimeout(checkOCRStatus, 1000);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-chart-3" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'processing':
        return <FileText className="h-4 w-4 text-chart-2 animate-pulse" />;
      default:
        return <Upload className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors hover-elevate ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        data-testid="upload-area"
      >
        <CardContent className="p-8">
          <div
            className="text-center space-y-4"
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
          >
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Upload FRA Documents</h3>
              <p className="text-muted-foreground">
                Drag and drop files here, or click to select
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Supports PDF, JPEG, PNG, TIFF • Max {maxFiles} files
              </p>
            </div>
            <div className="flex gap-4 justify-center">
              <Button 
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-select-files"
              >
                Select Files
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  console.log('Bulk upload triggered');
                }}
                data-testid="button-bulk-upload"
              >
                Bulk Upload
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes.join(',')}
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            data-testid="file-input"
          />
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card data-testid="file-list">
          <CardHeader>
            <CardTitle>Processing Files</CardTitle>
            <CardDescription>
              {files.filter(f => f.status === 'completed').length} of {files.length} files processed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`file-item-${file.id}`}>
                <div className="flex-shrink-0">
                  {getStatusIcon(file.status)}
                </div>
                
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium truncate">{file.name}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        data-testid={`button-remove-${file.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {file.status === 'uploading' && (
                    <div className="space-y-1">
                      <Progress value={file.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">Uploading... {Math.round(file.progress)}%</p>
                    </div>
                  )}
                  
                  {file.status === 'processing' && (
                    <div className="space-y-1">
                      <Progress value={100} className="h-2" />
                      <p className="text-xs text-chart-2">Processing with OCR...</p>
                    </div>
                  )}
                  
                  {file.status === 'completed' && file.extractedData && (
                    <div className="bg-muted/50 p-3 rounded text-sm space-y-1">
                      <p className="font-medium text-chart-3">✓ Data Extracted Successfully</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div><strong>Claim ID:</strong> {file.extractedData.claimId}</div>
                        <div><strong>Area:</strong> {file.extractedData.area}</div>
                        <div><strong>Claimant:</strong> {file.extractedData.claimantName}</div>
                        <div><strong>Location:</strong> {file.extractedData.location}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}