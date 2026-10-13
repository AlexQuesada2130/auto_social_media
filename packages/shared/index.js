// Tipos y reglas que comparten la web y el móvil.
// Un solo sitio donde cambiar el límite o los estados.

export const LIMITE_CARACTERES = 3000;

// Cuántas propuestas sin gestionar se toleran en la cola. Pasado ese punto,
// generar más es ruido: lo que sobra no se lee, se ignora.
export const TOPE_PENDIENTES = 20;

/** Un título de un vistazo, sacado del propio texto si no viene dado. */
export function tituloDe(texto) {
  const primera = (texto || "").trim().split("\n")[0];
  if (primera.length <= 58) return primera;
  const corte = primera.lastIndexOf(" ", 58);
  return primera.slice(0, corte > 30 ? corte : 58) + "…";
}

// LinkedIn corta el post aquí y muestra "…ver más".
// Lo que vaya después de este punto solo lo lee quien ya decidió seguir.
export const PLIEGUE = 210;

export const ESTADOS = ["pendiente", "aprobado", "descartado", "publicado"];

/**
 * Tasa de interacción: el porcentaje de quien lo vio que hizo algo.
 *
 * Es la métrica honesta. Las impresiones solas solo dicen a cuánta gente se lo
 * enseñó LinkedIn, que depende más del algoritmo que del post. Esta dice
 * cuántos de los que lo vieron reaccionaron, y eso sí es del texto.
 */
export function tasaInteraccion(m) {
  if (!m?.impresiones) return null;
  const acciones = (m.reacciones || 0) + (m.comentarios || 0) + (m.compartidos || 0);
  return (acciones / m.impresiones) * 100;
}

/** Un comentario cuesta mucho más que un "me gusta", y vale más. */
export function pesoConversacion(m) {
  if (!m?.reacciones) return null;
  return ((m.comentarios || 0) / m.reacciones) * 100;
}

/** Cómo de bien fue, en palabras. Los cortes salen de la media de LinkedIn. */
export function comoFue(m) {
  const t = tasaInteraccion(m);
  if (t === null) return { etiqueta: "sin datos", nivel: "ninguno" };
  if (t >= 6) return { etiqueta: "muy bien", nivel: "alto" };
  if (t >= 3) return { etiqueta: "bien", nivel: "medio" };
  if (t >= 1.5) return { etiqueta: "normal", nivel: "medio" };
  return { etiqueta: "flojo", nivel: "bajo" };
}

/** Por qué descartaste algo. Lo lee la rutina para dejar de traer lo mismo. */
export const MOTIVOS_DESCARTE = [
  { id: "tema", nombre: "El tema no me interesa" },
  { id: "tono", nombre: "No suena a mí" },
  { id: "repetido", nombre: "Ya he dicho esto" },
  { id: "flojo", nombre: "El ángulo es flojo" },
  { id: "otro", nombre: "Otro motivo" },
];

export const CAMPOS_METRICA = [
  { id: "impresiones", nombre: "Impresiones", ayuda: "cuánta gente lo vio" },
  { id: "reacciones", nombre: "Reacciones", ayuda: "me gusta y similares" },
  { id: "comentarios", nombre: "Comentarios", ayuda: "los que escribieron algo" },
  { id: "compartidos", nombre: "Compartidos", ayuda: "los que lo republicaron" },
];

export function nuevoBorrador({ texto, origen = "propuesta", notaVisual = "", promptVisual = "", titulo = "" }) {
  const ahora = new Date().toISOString();
  return {
    id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    texto,
    titulo: titulo || tituloDe(texto),
    origen,
    notaVisual,
    promptVisual,
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
