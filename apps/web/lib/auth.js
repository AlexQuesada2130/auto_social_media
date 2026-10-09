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
  // Se compara el resumen, no el texto: así ambos lados miden siempre 32 bytes
  // y ni el tiempo de respuesta ni un return temprano delatan la longitud.
  const a = crypto.createHash("sha256").update(String(intento || "")).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

// --- freno a la fuerza bruta -----------------------------------------------
//
// En memoria y por instancia. En Vercel eso significa que varias instancias
// llevan cuentas separadas, así que no es una barrera dura: es un freno que
// convierte un ataque de minutos en uno de días. La barrera de verdad es una
// contraseña larga.

const INTENTOS = new Map();
const TOPE = 5;
const CASTIGO = 15 * 60 * 1000;
const VENTANA = 10 * 60 * 1000;

export function bloqueado(clave) {
  const r = INTENTOS.get(clave);
  if (!r) return 0;
  if (r.hasta && r.hasta > Date.now()) return Math.ceil((r.hasta - Date.now()) / 1000);
  return 0;
}

export function apuntarFallo(clave) {
  const ahora = Date.now();
  const r = INTENTOS.get(clave) || { n: 0, desde: ahora };
  // Los fallos viejos no cuentan: un error hace una hora no es un ataque.
  if (ahora - r.desde > VENTANA) { r.n = 0; r.desde = ahora; }
  r.n += 1;
  if (r.n >= TOPE) { r.hasta = ahora + CASTIGO; r.n = 0; r.desde = ahora; }
  INTENTOS.set(clave, r);
  // Sin esto el mapa crecería sin fin con cada IP que pruebe suerte.
  if (INTENTOS.size > 1000) {
    for (const [k, v] of INTENTOS) {
      if (!v.hasta && ahora - v.desde > VENTANA) INTENTOS.delete(k);
    }
  }
}

export function olvidarFallos(clave) {
  INTENTOS.delete(clave);
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
