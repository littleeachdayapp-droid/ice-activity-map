import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../../i18n';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface QueueReport {
  id: string;
  activityType: string;
  description: string;
  city: string | null;
  state: string | null;
  authorHandle: string;
  authorDisplayName: string | null;
  status: string;
  reportedAt: string;
  createdAt: string;
  flagCount: number;
}

interface ModerationLogEntry {
  id: string;
  reportId: string;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  moderatorId: string;
  createdAt: string;
  report?: {
    description: string;
    city: string | null;
    state: string | null;
  };
}

interface AdminDashboardProps {
  onClose: () => void;
}

type Tab = 'queue' | 'flagged' | 'log';

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const { t } = useI18n();
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [queue, setQueue] = useState<QueueReport[]>([]);
  const [flagged, setFlagged] = useState<QueueReport[]>([]);
  const [log, setLog] = useState<ModerationLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }

    // Focus trap
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, [onClose]);

  // Focus management
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus the first input
    setTimeout(() => {
      const firstInput = modalRef.current?.querySelector<HTMLElement>('input, button');
      firstInput?.focus();
    }, 10);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [handleKeyDown]);

  const fetchQueue = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/moderation/queue`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (response.ok) {
        const data = await response.json();
        setQueue(data.reports || []);
        setIsAuthenticated(true);
        setAuthError(null);
      } else if (response.status === 401 || response.status === 403) {
        setAuthError(t.admin?.invalidKey || 'Invalid admin key');
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setLoading(false);
    }
  }, [adminKey, t.admin?.invalidKey]);

  const fetchFlagged = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/moderation/queue?flagged=true`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (response.ok) {
        const data = await response.json();
        setFlagged(data.reports || []);
      }
    } catch (err) {
      console.error('Error fetching flagged:', err);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  const fetchLog = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/moderation/log`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (response.ok) {
        const data = await response.json();
        setLog(data.entries || []);
      }
    } catch (err) {
      console.error('Error fetching log:', err);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'queue') fetchQueue();
      else if (activeTab === 'flagged') fetchFlagged();
      else if (activeTab === 'log') fetchLog();
    }
  }, [isAuthenticated, activeTab, fetchQueue, fetchFlagged, fetchLog]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchQueue();
  };

  const handleStatusChange = async (reportId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`${API_URL}/api/moderation/reports/${reportId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        // Refresh the queue
        fetchQueue();
        fetchFlagged();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'raid': return 'bg-red-500';
      case 'checkpoint': return 'bg-orange-500';
      case 'arrest': return 'bg-purple-500';
      case 'surveillance': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const titleId = 'admin-dashboard-title';

  // Login form
  if (!isAuthenticated) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0"
          onClick={onClose}
          aria-hidden="true"
        />

        <div ref={modalRef} className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id={titleId} className="text-xl font-bold text-gray-900">
              {t.admin?.title || 'Admin Dashboard'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close admin dashboard"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-key-input" className="block text-sm font-medium text-gray-700 mb-1">
                {t.admin?.adminKey || 'Admin Key'}
              </label>
              <input
                id="admin-key-input"
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter admin key..."
                autoComplete="current-password"
              />
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={!adminKey || loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? 'Loading...' : (t.admin?.login || 'Login')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div
      className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div ref={modalRef} className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
          <h2 id={titleId} className="text-xl font-bold text-gray-900">
            {t.admin?.title || 'Admin Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setAdminKey('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
            >
              {t.admin?.logout || 'Logout'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close admin dashboard"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b px-6 shrink-0">
          <div className="flex gap-4" role="tablist" aria-label="Admin sections">
            <button
              onClick={() => setActiveTab('queue')}
              role="tab"
              aria-selected={activeTab === 'queue'}
              aria-controls="queue-panel"
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                activeTab === 'queue'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.admin?.moderationQueue || 'Moderation Queue'} ({queue.length})
            </button>
            <button
              onClick={() => setActiveTab('flagged')}
              role="tab"
              aria-selected={activeTab === 'flagged'}
              aria-controls="flagged-panel"
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                activeTab === 'flagged'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.admin?.flaggedReports || 'Flagged Reports'} ({flagged.length})
            </button>
            <button
              onClick={() => setActiveTab('log')}
              role="tab"
              aria-selected={activeTab === 'log'}
              aria-controls="log-panel"
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                activeTab === 'log'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.admin?.moderationLog || 'Moderation Log'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-8 text-gray-500" aria-live="polite">Loading...</div>
          )}

          {/* Queue Tab */}
          {activeTab === 'queue' && !loading && (
            <div className="space-y-4">
              {queue.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {t.admin?.noReports || 'No reports in queue'}
                </div>
              ) : (
                queue.map((report) => (
                  <div
                    key={report.id}
                    className="border rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-3 h-3 rounded-full ${getActivityTypeColor(report.activityType)}`} />
                          <span className="font-medium text-gray-900 capitalize">
                            {report.activityType}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(report.status)}`}>
                            {report.status}
                          </span>
                          {report.flagCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">
                              {report.flagCount} flags
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2 line-clamp-3">
                          {report.description}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                          {(report.city || report.state) && (
                            <span>
                              {[report.city, report.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                          <span>@{report.authorHandle}</span>
                          <span>{formatDate(report.reportedAt)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleStatusChange(report.id, 'approved')}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                          {t.admin?.approve || 'Approve'}
                        </button>
                        <button
                          onClick={() => handleStatusChange(report.id, 'rejected')}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                        >
                          {t.admin?.reject || 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Flagged Tab */}
          {activeTab === 'flagged' && !loading && (
            <div className="space-y-4">
              {flagged.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No flagged reports
                </div>
              ) : (
                flagged.map((report) => (
                  <div
                    key={report.id}
                    className="border border-red-200 rounded-lg p-4 bg-red-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-3 h-3 rounded-full ${getActivityTypeColor(report.activityType)}`} />
                          <span className="font-medium text-gray-900 capitalize">
                            {report.activityType}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">
                            {report.flagCount} flags
                          </span>
                        </div>
                        <p className="text-gray-700 mb-2 line-clamp-3">
                          {report.description}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                          {(report.city || report.state) && (
                            <span>
                              {[report.city, report.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                          <span>@{report.authorHandle}</span>
                          <span>{formatDate(report.reportedAt)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleStatusChange(report.id, 'approved')}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                          Keep
                        </button>
                        <button
                          onClick={() => handleStatusChange(report.id, 'rejected')}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Log Tab */}
          {activeTab === 'log' && !loading && (
            <div className="space-y-3">
              {log.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No moderation actions yet
                </div>
              ) : (
                log.map((entry) => (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {entry.action}
                      </span>
                      {entry.previousStatus && entry.newStatus && (
                        <span className="text-gray-500">
                          {entry.previousStatus} → {entry.newStatus}
                        </span>
                      )}
                      <span className="text-gray-400 ml-auto">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    {entry.report && (
                      <p className="text-gray-600 truncate">
                        {entry.report.description}
                      </p>
                    )}
                    {entry.reason && (
                      <p className="text-gray-500 text-xs mt-1">
                        Reason: {entry.reason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
