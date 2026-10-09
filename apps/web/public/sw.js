// Service worker.
//
// Hace dos cosas: recibir notificaciones push y servir un casco mínimo cuando
// no hay red. No cachea la API a propósito: una cola de borradores desfasada
// es peor que un aviso de "sin conexión".

const VERSION = "mesa-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (e) => {
  let datos = { titulo: "Propuesta nueva", cuerpo: "", url: "/" };
  try {
    if (e.data) datos = { ...datos, ...e.data.json() };
  } catch {
    if (e.data) datos.cuerpo = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      data: { url: datos.url },
      // Sin esto, varias propuestas seguidas apilan avisos idénticos.
      tag: datos.tag || "propuesta",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = e.notification.data?.url || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      // Si ya está abierta, se trae al frente en vez de abrir otra.
      for (const c of lista) {
        if (c.url.includes(self.location.origin) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
