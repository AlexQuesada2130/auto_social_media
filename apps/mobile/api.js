// Única puerta al servidor. Guarda el token y lo adjunta a cada llamada.
//
// La URL sale de app.json -> extra.apiUrl. En desarrollo apunta a la IP del
// Mac en la red local; en producción, al dominio de Vercel.

import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const BASE =
  Constants.expoConfig?.extra?.apiUrl?.replace(/\/$/, "") ||
  "http://localhost:3000";

const LLAVE = "mesa.token";

// El token vive en el llavero de iOS, no en almacenamiento plano. Si alguien
// se lleva el teléfono desbloqueado da igual, pero una copia de seguridad o un
// volcado del disco ya no lo entregan.
const OPCIONES = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let token = null;

export async function cargarToken() {
  try {
    token = await SecureStore.getItemAsync(LLAVE, OPCIONES);
  } catch {
    token = null;
  }
  return token;
}

/** Hay sesión guardada, sin leerla todavía. Para decidir si pedir Face ID. */
export async function haySesion() {
  try {
    return Boolean(await SecureStore.getItemAsync(LLAVE, OPCIONES));
  } catch {
    return false;
  }
}

export async function entrar(password) {
  const res = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("Contraseña incorrecta");
  const { token: nuevo } = await res.json();
  token = nuevo;
  await SecureStore.setItemAsync(LLAVE, nuevo, OPCIONES);
  return nuevo;
}

export async function salir() {
  token = null;
  await SecureStore.deleteItemAsync(LLAVE, OPCIONES).catch(() => {});
}

async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: {
      ...(opciones.headers || {}),
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    await salir();
    const e = new Error("La sesión ha caducado");
    e.sesionCaducada = true;
    throw e;
  }
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || `El servidor respondió ${res.status}`);
  }
  return res.json();
}

export const listar = () => pedir("/api/drafts");
export const crear = (texto, origen = "idea tuya") =>
  pedir("/api/drafts", { method: "POST", body: JSON.stringify({ texto, origen }) });
export const parchear = (id, cambios) =>
  pedir(`/api/drafts/${id}`, { method: "PATCH", body: JSON.stringify(cambios) });

export const registrarPush = (token) =>
  pedir("/api/push/register", { method: "POST", body: JSON.stringify({ token }) });

/** El puente del Mac necesita el mismo token; no se guarda contraseña. */
export const tokenActual = () => token;

export const urlBase = BASE;
