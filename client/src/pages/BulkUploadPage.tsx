import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import BulkUpload from "@/components/BulkUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ArrowLeft, FileDown, Upload, Database } from "lucide-react";

export default function BulkUploadPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: recentImports, isLoading } = useQuery({
    queryKey: ['/api/audit-log', 'bulk_import_claim', refreshKey],
    queryFn: async () => {
      const response = await fetch('/api/audit-log?resourceType=claim', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch audit log');
      const logs = await response.json();
      return logs.filter((log: any) => log.action.includes('bulk_import')).slice(0, 10);
    },
  });

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const downloadTemplate = () => {
    const csvContent = `claimant_name,location,district,state,area,land_type,status,family_members,notes
John Doe,Village A,District 1,Madhya Pradesh,2.5,individual,pending,4,Sample claim for family land
Community Group,Village B,District 2,Odisha,10.0,community,pending,25,Community forest rights claim
Jane Smith,Village C,District 1,Telangana,1.8,individual,pending,3,Agricultural land claim`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'fra-claims-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="bulk-upload-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/claims">
            <Button variant="outline" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Claims
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Bulk Claims Management</h1>
            <p className="text-muted-foreground">Import and manage large volumes of FRA claims data</p>
          </div>
        </div>
        <Button 
          onClick={downloadTemplate} 
          variant="outline"
          data-testid="button-download-template"
        >
          <FileDown className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Claims
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Database className="h-4 w-4 mr-2" />
            Import History
          </TabsTrigger>
          <TabsTrigger value="guidelines" data-testid="tab-guidelines">
            Guidelines
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <BulkUpload onSuccess={handleUploadSuccess} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Import History</CardTitle>
              <CardDescription>
                View recent bulk import operations and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : recentImports && recentImports.length > 0 ? (
                <div className="space-y-4">
                  {recentImports.map((log: any) => (
                    <div key={log.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{log.action.replace('_', ' ').toUpperCase()}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            {log.changes?.imported ? 'Success' : 'Completed'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No recent import operations found.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guidelines" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Import Guidelines</CardTitle>
              <CardDescription>
                Best practices for importing legacy FRA claims data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Data Preparation</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Ensure all required fields are present and properly formatted</li>
                  <li>Use consistent naming conventions for locations and districts</li>
                  <li>Verify area measurements are in hectares</li>
                  <li>Check that dates are in YYYY-MM-DD format</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Data Quality</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Remove duplicate entries before import</li>
                  <li>Validate claimant names and contact information</li>
                  <li>Ensure geographic coordinates are accurate (if available)</li>
                  <li>Standardize status values (pending, approved, rejected, under-review)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Legacy Data Handling</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Map old field names to new standardized format</li>
                  <li>Convert legacy claim IDs to new FRA format</li>
                  <li>Preserve historical processing dates and notes</li>
                  <li>Maintain audit trail for data transformation</li>
                </ul>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Note:</strong> Large files (&gt;10,000 records) should be split into smaller batches for optimal processing performance.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}