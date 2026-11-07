import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { eur, lucide } from './components';
import { useVaultField } from './campo';

// Plan de fondos (MyInvestor): el reparto que quieres mantener, lo que tienes
// hoy y qué hacer con la próxima aportación. Los importes viven en la bóveda
// cifrada; al servidor solo llega el día del recordatorio.
//
// La idea es de mínima atención: deja en MyInvestor una aportación periódica
// automática con tu reparto y vuelve aquí una vez al mes. Si el desvío pasa
// del umbral, te propone un traspaso entre fondos (en España no tributa).
// Cada vez que actualizas los valores se guarda una foto del día.

const PLAN_INICIAL = {
  fondos: [
    { id: 'world', nombre: 'Fidelity MSCI World', valor: 0, invertido: 0, objetivo: 80 },
    { id: 'em', nombre: 'Fidelity MSCI Emerging Markets', valor: 0, invertido: 0, objetivo: 20 },
  ],
  aportacion: 100,
  umbral: 5,
  dia: 5,
  actualizado: null,
  historial: [],
};

const campo = "rounded-lg border border-rule bg-field px-2.5 py-1.5 text-sm text-ink placeholder-faint focus:border-accent focus:outline-none";
// "8.000,50" y "8000,50" (español), "8000.50" (punto decimal) y "8.000" valen.
export function num(texto) {
  let t = String(texto).trim().replace(/\s|€/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}
const pct = (x, d = 1) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)} %`;
const color = (i) => `var(--serie-${(i % 8) + 1})`;

/** Reparte la aportación para acercarse al objetivo sin vender nada. */
export function repartir(fondos, aportacion) {
  const total = fondos.reduce((s, f) => s + f.valor, 0);
  const sumaObj = fondos.reduce((s, f) => s + f.objetivo, 0) || 1;
  const futuro = total + aportacion;
  const falta = fondos.map((f) => Math.max(0, (f.objetivo / sumaObj) * futuro - f.valor));
  const sumaFalta = falta.reduce((s, x) => s + x, 0);
  return fondos.map((f, i) => (sumaFalta > 0 ? (falta[i] / sumaFalta) * aportacion : (f.objetivo / sumaObj) * aportacion));
}

/** Si tras la aportación sigue desviado, el traspaso que lo arregla. */
export function traspaso(fondos, aportacion, umbral) {
  const reparto = repartir(fondos, aportacion);
  const despues = fondos.map((f, i) => f.valor + reparto[i]);
  const total = despues.reduce((s, x) => s + x, 0);
  if (total <= 0) return null;
  const sumaObj = fondos.reduce((s, f) => s + f.objetivo, 0) || 1;
  const desvio = fondos.map((f, i) => (despues[i] / total) * 100 - (f.objetivo / sumaObj) * 100);
  const max = Math.max(...desvio.map(Math.abs));
  if (max <= umbral) return null;
  const de = desvio.indexOf(Math.max(...desvio));
  const a = desvio.indexOf(Math.min(...desvio));
  const importe = Math.min((desvio[de] / 100) * total, (-desvio[a] / 100) * total);
  return { de, a, importe, desvio: max };
}

// ── Anillo: reparto real (fuera) frente al objetivo (dentro) ─────────────
function Anillo({ fondos, total, sumaObj }) {
  const R1 = 52, R2 = 38, G = 0.012; // radios y hueco entre segmentos (en vueltas)
  const arcos = (fracciones, r) => {
    let acum = 0;
    return fracciones.map((f, i) => {
      const ini = acum, fin = acum + f; acum = fin;
      if (f <= 0) return null;
      const a0 = 2 * Math.PI * (ini + (f > 2 * G ? G : 0)) - Math.PI / 2;
      const a1 = 2 * Math.PI * (fin - (f > 2 * G ? G : 0)) - Math.PI / 2;
      const grande = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M ${60 + r * Math.cos(a0)} ${60 + r * Math.sin(a0)} A ${r} ${r} 0 ${grande} 1 ${60 + r * Math.cos(a1)} ${60 + r * Math.sin(a1)}`;
      return <path key={i} d={d} fill="none" stroke={color(i)} strokeWidth={r === R1 ? 12 : 7} strokeLinecap="round" opacity={r === R1 ? 1 : 0.7} />;
    });
  };
  const reales = fondos.map((f) => (total > 0 ? f.valor / total : 0));
  const objetivos = fondos.map((f) => f.objetivo / (sumaObj || 1));
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img" aria-label="Reparto real frente al objetivo">
        <circle cx="60" cy="60" r={R1} fill="none" stroke="var(--rule-soft)" strokeWidth="12" />
        {total > 0 && arcos(reales, R1)}
        {arcos(objetivos, R2)}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {fondos.map((f, i) => (
          <li key={f.id} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color(i) }} />
            <span className="text-ink">{f.nombre}</span>
            <span className="font-mono text-muted">
              {total > 0 ? `${(reales[i] * 100).toFixed(1)} %` : '—'} <span className="text-faint">/ objetivo {(objetivos[i] * 100).toFixed(0)} %</span>
            </span>
          </li>
        ))}
        <li className="text-[11px] text-muted pt-1">Anillo exterior: lo que tienes · interior: tu objetivo</li>
      </ul>
    </div>
  );
}

