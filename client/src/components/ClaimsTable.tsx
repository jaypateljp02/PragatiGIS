import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Download, Eye } from "lucide-react";

export interface Claim {
  id: string;
  claimantName: string;
  location: string;
  district: string;
  state: string;
  area: number;
  status: 'pending' | 'approved' | 'rejected' | 'under-review';
  dateSubmitted: string;
  landType: 'individual' | 'community';
}

interface ClaimsTableProps {
  claims: Claim[];
  onViewClaim?: (claimId: string) => void;
  onExportData?: () => void;
}

const statusColors = {
  pending: 'default',
  approved: 'default',
  rejected: 'destructive',
  'under-review': 'secondary'
} as const;

const statusLabels = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  'under-review': 'Under Review'
};

export default function ClaimsTable({ claims, onViewClaim, onExportData }: ClaimsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const filteredClaims = claims.filter(claim => {
    const matchesSearch = claim.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         claim.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         claim.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    const matchesState = stateFilter === 'all' || claim.state === stateFilter;
    
    return matchesSearch && matchesStatus && matchesState;
  });

  const uniqueStates = Array.from(new Set(claims.map(claim => claim.state)));

  return (
    <Card data-testid="claims-table">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Forest Rights Claims</CardTitle>
            <CardDescription>
              Manage and review FRA claims across states
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
              console.log('Export data triggered');
              onExportData?.();
            }}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-4 pt-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search claims, names, or locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search"
              />
            </div>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="under-review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-40" data-testid="select-state-filter">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {uniqueStates.map(state => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim ID</TableHead>
                <TableHead>Claimant</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Area (Ha)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClaims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No claims found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredClaims.map((claim) => (
                  <TableRow key={claim.id} data-testid={`row-claim-${claim.id}`}>
                    <TableCell className="font-mono text-sm">
                      {claim.id}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{claim.claimantName}</div>
                        <div className="text-sm text-muted-foreground">{claim.district}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{claim.location}</div>
                        <div className="text-sm text-muted-foreground">{claim.state}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {claim.area.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[claim.status]} data-testid={`badge-status-${claim.status}`}>
                        {statusLabels[claim.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(claim.dateSubmitted).toLocaleDateString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {claim.landType === 'individual' ? 'Individual' : 'Community'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          console.log(`View claim ${claim.id} triggered`);
                          onViewClaim?.(claim.id);
                        }}
                        data-testid={`button-view-${claim.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
          <div>
            Showing {filteredClaims.length} of {claims.length} claims
          </div>
          <div>
            {searchTerm || statusFilter !== 'all' || stateFilter !== 'all' 
              ? 'Filters active' 
              : 'All data shown'
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}