import { api } from './api';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/** Registers the service worker once; safe to call repeatedly. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('Rejestracja service workera nie powiodła się', err);
    return null;
  }
}

/** Whether this browser already holds an active push subscription. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Requests notification permission, subscribes this browser and registers the
 * subscription with the API. Throws with a Polish message on any failure so
 * the caller can show it directly - permission denial is the common case.
 */
export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('Ta przeglądarka nie obsługuje powiadomień push');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Nie udzielono zgody na powiadomienia');
  }

  const { publicKey } = await api.get<{ publicKey: string }>(
    '/api/notifications/push/vapid-public-key',
  );

  const registration = await registerServiceWorker();
  if (!registration) throw new Error('Nie udało się zarejestrować service workera');

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys.auth) {
    throw new Error('Przeglądarka nie zwróciła kluczy subskrypcji');
  }

  await api.post('/api/notifications/push/subscribe', {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.post('/api/notifications/push/unsubscribe', { endpoint });
}

/** VAPID keys are base64url; the Push API wants a raw ArrayBuffer view. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
