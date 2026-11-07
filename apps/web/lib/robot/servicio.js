// Ejecuta el robot un día: lee su estado, pide precios a Kraken, avanza y
// guarda. Lo llama la tarea diaria (y el botón "Ejecutar hoy" de la app).

import { leer, guardar } from "../kvpropio";
import { CESTA, cierresDiarios, preciosActuales } from "./kraken";
import { avanzar, estadoInicial, valorSiVendo } from "./motor";

const CLAVE = "mesa:robot";
const hoy = () => new Date().toISOString().slice(0, 10);

export const leerRobot = () => leer(CLAVE, null);
export const guardarRobot = (e) => guardar(CLAVE, e);

export async function ejecutarDia() {
  const fecha = hoy();
  let estado = await leerRobot();
  if (!estado) estado = estadoInicial({ activos: CESTA.map(([c]) => c), inicial: 50, semanal: 10, fecha });
  if (estado.ultimoDia === fecha) return { estado, avisos: [], yaHecho: true };
  if (estado.pausado) return { estado, avisos: [], pausado: true };

  const historico = await cierresDiarios();
  const precios = await preciosActuales();
  // Solo cierres de días anteriores a hoy (la señal nunca ve el día en curso).
  const cierres = Object.fromEntries(Object.entries(historico).map(([c, h]) => [c, h.cierres.filter((_, j) => h.fechas[j] < fecha)]));
  const { avisos } = avanzar(estado, { fecha, cierres, precios });
  estado.ultimosPrecios = precios;
  estado.ultimoError = null;
  await guardarRobot(estado);
  return { estado, avisos };
}

/** Resumen para la app y para el aviso de los lunes. */
export function resumen(estado) {
  if (!estado) return null;
  const precios = estado.ultimosPrecios || {};
  const h = estado.historial;
  const ult = h[h.length - 1];
  const hace7 = h[Math.max(0, h.length - 8)];
  const aportado = ult?.aportado ?? 0;
  const valor = ult ? valorSiVendo(estado, precios) : 0;
  // Variación de la semana sin contar lo aportado en ella.
  const semana = ult && hace7 && hace7 !== ult ? (ult.valor - (ult.aportado - hace7.aportado)) / hace7.valor - 1 : 0;
  // Con menos de una semana de historial cuentan todas las operaciones.
  const desde = h.length > 7 ? h[h.length - 8].fecha : "";
  const semanaOps = estado.operaciones.filter((o) => o.fecha > desde).length;
  const partes = Object.fromEntries(Object.entries(estado.partes).map(([id, P]) => [id, {
    valor: P.ultimoValor ?? P.aportado, aportado: P.aportado, frenado: P.frenado, exposicion: P.exposicion,
    diasFuera: P.diasFuera, decision: P.decision, frenazos: P.frenazos,
    agentes: P.agentes.length, reserva: P.reserva,
    posiciones: Object.fromEntries(estado.activos.map((a) => [a, P.agentes.reduce((s, ag) => s + ag.uds[a] * (precios[a] ?? ag.ultimo[a] ?? 0), 0)]).filter(([, v]) => v > 0.005)),
  }]));
  return {
    modo: estado.modo, inicio: estado.inicio, ultimoDia: estado.ultimoDia, dias: estado.dia, pausado: estado.pausado,
    valor, aportado, resultado: valor - aportado, semana, semanaOps,
    historial: h.slice(-120), operaciones: estado.operaciones.slice(0, 40), partes, ultimoError: estado.ultimoError ?? null,
  };
}

export function textoSemanal(r) {
  const signo = (x) => (x >= 0 ? "+" : "");
  return `Valor ${r.valor.toFixed(2)} € (aportado ${r.aportado.toFixed(2)} €, ${signo(r.resultado)}${r.resultado.toFixed(2)} €). ` +
    `Semana: ${signo(r.semana)}${(r.semana * 100).toFixed(1)} %, ${r.semanaOps} operaciones.` +
    (Object.values(r.partes).some((p) => p.frenado) ? " Freno activo en alguna parte." : "");
}
