/* SIMMS service worker: Web Push notifications (Plan v2 C8, T16).
 *
 * The backend pushes {title, body, url, tag} for every in-app
 * notification. This shows it even when no SIMMS tab is open, and a
 * tap opens (or focuses) the app on the ticket.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data;

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "SIMMS";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag,
      // A newer event for the same ticket alerts again.
      renotify: Boolean(data.tag),
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;

        try {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        } catch {
          // Not controllable: fall through to a new window.
        }
      }

      await self.clients.openWindow(target);
    })
  );
});
