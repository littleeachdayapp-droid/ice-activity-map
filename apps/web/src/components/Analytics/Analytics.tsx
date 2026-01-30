import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Stats {
  totalReports: number;
  last7Days: number;
  last30Days: number;
  byActivityType: Array<{ type: string; count: number }>;
  topStates: Array<{ state: string; count: number }>;
  timeline: Array<{ date: string; count: number }>;
  recentActivity: Array<{
    id: string;
    activityType: string;
    location: string;
    reportedAt: string;
  }>;
}

interface AnalyticsProps {
  onClose: () => void;
}

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  raid: '#ef4444',
  checkpoint: '#f97316',
  arrest: '#a855f7',
  surveillance: '#3b82f6',
  other: '#6b7280'
};

export function Analytics({ onClose }: AnalyticsProps) {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/stats`);
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getActivityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      raid: t.raid,
      checkpoint: t.checkpoint,
      arrest: t.arrest,
      surveillance: t.surveillance,
      other: t.other
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getMaxTimelineValue = () => {
    if (!stats?.timeline.length) return 1;
    return Math.max(...stats.timeline.map(d => d.count));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {t.analytics?.title || 'Analytics'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {stats && !loading && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.totalReports.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-800">
                    {t.analytics?.totalReports || 'Total Reports'}
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.last7Days.toLocaleString()}
                  </div>
                  <div className="text-sm text-green-800">
                    {t.analytics?.last7Days || 'Last 7 Days'}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="text-3xl font-bold text-purple-600">
                    {stats.last30Days.toLocaleString()}
                  </div>
                  <div className="text-sm text-purple-800">
                    {t.analytics?.last30Days || 'Last 30 Days'}
                  </div>
                </div>
              </div>

              {/* Timeline Chart */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-4">
                  {t.analytics?.reportsOverTime || 'Reports Over Time'}
                </h3>
                <div className="h-32 flex items-end gap-1">
                  {stats.timeline.length === 0 ? (
                    <div className="text-gray-400 text-sm w-full text-center py-8">
                      No data for the last 30 days
                    </div>
                  ) : (
                    stats.timeline.map((day, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors group relative"
                        style={{
                          height: `${(day.count / getMaxTimelineValue()) * 100}%`,
                          minHeight: day.count > 0 ? '4px' : '0'
                        }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                          {formatDate(day.date)}: {day.count}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>30 days ago</span>
                  <span>Today</span>
                </div>
              </div>

              {/* Activity Types & Top States */}
              <div className="grid grid-cols-2 gap-4">
                {/* By Activity Type */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">
                    {t.analytics?.byActivityType || 'By Activity Type'}
                  </h3>
                  <div className="space-y-2">
                    {stats.byActivityType.map((item) => (
                      <div key={item.type} className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: ACTIVITY_TYPE_COLORS[item.type] || '#6b7280' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700 capitalize">
                              {getActivityTypeLabel(item.type)}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {item.count}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(item.count / stats.totalReports) * 100}%`,
                                backgroundColor: ACTIVITY_TYPE_COLORS[item.type] || '#6b7280'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top States */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">
                    {t.analytics?.topLocations || 'Top Locations'}
                  </h3>
                  <div className="space-y-2">
                    {stats.topStates.length === 0 ? (
                      <div className="text-gray-400 text-sm text-center py-4">
                        No location data
                      </div>
                    ) : (
                      stats.topStates.slice(0, 5).map((item, i) => (
                        <div key={item.state} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                            {i + 1}
                          </div>
                          <div className="flex-1 flex justify-between items-center">
                            <span className="text-sm text-gray-700">
                              {item.state}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {item.count}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-4">
                  {t.analytics?.recentActivity || 'Recent Activity'}
                </h3>
                <div className="space-y-2">
                  {stats.recentActivity.length === 0 ? (
                    <div className="text-gray-400 text-sm text-center py-4">
                      No recent activity
                    </div>
                  ) : (
                    stats.recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-2 border-b border-gray-200 last:border-0"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: ACTIVITY_TYPE_COLORS[item.activityType] || '#6b7280' }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-700 capitalize">
                            {getActivityTypeLabel(item.activityType)}
                          </span>
                          <span className="text-gray-400 mx-2">·</span>
                          <span className="text-sm text-gray-500">
                            {item.location}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatDate(item.reportedAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
