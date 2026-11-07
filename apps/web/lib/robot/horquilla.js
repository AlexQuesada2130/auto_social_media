// Horquilla de precio a N días: entre qué valores suele acabar una cripto,
// remuestreando por bloques de 5 días sus movimientos diarios del último año.
// No predice si sube o baja. Sin dependencias, para poder probarla suelta.

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const semilla = (texto) => [...texto].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/** Horquilla a `dias` días: percentiles 5, 50 y 95 del precio, por bloques de 5 días. */
export function horquilla(cierres, precio, { dias = 30, sims = 2000, clave = "" } = {}) {
  const c = cierres.slice(-366);
  if (c.length < 60) return null;
  const r = [];
  for (let i = 1; i < c.length; i++) r.push(Math.log(c[i] / c[i - 1]));
  const azar = mulberry32(semilla(clave));
  const finales = new Float64Array(sims);
  const B = 5;
  for (let s = 0; s < sims; s++) {
    let suma = 0;
    for (let d = 0; d < dias; ) {
      const ini = Math.floor(azar() * (r.length - B));
      for (let j = 0; j < B && d < dias; j++, d++) suma += r[ini + j];
    }
    finales[s] = precio * Math.exp(suma);
  }
  finales.sort();
  const q = (p) => finales[Math.floor(p * (sims - 1))];
  return { dias, p5: q(0.05), p50: q(0.5), p95: q(0.95) };
}

