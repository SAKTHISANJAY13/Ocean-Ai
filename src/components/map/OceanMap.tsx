import { MapContainer, TileLayer, ZoomControl, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface OceanMapProps {
  children?: React.ReactNode;
  center?: [number, number];
  zoom?: number;
}

export default function OceanMap({
  children,
  center = [12.86, 80.35],
  zoom = 6,
}: OceanMapProps) {

  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY;

  return (
    <div className="w-full h-full relative bg-abyssal">

      {/* Map overlay for extra depth */}
      <div className="absolute inset-0 pointer-events-none z-[400] shadow-[inset_0_0_80px_rgba(2,6,23,0.8)]" />

      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false}
        className="w-full h-full z-0"
        style={{ background: '#020617' }}
      >

        <ZoomControl position="bottomleft" />

        <LayersControl position="topright">

          {/* Dark operational map */}
          <LayersControl.BaseLayer
            checked
            name="ORIGIN Operational"
          >
            <TileLayer
              url={`https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${mapTilerKey}`}
              tileSize={512}
              zoomOffset={-1}
              attribution="© MapTiler © OpenStreetMap contributors"
              className="map-tiles-dark"
            />
          </LayersControl.BaseLayer>

          {/* Satellite imagery */}
          <LayersControl.BaseLayer
            name="Satellite"
          >
            <TileLayer
              url={`https://api.maptiler.com/tiles/satellite-v4/{z}/{x}/{y}.jpg?key=${mapTilerKey}`}
              attribution="© MapTiler © OpenStreetMap contributors"
            />
          </LayersControl.BaseLayer>

        </LayersControl>

        {children}

      </MapContainer>
    </div>
  );
}