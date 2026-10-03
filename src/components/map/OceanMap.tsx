import { useEffect } from 'react';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface OceanMapProps {
  children?: React.ReactNode;
  center?: [number, number];
  zoom?: number;
}

export default function OceanMap({ 
  children, 
  center = [12.86, 80.35], // Default to Bay of Bengal
  zoom = 6 
}: OceanMapProps) {
  
  return (
    <div className="w-full h-full relative bg-abyssal">
      {/* Map overlay for extra depth */}
      <div className="absolute inset-0 pointer-events-none z-[400] shadow-[inset_0_0_80px_rgba(2,6,23,0.8)]"></div>
      
      <MapContainer 
        center={center} 
        zoom={zoom} 
        zoomControl={false}
        className="w-full h-full z-0"
        style={{ background: '#020617' }} // Matches abyssal
      >
        <ZoomControl position="bottomleft" />
        
        {/* CartoDB Dark Matter Base Map */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          className="map-tiles-dark"
        />
        
        {children}
      </MapContainer>
    </div>
  );
}
