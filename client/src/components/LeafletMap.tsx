import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
  } | {
    latitude: number;
    longitude: number;
  };
}

interface LeafletMapProps {
  claims: ClaimData[];
  selectedLayer: string;
  statusFilter: string;
  onClaimClick?: (claim: ClaimData) => void;
  height?: string;
}

interface LeafletMapRef {
  zoomIn: () => void;
  zoomOut: () => void;
  toggleFullscreen: () => void;
}

const LeafletMap = forwardRef<LeafletMapRef, LeafletMapProps>(({ 
  claims, 
  selectedLayer, 
  statusFilter, 
  onClaimClick,
  height = '400px' 
}, ref) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const isFullscreenRef = useRef<boolean>(false);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (mapRef.current) {
        mapRef.current.zoomIn();
      }
    },
    zoomOut: () => {
      if (mapRef.current) {
        mapRef.current.zoomOut();
      }
    },
    toggleFullscreen: () => {
      if (!mapContainerRef.current) return;
      
      if (!isFullscreenRef.current) {
        // Enter fullscreen
        if (mapContainerRef.current.requestFullscreen) {
          mapContainerRef.current.requestFullscreen();
        } else if ((mapContainerRef.current as any).webkitRequestFullscreen) {
          (mapContainerRef.current as any).webkitRequestFullscreen();
        } else if ((mapContainerRef.current as any).msRequestFullscreen) {
          (mapContainerRef.current as any).msRequestFullscreen();
        }
        isFullscreenRef.current = true;
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
        isFullscreenRef.current = false;
      }
    }
  }), []);

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
    
    console.log(`Processing ${filteredClaims.length} filtered claims for map display`);
    console.log('Sample claims data:', filteredClaims.slice(0, 3).map(c => ({ 
      id: c.id, 
      coordinates: c.coordinates,
      location: c.location 
    })));

    // Add markers for filtered claims
    filteredClaims.forEach((claim) => {
      let marker: L.Marker | L.Polygon | null = null;
      
      if (claim.coordinates) {
        let lat: number | undefined, lng: number | undefined;
        
        // Parse coordinates safely
        try {
          const coords = claim.coordinates;
          
          // Check if it's GeoJSON format (has type property)
          if (coords && typeof coords === 'object' && 'type' in coords && coords.type) {
            // GeoJSON format
            if (coords.type === 'Point' && coords.coordinates) {
              [lng, lat] = coords.coordinates as number[];
            } else if (coords.type === 'Polygon' && coords.coordinates) {
              // Handle polygon coordinates for land boundaries
              const coordinates = coords.coordinates[0] as number[][];
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
            }
          } else if (coords && typeof coords === 'object' && 'latitude' in coords && 'longitude' in coords) {
            // Legacy format: { latitude: number, longitude: number }
            lat = coords.latitude;
            lng = coords.longitude;
          }
          
          // Create marker for Point coordinates (both GeoJSON Point and legacy format)
          if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
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
          }
        } catch (error) {
          console.warn('Error parsing coordinates for claim:', claim.id, error);
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

      // Create popup content safely to prevent XSS
      const popupContainer = L.DomUtil.create('div');
      popupContainer.style.minWidth = '200px';

      const title = L.DomUtil.create('h4', '', popupContainer);
      title.style.margin = '0 0 8px 0';
      title.style.fontWeight = 'bold';
      title.textContent = claim.claimId;

      const createField = (label: string, value: string) => {
        const p = L.DomUtil.create('p', '', popupContainer);
        p.style.margin = '4px 0';
        const strong = L.DomUtil.create('strong', '', p);
        strong.textContent = label + ': ';
        const span = L.DomUtil.create('span', '', p);
        span.textContent = value;
        return p;
      };

      createField('Claimant', claim.claimantName);
      createField('Location', claim.location);
      createField('District', claim.district);
      createField('State', claim.state);
      createField('Area', claim.area + ' hectares');
      
      const statusP = L.DomUtil.create('p', '', popupContainer);
      statusP.style.margin = '4px 0';
      const statusLabel = L.DomUtil.create('strong', '', statusP);
      statusLabel.textContent = 'Status: ';
      const statusSpan = L.DomUtil.create('span', '', statusP);
      statusSpan.style.textTransform = 'capitalize';
      statusSpan.style.fontWeight = 'bold';
      statusSpan.textContent = claim.status;

      // Only proceed if marker was successfully created
      if (marker) {
        marker.bindPopup(popupContainer);

        // Add click handler
        marker.on('click', () => {
          onClaimClick?.(claim);
        });

        // Add to markers layer group
        markersRef.current!.addLayer(marker);
      }
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
});

LeafletMap.displayName = 'LeafletMap';

export default LeafletMap;