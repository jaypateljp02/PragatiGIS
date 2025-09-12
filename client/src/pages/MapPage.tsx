import MapView from "@/components/MapView";

export default function MapPage() {
  return (
    <div className="space-y-4" data-testid="maps-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Interactive Maps</h1>
        <p className="text-muted-foreground">
          Geospatial visualization and analysis of Forest Rights Act claims
        </p>
      </div>
      
      <MapView 
        onClusterClick={(clusterId) => console.log('Viewing cluster details:', clusterId)}
      />
    </div>
  );
}