import { useState } from 'react';
import { Report, ACTIVITY_COLORS } from '../../types/report';
import { useI18n, getActivityTypeLabel, getStatusLabel } from '../../i18n';
import { VerificationPanel } from '../VerificationPanel/VerificationPanel';
import { FlagButton } from '../FlagButton/FlagButton';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ReportDetailProps {
  report: Report;
  onClose: () => void;
}

const STATUS_STYLES: Record<Report['status'], string> = {
  verified: 'bg-green-100 text-green-800',
  unverified: 'bg-yellow-100 text-yellow-800',
  disputed: 'bg-red-100 text-red-800'
};

// Simple user identifier (in production, use proper auth)
function getUserIdentifier(): string {
  let id = localStorage.getItem('ice-map-user-id');
  if (!id) {
    id = 'user-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('ice-map-user-id', id);
  }
  return id;
}

export function ReportDetail({ report, onClose }: ReportDetailProps) {
  const { t, language } = useI18n();
  const [userVote, setUserVote] = useState<'confirm' | 'dispute' | null>(null);
  const [confirmCount, setConfirmCount] = useState(0);
  const [disputeCount, setDisputeCount] = useState(0);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return t.lessThanAnHourAgo;
    if (diffHours < 24) return `${diffHours} ${t.hoursAgo}`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ${t.daysAgo}`;

    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleVote = async (vote: 'confirm' | 'dispute', comment?: string) => {
    const userIdentifier = getUserIdentifier();
    await fetch(`${API_URL}/api/reports/${report.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote, comment, userIdentifier })
    });

    if (userVote === 'confirm') setConfirmCount(c => c - 1);
    if (userVote === 'dispute') setDisputeCount(c => c - 1);

    setUserVote(vote);
    if (vote === 'confirm') setConfirmCount(c => c + 1);
    if (vote === 'dispute') setDisputeCount(c => c + 1);
  };

  const handleRemoveVote = async () => {
    const userIdentifier = getUserIdentifier();
    await fetch(`${API_URL}/api/reports/${report.id}/verify`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIdentifier })
    });

    if (userVote === 'confirm') setConfirmCount(c => c - 1);
    if (userVote === 'dispute') setDisputeCount(c => c - 1);
    setUserVote(null);
  };

  const handleFlag = async (reason: string, details?: string) => {
    const userIdentifier = getUserIdentifier();
    await fetch(`${API_URL}/api/reports/${report.id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, details, userIdentifier })
    });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: ACTIVITY_COLORS[report.activityType] }}
            />
            <h2 className="text-lg font-semibold">
              {getActivityTypeLabel(report.activityType, language)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Location */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">{t.location}</h3>
            <p className="text-gray-900">
              {report.location.city}, {report.location.state}
            </p>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">{t.description}</h3>
            <p className="text-gray-900">{report.description}</p>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t.reportedBy}</h3>
              <p className="text-gray-900">{report.author}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t.time}</h3>
              <p className="text-gray-900">{formatTimestamp(report.timestamp)}</p>
            </div>
          </div>

          {/* Status badge */}
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[report.status]}`}>
              {getStatusLabel(report.status, language)}
            </span>
          </div>

          {/* Verification Panel */}
          <VerificationPanel
            reportId={report.id}
            confirmCount={confirmCount}
            disputeCount={disputeCount}
            userVote={userVote}
            onVote={handleVote}
            onRemoveVote={handleRemoveVote}
          />

          {/* Flag Button */}
          <FlagButton
            reportId={report.id}
            onFlag={handleFlag}
          />
        </div>
      </div>
    </div>
  );
}
