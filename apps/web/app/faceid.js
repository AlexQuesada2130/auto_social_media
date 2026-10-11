// Desbloqueo con Face ID en la PWA, mediante WebAuthn.
//
// Qué es y qué no es, para no venderlo de más:
//
// Esto es un CERROJO LOCAL, no un segundo factor contra el servidor. Quien te
// autentica sigue siendo la cookie de sesión; Face ID solo decide si la app se
// abre. Es exactamente el mismo modelo que tenía la versión de Expo.
//
// Lo hace bien un detalle importante: iOS nunca entrega la cara ni la huella.
// Solo responde sí o no, así que aquí no hay ningún dato biométrico que
// guardar, perder o filtrar.

const LLAVE_ID = "mesa.faceid.credencial";
const LLAVE_ON = "mesa.faceid.activo";

function guardar(k, v) { try { localStorage.setItem(k, v); } catch {} }
function leer(k) { try { return localStorage.getItem(k); } catch { return null; } }
function borrar(k) { try { localStorage.removeItem(k); } catch {} }

function aBytes(b64) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
function aB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** ¿Este dispositivo tiene Face ID o Touch ID disponible para el navegador? */
export async function disponible() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export const activo = () => leer(LLAVE_ON) === "si" && Boolean(leer(LLAVE_ID));

/** Registra la credencial. Tiene que salir de un gesto del usuario. */
export async function activar() {
  if (!(await disponible())) {
    throw new Error("Este dispositivo no ofrece Face ID al navegador");
  }
  const reto = crypto.getRandomValues(new Uint8Array(32));
  const idUsuario = crypto.getRandomValues(new Uint8Array(16));

  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: reto,
      rp: { name: "Mesa de Redacción", id: location.hostname },
      user: { id: idUsuario, name: "mesa", displayName: "Mesa de Redacción" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: {
        // Face ID del propio iPhone, no una llave USB.
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  });
  if (!cred) throw new Error("No se creó la credencial");

  guardar(LLAVE_ID, aB64(cred.rawId));
  guardar(LLAVE_ON, "si");
  return true;
}

export function desactivar() {
  borrar(LLAVE_ON);
  borrar(LLAVE_ID);
}

/** Pide la cara. Devuelve true solo si iOS la da por buena. */
export async function desbloquear() {
  const id = leer(LLAVE_ID);
  if (!id) return false;
  try {
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: aBytes(id) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return Boolean(r);
  } catch {
    // Cancelar, fallar la cara o agotar el tiempo acaban todos aquí.
    return false;
  }
}
