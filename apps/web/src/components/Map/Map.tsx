import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Report } from '../../types/report';
import { ReportMarker } from '../ReportMarker/ReportMarker';

interface MapProps {
  reports: Report[];
  onMarkerClick: (report: Report) => void;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
}

// Center of continental US
const US_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

function MapEventHandler({ onCenterChange }: { onCenterChange?: (center: { lat: number; lng: number }) => void }) {
  const map = useMap();

  useEffect(() => {
    // Report initial center
    const center = map.getCenter();
    onCenterChange?.({ lat: center.lat, lng: center.lng });
  }, [map, onCenterChange]);

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onCenterChange?.({ lat: center.lat, lng: center.lng });
    }
  });

  return null;
}

export function Map({ reports, onMarkerClick, onCenterChange }: MapProps) {
  return (
    <MapContainer
      center={US_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEventHandler onCenterChange={onCenterChange} />
      {reports.map(report => (
        <ReportMarker
          key={report.id}
          report={report}
          onClick={onMarkerClick}
        />
      ))}
    </MapContainer>
  );
}
