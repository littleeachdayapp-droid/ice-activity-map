import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { Report, ACTIVITY_COLORS } from '../../types/report';

// Extend Leaflet types
declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: HeatLayerOptions
  ): HeatLayer;

  interface HeatLayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: { [key: number]: string };
  }

  interface HeatLayer extends L.Layer {
    setLatLngs(latlngs: Array<[number, number, number?]>): this;
    addLatLng(latlng: [number, number, number?]): this;
    setOptions(options: HeatLayerOptions): this;
    redraw(): this;
  }
}

interface HeatmapLayerProps {
  reports: Report[];
  colorByActivity?: boolean;
}

// Calculate intensity based on report recency
function getIntensity(report: Report): number {
  const now = new Date();
  const hoursAgo = (now.getTime() - report.timestamp.getTime()) / (1000 * 60 * 60);

  // More recent = higher intensity
  if (hoursAgo < 24) return 1.0;
  if (hoursAgo < 72) return 0.8;
  if (hoursAgo < 168) return 0.6;
  if (hoursAgo < 720) return 0.4;
  return 0.2;
}

// Convert activity type to hex gradient color
function activityToGradient(activityType: Report['activityType']): { [key: number]: string } {
  const baseColor = ACTIVITY_COLORS[activityType];
  return {
    0.0: 'rgba(0, 0, 0, 0)',
    0.2: baseColor + '40',
    0.4: baseColor + '80',
    0.6: baseColor + 'B0',
    0.8: baseColor + 'E0',
    1.0: baseColor
  };
}

// Default gradient (red-yellow-red for urgency)
const DEFAULT_GRADIENT = {
  0.0: 'rgba(0, 0, 255, 0)',
  0.2: 'rgba(0, 255, 0, 0.3)',
  0.4: 'rgba(255, 255, 0, 0.5)',
  0.6: 'rgba(255, 128, 0, 0.7)',
  0.8: 'rgba(255, 64, 0, 0.85)',
  1.0: 'rgba(255, 0, 0, 1)'
};

export function HeatmapLayer({ reports, colorByActivity = false }: HeatmapLayerProps) {
  const map = useMap();
  const heatLayerRef = useRef<L.HeatLayer | null>(null);
  const activityLayersRef = useRef<Map<string, L.HeatLayer>>(new Map());

  useEffect(() => {
    if (colorByActivity) {
      // Create separate layers for each activity type
      const groupedReports = reports.reduce((acc, report) => {
        const type = report.activityType;
        if (!acc[type]) acc[type] = [];
        acc[type].push(report);
        return acc;
      }, {} as Record<string, Report[]>);

      // Remove old layers
      activityLayersRef.current.forEach(layer => {
        map.removeLayer(layer);
      });
      activityLayersRef.current.clear();

      // Create new layers for each activity type
      Object.entries(groupedReports).forEach(([activityType, activityReports]) => {
        const points: Array<[number, number, number]> = activityReports.map(report => [
          report.location.lat,
          report.location.lng,
          getIntensity(report)
        ]);

        if (points.length > 0) {
          const layer = L.heatLayer(points, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            max: 1.0,
            gradient: activityToGradient(activityType as Report['activityType'])
          });
          layer.addTo(map);
          activityLayersRef.current.set(activityType, layer);
        }
      });

      // Remove single layer if exists
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    } else {
      // Single heatmap layer
      const points: Array<[number, number, number]> = reports.map(report => [
        report.location.lat,
        report.location.lng,
        getIntensity(report)
      ]);

      // Remove activity-based layers
      activityLayersRef.current.forEach(layer => {
        map.removeLayer(layer);
      });
      activityLayersRef.current.clear();

      if (heatLayerRef.current) {
        heatLayerRef.current.setLatLngs(points);
      } else {
        heatLayerRef.current = L.heatLayer(points, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
          max: 1.0,
          gradient: DEFAULT_GRADIENT
        });
        heatLayerRef.current.addTo(map);
      }
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      activityLayersRef.current.forEach(layer => {
        map.removeLayer(layer);
      });
      activityLayersRef.current.clear();
    };
  }, [map, reports, colorByActivity]);

  return null;
}