export function PlanFondos() {
  const [plan, setPlan] = useVaultField('planFondos', PLAN_INICIAL);
  const [aviso, setAviso] = useState('');
  const [copiado, setCopiado] = useState(false);
  const fondos = plan.fondos;
  const total = fondos.reduce((s, f) => s + f.valor, 0);
  const invertido = fondos.reduce((s, f) => s + (f.invertido || 0), 0);
  const sumaObj = fondos.reduce((s, f) => s + f.objetivo, 0);
  const reparto = useMemo(() => repartir(fondos, plan.aportacion), [fondos, plan.aportacion]);
  const mover = useMemo(() => traspaso(fondos, plan.aportacion, plan.umbral), [fondos, plan.aportacion, plan.umbral]);
  const diasDesde = plan.actualizado ? Math.floor((Date.now() - new Date(plan.actualizado)) / 864e5) : null;
  const historial = plan.historial ?? [];

  const cambiar = (cambios) => setPlan((p) => ({ ...p, ...cambios }));
  // Al cambiar un importe se guarda la foto del día (una por fecha).
  const cambiarImporte = (i, cambios) => setPlan((p) => {
    const fs = p.fondos.map((f, j) => (j === i ? { ...f, ...cambios } : f));
    const fecha = new Date().toISOString().slice(0, 10);
    const foto = { fecha, valor: fs.reduce((s, f) => s + f.valor, 0), invertido: fs.reduce((s, f) => s + (f.invertido || 0), 0) };
    const h = (p.historial ?? []).filter((x) => x.fecha !== fecha).concat(foto).slice(-120);
    return { ...p, fondos: fs, historial: h, actualizado: new Date().toISOString() };
  });
  const cambiarFondo = (i, cambios) => setPlan((p) => ({ ...p, fondos: p.fondos.map((f, j) => (j === i ? { ...f, ...cambios } : f)) }));
  const quitar = (i) => setPlan((p) => ({ ...p, fondos: p.fondos.filter((_, j) => j !== i) }));
  const anadir = () => setPlan((p) => ({ ...p, fondos: [...p.fondos, { id: crypto.randomUUID(), nombre: 'Otro fondo', valor: 0, invertido: 0, objetivo: 0 }] }));

  // El día del recordatorio es lo único que conoce el servidor.
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/recordatorios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fondos: { dia: plan.dia } }),
      }).then((r) => setAviso(r.ok ? '' : 'No se pudo guardar el día del recordatorio')).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [plan.dia]);

  const instruccion = mover
    ? `Traspaso en MyInvestor: ${mover.importe.toFixed(2).replace('.', ',')} € de «${fondos[mover.de].nombre}» a «${fondos[mover.a].nombre}». Traspaso entre fondos: no tributa.`
    : '';
  async function copiar() {
    try { await navigator.clipboard.writeText(instruccion); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch { /* el navegador lo bloqueó */ }
  }

  const ganancia = total - invertido;
  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-rule bg-card p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted">Valor de la cartera</div>
          <div className="text-3xl font-semibold text-ink font-mono mt-2">{total > 0 ? eur(total, 0) : '—'}</div>
          {diasDesde !== null && <div className={`text-xs mt-1 ${diasDesde > 35 ? 'text-warn' : 'text-muted'}`}>actualizado hace {diasDesde === 0 ? 'menos de un día' : `${diasDesde} día${diasDesde === 1 ? '' : 's'}`}</div>}
        </div>
        <div className="rounded-2xl border border-rule bg-card p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted">Invertido</div>
          <div className="text-3xl font-semibold text-ink font-mono mt-2">{invertido > 0 ? eur(invertido, 0) : '—'}</div>
          <div className="text-xs text-muted mt-1">lo que MyInvestor llama «importe invertido»</div>
        </div>
        <div className="rounded-2xl border border-rule bg-card p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted">Ganancia</div>
          <div className={`text-3xl font-semibold font-mono mt-2 ${invertido > 0 ? (ganancia >= 0 ? 'text-pos' : 'text-neg') : 'text-ink'}`}>
            {invertido > 0 ? `${ganancia >= 0 ? '+' : ''}${eur(ganancia, 0)}` : '—'}
          </div>
          <div className="text-xs text-muted mt-1">{invertido > 0 ? pct(ganancia / invertido) : 'escribe lo invertido de cada fondo'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Reparto y estado */}
        <div className="xl:col-span-2 rounded-2xl border border-rule bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Reparto</h2>
          <Anillo fondos={fondos} total={total} sumaObj={sumaObj} />
          <div className={`rounded-xl border p-3 text-sm ${mover ? 'border-warn bg-warn-bg' : 'border-rule bg-field'}`}>
            {total <= 0 ? (
              <p className="text-muted">Escribe el valor de tus fondos para ver qué hacer este mes.</p>
            ) : mover ? (
              <div className="space-y-2">
                <p className="text-ink"><b>Toca reequilibrar.</b> Aunque repartas la aportación, un fondo seguiría desviado {mover.desvio.toFixed(1)} puntos.
                  Traspasa <b>{eur(mover.importe)}</b> de <b>{fondos[mover.de].nombre}</b> a <b>{fondos[mover.a].nombre}</b>. Entre fondos no tributa (no vale para ETF).</p>
                <button onClick={copiar} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-text">
                  {copiado ? 'Copiado ✓' : 'Copiar la orden de traspaso'}
                </button>
              </div>
            ) : (
              <p className="text-ink"><b>Todo en orden.</b> Reparte la aportación como en la tabla y no hace falta mover nada más.</p>
            )}
          </div>
        </div>

        {/* Evolución */}
        <div className="xl:col-span-3 rounded-2xl border border-rule bg-card p-5">
          <h2 className="text-sm font-semibold text-ink mb-3">Evolución</h2>
          {historial.length < 2 ? (
            <p className="text-xs text-muted">Cada vez que actualices los valores se guarda una foto del día. Con dos fotos aparece aquí la evolución del valor frente a lo invertido.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historial}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="fecha" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--rule)', borderRadius: 8, fontSize: 12 }} formatter={(v) => eur(v, 0)} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="valor" name="Valor" stroke="var(--serie-1)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="stepAfter" dataKey="invertido" name="Invertido" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de fondos */}
      <div className="rounded-2xl border border-rule bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Tus fondos</h2>
          <p className="text-xs text-muted mt-1">Copia de MyInvestor el valor y el importe invertido de cada fondo. Se guarda cifrado en este dispositivo.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted text-left">
                <th className="py-2 pr-3 font-medium">Fondo</th>
                <th className="py-2 pr-3 font-medium">Valor hoy</th>
                <th className="py-2 pr-3 font-medium">Invertido</th>
                <th className="py-2 pr-3 font-medium">Objetivo</th>
                <th className="py-2 pr-3 font-medium">Próxima aportación</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {fondos.map((f, i) => (
                <tr key={f.id}>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color(i) }} />
                      <input className={`${campo} w-52`} value={f.nombre} aria-label="Nombre del fondo" onChange={(e) => cambiarFondo(i, { nombre: e.target.value })} />
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <input className={`${campo} w-28 font-mono`} inputMode="decimal" aria-label={`Valor de ${f.nombre}`} defaultValue={f.valor || ''} placeholder="0 €"
                      onBlur={(e) => num(e.target.value) !== f.valor && cambiarImporte(i, { valor: num(e.target.value) })} />
                  </td>
                  <td className="py-2 pr-3">
                    <input className={`${campo} w-28 font-mono`} inputMode="decimal" aria-label={`Invertido en ${f.nombre}`} defaultValue={f.invertido || ''} placeholder="0 €"
                      onBlur={(e) => num(e.target.value) !== (f.invertido || 0) && cambiarImporte(i, { invertido: num(e.target.value) })} />
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <input className={`${campo} w-16 font-mono`} inputMode="decimal" aria-label={`Objetivo de ${f.nombre}`} defaultValue={f.objetivo}
                      onBlur={(e) => cambiarFondo(i, { objetivo: num(e.target.value) })} /> <span className="text-muted">%</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-ink">{eur(reparto[i] || 0)}</td>
                  <td className="py-2">
                    {fondos.length > 1 && (
                      <button onClick={() => quitar(i)} className="text-faint hover:text-neg" aria-label={`Quitar ${f.nombre}`}><lucide.Trash size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={anadir} className="text-xs text-accent hover:underline">+ Añadir fondo</button>
        {Math.round(sumaObj) !== 100 && <p className="text-xs text-warn">Los objetivos suman {sumaObj.toFixed(0)} %; se reparten en proporción.</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-rule">
          <label className="text-xs text-muted space-y-1">
            <span>Aportación mensual</span>
            <div><input className={`${campo} w-28 font-mono`} inputMode="decimal" defaultValue={plan.aportacion} onBlur={(e) => cambiar({ aportacion: num(e.target.value) })} /> €</div>
          </label>
          <label className="text-xs text-muted space-y-1">
            <span>Avisarme si un fondo se desvía más de</span>
            <div><input className={`${campo} w-16 font-mono`} inputMode="decimal" defaultValue={plan.umbral} onBlur={(e) => cambiar({ umbral: Math.max(1, num(e.target.value)) })} /> puntos</div>
          </label>
          <label className="text-xs text-muted space-y-1">
            <span>Recordatorio al móvil el día</span>
            <div>
              <select className={campo} value={plan.dia} onChange={(e) => cambiar({ dia: Number(e.target.value) })}>
                <option value={0}>Sin recordatorio</option>
                {Array.from({ length: 28 }, (_, d) => <option key={d + 1} value={d + 1}>{d + 1}</option>)}
              </select> de cada mes
            </div>
          </label>
        </div>
        {aviso && <p className="text-xs text-neg">{aviso}</p>}
      </div>
    </div>
  );
}
