// Modelo de dinero de Gastos.
//
//  - Cuentas: el saldo de cada cuenta el día que lo apuntas. El saldo total
//    es su suma más ingresos y menos gastos desde ese día. Sin cortes por mes.
//  - Cargos pendientes: se restan de lo libre hasta que se pagan.
//  - Otros bienes (capital social, oro...): cuentan en el patrimonio, no en lo
//    que puedes gastar.
//  - Págate primero con ingresos variables: de cada cobro se aparta un
//    porcentaje para fondos, cripto y colchón. La inversión sale de la cuenta
//    como "traspaso" (no cuenta como gasto); el ahorro se queda reservado.
//  - Libre = saldo − reservado − pendientes.
//
// No es asesoramiento financiero: son cálculos con tus propios números.

export const FINANZAS_INICIALES = {
  cuentas: [],             // { id, nombre, saldo, fecha }
  pendientes: [],          // { id, nombre, importe }
  otros: [],               // { id, nombre, valor }  (no líquidos)
  saldoInicial: null,      // suma de cuentas en fechaSaldo (calculado al guardar cuentas)
  fechaSaldo: null,        // "YYYY-MM-DD"
  sueldo: 0,               // nómina habitual (aprox.), para estimar y proponer
  diaCobro: 28,
  apartados: [             // % de cada ingreso que se aparta al cobrar
    { id: "fondos", nombre: "Fondos (MyInvestor)", porcentaje: 0, tipo: "inversion" },
    { id: "cripto", nombre: "Cripto", porcentaje: 0, tipo: "inversion" },
    { id: "colchon", nombre: "Colchón de emergencia", porcentaje: 0, tipo: "ahorro" },
  ],
  colchon: { ahorrado: 0, meses: 4 },
  metas: [],               // { id, nombre, objetivo, fecha, ahorrado }
  cobros: [],              // { fecha, importe, tipo, metas: { id: € } } por cada ingreso repartido
};

const DIA = 864e5;
export const hoyISO = () => aISO(new Date());
function aISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Une lo guardado con los valores por defecto y migra la versión anterior. */
export function normalizar(f) {
  const n = { ...FINANZAS_INICIALES, ...(f ?? {}) };
  // Versión anterior: apartados en € fijos → % de la nómina habitual.
  n.apartados = (n.apartados ?? FINANZAS_INICIALES.apartados).map((a) =>
    a.porcentaje != null ? a : { ...a, porcentaje: n.sueldo > 0 && a.importe ? Math.round((a.importe / n.sueldo) * 1000) / 10 : 0 });
  // Versión anterior: un saldo único sin cuentas.
  if (!n.cuentas.length && n.saldoInicial != null) n.cuentas = [{ id: "principal", nombre: "Saldo", saldo: n.saldoInicial, fecha: n.fechaSaldo }];
  n.colchon = { ahorrado: 0, meses: 4, ...(n.colchon ?? {}) };
  return n;
}

/** Próximo día de cobro (si hoy cobras, el siguiente). */
export function proximoCobro(diaCobro, desde = new Date()) {
  const d = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const dia = (m) => Math.min(diaCobro, new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate());
  let c = new Date(d.getFullYear(), d.getMonth(), dia(d));
  if (c <= new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())) {
    const sig = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    c = new Date(sig.getFullYear(), sig.getMonth(), dia(sig));
  }
  return c;
}

/** Cobros que quedan desde hoy hasta una fecha (incluida). */
export function cobrosHasta(diaCobro, fechaISO) {
  const fin = new Date(fechaISO + "T23:59");
  let n = 0;
  let c = proximoCobro(diaCobro);
  while (c <= fin && n < 120) { n++; c = proximoCobro(diaCobro, c); }
  return n;
}

/** Cuánto apartar en cada nómina para llegar a la meta a tiempo. */
export function cuotaMeta(meta, diaCobro) {
  const falta = Math.max(0, (meta.objetivo || 0) - (meta.ahorrado || 0));
  if (!falta) return 0;
  const n = cobrosHasta(diaCobro, meta.fecha);
  return n > 0 ? falta / n : falta;
}

/** Gasto medio mensual de los últimos 90 días (sin traspasos). */
export function gastoMensualMedio(transactions) {
  const desde = aISO(new Date(Date.now() - 90 * DIA));
  const total = transactions.filter((t) => t.type === "expense" && t.date >= desde).reduce((s, t) => s + t.amount, 0);
  return (total / 90) * 30.4;
}

