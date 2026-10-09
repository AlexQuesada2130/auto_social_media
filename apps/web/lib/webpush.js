// Envío de Web Push (el de la PWA), distinto del de Expo.
//
// Las claves VAPID identifican a este servidor ante Apple y Google. La pública
// viaja al navegador; la privada no sale de aquí.

import webpush from "web-push";

const PUBLICA = process.env.VAPID_PUBLIC_KEY;
const PRIVADA = process.env.VAPID_PRIVATE_KEY;
const SUJETO = process.env.VAPID_SUBJECT || "mailto:nadie@example.com";

export const hayClaves = Boolean(PUBLICA && PRIVADA);

if (hayClaves) webpush.setVapidDetails(SUJETO, PUBLICA, PRIVADA);

export const clavePublica = PUBLICA || null;

export async function enviarWeb(suscripciones, { titulo, cuerpo, url }) {
  if (!hayClaves) return { enviados: 0, caducadas: [], motivo: "faltan las claves VAPID" };

  const carga = JSON.stringify({ titulo, cuerpo, url: url || "/" });
  const caducadas = [];
  let enviados = 0;

  await Promise.all(
    (suscripciones || []).map(async (s) => {
      try {
        await webpush.sendNotification(s, carga, { TTL: 3600 });
        enviados += 1;
      } catch (e) {
        // 404 y 410 significan que el navegador ya no existe: hay que olvidarla.
        if (e.statusCode === 404 || e.statusCode === 410) caducadas.push(s.endpoint);
      }
    }),
  );

  return { enviados, caducadas, motivo: null };
}
