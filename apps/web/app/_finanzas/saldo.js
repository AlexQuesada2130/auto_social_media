// Modelo de dinero de Gastos: saldo continuo + "págate primero".
//
//  - Saldo: el que escribes una vez (saldoInicial en fechaSaldo) más ingresos
//    y menos gastos desde ese día. Sin cortes por mes.
//  - Al cobrar, lo que va a invertir (fondos, cripto) sale de la cuenta como
//    "traspaso": baja el saldo pero no cuenta como gasto.
//  - Lo que se ahorra (colchón y metas) se queda en la cuenta, reservado.
//  - Libre = saldo − reservado. Es lo que puedes gastar hasta el próximo cobro.
//
// No es asesoramiento financiero: son cálculos con tus propios números.

export const FINANZAS_INICIALES = {
  saldoInicial: null,      // € en cuenta el día fechaSaldo
  fechaSaldo: null,        // "YYYY-MM-DD"
  sueldo: 0,               // neto por nómina
  diaCobro: 28,
  apartados: [             // lo que se separa nada más cobrar
    { id: "fondos", nombre: "Fondos (MyInvestor)", importe: 0, tipo: "inversion" },
    { id: "cripto", nombre: "Cripto", importe: 0, tipo: "inversion" },
    { id: "colchon", nombre: "Colchón de emergencia", importe: 0, tipo: "ahorro" },
  ],
  colchon: { ahorrado: 0, meses: 4 },
  metas: [],               // { id, nombre, objetivo, fecha, ahorrado }
  cobros: [],              // fechas "YYYY-MM-DD" en que pulsaste "He cobrado"
};

const DIA = 864e5;
export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Próximo día de cobro (hoy incluido no: si hoy cobras, el siguiente). */
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

/** Cuánto apartar en cada cobro para llegar a la meta a tiempo. */
export function cuotaMeta(meta, diaCobro) {
  const falta = Math.max(0, (meta.objetivo || 0) - (meta.ahorrado || 0));
  if (!falta) return 0;
  const n = cobrosHasta(diaCobro, meta.fecha);
  return n > 0 ? falta / n : falta; // si ya no quedan cobros, todo lo que falta
}

/** Gasto medio mensual de los últimos 90 días (sin traspasos). */
export function gastoMensualMedio(transactions) {
  const desde = aISO(new Date(Date.now() - 90 * DIA));
  const total = transactions.filter((t) => t.type === "expense" && t.date >= desde).reduce((s, t) => s + t.amount, 0);
  return (total / 90) * 30.4;
}

export function resumenFinanzas(datos) {
  const f = { ...FINANZAS_INICIALES, ...(datos.finanzas ?? {}) };
  const tx = datos.transactions ?? [];
  const hoy = hoyISO();
  const configurado = f.saldoInicial != null && f.fechaSaldo;

  let saldo = null;
  if (configurado) {
    saldo = f.saldoInicial;
    for (const t of tx) {
      if (t.date < f.fechaSaldo) continue;
      saldo += t.type === "income" ? t.amount : -t.amount; // gastos y traspasos restan
    }
  }
  const reservado = (f.colchon?.ahorrado || 0) + f.metas.reduce((s, m) => s + (m.ahorrado || 0), 0);
  const libre = saldo == null ? null : saldo - reservado;

  // Periodo actual: desde el último cobro (o el día que pusiste el saldo).
  const proximo = proximoCobro(f.diaCobro);
  const anterior = new Date(proximo.getFullYear(), proximo.getMonth() - 1, Math.min(f.diaCobro, new Date(proximo.getFullYear(), proximo.getMonth(), 0).getDate()));
  const inicioPeriodo = [aISO(anterior), f.fechaSaldo ?? ""].sort().pop();
  const diasHastaCobro = Math.max(1, Math.ceil((proximo - new Date(hoy + "T00:00")) / DIA));
  const gastadoPeriodo = tx.filter((t) => t.type === "expense" && t.date >= inicioPeriodo).reduce((s, t) => s + t.amount, 0);

  // Págate primero: lo que se aparta en cada cobro.
  const cuotas = f.metas.map((m) => ({ id: m.id, nombre: m.nombre, importe: cuotaMeta(m, f.diaCobro) }));
  const apartadoFijo = f.apartados.reduce((s, a) => s + (a.importe || 0), 0);
  const apartadoMetas = cuotas.reduce((s, c) => s + c.importe, 0);
  const paraGastar = f.sueldo - apartadoFijo - apartadoMetas;

  // Colchón: meses de gasto cubiertos.
  const gastoMes = gastoMensualMedio(tx);
  const objetivoColchon = gastoMes * (f.colchon?.meses || 4);
  const mesesCubiertos = gastoMes > 0 ? (f.colchon?.ahorrado || 0) / gastoMes : null;

  // Aviso de gasto: ritmo del periodo frente a lo previsto para gastar.
  const diasPeriodo = Math.max(1, Math.round((proximo - new Date(inicioPeriodo + "T00:00")) / DIA));
  const diasPasados = diasPeriodo - diasHastaCobro;
  const previstoHastaHoy = paraGastar > 0 ? (paraGastar * diasPasados) / diasPeriodo : 0;
  const porDia = libre == null ? null : Math.max(0, libre) / diasHastaCobro;

  return {
    f, configurado, saldo, reservado, libre, porDia,
    proximoCobro: aISO(proximo), diasHastaCobro, inicioPeriodo, gastadoPeriodo,
    cuotas, apartadoFijo, apartadoMetas, paraGastar,
    gastoMes, objetivoColchon, mesesCubiertos,
    vasPorEncima: paraGastar > 0 && gastadoPeriodo > previstoHastaHoy * 1.1 && diasPasados > 2,
    previstoHastaHoy,
  };
}

