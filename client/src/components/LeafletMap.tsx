import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.divIcon({
  html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface ClaimData {
  id: string;
  claimId: string;
  claimantName: string;
  location: string;
  district: string;
  state: string;
  area: string;
  landType: string;
  status: string;
  dateSubmitted: Date;
  coordinates?: {
    type: 'Point' | 'Polygon';
    coordinates: number[] | number[][][];
  };
}

interface LeafletMapProps {
  claims: ClaimData[];
  selectedLayer: string;
  statusFilter: string;
  onClaimClick?: (claim: ClaimData) => void;
  height?: string;
}

export default function LeafletMap({ 
  claims, 
  selectedLayer, 
  statusFilter, 
  onClaimClick,
  height = '400px' 
}: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    mapRef.current = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629], // Center of India
      zoom: 5,
      zoomControl: true,
    });

    // Add base layers
    const tileLayers = {
      street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }),
      satellite: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: © OpenTopoMap (CC-BY-SA)'
      }),
      terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: © OpenTopoMap (CC-BY-SA)'
      }),
      forest: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      })
    };

    // Set initial layer
    tileLayers.street.addTo(mapRef.current);

    // Initialize markers layer group
    markersRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update base layer when selectedLayer changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing layers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current!.removeLayer(layer);
      }
    });

    // Add new layer based on selection
    let newLayer: L.TileLayer;
    switch (selectedLayer) {
      case 'satellite':
        newLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles © Esri'
        });
        break;
      case 'terrain':
        newLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data: © OpenTopoMap (CC-BY-SA)'
        });
        break;
      case 'forest':
        newLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          opacity: 0.7
        });
        break;
      default:
        newLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        });
    }

    newLayer.addTo(mapRef.current);
  }, [selectedLayer]);

  // Update markers when claims or statusFilter changes
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    // Filter claims based on status
    const filteredClaims = claims.filter(claim => 
      statusFilter === 'all' || claim.status === statusFilter
    );

    // Add markers for filtered claims
    filteredClaims.forEach((claim) => {
      let marker: L.Marker | L.Polygon;
      
      if (claim.coordinates) {
        if (claim.coordinates.type === 'Point') {
          const [lng, lat] = claim.coordinates.coordinates as number[];
          
          // Create custom marker based on status
          const statusColors = {
            approved: '#10b981', // green
            pending: '#f59e0b',   // yellow
            rejected: '#ef4444',  // red
            'under-review': '#8b5cf6' // purple
          };
          
          const color = statusColors[claim.status as keyof typeof statusColors] || '#6b7280';
          
          const customIcon = L.divIcon({
            html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          marker = L.marker([lat, lng], { icon: customIcon });
        } else if (claim.coordinates.type === 'Polygon') {
          // Handle polygon coordinates for land boundaries
          const coordinates = claim.coordinates.coordinates[0] as number[][];
          const latLngs = coordinates.map(coord => [coord[1], coord[0]] as [number, number]);
          
          const statusColors = {
            approved: '#10b981',
            pending: '#f59e0b',
            rejected: '#ef4444',
            'under-review': '#8b5cf6'
          };
          
          const color = statusColors[claim.status as keyof typeof statusColors] || '#6b7280';
          
          marker = L.polygon(latLngs, {
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
            weight: 2
          });
        } else {
          return; // Skip if coordinates format is unknown
        }
      } else {
        // If no coordinates, try to place based on location name (mock coordinates)
        // In a real implementation, you'd geocode the location
        const mockLat = 20.5937 + (Math.random() - 0.5) * 10;
        const mockLng = 78.9629 + (Math.random() - 0.5) * 20;
        
        const statusColors = {
          approved: '#10b981',
          pending: '#f59e0b',
          rejected: '#ef4444',
          'under-review': '#8b5cf6'
        };
        
        const color = statusColors[claim.status as keyof typeof statusColors] || '#6b7280';
        
        const customIcon = L.divIcon({
          html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 1px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        marker = L.marker([mockLat, mockLng], { icon: customIcon });
      }

      // Add popup with claim information
      const popupContent = `
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 8px 0; font-weight: bold;">${claim.claimId}</h4>
          <p style="margin: 4px 0;"><strong>Claimant:</strong> ${claim.claimantName}</p>
          <p style="margin: 4px 0;"><strong>Location:</strong> ${claim.location}</p>
          <p style="margin: 4px 0;"><strong>District:</strong> ${claim.district}</p>
          <p style="margin: 4px 0;"><strong>State:</strong> ${claim.state}</p>
          <p style="margin: 4px 0;"><strong>Area:</strong> ${claim.area} hectares</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="text-transform: capitalize; font-weight: bold;">${claim.status}</span></p>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Add click handler
      marker.on('click', () => {
        onClaimClick?.(claim);
      });

      // Add to markers layer group
      markersRef.current!.addLayer(marker);
    });

    // Auto-fit map to show all markers if there are any
    if (filteredClaims.length > 0 && markersRef.current.getLayers().length > 0) {
      const group = L.featureGroup(markersRef.current.getLayers());
      mapRef.current.fitBounds(group.getBounds(), { padding: [10, 10] });
    }
  }, [claims, statusFilter, onClaimClick]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ height, width: '100%' }}
      data-testid="leaflet-map"
    />
  );
}