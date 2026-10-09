#!/usr/bin/env node
// Mete un borrador en la cola desde la terminal.
//
//   node scripts/proponer.mjs borrador.txt --origen "repesca" --visual "captura del panel"
//
// Lee la contraseña de MESA_PASSWORD y la URL de MESA_URL
// (por defecto http://localhost:3000).

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith("--"));
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i === -1 ? undefined : args[i + 1];
};

if (!archivo) {
  console.error("uso: node scripts/proponer.mjs <archivo.txt> [--origen X] [--visual Y]");
  process.exit(1);
}

const BASE = (process.env.MESA_URL || "http://localhost:3000").replace(/\/$/, "");
const password = process.env.MESA_PASSWORD;
if (!password) {
  console.error("falta MESA_PASSWORD en el entorno");
  process.exit(1);
}

const texto = readFileSync(archivo, "utf8").trim();

const auth = await fetch(`${BASE}/api/auth`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
if (!auth.ok) {
  console.error("no se pudo entrar: contraseña incorrecta");
  process.exit(1);
}
const { token } = await auth.json();

const res = await fetch(`${BASE}/api/drafts`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ texto, origen: opcion("origen"), notaVisual: opcion("visual") }),
});

if (!res.ok) {
  const { error } = await res.json().catch(() => ({}));
  console.error(`no se pudo crear: ${error || res.status}`);
  process.exit(1);
}
const { borrador } = await res.json();
console.log(`añadido ${borrador.id} (${texto.length} caracteres)`);
