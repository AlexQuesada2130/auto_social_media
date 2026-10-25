// Bóveda cifrada del dinero. Solo se ejecuta en el navegador.
//
// Los datos se cifran con una clave de datos (DEK) aleatoria AES-256-GCM. Esa
// DEK nunca se guarda en claro: se guarda "envuelta" una vez por cada forma de
// abrir la app. Hoy hay dos llaves:
//
//   - contraseña: PBKDF2-SHA256 (600.000 iteraciones) sobre la contraseña de
//     la app, con sal propia de este dispositivo.
//   - faceid: el secreto PRF que devuelve WebAuthn. Solo existe si el sistema
//     lo admite (iOS 18+, macOS 15+).
//
// Con esto, cambiar la contraseña o activar Face ID solo re-envuelve la DEK;
// los datos no se tocan. El bloque cifrado vive en localStorage de este
// dispositivo y no viaja nunca al servidor.

export const LLAVE_BOVEDA = "mesa.boveda.v1";
const FORMATO = "mesa-boveda";
const ITERACIONES = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const aB64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const azar = (n) => crypto.getRandomValues(new Uint8Array(n));

export function datosVacios() {
  const ahora = new Date().toISOString();
  return {
    schema: 1,
    positions: {},
    transactions: [],
    budgets: {},
    settings: { autoLockMinutes: 15 },
    createdAt: ahora,
    updatedAt: ahora,
  };
}

// ── claves ────────────────────────────────────────────────────────────────

async function kekDePassword(password, sal, iteraciones = ITERACIONES) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey", "decrypt"]
  );
}

async function kekDePrf(secreto) {
  const base = await crypto.subtle.importKey("raw", secreto, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode("mesa-boveda-faceid") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

async function envolver(dek, kek) {
  const iv = azar(12);
  const ct = await crypto.subtle.wrapKey("raw", dek, kek, { name: "AES-GCM", iv });
  return { iv: aB64(iv), ct: aB64(ct) };
}

async function desenvolver(llave, kek) {
  return crypto.subtle.unwrapKey(
    "raw", deB64(llave.ct), kek, { name: "AES-GCM", iv: deB64(llave.iv) },
    { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  );
}

async function llavePassword(dek, password) {
  const sal = azar(16);
  const kek = await kekDePassword(password, sal);
  return { iteraciones: ITERACIONES, sal: aB64(sal), ...(await envolver(dek, kek)) };
}

// ── almacenamiento ────────────────────────────────────────────────────────

export function leerSobre() {
  try {
    const raw = localStorage.getItem(LLAVE_BOVEDA);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function escribirSobre(sobre) {
  localStorage.setItem(LLAVE_BOVEDA, JSON.stringify(sobre));
}

export const hayBoveda = () => Boolean(leerSobre());

export function borrarBoveda() {
  localStorage.removeItem(LLAVE_BOVEDA);
}

async function sellar(dek, datos) {
  const iv = azar(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dek, enc.encode(JSON.stringify(datos)));
  return { iv: aB64(iv), ct: aB64(ct) };
}

async function abrir(dek, sobre) {
  const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(sobre.iv) }, dek, deB64(sobre.ct));
  return { ...datosVacios(), ...JSON.parse(dec.decode(plano)) };
}

// ── API ───────────────────────────────────────────────────────────────────

/** Crea la bóveda. Devuelve la DEK, que es la "sesión" mientras esté abierta. */
export async function crearBoveda(password, datos = datosVacios()) {
  const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  escribirSobre({
    formato: FORMATO,
    v: 2,
    llaves: { password: await llavePassword(dek, password) },
    ...(await sellar(dek, datos)),
  });
  return dek;
}

/** Lanza Error("Contraseña incorrecta") si no abre. */
export async function abrirConPassword(password) {
  const sobre = leerSobre();
  const l = sobre.llaves.password;
  try {
    const dek = await desenvolver(l, await kekDePassword(password, deB64(l.sal), l.iteraciones));
    return { dek, datos: await abrir(dek, sobre) };
  } catch {
    throw new Error("Contraseña incorrecta");
  }
}

export async function abrirConPrf(secreto) {
  const sobre = leerSobre();
  const dek = await desenvolver(sobre.llaves.faceid, await kekDePrf(secreto));
  return { dek, datos: await abrir(dek, sobre) };
}

export async function guardar(dek, datos) {
  const sobre = leerSobre();
  escribirSobre({ ...sobre, ...(await sellar(dek, datos)) });
}

/** Re-envuelve la DEK con otra contraseña. Los datos no cambian. */
export async function cambiarPassword(dek, nueva) {
  const sobre = leerSobre();
  escribirSobre({ ...sobre, llaves: { ...sobre.llaves, password: await llavePassword(dek, nueva) } });
}

export const datosFaceId = () => leerSobre()?.llaves?.faceid ?? null;

export async function ponerFaceId(dek, { credencial, salPrf, secreto }) {
  const sobre = leerSobre();
  const llave = { credencial, salPrf, ...(await envolver(dek, await kekDePrf(secreto))) };
  escribirSobre({ ...sobre, llaves: { ...sobre.llaves, faceid: llave } });
}

export function quitarFaceId() {
  const sobre = leerSobre();
  if (!sobre?.llaves?.faceid) return;
  const { faceid, ...resto } = sobre.llaves;
  escribirSobre({ ...sobre, llaves: resto });
}

// ── copias ────────────────────────────────────────────────────────────────

/**
 * Copia cifrada portátil: los datos con una contraseña concreta, sin la llave
 * de Face ID (que solo vale en este dispositivo).
 */
export async function copiaCifrada(datos, password) {
  const sal = azar(16);
  const kek = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: ITERACIONES },
    await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]),
    { name: "AES-GCM", length: 256 }, false, ["encrypt"]
  );
  const iv = azar(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, enc.encode(JSON.stringify(datos)));
  // Mismo formato que las copias de StadisticWallet, así sirven en los dos lados.
  return {
    format: "stadistic-vault", v: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERACIONES, salt: aB64(sal) },
    iv: aB64(iv), ct: aB64(ct),
  };
}

export const esCopiaCifrada = (o) => o?.format === "stadistic-vault" && typeof o.ct === "string";

export async function abrirCopia(copia, password) {
  const kek = await kekDePassword(password, deB64(copia.kdf.salt), copia.kdf.iterations);
  try {
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(copia.iv) }, kek, deB64(copia.ct));
    return { ...datosVacios(), ...JSON.parse(dec.decode(plano)) };
  } catch {
    throw new Error("Contraseña incorrecta");
  }
}

export function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
