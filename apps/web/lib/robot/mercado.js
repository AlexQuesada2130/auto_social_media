// Monitor de mercado: precios en vivo, cierres, señales y horquillas.
//
// Los cierres diarios cambian una vez al día: se guardan en Upstash (los
// renueva el robot cada mañana o la primera visita del día). El precio en
// vivo es una sola petición a Kraken con 10 s de caché.
//
// La horquilla NO predice si sube o baja: dice entre qué precios suele acabar
// cada cripto a 30 días, remuestreando sus movimientos diarios del último año.

import { leer, guardar, reservar, existe } from "../kvpropio";
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

/**
 * Cierres de días ya terminados. Devuelve { datos, fecha, deAyer }.
 *  - Si los guardados son de hoy, se sirven sin más.
 *  - Si son de otro día, solo UNA petición a la vez los renueva (candado de
 *    90 s); las demás sirven los guardados. Si la descarga falla, se sirven
 *    los guardados y no se reintenta en 10 minutos: un fallo de Kraken no se
 *    convierte en un bucle de reintentos. Para una horquilla a 30 días, un
 *    cierre de ayer no cambia nada.
 */
export async function cierresDelDia(historico = null) {
  const fecha = hoy();
  if (historico) { await guardar(CLAVE, { fecha, datos: historico }); return { datos: historico, fecha, deAyer: false }; }
  const guardado = await leer(CLAVE, null);
  if (guardado?.fecha === fecha) return { ...guardado, deAyer: false };
  if (await reservar(`${CLAVE}:descargando`, 90)) {
    try {
      const datos = await cierresDiarios();
      await guardar(CLAVE, { fecha, datos });
      return { datos, fecha, deAyer: false };
    } catch (e) {
      await reservar(`${CLAVE}:pausa`, 600);
      if (!guardado) throw e;
    }
  }
  if (guardado) return { ...guardado, deAyer: true };
  throw new Error("Descargando el histórico de precios; vuelve a intentarlo en unos segundos");
}

const media = (c, n) => (c.length < n ? NaN : c.slice(-n).reduce((s, x) => s + x, 0) / n);

/** Todo lo que pinta el monitor, cripto a cripto, en el orden de la cesta. */
export async function monitor() {
  const [{ datos: historico, fecha: fechaCierres, deAyer }, precios] = await Promise.all([cierresAhora(), preciosEnVivo()]);
  const fecha = hoy();
  const criptos = CESTA.map(([cripto]) => {
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
  return { criptos, cierresDe: fechaCierres, deAyer };
}

/** Respeta la pausa tras un fallo: mientras dure, solo se sirve lo guardado. */
async function cierresAhora() {
  const guardado = await leer(CLAVE, null);
  if (guardado && guardado.fecha !== hoy() && (await existe(`${CLAVE}:pausa`))) return { ...guardado, deAyer: true };
  return cierresDelDia();
}
