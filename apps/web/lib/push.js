// Envío de notificaciones por la API de Expo.
//
// No lleva SDK: es una petición HTTP. Expo acepta hasta 100 destinatarios por
// llamada, y de todas formas aquí solo hay un teléfono.
//
// Un fallo al notificar nunca debe tumbar la creación del borrador: el
// borrador es el dato, la notificación es un aviso. Por eso todo va envuelto.

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";

/** ExponentPushToken[xxxxxxxx] es la forma que emite Expo. */
export function tokenValido(t) {
  return typeof t === "string" && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t);
}

export async function enviar(tokens, { titulo, cuerpo, datos }) {
  const destinos = (tokens || []).filter(tokenValido);
  if (!destinos.length) return { enviados: 0, motivo: "no hay tokens registrados" };

  const mensajes = destinos.map((to) => ({
    to,
    title: titulo,
    body: cuerpo,
    sound: "default",
    data: datos || {},
  }));

  try {
    const res = await fetch(EXPO_PUSH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(mensajes),
    });
    if (!res.ok) {
      return { enviados: 0, motivo: `Expo respondió ${res.status}` };
    }
    const { data } = await res.json();
    const fallos = (data || []).filter((t) => t.status === "error");
    return {
      enviados: destinos.length - fallos.length,
      // DeviceNotRegistered significa que hay que limpiar ese token.
      caducados: fallos
        .filter((f) => f.details?.error === "DeviceNotRegistered")
        .map((f, i) => destinos[i]),
      motivo: fallos.length ? fallos[0].message : null,
    };
  } catch (e) {
    return { enviados: 0, motivo: e.message };
  }
}
