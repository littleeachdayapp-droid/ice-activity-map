import { useState } from 'react';
import { useI18n } from '../../i18n';

interface VerificationPanelProps {
  reportId: string;
  confirmCount: number;
  disputeCount: number;
  userVote?: 'confirm' | 'dispute' | null;
  onVote: (vote: 'confirm' | 'dispute', comment?: string) => Promise<void>;
  onRemoveVote: () => Promise<void>;
}

export function VerificationPanel({
  confirmCount,
  disputeCount,
  userVote,
  onVote,
  onRemoveVote
}: VerificationPanelProps) {
  const { t } = useI18n();
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [pendingVote, setPendingVote] = useState<'confirm' | 'dispute' | null>(null);

  const handleVoteClick = (vote: 'confirm' | 'dispute') => {
    if (userVote === vote) {
      // Remove existing vote
      handleRemoveVote();
    } else {
      setPendingVote(vote);
      setShowCommentBox(true);
    }
  };

  const handleSubmitVote = async () => {
    if (!pendingVote) return;

    setIsSubmitting(true);
    try {
      await onVote(pendingVote, comment || undefined);
      setComment('');
      setShowCommentBox(false);
      setPendingVote(null);
    } catch (error) {
      console.error('Error submitting vote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveVote = async () => {
    setIsSubmitting(true);
    try {
      await onRemoveVote();
    } catch (error) {
      console.error('Error removing vote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center gap-4 mb-3">
        <span className="text-sm text-gray-500">{t.yourVote}:</span>
        <div className="flex gap-2">
          <button
            onClick={() => handleVoteClick('confirm')}
            disabled={isSubmitting}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              userVote === 'confirm'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-green-100'
            }`}
          >
            ✓ {confirmCount}
          </button>
          <button
            onClick={() => handleVoteClick('dispute')}
            disabled={isSubmitting}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              userVote === 'dispute'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-red-100'
            }`}
          >
            ✗ {disputeCount}
          </button>
        </div>
      </div>

      {showCommentBox && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t.addComment}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmitVote}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {t.submitVote}
            </button>
            <button
              onClick={() => {
                setShowCommentBox(false);
                setPendingVote(null);
                setComment('');
              }}
              className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-4 text-xs text-gray-500 mt-2">
        <span>{confirmCount} {t.confirmations}</span>
        <span>{disputeCount} {t.disputes}</span>
      </div>
    </div>
  );
}