/** Revisión del reparto: propuestas con tus números (no asesoramiento). */
export function revisarReparto(r) {
  const p = [];
  const { f } = r;
  if (!f.sueldo) return [{ tono: "info", texto: "Escribe tu sueldo neto para que pueda proponerte un reparto." }];
  if (r.paraGastar < 0) p.push({ tono: "neg", texto: `Apartas más de lo que cobras: te faltan ${Math.round(-r.paraGastar)} € en cada nómina. Baja algún apartado o alarga la fecha de una meta.` });
  if (r.gastoMes > 0 && r.objetivoColchon > (f.colchon?.ahorrado || 0)) {
    const falta = r.objetivoColchon - (f.colchon?.ahorrado || 0);
    const aporte = f.apartados.find((a) => a.id === "colchon")?.importe || 0;
    const inversion = f.apartados.filter((a) => a.tipo === "inversion").reduce((s, a) => s + (a.importe || 0), 0);
    p.push({ tono: "warn", texto: aporte > 0
      ? `Colchón: te faltan ${Math.round(falta)} € para cubrir ${f.colchon?.meses || 4} meses de gastos; al ritmo actual, unos ${Math.ceil(falta / aporte)} meses.`
      : `Colchón: te faltan ${Math.round(falta)} € para cubrir ${f.colchon?.meses || 4} meses de gastos y no le estás apartando nada.` });
    if (inversion > 0 && aporte < inversion) p.push({ tono: "info", texto: `Mientras el colchón no esté lleno, la pauta habitual es darle prioridad: podrías pasar parte de los ${Math.round(inversion)} € de inversión al colchón.` });
  }
  if (r.gastoMes > 0 && f.sueldo > 0) {
    const sobra = f.sueldo - r.apartadoFijo - r.apartadoMetas - r.gastoMes;
    if (sobra > 50) p.push({ tono: "pos", texto: `Con tu gasto real (${Math.round(r.gastoMes)} €/mes) te sobran unos ${Math.round(sobra)} € por nómina sin asignar. Podrías subir ahorro o inversión en esa cantidad.` });
    if (sobra < -20) p.push({ tono: "neg", texto: `Tu gasto real (${Math.round(r.gastoMes)} €/mes) supera lo que te queda tras apartar: ${Math.round(-sobra)} € al mes. O recortas gasto o bajas apartados.` });
  }
  const cripto = f.apartados.find((a) => a.id === "cripto")?.importe || 0;
  if (cripto > 0 && f.sueldo > 0 && cripto / f.sueldo > 0.1) p.push({ tono: "warn", texto: `Cripto se lleva el ${Math.round((cripto / f.sueldo) * 100)} % de tu nómina. Con su volatilidad, lo prudente es que sea dinero que puedas ver caer a la mitad.` });
  if (!p.length) p.push({ tono: "pos", texto: "Tu reparto cuadra con tus gastos reales. Nada que cambiar este mes." });
  return p;
}
