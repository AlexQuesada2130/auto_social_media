// Almacén de borradores.
//
// En Vercel usa Upstash Redis por REST (sin SDK, solo fetch). En local, si no
// hay variables de entorno, cae a un archivo JSON. La misma interfaz en ambos,
// para que el código de arriba no sepa dónde está.

import { promises as fs } from "node:fs";
import path from "node:path";

const CLAVE = "mesa:borradores";
const CLAVE_TOKENS = "mesa:tokens";
const CLAVE_SUBS = "mesa:subs";
const URL_KV = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_KV = process.env.UPSTASH_REDIS_REST_TOKEN;
const ARCHIVO = path.join(process.cwd(), "..", "..", "data", "local.json");
const ARCHIVO_TOKENS = path.join(process.cwd(), "..", "..", "data", "tokens.json");
const ARCHIVO_SUBS = path.join(process.cwd(), "..", "..", "data", "subs.json");

const hayKV = Boolean(URL_KV && TOKEN_KV);

async function kv(comando) {
  const res = await fetch(URL_KV, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN_KV}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(comando),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash respondió ${res.status}: ${await res.text()}`);
  }
  const { result } = await res.json();
  return result;
}

async function leerArchivo(ruta = ARCHIVO) {
  try {
    return JSON.parse(await fs.readFile(ruta, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function escribirArchivo(lista, ruta = ARCHIVO) {
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  await fs.writeFile(ruta, JSON.stringify(lista, null, 2) + "\n");
}

export async function listar() {
  const crudo = hayKV ? await kv(["GET", CLAVE]) : null;
  const lista = hayKV ? (crudo ? JSON.parse(crudo) : []) : await leerArchivo();
  // Más recientes primero: es el orden en que se revisan.
  return lista.sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
}

export async function guardarTodos(lista) {
  if (hayKV) await kv(["SET", CLAVE, JSON.stringify(lista)]);
  else await escribirArchivo(lista);
  return lista;
}

export async function anadir(borrador) {
  const lista = await listar();
  lista.unshift(borrador);
  await guardarTodos(lista);
  return borrador;
}

export async function parchear(id, cambios) {
  const lista = await listar();
  const i = lista.findIndex((d) => d.id === id);
  if (i === -1) return null;
  lista[i] = { ...lista[i], ...cambios, actualizado: new Date().toISOString() };
  await guardarTodos(lista);
  return lista[i];
}

export async function borrar(id) {
  const lista = await listar();
  const quedan = lista.filter((d) => d.id !== id);
  if (quedan.length === lista.length) return false;
  await guardarTodos(quedan);
  return true;
}

// --- tokens de push -------------------------------------------------------

export async function listarTokens() {
  if (hayKV) {
    const crudo = await kv(["GET", CLAVE_TOKENS]);
    return crudo ? JSON.parse(crudo) : [];
  }
  return leerArchivo(ARCHIVO_TOKENS);
}

/** Idempotente: registrar el mismo teléfono dos veces no lo duplica. */
export async function registrarToken(token) {
  const tokens = await listarTokens();
  if (tokens.includes(token)) return tokens;
  const nuevos = [...tokens, token];
  if (hayKV) await kv(["SET", CLAVE_TOKENS, JSON.stringify(nuevos)]);
  else await escribirArchivo(nuevos, ARCHIVO_TOKENS);
  return nuevos;
}

export async function olvidarTokens(caducados) {
  if (!caducados?.length) return;
  const tokens = await listarTokens();
  const quedan = tokens.filter((t) => !caducados.includes(t));
  if (hayKV) await kv(["SET", CLAVE_TOKENS, JSON.stringify(quedan)]);
  else await escribirArchivo(quedan, ARCHIVO_TOKENS);
}

// --- suscripciones de la PWA ----------------------------------------------

export async function listarSubs() {
  if (hayKV) {
    const crudo = await kv(["GET", CLAVE_SUBS]);
    return crudo ? JSON.parse(crudo) : [];
  }
  return leerArchivo(ARCHIVO_SUBS);
}

/** El endpoint identifica al navegador: re-suscribirse no duplica. */
export async function registrarSub(sub) {
  const subs = await listarSubs();
  const otras = subs.filter((s) => s.endpoint !== sub.endpoint);
  const nuevas = [...otras, sub];
  if (hayKV) await kv(["SET", CLAVE_SUBS, JSON.stringify(nuevas)]);
  else await escribirArchivo(nuevas, ARCHIVO_SUBS);
  return nuevas;
}

export async function olvidarSubs(endpoints) {
  if (!endpoints?.length) return;
  const subs = await listarSubs();
  const quedan = subs.filter((s) => !endpoints.includes(s.endpoint));
  if (hayKV) await kv(["SET", CLAVE_SUBS, JSON.stringify(quedan)]);
  else await escribirArchivo(quedan, ARCHIVO_SUBS);
}

export const dondeGuarda = hayKV ? "upstash" : "archivo local";
