import { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Report, ACTIVITY_COLORS, ACTIVITY_LABELS } from '../../types/report';

interface ReportMarkerProps {
  report: Report;
  onClick: (report: Report) => void;
}

// Create a custom div icon that looks like a circle marker
function createMarkerIcon(color: string, opacity: number): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: ${color};
      opacity: ${opacity};
      border: 2px solid ${color};
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
}

export function ReportMarker({ report, onClick }: ReportMarkerProps) {
  const color = ACTIVITY_COLORS[report.activityType];

  // Calculate opacity based on recency (more recent = more opaque)
  const hoursAgo = (Date.now() - report.timestamp.getTime()) / (1000 * 60 * 60);
  const opacity = Math.max(0.4, 1 - (hoursAgo / 168) * 0.6); // 168 hours = 7 days

  const icon = useMemo(() => createMarkerIcon(color, opacity), [color, opacity]);

  return (
    <Marker
      position={[report.location.lat, report.location.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onClick(report)
      }}
    >
      <Popup>
        <div className="text-sm">
          <strong>{ACTIVITY_LABELS[report.activityType]}</strong>
          <br />
          {report.location.city}, {report.location.state}
        </div>
      </Popup>
    </Marker>
  );
}
