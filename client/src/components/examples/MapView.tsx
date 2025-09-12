import MapView from '../MapView';

export default function MapViewExample() {
  return (
    <MapView 
      onClusterClick={(clusterId) => console.log('Viewing cluster:', clusterId)}
    />
  );
}