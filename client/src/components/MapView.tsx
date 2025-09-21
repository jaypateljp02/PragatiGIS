import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Map, Layers, ZoomIn, ZoomOut, Maximize, Filter } from "lucide-react";
import LeafletMap from "@/components/LeafletMap";
import { type Claim } from "@/components/ClaimsTable";
import { useRef } from "react";

// Convert Claim to ClaimData format for map component
const convertClaimToMapData = (claim: Claim) => ({
  ...claim,
  claimId: claim.id || '', // Use id as claimId since it's not in the Claim type
  area: (claim.area || 0).toString(), // Convert number to string, fallback to 0
  dateSubmitted: new Date(claim.dateSubmitted || Date.now()),
  // Keep real coordinates from claim data if available
  coordinates: claim.coordinates || undefined
});

interface MapViewProps {
  onClaimClick?: (claim: Claim) => void;
}

export default function MapView({ onClaimClick }: MapViewProps) {
  const [selectedLayer, setSelectedLayer] = useState('satellite');
  const [statusFilter, setStatusFilter] = useState('all');
  const mapRef = useRef<any>(null);

  // Fetch claims data for mapping
  const { data: claims = [], isLoading, error } = useQuery<Claim[]>({
    queryKey: ['/api/claims', { format: 'detailed' }],
    enabled: true,
  });

  const filteredClaims = claims.filter(claim => 
    statusFilter === 'all' || claim.status === statusFilter
  );

  const getStatusCounts = () => {
    const approved = filteredClaims.filter(c => c.status === 'approved').length;
    const pending = filteredClaims.filter(c => c.status === 'pending').length;
    const rejected = filteredClaims.filter(c => c.status === 'rejected').length;
    return { approved, pending, rejected };
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-4">
      {/* Map Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Select value={selectedLayer} onValueChange={setSelectedLayer}>
            <SelectTrigger className="w-40" data-testid="select-map-layer">
              <Layers className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="satellite">Satellite</SelectItem>
              <SelectItem value="terrain">Terrain</SelectItem>
              <SelectItem value="street">Street Map</SelectItem>
              <SelectItem value="forest">Forest Cover</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Claims</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => mapRef.current?.zoomIn()}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => mapRef.current?.zoomOut()}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => mapRef.current?.toggleFullscreen()}
            data-testid="button-fullscreen"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <Card data-testid="map-container">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Interactive FRA Claims Map
          </CardTitle>
          <CardDescription>
            Geospatial visualization of Forest Rights Act claims across India
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">Loading map data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-4">
                <Map className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Failed to load map data</p>
              </div>
            </div>
          ) : (
            <LeafletMap 
              ref={mapRef}
              claims={filteredClaims.map(convertClaimToMapData)}
              selectedLayer={selectedLayer}
              statusFilter={statusFilter}
              onClaimClick={(claimData) => {
                // Find original claim by id and call the handler
                const originalClaim = claims.find(c => c.id === claimData.id);
                if (originalClaim) {
                  onClaimClick?.(originalClaim);
                }
              }}
              height="400px"
            />
          )}

          {/* Map Legend */}
          <div className="flex flex-wrap gap-4 mt-4 p-4 bg-muted/30 rounded">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{backgroundColor: '#10b981'}}></div>
              <span className="text-sm">Approved Claims</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{backgroundColor: '#f59e0b'}}></div>
              <span className="text-sm">Pending Review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{backgroundColor: '#ef4444'}}></div>
              <span className="text-sm">Rejected Claims</span>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              Showing {filteredClaims.length} claim(s) • {selectedLayer} layer
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{color: '#10b981'}}>
              {statusCounts.approved}
            </div>
            <div className="text-sm text-muted-foreground">Approved Claims</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{color: '#f59e0b'}}>
              {statusCounts.pending}
            </div>
            <div className="text-sm text-muted-foreground">Pending Review</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{color: '#ef4444'}}>
              {statusCounts.rejected}
            </div>
            <div className="text-sm text-muted-foreground">Rejected Claims</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}