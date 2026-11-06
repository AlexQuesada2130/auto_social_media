// Preferencias de recordatorios. Solo datos que no dicen nada de tu dinero:
// el día del mes en que quieres el aviso de los fondos.
//
// Mismo almacén que el resto (Upstash si hay variables, archivo en local),
// con su propia clave para no tocar lib/store.js.

import { promises as fs } from "node:fs";
import path from "node:path";

// Los mismos nombres de variable que busca lib/store.js.
const primera = (...nombres) => nombres.map((n) => process.env[n]).find(Boolean);
const URL_KV = primera("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_KV_REST_API_URL", "KV_REST_API_URL");
const TOKEN_KV = primera("UPSTASH_REDIS_REST_TOKEN", "UPSTASH_REDIS_REST_KV_REST_API_TOKEN", "KV_REST_API_TOKEN");
const hayKV = Boolean(URL_KV && TOKEN_KV);
const CLAVE = "mesa:recordatorios";
const ARCHIVO = path.join(process.cwd(), "..", "..", "data", "recordatorios.json");

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

export async function leerRecordatorios() {
  try {
    const crudo = hayKV ? await kv(["GET", CLAVE]) : await fs.readFile(ARCHIVO, "utf8");
    return crudo ? JSON.parse(crudo) : {};
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
}

export async function guardarRecordatorios(datos) {
  const texto = JSON.stringify(datos);
  if (hayKV) await kv(["SET", CLAVE, texto]);
  else { await fs.mkdir(path.dirname(ARCHIVO), { recursive: true }); await fs.writeFile(ARCHIVO, texto); }
  return datos;
}
