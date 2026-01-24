import { useState } from 'react';
import { Map } from './components/Map/Map';
import { FilterPanel } from './components/FilterPanel/FilterPanel';
import { ReportDetail } from './components/ReportDetail/ReportDetail';
import { LanguageSelector } from './components/LanguageSelector/LanguageSelector';
import { NotificationButton } from './components/NotificationButton/NotificationButton';
import { useReports } from './hooks/useReports';
import { Report, FilterState, ActivityType } from './types/report';
import { I18nProvider, useI18n } from './i18n';

const ALL_ACTIVITY_TYPES: ActivityType[] = ['raid', 'checkpoint', 'arrest', 'surveillance', 'other'];

function AppContent() {
  const { t } = useI18n();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    timeRange: 'all',
    activityTypes: ALL_ACTIVITY_TYPES
  });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  const { reports, loading, usingMockData } = useReports(filters);

  return (
    <div className="h-screen w-screen relative">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-gradient-to-b from-slate-900/80 to-transparent pointer-events-none">
        <div className="flex items-start justify-between p-4">
          <div className="pointer-events-auto">
            <h1 className="text-xl font-bold text-white">{t.appTitle}</h1>
            <p className="text-sm text-slate-300">{t.appSubtitle}</p>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <NotificationButton
              latitude={mapCenter?.lat}
              longitude={mapCenter?.lng}
            />
            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Map */}
      <Map
        reports={reports}
        onMarkerClick={setSelectedReport}
        onCenterChange={setMapCenter}
      />

      {/* Filter panel */}
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        isOpen={filterPanelOpen}
        onToggle={() => setFilterPanelOpen(!filterPanelOpen)}
      />

      {/* Report count badge */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white px-3 py-2 rounded-lg shadow-lg">
        <span className="text-sm font-medium text-gray-700">
          {loading ? t.loading : `${reports.length} ${reports.length !== 1 ? t.reports : t.report}`}
        </span>
        {usingMockData && (
          <span className="ml-2 text-xs text-amber-600">{t.demoData}</span>
        )}
      </div>

      {/* Report detail modal */}
      {selectedReport && (
        <ReportDetail
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

export default App;
