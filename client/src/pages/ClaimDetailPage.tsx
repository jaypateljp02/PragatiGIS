import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  MapPin, 
  User, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Download,
  Edit,
  ArrowLeft,
  Users
} from "lucide-react";
import { Link } from "wouter";

interface ClaimDetail {
  id: string;
  claimId: string;
  claimantName: string;
  location: string;
  district: string;
  state: string;
  area: number;
  landType: string;
  status: string;
  dateSubmitted: string;
  dateProcessed?: string;
  familyMembers?: number;
  coordinates?: any;
  notes?: string;
  assignedOfficer?: string;
}

interface Document {
  id: string;
  filename: string;
  fileType: string;
  ocrStatus: string;
  reviewStatus: string;
  uploadedBy: string;
  createdAt: string;
}

export default function ClaimDetailPage() {
  const [match, params] = useRoute("/claims/:id");
  const { toast } = useToast();

  const { data: claim, isLoading: claimLoading, error: claimError } = useQuery<ClaimDetail>({
    queryKey: ['/api/claims', params?.id],
    enabled: !!params?.id,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents', params?.id],
    enabled: !!params?.id,
  });

  const approveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/claims/${params?.id}/approve`, {
      method: 'POST',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/claims', params?.id] });
      toast({
        title: "Claim Approved",
        description: "The claim has been successfully approved.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: "Failed to approve the claim. Please try again.",
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { reason: string }) => apiRequest(`/api/claims/${params?.id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/claims', params?.id] });
      toast({
        title: "Claim Rejected",
        description: "The claim has been rejected with the provided reason.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Rejection Failed",
        description: "Failed to reject the claim. Please try again.",
      });
    }
  });

  const handleApprove = () => {
    approveMutation.mutate();
  };

  const handleReject = () => {
    // For now, reject with a default reason
    rejectMutation.mutate({ reason: "Insufficient documentation provided" });
  };

  const isLoading = claimLoading || documentsLoading;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-chart-3 text-chart-3-foreground';
      case 'pending': return 'bg-chart-4 text-chart-4-foreground'; 
      case 'rejected': return 'bg-destructive text-destructive-foreground';
      case 'under-review': return 'bg-chart-2 text-chart-2-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'under-review': return <Clock className="h-4 w-4" />;
      case 'pending': return <AlertTriangle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading claim details...</p>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="text-center space-y-4 min-h-96 flex flex-col justify-center">
        <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Claim Not Found</h2>
        <p className="text-muted-foreground">The requested claim could not be found.</p>
        <Link href="/claims">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Claims
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="claim-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/claims">
            <Button variant="outline" size="sm" data-testid="button-back-to-claims">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Claims
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{claim.claimId}</h1>
            <p className="text-muted-foreground">{claim.claimantName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(claim.status)} data-testid="claim-status-badge">
            {getStatusIcon(claim.status)}
            <span className="ml-1 capitalize">{claim.status.replace('-', ' ')}</span>
          </Badge>
          <Button variant="outline" size="sm" data-testid="button-edit-claim">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm" data-testid="button-download-claim">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="timeline">Processing Timeline</TabsTrigger>
          <TabsTrigger value="location">Location & Maps</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Claim Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <dt className="font-medium text-sm text-muted-foreground">Claim ID</dt>
                  <dd className="font-mono text-sm">{claim.claimId}</dd>
                </div>
                <div>
                  <dt className="font-medium text-sm text-muted-foreground">Claimant</dt>
                  <dd>{claim.claimantName}</dd>
                </div>
                <div>
                  <dt className="font-medium text-sm text-muted-foreground">Land Type</dt>
                  <dd className="capitalize flex items-center gap-2">
                    {claim.landType === 'community' ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    {claim.landType} Rights
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-sm text-muted-foreground">Area</dt>
                  <dd>{claim.area} hectares</dd>
                </div>
                {claim.familyMembers && (
                  <div>
                    <dt className="font-medium text-sm text-muted-foreground">Family Members</dt>
                    <dd>{claim.familyMembers} members</dd>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <dt className="font-medium text-sm text-muted-foreground">Location</dt>
                  <dd>{claim.location}</dd>
                </div>
                <div>
                  <dt className="font-medium text-sm text-muted-foreground">District</dt>
                  <dd>{claim.district}</dd>
                </div>
                <div>
                  <dt className="font-medium text-sm text-muted-foreground">State</dt>
                  <dd>{claim.state}</dd>
                </div>
                {claim.coordinates && (
                  <div>
                    <dt className="font-medium text-sm text-muted-foreground">Coordinates</dt>
                    <dd className="font-mono text-sm">
                      {claim.coordinates.lat.toFixed(4)}, {claim.coordinates.lng.toFixed(4)}
                    </dd>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dates and Processing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Important Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <dt className="font-medium text-sm text-muted-foreground">Date Submitted</dt>
                  <dd>{new Date(claim.dateSubmitted).toLocaleDateString('en-IN')}</dd>
                </div>
                {claim.dateProcessed && (
                  <div>
                    <dt className="font-medium text-sm text-muted-foreground">Date Processed</dt>
                    <dd>{new Date(claim.dateProcessed).toLocaleDateString('en-IN')}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-sm text-muted-foreground">Days Since Submission</dt>
                  <dd>{Math.floor((Date.now() - new Date(claim.dateSubmitted).getTime()) / (1000 * 60 * 60 * 24))} days</dd>
                </div>
              </CardContent>
            </Card>

            {/* Officer and Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {claim.assignedOfficer && (
                  <div>
                    <dt className="font-medium text-sm text-muted-foreground">Assigned Officer</dt>
                    <dd className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">O</AvatarFallback>
                      </Avatar>
                      Officer ID: {claim.assignedOfficer}
                    </dd>
                  </div>
                )}
                {claim.notes && (
                  <div>
                    <dt className="font-medium text-sm text-muted-foreground">Notes</dt>
                    <dd className="text-sm">{claim.notes}</dd>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              className="bg-chart-3 hover:bg-chart-3/90" 
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              data-testid="button-approve-claim"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {approveMutation.isPending ? "Approving..." : "Approve Claim"}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              data-testid="button-reject-claim"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {rejectMutation.isPending ? "Rejecting..." : "Reject Claim"}
            </Button>
            <Button variant="outline" data-testid="button-request-info">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Request Additional Information
            </Button>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="grid gap-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium">{doc.filename}</h4>
                        <p className="text-sm text-muted-foreground">
                          Uploaded by {doc.uploadedBy} • {new Date(doc.createdAt).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${
                        doc.ocrStatus === 'completed' ? 'bg-chart-3/10' : 
                        doc.ocrStatus === 'processing' ? 'bg-chart-2/10' : 'bg-muted'
                      }`}>
                        OCR: {doc.ocrStatus}
                      </Badge>
                      <Badge variant="outline" className={`${
                        doc.reviewStatus === 'approved' ? 'bg-chart-3/10' :
                        doc.reviewStatus === 'rejected' ? 'bg-destructive/10' : 'bg-chart-4/10'
                      }`}>
                        Review: {doc.reviewStatus}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processing Timeline</CardTitle>
              <CardDescription>Complete history of this claim's processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { date: "2024-03-15", action: "Claim Submitted", status: "completed", user: "Village Officer" },
                  { date: "2024-03-16", action: "Documents Uploaded", status: "completed", user: "District Officer" },
                  { date: "2024-03-17", action: "Initial Review Started", status: "completed", user: "State Officer" },
                  { date: "2024-03-20", action: "Field Verification", status: "in-progress", user: "District Officer" },
                  { date: "TBD", action: "Final Approval", status: "pending", user: "State Administrator" }
                ].map((event, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className={`mt-1 h-3 w-3 rounded-full ${
                      event.status === 'completed' ? 'bg-chart-3' :
                      event.status === 'in-progress' ? 'bg-chart-2' : 'bg-muted'
                    }`}></div>
                    <div className="flex-1">
                      <h4 className="font-medium">{event.action}</h4>
                      <p className="text-sm text-muted-foreground">
                        {event.date} • {event.user}
                      </p>
                    </div>
                    <Badge variant="outline" className={`${
                      event.status === 'completed' ? 'bg-chart-3/10' :
                      event.status === 'in-progress' ? 'bg-chart-2/10' : 'bg-muted'
                    }`}>
                      {event.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location & Boundary Map
              </CardTitle>
              <CardDescription>
                Geospatial view of the claimed forest area
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center space-y-2">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-lg font-medium">Interactive Map View</p>
                  <p className="text-sm text-muted-foreground">
                    Detailed boundary mapping and satellite imagery
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}