// Almacén para lo que no es de la cola de LinkedIn (recordatorios, robot).
// Mismo Upstash que lib/store.js, con sus propias claves para no tocarlo.
// En Vercel exige Upstash: el disco se borra entre peticiones y guardar ahí
// haría que los datos parecieran guardarse y luego se esfumaran.

import { promises as fs } from "node:fs";
import path from "node:path";

// Los mismos nombres de variable que busca lib/store.js.
const primera = (...nombres) => nombres.map((n) => process.env[n]).find(Boolean);
const URL_KV = primera("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_KV_REST_API_URL", "KV_REST_API_URL");
const TOKEN_KV = primera("UPSTASH_REDIS_REST_TOKEN", "UPSTASH_REDIS_REST_KV_REST_API_TOKEN", "KV_REST_API_TOKEN");
const hayKV = Boolean(URL_KV && TOKEN_KV);
const DIR = path.join(process.cwd(), "..", "..", "data");

function exigirKV() {
  if (!hayKV && process.env.VERCEL) throw new Error("Faltan las variables de Upstash");
}

async function kv(comando) {
  const r = await fetch(URL_KV, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN_KV}`, "Content-Type": "application/json" },
    body: JSON.stringify(comando),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Upstash respondió ${r.status}`);
  return (await r.json()).result;
}

const archivo = (clave) => path.join(DIR, `${clave.replace(/[^a-z0-9-]/gi, "_")}.json`);

export async function leer(clave, porDefecto = null) {
  exigirKV();
  try {
    const crudo = hayKV ? await kv(["GET", clave]) : await fs.readFile(archivo(clave), "utf8");
    return crudo ? JSON.parse(crudo) : porDefecto;
  } catch (e) {
    if (e.code === "ENOENT") return porDefecto;
    throw e;
  }
}

export async function guardar(clave, valor) {
  exigirKV();
  const texto = JSON.stringify(valor);
  if (hayKV) await kv(["SET", clave, texto]);
  else { await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(archivo(clave), texto); }
  return valor;
}
