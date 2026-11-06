import React, { useEffect, useMemo, useState } from 'react';
import { eur, lucide } from './components';
import { useVaultField } from './campo';

// Plan de fondos (MyInvestor): el reparto que quieres mantener, lo que tienes
// hoy y qué hacer con la próxima aportación. Los importes viven en la bóveda
// cifrada; al servidor solo llega el día del recordatorio.
//
// La idea es de mínima atención: deja en MyInvestor una aportación periódica
// automática con tu reparto y vuelve aquí una vez al mes. Si el desvío pasa
// del umbral, te propone un traspaso entre fondos (en España no tributa).

const PLAN_INICIAL = {
  fondos: [
    { id: 'world', nombre: 'Fidelity MSCI World', valor: 0, objetivo: 80 },
    { id: 'em', nombre: 'Fidelity MSCI Emerging Markets', valor: 0, objetivo: 20 },
  ],
  aportacion: 100,
  umbral: 5,
  dia: 5,
  actualizado: null,
};

const campo = "rounded-lg border border-rule bg-field px-2.5 py-1.5 text-sm text-ink placeholder-faint focus:border-accent focus:outline-none";
const num = (s) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

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

export function PlanFondos() {
  const [plan, setPlan] = useVaultField('planFondos', PLAN_INICIAL);
  const [aviso, setAviso] = useState('');
  const fondos = plan.fondos;
  const total = fondos.reduce((s, f) => s + f.valor, 0);
  const sumaObj = fondos.reduce((s, f) => s + f.objetivo, 0);
  const reparto = useMemo(() => repartir(fondos, plan.aportacion), [fondos, plan.aportacion]);
  const mover = useMemo(() => traspaso(fondos, plan.aportacion, plan.umbral), [fondos, plan.aportacion, plan.umbral]);
  const diasDesde = plan.actualizado ? Math.floor((Date.now() - new Date(plan.actualizado)) / 864e5) : null;

  const cambiar = (cambios) => setPlan((p) => ({ ...p, ...cambios }));
  const cambiarFondo = (i, cambios, esValor) =>
    setPlan((p) => ({ ...p, fondos: p.fondos.map((f, j) => (j === i ? { ...f, ...cambios } : f)), ...(esValor ? { actualizado: new Date().toISOString() } : {}) }));
  const quitar = (i) => setPlan((p) => ({ ...p, fondos: p.fondos.filter((_, j) => j !== i) }));
  const anadir = () => setPlan((p) => ({ ...p, fondos: [...p.fondos, { id: crypto.randomUUID(), nombre: 'Otro fondo', valor: 0, objetivo: 0 }] }));

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

  return (
    <div className="rounded-2xl border border-rule bg-card p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Plan de fondos · MyInvestor</h2>
          <p className="text-xs text-muted mt-1 max-w-xl">
            Escribe el valor actual de cada fondo tal como lo ves en MyInvestor. Te digo cómo repartir la próxima aportación y
            si toca mover algo. Se guarda cifrado en este dispositivo.
          </p>
        </div>
        {diasDesde !== null && (
          <span className={`text-[11px] ${diasDesde > 35 ? 'text-warn' : 'text-muted'}`}>
            Valores actualizados hace {diasDesde === 0 ? 'menos de un día' : `${diasDesde} día${diasDesde === 1 ? '' : 's'}`}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted text-left">
              <th className="py-2 pr-3 font-medium">Fondo</th>
              <th className="py-2 pr-3 font-medium">Valor hoy</th>
              <th className="py-2 pr-3 font-medium">Objetivo</th>
              <th className="py-2 pr-3 font-medium">Ahora</th>
              <th className="py-2 pr-3 font-medium">Próxima aportación</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {fondos.map((f, i) => {
              const ahora = total > 0 ? (f.valor / total) * 100 : 0;
              const obj = sumaObj > 0 ? (f.objetivo / sumaObj) * 100 : 0;
              const desv = ahora - obj;
              return (
                <tr key={f.id}>
                  <td className="py-2 pr-3">
                    <input className={`${campo} w-56`} value={f.nombre} aria-label="Nombre del fondo"
                      onChange={(e) => cambiarFondo(i, { nombre: e.target.value })} />
                  </td>
                  <td className="py-2 pr-3">
                    <input className={`${campo} w-28 font-mono`} inputMode="decimal" aria-label={`Valor de ${f.nombre}`}
                      defaultValue={f.valor || ''} placeholder="0 €"
                      onBlur={(e) => cambiarFondo(i, { valor: num(e.target.value) }, true)} />
                  </td>
                  <td className="py-2 pr-3">
                    <input className={`${campo} w-16 font-mono`} inputMode="decimal" aria-label={`Objetivo de ${f.nombre}`}
                      defaultValue={f.objetivo} onBlur={(e) => cambiarFondo(i, { objetivo: num(e.target.value) })} /> <span className="text-muted">%</span>
                  </td>
                  <td className="py-2 pr-3 font-mono whitespace-nowrap">
                    {total > 0 ? `${ahora.toFixed(1)} %` : '—'}
                    {total > 0 && Math.abs(desv) >= 0.5 && (
                      <span className={`ml-1 text-[11px] ${Math.abs(desv) > plan.umbral ? 'text-warn' : 'text-muted'}`}>
                        ({desv > 0 ? '+' : ''}{desv.toFixed(1)})
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono text-ink">{eur(reparto[i] || 0)}</td>
                  <td className="py-2">
                    {fondos.length > 1 && (
                      <button onClick={() => quitar(i)} className="text-faint hover:text-neg" aria-label={`Quitar ${f.nombre}`}>
                        <lucide.Trash size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button onClick={anadir} className="text-xs text-accent hover:underline">+ Añadir fondo</button>
      {Math.round(sumaObj) !== 100 && <p className="text-xs text-warn">Los objetivos suman {sumaObj.toFixed(0)} %; se reparten en proporción.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-muted space-y-1">
          <span>Aportación mensual</span>
          <div><input className={`${campo} w-28 font-mono`} inputMode="decimal" defaultValue={plan.aportacion}
            onBlur={(e) => cambiar({ aportacion: num(e.target.value) })} /> €</div>
        </label>
        <label className="text-xs text-muted space-y-1">
          <span>Avisarme si un fondo se desvía más de</span>
          <div><input className={`${campo} w-16 font-mono`} inputMode="decimal" defaultValue={plan.umbral}
            onBlur={(e) => cambiar({ umbral: Math.max(1, num(e.target.value)) })} /> puntos</div>
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

      <div className={`rounded-xl border p-4 text-sm ${mover ? 'border-warn bg-warn-bg' : 'border-rule bg-field'}`}>
        {total <= 0 ? (
          <p className="text-muted">Escribe el valor de tus fondos para ver qué hacer este mes.</p>
        ) : mover ? (
          <p className="text-ink">
            <b>Toca reequilibrar.</b> Aunque repartas la aportación como arriba, un fondo seguiría desviado {mover.desvio.toFixed(1)} puntos.
            Haz un <b>traspaso de {eur(mover.importe)}</b> de <b>{fondos[mover.de].nombre}</b> a <b>{fondos[mover.a].nombre}</b>.
            Entre fondos de inversión en España el traspaso no paga impuestos (no vale para ETF).
          </p>
        ) : (
          <p className="text-ink">
            <b>Todo en orden.</b> Reparte la aportación de este mes como en la tabla y no hace falta mover nada más.
            Si tienes una aportación automática en MyInvestor con tu reparto objetivo, puedes dejarla tal cual.
          </p>
        )}
      </div>
    </div>
  );
}
