// Desbloqueo biométrico.
//
// El token sigue viviendo en el llavero; esto decide si se abre o no. La
// comprobación es local: iOS nunca entrega la huella ni la cara, solo responde
// sí o no, así que aquí no hay ningún dato biométrico que guardar o perder.

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const LLAVE_PREF = "mesa.faceid";

/** Qué puede hacer este teléfono: hay sensor, y hay algo registrado en él. */
export async function capacidad() {
  try {
    const [hardware, registrado, tipos] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const facial = tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    return {
      disponible: hardware && registrado,
      nombre: facial ? "Face ID" : "Touch ID",
      // Hay sensor pero nada registrado: merece un mensaje distinto a "no hay".
      sinRegistrar: hardware && !registrado,
    };
  } catch {
    return { disponible: false, nombre: "Face ID", sinRegistrar: false };
  }
}

export async function preferencia() {
  try {
    return (await SecureStore.getItemAsync(LLAVE_PREF)) === "si";
  } catch {
    return false;
  }
}

export async function guardarPreferencia(activo) {
  try {
    await SecureStore.setItemAsync(LLAVE_PREF, activo ? "si" : "no");
  } catch {
    /* si no se puede guardar, simplemente volverá a preguntar */
  }
}

/**
 * Pide la cara o la huella. Devuelve {ok, motivo}.
 * Nunca lanza: un fallo del sensor no debe dejar al dueño fuera de su app.
 */
export async function desbloquear(nombre = "Face ID") {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: `Desbloquea la Mesa de Redacción`,
      cancelLabel: "Usar contraseña",
      // Sin esto, iOS ofrece el código del dispositivo como alternativa, lo
      // que confunde: aquí la alternativa es la contraseña de la app.
      disableDeviceFallback: true,
    });
    if (r.success) return { ok: true, motivo: null };
    const motivos = {
      user_cancel: null,                     // canceló a propósito: sin ruido
      system_cancel: null,
      user_fallback: null,
      lockout: `${nombre} bloqueado por demasiados intentos. Entra con la contraseña.`,
      not_enrolled: `No hay ${nombre} configurado en este iPhone.`,
    };
    return { ok: false, motivo: motivos[r.error] ?? null };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}
