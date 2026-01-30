import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Report, ACTIVITY_COLORS } from '../../types/report';
import { ReportMarker } from '../ReportMarker/ReportMarker';
import { HeatmapLayer } from '../HeatmapLayer/HeatmapLayer';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface MapProps {
  reports: Report[];
  onMarkerClick: (report: Report) => void;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
  showHeatmap?: boolean;
  colorByActivity?: boolean;
}

// Center of continental US
const US_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

// Custom cluster icon that shows count and color based on cluster size
function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const childCount = cluster.getChildCount();

  // Determine size based on count
  let size = 'small';
  let dimensions = 30;
  if (childCount >= 100) {
    size = 'large';
    dimensions = 50;
  } else if (childCount >= 10) {
    size = 'medium';
    dimensions = 40;
  }

  // Color based on cluster size (more reports = more urgent color)
  let color = ACTIVITY_COLORS.other; // gray for small clusters
  if (childCount >= 50) {
    color = ACTIVITY_COLORS.raid; // red for large clusters
  } else if (childCount >= 20) {
    color = ACTIVITY_COLORS.checkpoint; // orange for medium-large
  } else if (childCount >= 5) {
    color = ACTIVITY_COLORS.arrest; // yellow for medium
  }

  return L.divIcon({
    html: `<div style="
      width: ${dimensions}px;
      height: ${dimensions}px;
      border-radius: 50%;
      background-color: ${color};
      opacity: 0.9;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: ${size === 'large' ? '14px' : size === 'medium' ? '12px' : '11px'};
    ">${childCount}</div>`,
    className: `marker-cluster marker-cluster-${size}`,
    iconSize: L.point(dimensions, dimensions)
  });
}

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

export function Map({ reports, onMarkerClick, onCenterChange, showHeatmap = false, colorByActivity = false }: MapProps) {
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
      {showHeatmap ? (
        <HeatmapLayer reports={reports} colorByActivity={colorByActivity} />
      ) : (
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={50}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          disableClusteringAtZoom={16}
        >
          {reports.map(report => (
            <ReportMarker
              key={report.id}
              report={report}
              onClick={onMarkerClick}
            />
          ))}
        </MarkerClusterGroup>
      )}
    </MapContainer>
  );
}
