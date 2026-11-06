// Motor del robot, un día cada vez. Es el mismo plan que se midió en el
// laboratorio (lab/plan.mjs) con 10.000 escenarios, reescrito para avanzar
// paso a paso guardando el estado entre ejecuciones:
//
//   - Núcleo (70 %): cesta BTC 40 / ETH 20 / resto 40 a partes iguales,
//     compra cada semana con la aportación y reequilibra cada 30 días.
//   - Satélite (30 %): tendencia por moneda: cada cripto mientras su precio
//     está sobre su media de 100 días; si no, ese hueco queda en efectivo.
//   - Clones: el agente que duplica su base vuelve a ella; el excedente va
//     mitad a un clon nuevo y mitad a la reserva, que rescata a quien caiga
//     por debajo de la mitad de su base.
//   - Freno: si el rendimiento cae un 25 % desde su mejor momento, vende la
//     mitad y te pregunta. Sin respuesta en 30 días, recompra en 2 tramos
//     semanales. Puedes decir "volver ya" o "salir del todo".
//
// Las señales usan cierres hasta ayer; las operaciones, el precio de ahora.
// No sabe de dinero real: en papel, las operaciones solo se anotan.

export const COSTE = 0.005;      // comisión + deslizamiento por operación
export const FRENO = 0.25;
export const DIAS_SIN_RESPUESTA = 30;

export const PARTES = {
  nucleo: { nombre: "Acumulación", fraccion: 0.7, reequilibrio: 30, estrategia: "cesta" },
  satelite: { nombre: "Trading por tendencia", fraccion: 0.3, reequilibrio: 7, estrategia: "tendencia" },
};

// ── Estrategias: pesos con cierres hasta ayer ─────────────────────────────
function media(cierres, n) {
  if (cierres.length < n) return NaN;
  let s = 0;
  for (let j = cierres.length - n; j < cierres.length; j++) s += cierres[j];
  return s / n;
}

export function pesos(estrategia, activos, cierres) {
  const w = Object.fromEntries(activos.map((a) => [a, 0]));
  const vivas = activos.filter((a) => cierres[a]?.length);
  if (estrategia === "cesta") {
    if (cierres.BTC?.length) w.BTC = 0.4;
    if (cierres.ETH?.length) w.ETH = 0.2;
    const resto = vivas.filter((a) => a !== "BTC" && a !== "ETH");
    for (const a of resto) w[a] = 0.4 / resto.length;
  } else {
    for (const a of vivas) {
      const c = cierres[a];
      if (c[c.length - 1] > media(c, 100)) w[a] = 1 / vivas.length;
    }
  }
  return w;
}

// ── Estado ────────────────────────────────────────────────────────────────
const nuevoAgente = (base, activos) => ({
  base, umbral: 2 * base, cash: base,
  uds: Object.fromEntries(activos.map((a) => [a, 0])),
  coste: Object.fromEntries(activos.map((a) => [a, 0])),
  ultimo: Object.fromEntries(activos.map((a) => [a, 0])),
});

export function estadoInicial({ activos, inicial = 50, semanal = 10, fecha }) {
  const partes = {};
  for (const [id, p] of Object.entries(PARTES)) {
    const b = inicial * p.fraccion;
    partes[id] = {
      agentes: [nuevoAgente(b, activos)], reserva: 0, aportado: b, participaciones: b, maxNav: 1,
      frenado: false, diasFuera: 0, tramoVuelta: 0, exposicion: 1, frenazos: 0, decision: null,
      objetivo: null, realizado: 0,
    };
  }
  return { version: 1, modo: "papel", activos, inicial, semanal, inicio: fecha, ultimoDia: null, dia: 0, pausado: false, partes, historial: [], operaciones: [], avisos: [] };
}

// ── Un día ────────────────────────────────────────────────────────────────
/**
 * Avanza un día. `cierres` = { cripto: [cierres diarios hasta ayer] },
 * `precios` = { cripto: precio de ahora }. Devuelve el estado nuevo (muta el
 * que recibe) y los avisos que hay que mandar al móvil.
 */