/** Ingreso medio mensual de los últimos 90 días (nómina, Bizum, lo que sea). */
export function ingresoMensualMedio(transactions) {
  const desde = aISO(new Date(Date.now() - 90 * DIA));
  const total = transactions.filter((t) => t.type === "income" && t.date >= desde).reduce((s, t) => s + t.amount, 0);
  return (total / 90) * 30.4;
}

/** Reparto de un ingreso: porcentajes y, con lo que quede, lo que falta de
 *  cada meta este mes. Las metas se llevan como mucho la mitad de lo que
 *  queda, para que un ingreso nunca se quede entero en apartados. */
export function repartoDe(importe, r) {
  const apartados = r.f.apartados.map((a) => ({ ...a, importe: Math.round(importe * (a.porcentaje || 0)) / 100 }));
  let queda = importe - apartados.reduce((s, a) => s + a.importe, 0);
  let paraMetas = Math.max(0, queda / 2);
  const metas = r.cuotas.map((c) => {
    const falta = Math.max(0, c.importe - (r.aportadoMetas[c.id] || 0));
    const pone = Math.min(falta, paraMetas);
    paraMetas -= pone;
    queda -= pone;
    return { id: c.id, nombre: c.nombre, importe: Math.round(pone * 100) / 100 };
  }).filter((m) => m.importe > 0);
  return { apartados, metas, queda };
}

export function resumenFinanzas(datos) {
  const f = normalizar(datos.finanzas);
  const tx = datos.transactions ?? [];
  const hoy = hoyISO();
  const configurado = f.cuentas.length > 0 && f.fechaSaldo;

  let saldo = null;
  if (configurado) {
    saldo = f.cuentas.reduce((s, c) => s + (c.saldo || 0), 0);
    for (const t of tx) {
      if (t.date < f.fechaSaldo) continue;
      saldo += t.type === "income" ? t.amount : -t.amount; // gastos y traspasos restan
    }
  }
  const pendiente = f.pendientes.reduce((s, p) => s + (p.importe || 0), 0);
  const reservado = (f.colchon.ahorrado || 0) + f.metas.reduce((s, m) => s + (m.ahorrado || 0), 0);
  const libre = saldo == null ? null : saldo - reservado - pendiente;
  const otros = f.otros.reduce((s, o) => s + (o.valor || 0), 0);

  // Periodo actual: desde el último cobro (o desde que pusiste el saldo).
  const proximo = proximoCobro(f.diaCobro);
  const anterior = new Date(proximo.getFullYear(), proximo.getMonth() - 1, Math.min(f.diaCobro, new Date(proximo.getFullYear(), proximo.getMonth(), 0).getDate()));
  const inicioPeriodo = [aISO(anterior), f.fechaSaldo ?? ""].sort().pop();
  const diasHastaCobro = Math.max(1, Math.ceil((proximo - new Date(hoy + "T00:00")) / DIA));
  const gastadoPeriodo = tx.filter((t) => t.type === "expense" && t.date >= inicioPeriodo).reduce((s, t) => s + t.amount, 0);
  const aportadoMetas = {};
  for (const c of f.cobros) if (typeof c === "object" && c.fecha >= inicioPeriodo) for (const [id, v] of Object.entries(c.metas ?? {})) aportadoMetas[id] = (aportadoMetas[id] || 0) + v;

  // Págate primero sobre lo que entra al mes: lo que dijiste o, si no, la
  // media real de los últimos 90 días.
  const ingresoMes = f.sueldo || ingresoMensualMedio(tx);
  const cuotas = f.metas.map((m) => ({ id: m.id, nombre: m.nombre, importe: cuotaMeta(m, f.diaCobro) }));
  const pctApartado = f.apartados.reduce((s, a) => s + (a.porcentaje || 0), 0);
  const apartadoFijo = (ingresoMes * pctApartado) / 100;
  const apartadoMetas = cuotas.reduce((s, c) => s + c.importe, 0);
  const paraGastar = ingresoMes - apartadoFijo - apartadoMetas;

  const gastoMes = gastoMensualMedio(tx);
  const objetivoColchon = gastoMes * (f.colchon.meses || 4);
  const mesesCubiertos = gastoMes > 0 ? (f.colchon.ahorrado || 0) / gastoMes : null;

  const diasPeriodo = Math.max(1, Math.round((proximo - new Date(inicioPeriodo + "T00:00")) / DIA));
  const diasPasados = diasPeriodo - diasHastaCobro;
  const previstoHastaHoy = paraGastar > 0 ? (paraGastar * diasPasados) / diasPeriodo : 0;
  const porDia = libre == null ? null : Math.max(0, libre) / diasHastaCobro;

  return {
    f, configurado, saldo, reservado, pendiente, libre, porDia, otros,
    proximoCobro: aISO(proximo), diasHastaCobro, inicioPeriodo, gastadoPeriodo,
    ingresoMes, cuotas, aportadoMetas, pctApartado, apartadoFijo, apartadoMetasMes: apartadoMetas, paraGastar,
    gastoMes, objetivoColchon, mesesCubiertos,
    vasPorEncima: paraGastar > 0 && gastadoPeriodo > previstoHastaHoy * 1.1 && diasPasados > 2,
    previstoHastaHoy,
  };
}

