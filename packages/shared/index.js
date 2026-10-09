// Tipos y reglas que comparten la web y el móvil.
// Un solo sitio donde cambiar el límite o los estados.

export const LIMITE_CARACTERES = 3000;

// LinkedIn corta el post aquí y muestra "…ver más".
// Lo que vaya después de este punto solo lo lee quien ya decidió seguir.
export const PLIEGUE = 210;

export const ESTADOS = ["pendiente", "aprobado", "descartado", "publicado"];

export function nuevoBorrador({ texto, origen = "propuesta", notaVisual = "" }) {
  const ahora = new Date().toISOString();
  return {
    id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    texto,
    origen,
    notaVisual,
    estado: "pendiente",
    creado: ahora,
    actualizado: ahora,
  };
}

/** Parte el texto por el pliegue, para pintar dónde cae el "ver más". */
export function partirPorPliegue(texto) {
  if (texto.length <= PLIEGUE) return [texto, ""];
  let corte = texto.lastIndexOf(" ", PLIEGUE);
  if (corte < PLIEGUE * 0.6) corte = PLIEGUE;
  return [texto.slice(0, corte), texto.slice(corte).replace(/^\s+/, "")];
}

/** Señales de texto generado que se pueden medir sin modelo. */
export function revisar(texto) {
  const avisos = [];
  if (texto.includes("—")) avisos.push("Lleva guiones largos");
  if (/[“”‘’]/.test(texto)) avisos.push("Lleva comillas tipográficas");
  if (/[​-‍﻿⁠­]/.test(texto)) avisos.push("Lleva caracteres invisibles");
  if (/\bno es solo\b.{0,40}\bes\b/i.test(texto)) avisos.push('Usa la fórmula "no es solo X, es Y"');
  if (texto.length > LIMITE_CARACTERES) avisos.push(`Se pasa en ${texto.length - LIMITE_CARACTERES} caracteres`);
  if (/\{\{[^}]+\}\}/.test(texto)) avisos.push("Tiene huecos sin rellenar");
  return avisos;
}

export const URL_COMPOSITOR = "https://www.linkedin.com/feed/?shareActive=true&text=";