export function avanzar(estado, { fecha, cierres, precios }) {
  const avisos = [];
  if (estado.ultimoDia === fecha || estado.pausado) return { estado, avisos };
  const activos = estado.activos;
  const dia = estado.dia;
  const vivo = (a) => Number.isFinite(precios[a]) && precios[a] > 0;
  const anotar = (parte, tipo, a, importe, precio) => estado.operaciones.unshift({ fecha, parte, tipo, cripto: a, importe: +importe.toFixed(4), precio });

  for (const [id, cfg] of Object.entries(PARTES)) {
    const P = estado.partes[id];
    const precio = (ag, a) => (vivo(a) ? precios[a] : ag.ultimo[a]);
    const valor = (ag) => activos.reduce((v, a) => v + (ag.uds[a] > 0 ? ag.uds[a] * precio(ag, a) : 0), ag.cash);
    const total = () => P.reserva + P.agentes.reduce((s, ag) => s + valor(ag), 0);

    const vender = (ag, a, uds, p) => {
      if (uds <= 0) return;
      const neto = uds * p * (1 - COSTE);
      const cv = ag.coste[a] * (uds / ag.uds[a]);
      P.realizado += neto - cv; ag.coste[a] -= cv; ag.uds[a] -= uds; ag.cash += neto;
      anotar(id, "venta", a, neto, p);
    };
    const comprar = (ag, a, gasto, p) => {
      gasto = Math.min(gasto, ag.cash);
      if (gasto <= 1e-9) return;
      ag.uds[a] += (gasto * (1 - COSTE)) / p; ag.coste[a] += gasto; ag.cash -= gasto;
      anotar(id, "compra", a, gasto, p);
    };
    const ajustar = (ag, w, expo) => {
      const v = valor(ag);
      for (let pasada = 0; pasada < 2; pasada++) {
        for (const a of activos) {
          if (!vivo(a)) continue;
          const quiere = (w[a] * expo * v) / precios[a];
          const dif = (quiere - ag.uds[a]) * precios[a];
          if (pasada === 0 && dif < -0.02 * v) vender(ag, a, ag.uds[a] - quiere, precios[a]);
          if (pasada === 1 && dif > 0.02 * v) comprar(ag, a, dif, precios[a]);
        }
      }
    };

    // Cripto que deja de cotizar con posición abierta: se vende al último precio.
    for (const ag of P.agentes) for (const a of activos) {
      if (vivo(a)) ag.ultimo[a] = precios[a];
      else if (ag.uds[a] > 0) vender(ag, a, ag.uds[a], ag.ultimo[a]);
    }

    // "Salir del todo": se vende lo que quedaba invertido tras el freno.
    if (P.frenado && P.decision === "salir") {
      for (const ag of P.agentes) for (const a of activos) if (ag.uds[a] > 0) vender(ag, a, ag.uds[a], precio(ag, a));
    }

    let toca = dia % cfg.reequilibrio === 0;
    const ag0 = P.agentes[0];
    if (dia > 0 && dia % 7 === 0 && estado.semanal > 0) {
      const aporte = estado.semanal * cfg.fraccion;
      P.participaciones += aporte / (total() / P.participaciones);
      ag0.cash += aporte; ag0.base += aporte; ag0.umbral += 2 * aporte; P.aportado += aporte;
      toca = true;
    }

    // Freno
    if (!P.frenado) {
      const nav = total() / P.participaciones;
      if (nav > P.maxNav) P.maxNav = nav;
      if (nav < P.maxNav * (1 - FRENO)) {
        P.frenado = true; P.frenazos++; P.diasFuera = 0; P.tramoVuelta = 0; P.decision = null;
        P.exposicion = 0.5; toca = true;
        avisos.push({ titulo: `Freno: ${cfg.nombre}`, cuerpo: `Ha caído un 25 % desde su mejor momento. He vendido la mitad. Si no dices nada, vuelvo a entrar en ${DIAS_SIN_RESPUESTA} días.` });
      }
    } else {
      P.diasFuera++;
      const desde0 = P.decision === "salir" ? 0 : 0.5;
      const tramos = P.decision === "salir" ? 3 : 2;
      const puede = P.decision === "volver" || (P.decision !== "salir" && P.diasFuera >= DIAS_SIN_RESPUESTA);
      // "Volver ya" empieza el mismo día; el resto, en tramos semanales.
      const empieza = P.decision === "volver" && P.tramoVuelta === 0;
      if (puede && (dia % 7 === 0 || empieza)) { P.tramoVuelta++; P.exposicion = desde0 + (1 - desde0) * (P.tramoVuelta / tramos); toca = true; }
      if (P.tramoVuelta >= tramos) {
        P.frenado = false; P.exposicion = 1; P.decision = null; P.maxNav = total() / P.participaciones;
        avisos.push({ titulo: `${cfg.nombre}: de vuelta`, cuerpo: "El robot vuelve a estar invertido del todo." });
      }
    }

    const w = pesos(cfg.estrategia, activos, cierres);
    if (!P.objetivo || activos.some((a) => Math.abs((w[a] ?? 0) - (P.objetivo[a] ?? 0)) > 1e-9)) { P.objetivo = w; toca = true; }
    if (toca && P.exposicion > 0) for (const ag of P.agentes) ajustar(ag, P.objetivo, P.exposicion);

    // Clones y rescate
    if (!P.frenado) {
      const nuevos = [];
      for (const ag of P.agentes) {
        const v = valor(ag);
        if (v >= ag.umbral && P.agentes.length + nuevos.length < 64) {
          const exc = v - ag.base;
          if (ag.cash < exc) {
            const f = Math.min(1, (exc - ag.cash) / Math.max(v - ag.cash, 1e-9) / (1 - COSTE));
            for (const a of activos) if (ag.uds[a] > 0 && vivo(a)) vender(ag, a, ag.uds[a] * f, precios[a]);
          }
          const sale = Math.min(exc, ag.cash);
          ag.cash -= sale;
          const nuevo = nuevoAgente(sale / 2, activos);
          Object.assign(nuevo.ultimo, ag.ultimo);
          ajustar(nuevo, P.objetivo, P.exposicion);
          nuevos.push(nuevo);
          P.reserva += sale / 2;
          avisos.push({ titulo: `${cfg.nombre}: nuevo clon`, cuerpo: `Un agente duplicó su base. ${(sale / 2).toFixed(2)} € van a un clon y otros tantos a la reserva.` });
        }
      }
      P.agentes.push(...nuevos);
      for (const ag of P.agentes) {
        const v = valor(ag);
        if (P.reserva > 1e-9 && v < ag.base * 0.5) {
          const pone = Math.min(P.reserva, ag.base - v);
          P.reserva -= pone; ag.cash += pone; ajustar(ag, P.objetivo, P.exposicion);
        }
      }
    }
    P.ultimoValor = total();
    // El mejor momento también se mide al cerrar el día (igual que el laboratorio).
    if (!P.frenado) P.maxNav = Math.max(P.maxNav, P.ultimoValor / P.participaciones);
  }

  const valorTotal = Object.values(estado.partes).reduce((s, P) => s + P.ultimoValor, 0);
  const aportado = Object.values(estado.partes).reduce((s, P) => s + P.aportado, 0);
  estado.historial.push({ fecha, valor: +valorTotal.toFixed(4), aportado: +aportado.toFixed(2) });
  if (estado.historial.length > 800) estado.historial.shift();
  if (estado.operaciones.length > 300) estado.operaciones.length = 300;
  estado.ultimoDia = fecha;
  estado.dia++;
  return { estado, avisos };
}

/** Lo que valdría todo si se vendiera ahora (para comparar con lo aportado). */
export function valorSiVendo(estado, precios) {
  let v = 0;
  for (const P of Object.values(estado.partes)) {
    v += P.reserva;
    for (const ag of P.agentes) {
      v += ag.cash;
      for (const a of estado.activos) {
        const p = Number.isFinite(precios[a]) ? precios[a] : ag.ultimo[a];
        v += ag.uds[a] * p * (1 - COSTE);
      }
    }
  }
  return v;
}
