import { useState, useEffect, useRef, useCallback } from 'react';
import { Report, ACTIVITY_COLORS } from '../../types/report';
import { useI18n, getActivityTypeLabel, getStatusLabel } from '../../i18n';
import { VerificationPanel } from '../VerificationPanel/VerificationPanel';
import { FlagButton } from '../FlagButton/FlagButton';
import { api } from '../../utils/api';

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

    // Focus the close button
    setTimeout(() => {
      const closeButton = modalRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close report details"]');
      closeButton?.focus();
    }, 10);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [handleKeyDown]);

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
    try {
      const userIdentifier = getUserIdentifier();
      await api.post(`/api/reports/${report.id}/verify`, {
        vote,
        comment,
        userIdentifier
      }, { retries: 2 });

      if (userVote === 'confirm') setConfirmCount(c => c - 1);
      if (userVote === 'dispute') setDisputeCount(c => c - 1);

      setUserVote(vote);
      if (vote === 'confirm') setConfirmCount(c => c + 1);
      if (vote === 'dispute') setDisputeCount(c => c + 1);
    } catch (err) {
      console.error('Failed to submit vote:', err);
    }
  };

  const handleRemoveVote = async () => {
    try {
      const userIdentifier = getUserIdentifier();
      await api.delete(`/api/reports/${report.id}/verify`, { userIdentifier }, { retries: 2 });

      if (userVote === 'confirm') setConfirmCount(c => c - 1);
      if (userVote === 'dispute') setDisputeCount(c => c - 1);
      setUserVote(null);
    } catch (err) {
      console.error('Failed to remove vote:', err);
    }
  };

  const handleFlag = async (reason: string, details?: string) => {
    try {
      const userIdentifier = getUserIdentifier();
      await api.post(`/api/moderation/${report.id}/flag`, {
        reason,
        details,
        userIdentifier
      }, { retries: 2 });
    } catch (err) {
      console.error('Failed to flag report:', err);
    }
  };

  const activityLabel = getActivityTypeLabel(report.activityType, language);
  const titleId = `report-detail-title-${report.id}`;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: ACTIVITY_COLORS[report.activityType] }}
              aria-hidden="true"
            />
            <h2 id={titleId} className="text-lg font-semibold">
              {activityLabel}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close report details"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[report.status]}`}
              role="status"
            >
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
