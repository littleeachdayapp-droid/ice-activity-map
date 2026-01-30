import { useState } from 'react';
import { Map } from './components/Map/Map';
import { FilterPanel } from './components/FilterPanel/FilterPanel';
import { ReportDetail } from './components/ReportDetail/ReportDetail';
import { ReportForm } from './components/ReportForm/ReportForm';
import { AdminDashboard } from './components/AdminDashboard/AdminDashboard';
import { Analytics } from './components/Analytics/Analytics';
import { EmailSubscription } from './components/EmailSubscription/EmailSubscription';
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
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [emailSubOpen, setEmailSubOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [colorByActivity, setColorByActivity] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    timeRange: 'all',
    activityTypes: ALL_ACTIVITY_TYPES
  });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  const { reports, loading, usingMockData, refetch, connected, newReportCount } = useReports(filters);

  return (
    <div className="h-screen w-screen relative">
      {/* Skip link for keyboard users */}
      <a
        href="#main-map"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[2000] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-blue-600 focus:font-medium"
      >
        Skip to map
      </a>

      {/* Header overlay */}
      <header className="absolute top-0 left-0 right-0 z-[1000] bg-gradient-to-b from-slate-900/80 to-transparent pointer-events-none">
        <div className="flex items-start justify-between p-4">
          <div className="pointer-events-auto">
            <h1 className="text-xl font-bold text-white">{t.appTitle}</h1>
            <p className="text-sm text-slate-300">{t.appSubtitle}</p>
          </div>
          <nav className="pointer-events-auto flex items-center gap-2" aria-label="Main navigation">
            <NotificationButton
              latitude={mapCenter?.lat}
              longitude={mapCenter?.lng}
            />
            <button
              onClick={() => setEmailSubOpen(true)}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Email Alerts"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
            <LanguageSelector />
            <button
              onClick={() => setAnalyticsOpen(true)}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={t.analytics?.title || 'Analytics'}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            <button
              onClick={() => setAdminOpen(true)}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={t.admin?.title || 'Admin'}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={t.filters || 'Filters'}
              aria-expanded={filterPanelOpen}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      {/* Map */}
      <main id="main-map" className="absolute inset-0" tabIndex={-1}>
        <Map
          reports={reports}
          onMarkerClick={setSelectedReport}
          onCenterChange={setMapCenter}
          showHeatmap={showHeatmap}
          colorByActivity={colorByActivity}
        />
      </main>

      {/* Filter panel */}
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        isOpen={filterPanelOpen}
        onToggle={() => setFilterPanelOpen(!filterPanelOpen)}
      />

      {/* View toggle (Markers/Heatmap) */}
      <div className="absolute top-20 right-4 z-[1000]" role="group" aria-label="Map view options">
        <div className="bg-white rounded-lg shadow-lg p-1 flex flex-col gap-1">
          <button
            onClick={() => setShowHeatmap(false)}
            className={`p-2 rounded transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !showHeatmap ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
            }`}
            aria-label="Marker View"
            aria-pressed={!showHeatmap}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setShowHeatmap(true)}
            className={`p-2 rounded transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              showHeatmap ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
            }`}
            aria-label="Heatmap View"
            aria-pressed={showHeatmap}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
          </button>
          {showHeatmap && (
            <button
              onClick={() => setColorByActivity(!colorByActivity)}
              className={`p-2 rounded transition-colors flex items-center gap-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                colorByActivity ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100 text-gray-600'
              }`}
              aria-label="Color by activity type"
              aria-pressed={colorByActivity}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Report count badge */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white px-3 py-2 rounded-lg shadow-lg" role="status" aria-live="polite">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {loading ? t.loading : `${reports.length} ${reports.length !== 1 ? t.reports : t.report}`}
          </span>
          {usingMockData && (
            <span className="text-xs text-amber-600">{t.demoData}</span>
          )}
          {!usingMockData && (
            <span className={`flex items-center gap-1 text-xs ${connected ? 'text-green-600' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} aria-hidden="true" />
              {connected ? 'Live' : 'Offline'}
            </span>
          )}
        </div>
        {newReportCount > 0 && (
          <div className="mt-1 text-xs text-blue-600" aria-live="polite">
            +{newReportCount} new report{newReportCount !== 1 ? 's' : ''} received
          </div>
        )}
      </div>

      {/* Submit report button */}
      <button
        onClick={() => setReportFormOpen(true)}
        className="absolute bottom-4 right-4 z-[1000] bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        aria-label={t.form?.submit || 'Submit Report'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t.form?.submit || 'Submit Report'}
      </button>

      {/* Report form modal */}
      {reportFormOpen && (
        <ReportForm
          onClose={() => setReportFormOpen(false)}
          onSubmitted={refetch}
          initialLocation={mapCenter}
        />
      )}

      {/* Admin dashboard modal */}
      {adminOpen && (
        <AdminDashboard onClose={() => setAdminOpen(false)} />
      )}

      {/* Analytics modal */}
      {analyticsOpen && (
        <Analytics onClose={() => setAnalyticsOpen(false)} />
      )}

      {/* Email subscription modal */}
      {emailSubOpen && (
        <EmailSubscription
          onClose={() => setEmailSubOpen(false)}
          latitude={mapCenter?.lat}
          longitude={mapCenter?.lng}
        />
      )}

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
