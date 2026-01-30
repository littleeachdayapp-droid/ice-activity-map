import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '../../i18n';
import { ActivityType } from '../../types/report';
import { api, getErrorMessage, isApiError } from '../../utils/api';
import { Turnstile, TURNSTILE_SITE_KEY } from '../Turnstile/Turnstile';
// @ts-expect-error - exif-js doesn't have types
import EXIF from 'exif-js';

interface ReportFormProps {
  onClose: () => void;
  onSubmitted?: () => void;
  initialLocation?: { lat: number; lng: number } | null;
}

interface FormData {
  activityType: ActivityType;
  description: string;
  streetAddress: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'District of Columbia', 'Puerto Rico'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Convert DMS (Degrees, Minutes, Seconds) to Decimal Degrees
 */
function convertDMSToDD(dms: number[], ref: string): number {
  const dd = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return (ref === 'S' || ref === 'W') ? -dd : dd;
}

/**
 * Extract GPS coordinates from photo EXIF data
 */
function extractGpsFromPhoto(file: File): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    EXIF.getData(file as unknown as HTMLImageElement, function(this: HTMLImageElement) {
      const lat = EXIF.getTag(this, 'GPSLatitude');
      const lng = EXIF.getTag(this, 'GPSLongitude');
      const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
      const lngRef = EXIF.getTag(this, 'GPSLongitudeRef');

      if (lat && lng && latRef && lngRef) {
        const latitude = convertDMSToDD(lat, latRef);
        const longitude = convertDMSToDD(lng, lngRef);
        resolve({ lat: latitude, lng: longitude });
      } else {
        resolve(null);
      }
    });
  });
}

