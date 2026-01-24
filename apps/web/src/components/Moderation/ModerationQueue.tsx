import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Flag {
  id: string;
  reportId: string;
  userIdentifier: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
}

interface ModerationQueueProps {
  adminKey: string;
  onClose: () => void;
}

export function ModerationQueue({ adminKey, onClose }: ModerationQueueProps) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  async function fetchQueue() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/moderation/queue`, {
        headers: { 'X-Admin-Key': adminKey }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch queue');
      }

      const data = await response.json();
      setFlags(data.flags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(flagId: string, status: string, moderator: string) {
    try {
      await fetch(`${API_URL}/api/moderation/flags/${flagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ status, moderator })
      });

      // Remove from local state
      setFlags(flags.filter(f => f.id !== flagId));
    } catch (err) {
      console.error('Failed to update flag:', err);
    }
  }

  async function handleModerateReport(reportId: string, newStatus: string, moderator: string) {
    try {
      await fetch(`${API_URL}/api/moderation/reports/${reportId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ status: newStatus, moderator })
      });

      // Refresh queue
      fetchQueue();
    } catch (err) {
      console.error('Failed to moderate report:', err);
    }
  }

  const reasonLabels: Record<string, string> = {
    spam: 'Spam',
    misinformation: 'Misinformation',
    duplicate: 'Duplicate',
    inappropriate: 'Inappropriate',
    other: 'Other'
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Moderation Queue</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : flags.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending flags
            </div>
          ) : (
            <div className="space-y-4">
              {flags.map(flag => (
                <div key={flag.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        flag.reason === 'spam' ? 'bg-red-100 text-red-800' :
                        flag.reason === 'misinformation' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {reasonLabels[flag.reason] || flag.reason}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        Report: {flag.reportId.substring(0, 8)}...
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(flag.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {flag.details && (
                    <p className="text-sm text-gray-600 mb-3">{flag.details}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(flag.id, 'dismissed', 'admin')}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleModerateReport(flag.reportId, 'disputed', 'admin')}
                      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Mark Disputed
                    </button>
                    <button
                      onClick={() => handleModerateReport(flag.reportId, 'verified', 'admin')}
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      Mark Verified
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
