// Monitor de mercado: precios en vivo, cierres, señales y horquillas.
//
// Los cierres diarios cambian una vez al día: se guardan en Upstash (los
// renueva el robot cada mañana o la primera visita del día). El precio en
// vivo es una sola petición a Kraken con 10 s de caché.
//
// La horquilla NO predice si sube o baja: dice entre qué precios suele acabar
// cada cripto a 30 días, remuestreando sus movimientos diarios del último año.

import { leer, guardar } from "../kvpropio";
import { CESTA, cierresDiarios, preciosActuales } from "./kraken";
import { horquilla } from "./horquilla";

const CLAVE = "mesa:cierres";
const hoy = () => new Date().toISOString().slice(0, 10);

let cacheVivo = { ts: 0, precios: null };
export async function preciosEnVivo() {
  if (cacheVivo.precios && Date.now() - cacheVivo.ts < 10_000) return cacheVivo.precios;
  const precios = await preciosActuales();
  cacheVivo = { ts: Date.now(), precios };
  return precios;
}

/** Cierres de días ya terminados, del almacén o de Kraken si son de otro día. */
export async function cierresDelDia(historico = null) {
  const fecha = hoy();
  if (historico) { await guardar(CLAVE, { fecha, datos: historico }); return historico; }
  const guardado = await leer(CLAVE, null);
  if (guardado?.fecha === fecha) return guardado.datos;
  const datos = await cierresDiarios();
  await guardar(CLAVE, { fecha, datos });
  return datos;
}

const media = (c, n) => (c.length < n ? NaN : c.slice(-n).reduce((s, x) => s + x, 0) / n);

/** Todo lo que pinta el monitor, cripto a cripto, en el orden de la cesta. */
export async function monitor() {
  const [historico, precios] = await Promise.all([cierresDelDia(), preciosEnVivo()]);
  const fecha = hoy();
  return CESTA.map(([cripto]) => {
    const h = historico[cripto] ?? { fechas: [], cierres: [] };
    const cierres = h.cierres.filter((_, j) => h.fechas[j] < fecha);
    const precio = precios[cripto] ?? cierres[cierres.length - 1];
    const ayer = cierres[cierres.length - 1];
    const sma100 = media(cierres, 100);
    return {
      cripto, precio,
      cambio: ayer ? precio / ayer - 1 : null,
      chispa: cierres.slice(-30).concat(precio),
      sma100: Number.isFinite(sma100) ? sma100 : null,
      sobreMedia: Number.isFinite(sma100) ? precio > sma100 : null,
      // Cuánto tendría que moverse el precio para cruzar su media.
      aCruce: Number.isFinite(sma100) ? sma100 / precio - 1 : null,
      horquilla: horquilla(cierres, precio, { clave: `${fecha}-${cripto}` }),
    };
  });
}
