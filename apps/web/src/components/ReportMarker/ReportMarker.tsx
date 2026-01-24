import { CircleMarker, Popup } from 'react-leaflet';
import { Report, ACTIVITY_COLORS, ACTIVITY_LABELS } from '../../types/report';

interface ReportMarkerProps {
  report: Report;
  onClick: (report: Report) => void;
}

export function ReportMarker({ report, onClick }: ReportMarkerProps) {
  const color = ACTIVITY_COLORS[report.activityType];

  // Calculate opacity based on recency (more recent = more opaque)
  const hoursAgo = (Date.now() - report.timestamp.getTime()) / (1000 * 60 * 60);
  const opacity = Math.max(0.4, 1 - (hoursAgo / 168) * 0.6); // 168 hours = 7 days

  return (
    <CircleMarker
      center={[report.location.lat, report.location.lng]}
      radius={10}
      pathOptions={{
        fillColor: color,
        fillOpacity: opacity,
        color: color,
        weight: 2,
        opacity: 1
      }}
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
    </CircleMarker>
  );
}
