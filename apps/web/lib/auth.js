// Autenticación de un solo usuario.
//
// Una contraseña en MESA_PASSWORD. Al acertarla se emite un token firmado con
// MESA_SECRET que caduca a los 30 días. La web lo guarda en una cookie
// httpOnly; el móvil lo manda en la cabecera Authorization.
//
// Esto protege borradores de posts, no datos médicos. Es proporcionado al
// riesgo: una contraseña buena y un token firmado, sin inventar criptografía.

import crypto from "node:crypto";

const DURACION = 30 * 24 * 60 * 60 * 1000;
export const COOKIE = "mesa_sesion";

function secreto() {
  const s = process.env.MESA_SECRET;
  if (!s) throw new Error("Falta MESA_SECRET en el entorno");
  return s;
}

function firmar(datos) {
  return crypto.createHmac("sha256", secreto()).update(datos).digest("base64url");
}

export function passwordCorrecta(intento) {
  const real = process.env.MESA_PASSWORD;
  if (!real) throw new Error("Falta MESA_PASSWORD en el entorno");
  const a = Buffer.from(String(intento || ""));
  const b = Buffer.from(real);
  // Longitudes distintas delatarían la contraseña por el tiempo de respuesta.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function emitirToken() {
  const caduca = Date.now() + DURACION;
  return `${caduca}.${firmar(String(caduca))}`;
}

export function tokenValido(token) {
  if (!token || typeof token !== "string") return false;
  const [caduca, firma] = token.split(".");
  if (!caduca || !firma) return false;
  if (Number(caduca) < Date.now()) return false;
  const esperada = Buffer.from(firmar(caduca));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return false;
  return crypto.timingSafeEqual(esperada, recibida);
}

/** Saca el token de la cookie (web) o de la cabecera (móvil). */
export function autorizado(req) {
  const cabecera = req.headers.get("authorization");
  if (cabecera?.startsWith("Bearer ") && tokenValido(cabecera.slice(7))) return true;
  const cookie = req.cookies?.get?.(COOKIE)?.value;
  return tokenValido(cookie);
}
