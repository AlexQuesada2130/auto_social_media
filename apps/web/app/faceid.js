// Desbloqueo con Face ID mediante WebAuthn + la extensión PRF.
//
// Antes esto era un cerrojo de "sí o no": Face ID decidía si la pantalla se
// abría, pero no podía abrir nada cifrado. Con PRF el autenticador devuelve
// además un secreto de 32 bytes, siempre el mismo para la misma credencial y
// la misma sal, que solo sale tras pasar la cara. Ese secreto envuelve la
// clave del dinero (ver lib/boveda.js), así que Face ID abre de verdad.
//
// iOS nunca entrega la cara ni la huella, solo el secreto derivado. PRF exige
// iOS 18 / macOS 15 o posterior. Sin PRF no se ofrece Face ID: un cerrojo de
// sí o no al lado de uno criptográfico sería la puerta de atrás del bueno.

const ANTIGUAS = ["mesa.faceid.credencial", "mesa.faceid.activo"];

const aB64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Borra la credencial del Face ID antiguo (sin PRF), que ya no se usa. */
export function olvidarAntiguo() {
  try { ANTIGUAS.forEach((k) => localStorage.removeItem(k)); } catch {}
}

/** ¿Este dispositivo tiene Face ID / Touch ID para el navegador? */
export async function disponible() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function pedirSecreto(credencial, salPrf) {
  const r = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: deB64(credencial) }],
      userVerification: "required",
      timeout: 60000,
      extensions: { prf: { eval: { first: deB64(salPrf) } } },
    },
  });
  const secreto = r?.getClientExtensionResults?.().prf?.results?.first;
  if (!secreto) throw new Error("Este dispositivo no devolvió la clave de Face ID");
  return new Uint8Array(secreto);
}

/**
 * Registra la credencial y obtiene su secreto. Tiene que salir de un gesto
 * del usuario. Devuelve { credencial, salPrf, secreto }.
 */
export async function activar() {
  if (!(await disponible())) throw new Error("Este dispositivo no ofrece Face ID al navegador");
  const salPrf = aB64(crypto.getRandomValues(new Uint8Array(32)));

  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Mesa", id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "mesa", displayName: "Mesa" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
      extensions: { prf: { eval: { first: deB64(salPrf) } } },
    },
  });
  if (!cred) throw new Error("No se creó la credencial");

  const prf = cred.getClientExtensionResults?.().prf;
  if (!prf?.enabled) {
    throw new Error("Este dispositivo no admite Face ID para datos cifrados (hace falta iOS 18 o macOS 15)");
  }
  const credencial = aB64(cred.rawId);
  olvidarAntiguo();
  // Algunos sistemas ya devuelven el secreto al crear; otros solo al usarla.
  const alCrear = prf.results?.first;
  const secreto = alCrear ? new Uint8Array(alCrear) : await pedirSecreto(credencial, salPrf);
  return { credencial, salPrf, secreto };
}

/** Pide la cara. Devuelve el secreto, o null si se cancela o falla. */
export async function desbloquear({ credencial, salPrf }) {
  try {
    return await pedirSecreto(credencial, salPrf);
  } catch {
    return null;
  }
}