export function ReportForm({ onClose, onSubmitted, initialLocation }: ReportFormProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState<FormData>({
    activityType: 'other',
    description: '',
    streetAddress: '',
    city: '',
    state: '',
    latitude: initialLocation?.lat.toString() || '',
    longitude: initialLocation?.lng.toString() || ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [extractingLocation, setExtractingLocation] = useState(false);
  const [locationFromPhoto, setLocationFromPhoto] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const firstInput = modalRef.current?.querySelector<HTMLElement>('select, input, textarea');
      firstInput?.focus();
    }, 10);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [handleKeyDown]);

  // Cleanup photo preview URL
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    // Clear location from photo flag if user manually changes coordinates
    if (field === 'latitude' || field === 'longitude') {
      setLocationFromPhoto(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t.form?.photoInvalidType || 'Please select an image file');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(t.form?.photoTooLarge || 'Photo must be less than 10MB');
      return;
    }

    setError(null);
    setPhoto(file);

    // Create preview URL
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(URL.createObjectURL(file));

    // Try to extract GPS from EXIF
    setExtractingLocation(true);
    try {
      const gps = await extractGpsFromPhoto(file);
      if (gps) {
        setFormData(prev => ({
          ...prev,
          latitude: gps.lat.toFixed(6),
          longitude: gps.lng.toFixed(6)
        }));
        setLocationFromPhoto(true);
      }
    } catch (err) {
      console.error('Failed to extract EXIF data:', err);
    } finally {
      setExtractingLocation(false);
    }
  };

  const handleRemovePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhoto(null);
    setPhotoPreview(null);
    setLocationFromPhoto(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGeocode = async () => {
    if (!formData.city.trim() || !formData.state) {
      setError(t.form?.geocodeNeedsCity || 'Please enter a city and state first');
      return;
    }

    setGeocoding(true);
    setError(null);

    try {
      // Build address string
      const addressParts = [
        formData.streetAddress.trim(),
        formData.city.trim(),
        formData.state,
        'USA'
      ].filter(Boolean);
      const query = encodeURIComponent(addressParts.join(', '));

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=us`,
        {
          headers: {
            'User-Agent': 'ICEActivityMap/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const results = await response.json();

      if (results.length === 0) {
        setError(t.form?.geocodeNotFound || 'Address not found. Please check the address or enter coordinates manually.');
        return;
      }

      const { lat, lon } = results[0];
      setFormData(prev => ({
        ...prev,
        latitude: parseFloat(lat).toFixed(6),
        longitude: parseFloat(lon).toFixed(6)
      }));
      setLocationFromPhoto(false);
    } catch (err) {
      console.error('Geocoding error:', err);
      setError(t.form?.geocodeError || 'Could not look up address. Please enter coordinates manually.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.description.trim()) {
      setError(t.form?.descriptionRequired || 'Description is required');
      return;
    }
    if (!formData.city.trim()) {
      setError(t.form?.cityRequired || 'City is required');
      return;
    }
    if (!formData.state) {
      setError(t.form?.stateRequired || 'State is required');
      return;
    }

    // Check CAPTCHA (only if not in development with test keys)
    if (!turnstileToken && import.meta.env.VITE_TURNSTILE_SITE_KEY) {
      setError('Please complete the security verification');
      return;
    }

    setSubmitting(true);

    try {
      // Build FormData for multipart upload
      const submitData = new FormData();
      submitData.append('activityType', formData.activityType);
      submitData.append('description', formData.description.trim());
      submitData.append('city', formData.city.trim());
      submitData.append('state', formData.state);
      if (formData.latitude) {
        submitData.append('latitude', formData.latitude);
      }
      if (formData.longitude) {
        submitData.append('longitude', formData.longitude);
      }
      submitData.append('authorHandle', 'anonymous');
      submitData.append('authorDisplayName', 'Anonymous User');
      if (turnstileToken) {
        submitData.append('turnstileToken', turnstileToken);
      }
      if (photo) {
        submitData.append('photo', photo);
      }

      await api.postFormData('/api/reports', submitData, {
        retries: 2,
        retryDelay: 1000,
        timeout: 30000, // Longer timeout for file uploads
        onRetry: (attempt, error) => {
          console.log(`Retry attempt ${attempt}: ${error.message}`);
        }
      });

      setSuccess(true);
      setTimeout(() => {
        onSubmitted?.();
        onClose();
      }, 2000);
    } catch (err) {
      let message = getErrorMessage(err);

      // Provide more helpful messages for common errors
      if (isApiError(err)) {
        if (err.isNetworkError) {
          message = 'Network error. Please check your connection and try again.';
        } else if (err.isTimeout) {
          message = 'Request timed out. Please try again.';
        } else if (err.status === 429) {
          message = 'Too many submissions. Please wait a moment and try again.';
        }
      }

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const titleId = 'report-form-title';

  if (success) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-title"
      >
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center" role="alert">
          <div className="text-5xl mb-4" aria-hidden="true">✓</div>
          <h2 id="success-title" className="text-xl font-bold text-green-600 mb-2">
            {t.form?.submitted || 'Report Submitted'}
          </h2>
          <p className="text-gray-600">
            {t.form?.thankYou || 'Thank you for your report. It will be reviewed by moderators.'}
          </p>
        </div>
      </div>
    );
  }

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

      <div
        ref={modalRef}
        className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-bold text-gray-900">
            {t.form?.title || 'Report ICE/CBP Activity'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close form"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.form?.activityType || 'Activity Type'} *
            </label>
            <select
              value={formData.activityType}
              onChange={(e) => handleChange('activityType', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="raid">{t.raid}</option>
              <option value="checkpoint">{t.checkpoint}</option>
              <option value="arrest">{t.arrest}</option>
              <option value="surveillance">{t.surveillance}</option>
              <option value="other">{t.other}</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.form?.description || 'Description'} *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t.form?.descriptionPlaceholder || 'Describe what you witnessed...'}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.form?.addPhoto || 'Add Photo'} ({t.form?.optional || 'optional'})
            </label>

            {!photo ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="photo-input"
                />
                <label
                  htmlFor="photo-input"
                  className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-600">
                    {t.form?.tapToAddPhoto || 'Tap to add a photo'}
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  {t.form?.photoHint || 'Photos with GPS data will auto-fill location. Max 10MB.'}
                </p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={photoPreview!}
                  alt="Photo preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={t.form?.removePhoto || 'Remove photo'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {extractingLocation && (
                  <div className="absolute bottom-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    {t.form?.extractingLocation || 'Extracting location...'}
                  </div>
                )}
                {locationFromPhoto && !extractingLocation && (
                  <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                    {t.form?.locationFromPhoto || 'Location extracted from photo'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Street Address (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.form?.streetAddress || 'Street Address'} ({t.form?.optional || 'optional'})
            </label>
            <input
              type="text"
              value={formData.streetAddress}
              onChange={(e) => handleChange('streetAddress', e.target.value)}
              placeholder={t.form?.streetAddressPlaceholder || 'e.g., 123 Main St'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t.form?.streetAddressHint || 'For more precise location mapping'}
            </p>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.form?.city || 'City'} *
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder={t.form?.cityPlaceholder || 'e.g., Los Angeles'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.form?.state || 'State'} *
              </label>
              <select
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t.form?.selectState || 'Select state...'}</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Coordinates (optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {t.form?.coordinates || 'Coordinates'} ({t.form?.optional || 'optional'})
              </label>
              <button
                type="button"
                onClick={handleGeocode}
                disabled={geocoding || (!formData.city.trim() && !formData.streetAddress.trim())}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus:underline"
              >
                {geocoding ? (t.form?.lookingUp || 'Looking up...') : (t.form?.lookupAddress || 'Look up from address')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => handleChange('latitude', e.target.value)}
                placeholder={t.form?.latitude || 'Latitude'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => handleChange('longitude', e.target.value)}
                placeholder={t.form?.longitude || 'Longitude'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t.form?.coordinatesHint || 'If left blank, we will geocode from the city/state'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
              {error}
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
            {t.form?.disclaimer || 'Reports are reviewed by moderators before appearing on the map. Only submit reports of activity you personally witnessed.'}
          </div>

          {/* CAPTCHA verification */}
          <div className="flex justify-center">
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY}
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setError('Security verification failed. Please refresh and try again.')}
              theme="light"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t.form?.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {submitting ? (t.form?.submitting || 'Submitting...') : (t.form?.submit || 'Submit Report')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
