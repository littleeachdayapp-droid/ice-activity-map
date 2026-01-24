import { useState } from 'react';
import { useI18n } from '../../i18n';

type FlagReason = 'spam' | 'misinformation' | 'duplicate' | 'inappropriate' | 'other';

interface FlagButtonProps {
  reportId: string;
  onFlag: (reason: FlagReason, details?: string) => Promise<void>;
}

export function FlagButton({ onFlag }: FlagButtonProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason | ''>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons: { value: FlagReason; label: string }[] = [
    { value: 'spam', label: t.spam },
    { value: 'misinformation', label: t.misinformation },
    { value: 'duplicate', label: t.duplicate },
    { value: 'inappropriate', label: t.inappropriate },
    { value: 'other', label: t.otherReason }
  ];

  const handleSubmit = async () => {
    if (!reason) return;

    setIsSubmitting(true);
    try {
      await onFlag(reason, details || undefined);
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setReason('');
        setDetails('');
      }, 2000);
    } catch (error) {
      console.error('Error flagging report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <span className="text-sm text-green-600 font-medium">
        ✓ {t.reportFlagged}
      </span>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-gray-500 hover:text-red-600 transition-colors"
      >
        ⚑ {t.flagReport}
      </button>
    );
  }

  return (
    <div className="border-t pt-4 mt-4 space-y-3">
      <h4 className="text-sm font-medium text-gray-700">{t.flagReason}</h4>

      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as FlagReason)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">-- {t.flagReason} --</option>
        {reasons.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder={t.flagDetails}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={2}
      />

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!reason || isSubmitting}
          className="px-4 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {t.submitFlag}
        </button>
        <button
          onClick={() => {
            setIsOpen(false);
            setReason('');
            setDetails('');
          }}
          className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
}
