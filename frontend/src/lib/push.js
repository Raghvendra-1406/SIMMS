import { apiFetch } from "./api";

// Web Push in the browser (Plan v2 C8, T16). The service worker is
// /sw.js; the backend sends every in-app notification as a push too.
//
// Push needs a secure context: https:// (Vercel) or http://localhost.
// A phone opening the laptop's LAN IP over http cannot subscribe.
// On iPhone it works only after "Add to Home Screen" (iOS 16.4+).

const SW_URL = "/sw.js";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function keyToBytes(base64url) {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function sameKey(subscription, keyBytes) {
  const current = subscription?.options?.applicationServerKey;
  if (!current) return true;
  const bytes = new Uint8Array(current);
  return bytes.length === keyBytes.length && bytes.every((value, index) => value === keyBytes[index]);
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  return registration ? registration.pushManager.getSubscription() : null;
}

/**
 * { supported, secure, permission, serverEnabled, subscribed }
 */
export async function getPushState() {
  const supported = pushSupported();
  const secure = typeof window !== "undefined" && window.isSecureContext;

  let serverEnabled;
  try {
    serverEnabled = Boolean((await apiFetch("/push/config")).enabled);
  } catch {
    serverEnabled = false;
  }

  if (!supported || !secure) {
    return { supported, secure, permission: "default", serverEnabled, subscribed: false };
  }

  const subscription = await currentSubscription();

  return {
    supported,
    secure,
    permission: Notification.permission,
    serverEnabled,
    subscribed: Boolean(subscription) && Notification.permission === "granted",
  };
}

/** Ask permission, subscribe this browser and register it for the logged-in user. */
export async function enablePush() {
  if (!pushSupported()) throw new Error("This browser does not support push notifications.");
  if (!window.isSecureContext) throw new Error("Push needs https:// (or localhost).");

  const config = await apiFetch("/push/config");
  if (!config.enabled || !config.public_key) {
    throw new Error("Push is not set up on the server yet (VAPID keys missing).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked for this site. Allow them in the browser's site settings.");
  }

  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;

  const keyBytes = keyToBytes(config.public_key);
  let subscription = await registration.pushManager.getSubscription();

  // The server's keys changed: the old subscription can't be used.
  if (subscription && !sameKey(subscription, keyBytes)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes,
    });
  }

  await apiFetch("/push/subscriptions", { method: "POST", body: subscription.toJSON() });
}

/** Stop push on this browser. */
export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;

  try {
    await apiFetch("/push/subscriptions", { method: "DELETE", body: { endpoint: subscription.endpoint } });
  } finally {
    await subscription.unsubscribe();
  }
}

export async function sendTestPush() {
  return apiFetch("/push/test", { method: "POST" });
}

/**
 * On app start: re-register an existing subscription for whoever is
 * logged in now (endpoints can rotate; another user may have logged in).
 * Silent: never prompts.
 */
export async function syncPushSubscription() {
  try {
    if (!pushSupported() || !window.isSecureContext || Notification.permission !== "granted") return;
    const subscription = await currentSubscription();
    if (!subscription) return;
    await apiFetch("/push/subscriptions", { method: "POST", body: subscription.toJSON() });
  } catch {
    // Best effort.
  }
}

/** On logout: stop pushes for the old user on this device. */
export async function unsubscribeOnLogout() {
  try {
    if (!pushSupported()) return;
    const subscription = await currentSubscription();
    // The browser drops it; the backend removes the row on the next 410.
    if (subscription) await subscription.unsubscribe();
  } catch {
    // Best effort.
  }
}
