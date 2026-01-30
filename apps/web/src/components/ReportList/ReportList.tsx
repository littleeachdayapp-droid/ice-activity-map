import { useState } from 'react';
import { ListReport, ACTIVITY_COLORS, ACTIVITY_LABELS } from '../../types/report';
import { useI18n } from '../../i18n';

interface ReportListProps {
  allReports: ListReport[];
  mappedCount: number;
  onClose: () => void;
  onSelectReport: (id: string) => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return '< 1h ago';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

export function ReportList({ allReports, mappedCount, onClose, onSelectReport }: ReportListProps) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="absolute top-0 left-0 h-full w-80 z-[1000] bg-white shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{t.reportList}</h2>
          <p className="text-xs text-gray-500">
            {mappedCount} {t.onMap} · {allReports.length} {t.totalReports}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={t.close}
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {allReports.length === 0 && (
          <p className="p-4 text-sm text-gray-400 text-center">{t.loading}</p>
        )}
        {allReports.map((report) => {
          const isExpanded = expandedId === report.id;
          const locationLabel = report.city && report.state
            ? `${report.city}, ${report.state}`
            : report.city || report.state || t.locationUnknown;

          return (
            <button
              key={report.id}
              className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                !report.hasLocation ? 'opacity-70' : ''
              }`}
              onClick={() => {
                if (report.hasLocation) {
                  onSelectReport(report.id);
                } else {
                  setExpandedId(isExpanded ? null : report.id);
                }
              }}
            >
              <div className="flex items-start gap-2">
                {/* Activity color dot */}
                <span
                  className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ACTIVITY_COLORS[report.activityType] }}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-800">
                      {ACTIVITY_LABELS[report.activityType]}
                    </span>
                    {!report.hasLocation && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">
                        {t.noMapPin}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{locationLabel}</p>
                  <p className="text-xs text-gray-700 mt-1">
                    {isExpanded ? report.description : truncate(report.description, 120)}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-400">{formatRelativeTime(report.timestamp)}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{report.sourceType}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
