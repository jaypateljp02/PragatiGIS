import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Map, Layers, ZoomIn, ZoomOut, Maximize, Filter } from "lucide-react";

interface MapCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  status: 'approved' | 'pending' | 'rejected';
}

interface MapViewProps {
  clusters?: MapCluster[];
  onClusterClick?: (clusterId: string) => void;
}

export default function MapView({ clusters = [], onClusterClick }: MapViewProps) {
  const [selectedLayer, setSelectedLayer] = useState('satellite');
  const [statusFilter, setStatusFilter] = useState('all');

  // Mock clusters for demonstration //todo: remove mock functionality
  const defaultClusters: MapCluster[] = [
    { id: '1', lat: 20.5937, lng: 78.9629, count: 45, status: 'approved' },
    { id: '2', lat: 19.0760, lng: 72.8777, count: 23, status: 'pending' },
    { id: '3', lat: 28.7041, lng: 77.1025, count: 67, status: 'approved' },
    { id: '4', lat: 22.5726, lng: 88.3639, count: 12, status: 'rejected' },
    { id: '5', lat: 13.0827, lng: 80.2707, count: 34, status: 'pending' },
  ];

  const mapClusters = clusters.length > 0 ? clusters : defaultClusters;

  const filteredClusters = mapClusters.filter(cluster => 
    statusFilter === 'all' || cluster.status === statusFilter
  );

  const getClusterColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-chart-3';
      case 'pending': return 'bg-chart-4';
      case 'rejected': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

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
            onClick={() => console.log('Zoom in triggered')}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => console.log('Zoom out triggered')}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => console.log('Fullscreen triggered')}
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
          {/* Mock Map Area */}
          <div 
            className="relative w-full h-96 bg-muted rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/20"
            data-testid="map-placeholder"
          >
            {/* India Map Background Placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-chart-3/5"></div>
            
            {/* Claim Clusters */}
            {filteredClusters.map((cluster) => (
              <button
                key={cluster.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full text-white text-xs font-bold hover-elevate active-elevate-2 transition-transform ${getClusterColor(cluster.status)}`}
                style={{
                  left: `${((cluster.lng + 180) / 360) * 100}%`,
                  top: `${((90 - cluster.lat) / 180) * 100}%`,
                  width: Math.max(24, Math.min(48, cluster.count * 0.8)) + 'px',
                  height: Math.max(24, Math.min(48, cluster.count * 0.8)) + 'px',
                }}
                onClick={() => {
                  console.log(`Cluster ${cluster.id} clicked`);
                  onClusterClick?.(cluster.id);
                }}
                data-testid={`cluster-${cluster.id}`}
              >
                {cluster.count}
              </button>
            ))}

            {/* Map Center Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center p-4 bg-background/90 rounded-lg border shadow-sm">
                <Map className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Interactive Map View</p>
                <p className="text-xs text-muted-foreground">
                  Click clusters to view claim details
                </p>
              </div>
            </div>
          </div>

          {/* Map Legend */}
          <div className="flex flex-wrap gap-4 mt-4 p-4 bg-muted/30 rounded">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-chart-3"></div>
              <span className="text-sm">Approved Claims</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-chart-4"></div>
              <span className="text-sm">Pending Review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-destructive"></div>
              <span className="text-sm">Rejected Claims</span>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              Showing {filteredClusters.length} cluster(s) • {selectedLayer} layer
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-chart-3">
              {filteredClusters.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.count, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Approved Claims</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-chart-4">
              {filteredClusters.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.count, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Pending Review</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">
              {filteredClusters.filter(c => c.status === 'rejected').reduce((sum, c) => sum + c.count, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Rejected Claims</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}