/** Patrimonio: dinero en cuentas + fondos + otros bienes − pendientes. */
export function patrimonio(datos) {
  const r = resumenFinanzas(datos);
  const fondos = (datos.planFondos?.fondos ?? []).reduce((s, f) => s + (f.valor || 0), 0);
  return { liquido: r.saldo ?? 0, fondos, otros: r.otros, pendiente: r.pendiente, total: (r.saldo ?? 0) + fondos + r.otros - r.pendiente };
}

/** Revisión del reparto: propuestas con tus números (no asesoramiento). */
export function revisarReparto(r) {
  const p = [];
  const { f } = r;
  const base = r.ingresoMes;
  if (!base) return [{ tono: "info", texto: "Apunta tus ingresos (o cuánto te entra al mes, aproximado) para que pueda proponerte un reparto." }];
  if (r.paraGastar < 0) p.push({ tono: "neg", texto: `Con lo que te entra al mes apartas más de lo que cobras: faltan ${Math.round(-r.paraGastar)} €. Baja algún porcentaje o alarga la fecha de una meta.` });
  if (r.gastoMes > 0 && r.objetivoColchon > (f.colchon.ahorrado || 0)) {
    const falta = r.objetivoColchon - (f.colchon.ahorrado || 0);
    const aporte = ((f.apartados.find((a) => a.id === "colchon")?.porcentaje || 0) * base) / 100;
    const inversionPct = f.apartados.filter((a) => a.tipo === "inversion").reduce((s, a) => s + (a.porcentaje || 0), 0);
    p.push({ tono: "warn", texto: aporte > 0
      ? `Colchón: te faltan ${Math.round(falta)} € para cubrir ${f.colchon.meses} meses de gastos; al ritmo actual, unos ${Math.ceil(falta / aporte)} meses.`
      : `Colchón: te faltan ${Math.round(falta)} € para cubrir ${f.colchon.meses} meses de gastos y no le apartas nada.` });
    if (inversionPct > 0 && aporte < (inversionPct * base) / 100) p.push({ tono: "info", texto: `Mientras el colchón no esté lleno, la pauta habitual es darle prioridad: podrías pasar parte del ${inversionPct} % de inversión al colchón.` });
  }
  if (r.gastoMes > 0) {
    const sobra = base - r.apartadoFijo - r.apartadoMetasMes - r.gastoMes;
    if (sobra > 50) p.push({ tono: "pos", texto: `Con tu gasto real (${Math.round(r.gastoMes)} €/mes) te sobran unos ${Math.round(sobra)} € al mes sin asignar. Podrías subir el porcentaje de ahorro o inversión.` });
    if (sobra < -20) p.push({ tono: "neg", texto: `Tu gasto real (${Math.round(r.gastoMes)} €/mes) supera lo que te queda tras apartar: ${Math.round(-sobra)} € al mes.` });
  }
  const cripto = f.apartados.find((a) => a.id === "cripto")?.porcentaje || 0;
  if (cripto > 10) p.push({ tono: "warn", texto: `Cripto se lleva el ${cripto} % de cada ingreso. Con su volatilidad, lo prudente es que sea dinero que puedas ver caer a la mitad.` });
  if (!p.length) p.push({ tono: "pos", texto: "Tu reparto cuadra con tus gastos reales. Nada que cambiar este mes." });
  return p;
}
