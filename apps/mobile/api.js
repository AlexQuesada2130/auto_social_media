// Única puerta al servidor. Guarda el token y lo adjunta a cada llamada.
//
// La URL sale de app.json -> extra.apiUrl. En desarrollo apunta a la IP del
// Mac en la red local; en producción, al dominio de Vercel.

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const BASE =
  Constants.expoConfig?.extra?.apiUrl?.replace(/\/$/, "") ||
  "http://localhost:3000";

const LLAVE = "mesa.token";

let token = null;

export async function cargarToken() {
  token = await AsyncStorage.getItem(LLAVE);
  return token;
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
  await AsyncStorage.setItem(LLAVE, nuevo);
  return nuevo;
}

export async function salir() {
  token = null;
  await AsyncStorage.removeItem(LLAVE);
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

export const urlBase = BASE;
