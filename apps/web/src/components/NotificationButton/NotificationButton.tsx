import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface NotificationButtonProps {
  latitude?: number;
  longitude?: number;
}

export function NotificationButton({ latitude, longitude }: NotificationButtonProps) {
  const { t } = useI18n();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [radiusKm, setRadiusKm] = useState(50);

  useEffect(() => {
    // Check if push notifications are supported
    setIsSupported('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window);

    // Check if already subscribed
    checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      // Not subscribed
    }
  }

  async function subscribe() {
    setIsLoading(true);
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return;
      }

      // Get VAPID public key
      const keyResponse = await fetch(`${API_URL}/api/subscriptions/vapid-public-key`);
      if (!keyResponse.ok) {
        console.error('Push notifications not configured on server');
        return;
      }
      const { publicKey } = await keyResponse.json();

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to server
      const subJson = subscription.toJSON();
      await fetch(`${API_URL}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth
          },
          location: latitude && longitude ? {
            latitude,
            longitude,
            radiusKm
          } : undefined
        })
      });

      setIsSubscribed(true);
    } catch (error) {
      console.error('Failed to subscribe:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from server
        await fetch(`${API_URL}/api/subscriptions`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
      }

      setIsSubscribed(false);
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => isSubscribed ? unsubscribe() : setShowSettings(true)}
        disabled={isLoading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isSubscribed
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        } shadow-lg disabled:opacity-50`}
      >
        <span>{isSubscribed ? '🔔' : '🔕'}</span>
        <span className="hidden sm:inline">
          {isSubscribed ? t.notificationsEnabled : t.enableNotifications}
        </span>
      </button>

      {showSettings && !isSubscribed && (
        <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl p-4 min-w-[280px] z-[1001]">
          <h3 className="font-medium text-gray-900 mb-3">{t.notifyForArea}</h3>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">{t.radiusKm}</label>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value={10}>10 km</option>
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
              <option value={100}>100 km</option>
              <option value={250}>250 km</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={subscribe}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {t.enableNotifications}
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
