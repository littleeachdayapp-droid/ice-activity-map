import { useState } from 'react';
import { useI18n } from '../../i18n';
import { ActivityType } from '../../types/report';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface EmailSubscriptionProps {
  onClose: () => void;
  latitude?: number;
  longitude?: number;
}

const ALL_ACTIVITY_TYPES: ActivityType[] = ['raid', 'checkpoint', 'arrest', 'surveillance', 'other'];

export function EmailSubscription({ onClose, latitude, longitude }: EmailSubscriptionProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [radiusKm, setRadiusKm] = useState(50);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>(ALL_ACTIVITY_TYPES);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivityTypeToggle = (type: ActivityType) => {
    setActivityTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Email is required');
      return;
    }

    if (activityTypes.length === 0) {
      setError('Select at least one activity type');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/email-subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          latitude,
          longitude,
          radiusKm,
          activityTypes
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to subscribe');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    } finally {
      setSubmitting(false);
    }
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    const labels: Record<ActivityType, string> = {
      raid: t.raid,
      checkpoint: t.checkpoint,
      arrest: t.arrest,
      surveillance: t.surveillance,
      other: t.other
    };
    return labels[type];
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-green-600 mb-2">
            Check Your Email
          </h2>
          <p className="text-gray-600 mb-4">
            We've sent a verification link to <strong>{email}</strong>. Click the link to activate your alerts.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Email Alerts
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Location info */}
          {latitude && longitude && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>Location:</strong> {latitude.toFixed(4)}, {longitude.toFixed(4)}
              <br />
              <span className="text-blue-600">Alerts will be sent for activity near this location</span>
            </div>
          )}

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.radiusKm}
            </label>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="100">100 km</option>
              <option value="200">200 km</option>
            </select>
          </div>

          {/* Activity Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.selectActivityTypes}
            </label>
            <div className="space-y-2">
              {ALL_ACTIVITY_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={activityTypes.includes(type)}
                    onChange={() => handleActivityTypeToggle(type)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {getActivityTypeLabel(type)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-3 rounded-lg text-xs">
            You can unsubscribe at any time using the link in any alert email.
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Subscribing...' : 'Subscribe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
