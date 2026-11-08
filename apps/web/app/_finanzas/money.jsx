import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { eur, lucide } from './components';
import { SummaryCard } from './portfolio-tracker';
import { useVaultField } from './campo';
import { FINANZAS_INICIALES, resumenFinanzas, revisarReparto, hoyISO } from './saldo';

export const EXPENSE_CATEGORIES = [
  'Vivienda', 'Supermercado', 'Transporte', 'Restaurantes', 'Ocio', 'Suscripciones',
  'Salud', 'Ropa', 'Educación', 'Regalos', 'Viajes', 'Otros',
];
export const INCOME_CATEGORIES = ['Nómina', 'Freelance', 'Inversiones', 'Ventas', 'Otros'];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthKey = (iso) => iso.slice(0, 7); // "YYYY-MM"
const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (key, opts = { month: 'long', year: 'numeric' }) => {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-ES', opts);
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const newId = () => crypto.randomUUID();

function sumBy(list, type) {
  return list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}

const fieldCls =
  "rounded-lg border border-rule bg-field px-3 py-2 text-sm text-ink placeholder-faint focus:border-accent focus:outline-none";

// ── Formulario alta / edición ─────────────────────────────────────────────
function TransactionForm({ initial, onSave, onCancel }) {
  const [type, setType] = useState(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category ?? EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? '');

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const switchType = (t) => {
    setType(t);
    setCategory((t === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0]);
  };

  const parsed = parseFloat(amount.replace(',', '.'));
  const valid = parsed > 0 && date;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ id: initial?.id ?? newId(), type, amount: Math.round(parsed * 100) / 100, category, date, note: note.trim() });
    if (!initial) { setAmount(''); setNote(''); }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-rule bg-field p-4 space-y-3">
      <div className="flex gap-1 rounded-lg bg-card p-1 w-fit">
        {[['expense', 'Gasto'], ['income', 'Ingreso']].map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => switchType(t)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
              type === t
                ? t === 'expense' ? 'bg-neg-bg text-neg' : 'bg-pos-bg text-pos'
                : 'text-muted hover:text-ink'
            }`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input inputMode="decimal" placeholder="Importe €" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${fieldCls} font-mono`} autoFocus={!!initial} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
        <input placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!valid} className="rounded-lg bg-accent hover:shadow-glow disabled:opacity-40 transition px-4 py-1.5 text-xs font-semibold text-accent-text">
          {initial ? 'Guardar cambios' : 'Añadir'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

// ── Gasto por categoría con presupuesto ───────────────────────────────────
function CategoryBreakdown({ monthTx, budgets, setBudgets }) {
  const rows = useMemo(() => {
    const spent = {};
    monthTx.filter((t) => t.type === 'expense').forEach((t) => { spent[t.category] = (spent[t.category] ?? 0) + t.amount; });
    return EXPENSE_CATEGORIES
      .map((c) => ({ category: c, spent: spent[c] ?? 0, budget: budgets[c] ?? 0 }))
      .filter((r) => r.spent > 0 || r.budget > 0)
      .sort((a, b) => b.spent - a.spent);
  }, [monthTx, budgets]);
  const [editing, setEditing] = useState(null);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.budget)));

  const saveBudget = (category, raw) => {
    const n = parseFloat(String(raw).replace(',', '.'));
    const next = { ...budgets };
    if (n > 0) next[category] = n; else delete next[category];
    setBudgets(next);
    setEditing(null);
  };

  const unbudgeted = EXPENSE_CATEGORIES.filter((c) => !rows.some((r) => r.category === c));

  return (
    <div className="rounded-2xl border border-rule bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink">Gasto por categoría</h3>
        {unbudgeted.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && setEditing(e.target.value)}
            className="rounded-md border border-rule bg-field px-2 py-1 text-[11px] text-muted">
            <option value="">+ Presupuesto</option>
            {unbudgeted.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
      </div>
      {rows.length === 0 && !editing && <p className="text-xs text-muted">Sin gastos este mes.</p>}
      <div className="space-y-3">
        {[...rows, ...(editing && !rows.some((r) => r.category === editing) ? [{ category: editing, spent: 0, budget: 0 }] : [])].map((r) => {
          const over = r.budget > 0 && r.spent > r.budget;
          return (
            <div key={r.category}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink">{r.category}</span>
                {editing === r.category ? (
                  <form onSubmit={(e) => { e.preventDefault(); saveBudget(r.category, e.target.budget.value); }} className="flex items-center gap-1">
                    <input name="budget" autoFocus defaultValue={r.budget || ''} placeholder="Límite €" inputMode="decimal" className="w-20 rounded border border-rule bg-field px-1.5 py-0.5 text-[11px] font-mono text-ink" onBlur={(e) => saveBudget(r.category, e.target.value)} />
                  </form>
                ) : (
                  <button onClick={() => setEditing(r.category)} className={`font-mono ${over ? 'text-neg' : 'text-muted'} hover:text-ink`} title="Editar presupuesto">
                    {eur(r.spent, 0)}{r.budget > 0 && <span className="text-muted"> / {eur(r.budget, 0)}</span>}
                  </button>
                )}
              </div>
              <div className="relative h-2 rounded-full bg-rule-soft overflow-hidden">
                <div className={`absolute inset-y-0 left-0 rounded-full ${over ? 'bg-neg' : 'bg-accent'}`} style={{ width: `${(r.spent / max) * 100}%` }} />
                {r.budget > 0 && <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${(r.budget / max) * 100}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tendencia de los últimos 6 meses ──────────────────────────────────────
function MonthlyTrend({ transactions, endMonth }) {
  const data = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(endMonth, i - 5));
    return months.map((m) => {
      const tx = transactions.filter((t) => monthKey(t.date) === m);
      return { mes: monthLabel(m, { month: 'short' }), Ingresos: sumBy(tx, 'income'), Gastos: sumBy(tx, 'expense') };
    });
  }, [transactions, endMonth]);

  return (
    <div className="rounded-2xl border border-rule bg-card p-5">
      <h3 className="text-sm font-semibold text-ink mb-4">Últimos 6 meses</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <CartesianGrid stroke="var(--rule-soft)" vertical={false} />
            <XAxis dataKey="mes" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : v)} />
            <RTooltip
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              contentStyle={{ background: "var(--card)", border: '1px solid var(--rule)', borderRadius: 8, fontSize: 12 }}
              formatter={(v) => eur(v, 0)}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
            <Bar dataKey="Ingresos" fill="var(--serie-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gastos" fill="var(--serie-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ── Anillos de presupuesto (al estilo del reloj) ──────────────────────────
function AnillosPresupuesto({ monthTx, budgets }) {
  const filas = Object.entries(budgets).filter(([, b]) => b > 0).map(([cat, b]) => {
    const gastado = monthTx.filter((t) => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0);
    return { cat, b, gastado, f: gastado / b };
  });
  if (!filas.length) return null;
  const R = 26, L = 2 * Math.PI * R;
  return (
    <div className="rounded-2xl border border-rule bg-card p-5">
      <h3 className="text-sm font-semibold text-ink mb-4">Presupuestos del mes</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        {filas.map(({ cat, b, gastado, f }) => {
          const pasado = f > 1;
          return (
            <div key={cat} className="flex flex-col items-center text-center gap-1">
              <svg viewBox="0 0 64 64" className="h-16 w-16" role="img" aria-label={`${cat}: ${Math.round(f * 100)} % del presupuesto`}>
                <circle cx="32" cy="32" r={R} fill="none" stroke="var(--rule-soft)" strokeWidth="7" />
                <circle cx="32" cy="32" r={R} fill="none" stroke={pasado ? 'var(--neg)' : f > 0.85 ? 'var(--warn)' : 'var(--accent)'} strokeWidth="7"
                  strokeLinecap="round" strokeDasharray={`${Math.min(f, 1) * L} ${L}`} transform="rotate(-90 32 32)" />
                <text x="32" y="36" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">{Math.round(f * 100)}%</text>
              </svg>
              <span className="text-xs text-ink">{cat}</span>
              <span className={`text-[11px] font-mono ${pasado ? 'text-neg' : 'text-muted'}`}>{eur(gastado, 0)} / {eur(b, 0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendario del mes: cada día, más intenso cuanto más se gastó ─────────
function CalendarioGastos({ month, monthTx, dia, setDia }) {
  const [y, m] = month.split('-').map(Number);
  const dias = new Date(y, m, 0).getDate();
  const hueco = (new Date(y, m - 1, 1).getDay() + 6) % 7; // lunes primero
  const porDia = Array(dias + 1).fill(0);
  for (const t of monthTx) if (t.type === 'expense') porDia[Number(t.date.slice(8, 10))] += t.amount;
  const max = Math.max(...porDia, 0);
  // 5 escalones de un solo color: la intensidad es la cantidad.
  const paso = (v) => (v <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const TINTE = [0, 16, 32, 52, 75];
  const hoy = todayISO();
  return (
    <div className="rounded-2xl border border-rule bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">Calendario de gasto</h3>
        {dia && <button onClick={() => setDia(null)} className="text-xs text-accent hover:underline">Ver todo el mes</button>}
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d} className="text-[10px] text-muted">{d}</div>)}
        {Array.from({ length: hueco }, (_, i) => <div key={`h${i}`} />)}
        {Array.from({ length: dias }, (_, i) => {
          const d = i + 1;
          const fecha = `${month}-${String(d).padStart(2, '0')}`;
          const st = paso(porDia[d]);
          const elegido = dia === fecha;
          return (
            <button key={d} onClick={() => setDia(elegido ? null : fecha)} title={porDia[d] > 0 ? `${d}: ${eur(porDia[d])} gastados` : `${d}: sin gastos`}
              className={`aspect-square rounded-lg border text-xs flex flex-col items-center justify-center ${elegido ? 'border-accent' : fecha === hoy ? 'border-ink' : 'border-rule'}`}
              style={{ background: st ? `color-mix(in srgb, var(--accent) ${TINTE[st]}%, transparent)` : undefined }}>
              <span className="text-ink font-semibold">{d}</span>
              {porDia[d] > 0 && <span className="text-[9px] font-mono text-ink opacity-80 hidden sm:block">{Math.round(porDia[d])}€</span>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-1 mt-3 text-[10px] text-muted">
        menos {TINTE.map((t, i) => <span key={i} className="h-3 w-3 rounded border border-rule" style={{ background: t ? `color-mix(in srgb, var(--accent) ${t}%, transparent)` : undefined }} />)} más
      </div>
    </div>
  );
}

// ── Gastos con saldo continuo y "págate primero" (modelo en ./saldo.js) ───
const num = (v) => { let t = String(v).trim().replace(/\s|€/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, ''); const n = parseFloat(t); return Number.isFinite(n) ? n : 0; };
const fechaCorta = (iso) => new Date(iso + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

function Configurar({ f, guardar }) {
  const [saldo, setSaldo] = useState('');
  const [sueldo, setSueldo] = useState(f.sueldo ? String(f.sueldo) : '');
  const [dia, setDia] = useState(f.diaCobro ?? 28);
  return (
    <div className="rounded-2xl border border-accent bg-card p-5 space-y-3">
      <h2 className="text-base font-semibold text-ink">Empecemos por tu dinero de hoy</h2>
      <p className="text-xs text-muted">Con tu saldo actual la app lleva la cuenta sola: suma lo que entra y resta lo que sale, sin cortes por mes.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-muted space-y-1"><span>Saldo actual (entre todas tus cuentas)</span>
          <input className={`${fieldCls} w-full font-mono`} inputMode="decimal" placeholder="0 €" value={saldo} onChange={(e) => setSaldo(e.target.value)} /></label>
        <label className="text-xs text-muted space-y-1"><span>Sueldo neto por nómina</span>
          <input className={`${fieldCls} w-full font-mono`} inputMode="decimal" placeholder="0 €" value={sueldo} onChange={(e) => setSueldo(e.target.value)} /></label>
        <label className="text-xs text-muted space-y-1"><span>Día de cobro</span>
          <select className={`${fieldCls} w-full`} value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, d) => <option key={d + 1} value={d + 1}>{d + 1}</option>)}
          </select></label>
      </div>
      <button disabled={!saldo} onClick={() => guardar({ saldoInicial: num(saldo), fechaSaldo: hoyISO(), sueldo: num(sueldo), diaCobro: dia })}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text disabled:opacity-40">Empezar</button>
    </div>
  );
}

function TuDinero({ r, onAjustar }) {
  return (
    <div className="rounded-2xl border border-rule bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted">Libre para gastar</div>
          <div className={`text-4xl font-semibold font-mono leading-tight ${r.libre < 0 ? 'text-neg' : 'text-ink'}`}>{eur(r.libre, 0)}</div>
          <div className="text-sm text-muted mt-1">
            {eur(r.porDia, 0)} al día durante {r.diasHastaCobro} día{r.diasHastaCobro === 1 ? '' : 's'}, hasta el cobro del {fechaCorta(r.proximoCobro)}
          </div>
        </div>
        <button onClick={onAjustar} className="text-xs text-accent hover:underline shrink-0">Ajustar saldo</button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-field p-3"><div className="text-[10px] uppercase tracking-wider text-muted">Saldo en cuenta</div><div className="font-mono font-semibold text-ink">{eur(r.saldo, 0)}</div></div>
        <div className="rounded-xl bg-field p-3"><div className="text-[10px] uppercase tracking-wider text-muted">Reservado (colchón y metas)</div><div className="font-mono font-semibold text-ink">{eur(r.reservado, 0)}</div></div>
      </div>
      {r.vasPorEncima && (
        <p className="rounded-xl border border-warn bg-warn-bg p-3 text-sm text-ink">
          Vas por encima de lo previsto: llevas {eur(r.gastadoPeriodo, 0)} gastados desde el {fechaCorta(r.inicioPeriodo)} y a estas alturas tocaban unos {eur(r.previstoHastaHoy, 0)}.
        </p>
      )}
    </div>
  );
}

function PagatePrimero({ r, guardar, onCobrar, cobradoEsteCiclo }) {
  const { f } = r;
  const cambiarApartado = (id, importe) => guardar({ apartados: f.apartados.map((a) => (a.id === id ? { ...a, importe } : a)) });
  return (
    <div className="rounded-2xl border border-rule bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">Págate primero</h3>
        <label className="text-xs text-muted">Sueldo <input className={`${fieldCls} w-24 font-mono ml-1`} inputMode="decimal" defaultValue={f.sueldo || ''} onBlur={(e) => guardar({ sueldo: num(e.target.value) })} /> €</label>
      </div>
      <p className="text-xs text-muted">Nada más cobrar se aparta esto. Lo que queda es lo que puedes gastar sin pensar.</p>
      <ul className="space-y-2">
        {f.apartados.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink">{a.nombre} <span className="text-[11px] text-muted">{a.tipo === 'inversion' ? '· sale de la cuenta' : '· se queda reservado'}</span></span>
            <span className="whitespace-nowrap"><input className={`${fieldCls} w-20 font-mono text-right`} inputMode="decimal" defaultValue={a.importe || ''} placeholder="0" onBlur={(e) => cambiarApartado(a.id, num(e.target.value))} /> €</span>
          </li>
        ))}
        {r.cuotas.filter((c) => c.importe > 0).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink">Meta: {c.nombre} <span className="text-[11px] text-muted">· calculado</span></span>
            <span className="font-mono text-ink">{eur(c.importe, 0)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-rule pt-3 text-sm">
        <span className="text-muted">Te queda para gastar por nómina</span>
        <span className={`font-mono font-semibold ${r.paraGastar < 0 ? 'text-neg' : 'text-ink'}`}>{eur(r.paraGastar, 0)}</span>
      </div>
      {cobradoEsteCiclo ? (
        <p className="text-xs text-pos">✓ Nómina de este periodo apuntada y repartida.</p>
      ) : (
        <button disabled={!f.sueldo} onClick={onCobrar} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text disabled:opacity-40">
          He cobrado {f.sueldo ? eur(f.sueldo, 0) : ''}: apuntar y repartir
        </button>
      )}
    </div>
  );
}

function MetasFecha({ r, guardar }) {
  const { f } = r;
  const cambiar = (id, c) => guardar({ metas: f.metas.map((m) => (m.id === id ? { ...m, ...c } : m)) });
  const anadir = () => {
    const y = new Date().getFullYear();
    guardar({ metas: [...f.metas, { id: newId(), nombre: 'Regalos de Navidad', objetivo: 300, ahorrado: 0, fecha: `${y}-12-20` }] });
  };
  return (
    <div className="rounded-2xl border border-rule bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Metas con fecha</h3>
        <button onClick={anadir} className="text-xs text-accent hover:underline">+ Nueva meta</button>
      </div>
      {f.metas.length === 0 && <p className="text-xs text-muted">Navidad, un viaje, el seguro del coche… Pon cuánto y para cuándo, y te digo cuánto apartar en cada nómina.</p>}
      {f.metas.map((m) => {
        const pct = m.objetivo > 0 ? Math.min(1, m.ahorrado / m.objetivo) : 0;
        const cuota = r.cuotas.find((c) => c.id === m.id)?.importe ?? 0;
        return (
          <div key={m.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <input className={`${fieldCls} flex-1 min-w-0`} defaultValue={m.nombre} aria-label="Nombre de la meta" onBlur={(e) => cambiar(m.id, { nombre: e.target.value })} />
              <button onClick={() => guardar({ metas: f.metas.filter((x) => x.id !== m.id) })} className="text-muted hover:text-neg" aria-label={`Quitar ${m.nombre}`}><lucide.Trash size={14} /></button>
            </div>
            <div className="h-3 rounded-full bg-rule-soft overflow-hidden"><div className={`h-full rounded-full ${pct >= 1 ? 'bg-pos' : 'bg-accent'}`} style={{ width: `${pct * 100}%` }} /></div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <input className={`${fieldCls} w-20 font-mono`} defaultValue={m.ahorrado} inputMode="decimal" aria-label="Ahorrado" onBlur={(e) => cambiar(m.id, { ahorrado: num(e.target.value) })} />
              de
              <input className={`${fieldCls} w-20 font-mono`} defaultValue={m.objetivo} inputMode="decimal" aria-label="Objetivo" onBlur={(e) => cambiar(m.id, { objetivo: num(e.target.value) })} />
              € para el
              <input type="date" className={fieldCls} defaultValue={m.fecha} aria-label="Fecha" onBlur={(e) => e.target.value && cambiar(m.id, { fecha: e.target.value })} />
              <span className="ml-auto text-ink">{pct >= 1 ? '✓ Conseguida' : `${eur(cuota, 0)} por nómina`}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Colchon({ r, guardar }) {
  const { f } = r;
  const pct = r.objetivoColchon > 0 ? Math.min(1, (f.colchon.ahorrado || 0) / r.objetivoColchon) : 0;
  return (
    <div className="rounded-2xl border border-rule bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-ink">Colchón de emergencia</h3>
      {r.gastoMes > 0 ? (
        <>
          <p className="text-xs text-muted">Gastas unos {eur(r.gastoMes, 0)} al mes (últimos 90 días). Tienes cubiertos <b className="text-ink">{r.mesesCubiertos.toFixed(1)} meses</b>.</p>
          <div className="h-3 rounded-full bg-rule-soft overflow-hidden"><div className={`h-full rounded-full ${pct >= 1 ? 'bg-pos' : 'bg-accent'}`} style={{ width: `${pct * 100}%` }} /></div>
        </>
      ) : <p className="text-xs text-muted">Cuando apuntes gastos calcularé cuántos meses te cubre.</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        Ahorrado <input className={`${fieldCls} w-24 font-mono`} defaultValue={f.colchon.ahorrado} inputMode="decimal" onBlur={(e) => guardar({ colchon: { ...f.colchon, ahorrado: num(e.target.value) } })} /> € · objetivo
        <select className={fieldCls} value={f.colchon.meses} onChange={(e) => guardar({ colchon: { ...f.colchon, meses: Number(e.target.value) } })}>
          {[3, 4, 6, 9, 12].map((n) => <option key={n} value={n}>{n} meses</option>)}
        </select>
        {r.gastoMes > 0 && <span className="ml-auto text-ink">{eur(r.objetivoColchon, 0)}</span>}
      </div>
    </div>
  );
}

function Revision({ r }) {
  const tonos = { pos: 'border-pos bg-pos-bg', warn: 'border-warn bg-warn-bg', neg: 'border-neg bg-neg-bg', info: 'border-rule bg-field' };
  return (
    <div className="rounded-2xl border border-rule bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-ink">Revisión del reparto</h3>
      {revisarReparto(r).map((p, i) => <p key={i} className={`rounded-xl border p-3 text-sm text-ink ${tonos[p.tono]}`}>{p.texto}</p>)}
      <p className="text-[11px] text-muted">Cálculos con tus números, no asesoramiento financiero.</p>
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────
export function MoneyManager() {
  const [transactions, setTransactions] = useVaultField('transactions', []);
  const [budgets, setBudgets] = useVaultField('budgets', {});
  const [finanzas, setFinanzas] = useVaultField('finanzas', FINANZAS_INICIALES);
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const [editingId, setEditingId] = useState(null);
  const [dia, setDia] = useState(null);
  const [ajustando, setAjustando] = useState(false);

  const datos = { transactions, finanzas };
  const r = resumenFinanzas(datos);
  const guardar = (cambios) => setFinanzas((f) => ({ ...FINANZAS_INICIALES, ...f, ...cambios }));

  // Movimientos del periodo actual (desde el último cobro) para presupuestos.
  const periodoTx = useMemo(() => transactions.filter((t) => t.date >= r.inicioPeriodo), [transactions, r.inicioPeriodo]);
  const monthTx = useMemo(() => transactions.filter((t) => monthKey(t.date) === month), [transactions, month]);
  const recientes = useMemo(() => [...(dia ? transactions.filter((t) => t.date === dia) : transactions)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40), [transactions, dia]);
  const cobradoEsteCiclo = (r.f.cobros ?? []).some((c) => c >= r.inicioPeriodo);

  const upsert = (tx) => {
    setTransactions((list) => (list.some((t) => t.id === tx.id) ? list.map((t) => (t.id === tx.id ? tx : t)) : [...list, tx]));
    setEditingId(null);
  };
  const remove = (id) => setTransactions((list) => list.filter((t) => t.id !== id));

  // "He cobrado": nómina como ingreso, inversión como traspaso que sale de la
  // cuenta, colchón y metas reservados.
  const cobrar = () => {
    const hoy = todayISO();
    const nuevos = [{ id: newId(), type: 'income', amount: r.f.sueldo, category: 'Nómina', date: hoy, note: 'Nómina' }];
    for (const a of r.f.apartados) if (a.tipo === 'inversion' && a.importe > 0) nuevos.push({ id: newId(), type: 'transfer', amount: a.importe, category: 'Inversión', date: hoy, note: a.nombre });
    setTransactions((list) => [...list, ...nuevos]);
    const colchon = r.f.apartados.find((a) => a.id === 'colchon')?.importe || 0;
    guardar({
      cobros: [...(r.f.cobros ?? []), hoy],
      colchon: { ...r.f.colchon, ahorrado: (r.f.colchon.ahorrado || 0) + colchon },
      metas: r.f.metas.map((m) => ({ ...m, ahorrado: (m.ahorrado || 0) + (r.cuotas.find((c) => c.id === m.id)?.importe || 0) })),
    });
  };

  if (!r.configurado || ajustando) {
    return <Configurar f={r.f} guardar={(c) => { guardar(c); setAjustando(false); }} />;
  }

  return (
    <div className="space-y-6">
      <TuDinero r={r} onAjustar={() => setAjustando(true)} />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="rounded-2xl border border-rule bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink">
              Movimientos{dia && ` del ${fechaCorta(dia)}`}
              {dia && <button onClick={() => setDia(null)} className="ml-2 text-xs text-accent hover:underline">ver todos</button>}
            </h3>
            <TransactionForm onSave={upsert} />
            {recientes.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">{dia ? 'Ese día no hay movimientos.' : 'Todavía no hay movimientos.'}</p>
            ) : (
              <ul className="divide-y divide-rule">
                {recientes.map((t) =>
                  editingId === t.id ? (
                    <li key={t.id} className="py-3"><TransactionForm initial={t} onSave={upsert} onCancel={() => setEditingId(null)} /></li>
                  ) : (
                    <li key={t.id} className="group flex items-center gap-3 py-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${t.type === 'income' ? 'bg-pos' : t.type === 'transfer' ? 'bg-accent' : 'bg-neg'}`} />
                      <button onClick={() => t.type !== 'transfer' && setEditingId(t.id)} className="flex-1 min-w-0 text-left">
                        <div className="text-sm text-ink truncate">{t.note || t.category}</div>
                        <div className="text-[11px] text-muted">{t.type === 'transfer' ? 'Traspaso a inversión' : t.category} · {new Date(t.date + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</div>
                      </button>
                      <span className={`font-mono text-sm ${t.type === 'income' ? 'text-pos' : 'text-ink'}`}>{t.type === 'income' ? '+' : '−'}{eur(t.amount)}</span>
                      <button onClick={() => remove(t.id)} className="text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-neg transition" aria-label="Borrar movimiento"><lucide.Trash size={14} /></button>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={() => { setDia(null); setMonth((m) => shiftMonth(m, -1)); }} className="rounded-lg border border-rule p-1.5 text-muted hover:text-ink" aria-label="Mes anterior"><lucide.ChevronLeft size={16} /></button>
              <span className="text-sm text-ink">{monthLabel(month)}</span>
              <button onClick={() => { setDia(null); setMonth((m) => shiftMonth(m, 1)); }} className="rounded-lg border border-rule p-1.5 text-muted hover:text-ink" aria-label="Mes siguiente"><lucide.ChevronRight size={16} /></button>
            </div>
            <CalendarioGastos month={month} monthTx={monthTx} dia={dia} setDia={setDia} />
          </div>
        </div>
        <div className="xl:col-span-2 space-y-6">
          <PagatePrimero r={r} guardar={guardar} onCobrar={cobrar} cobradoEsteCiclo={cobradoEsteCiclo} />
          <MetasFecha r={r} guardar={guardar} />
          <Colchon r={r} guardar={guardar} />
          <Revision r={r} />
          <AnillosPresupuesto monthTx={periodoTx} budgets={budgets} />
          <CategoryBreakdown monthTx={periodoTx} budgets={budgets} setBudgets={setBudgets} />
          <MonthlyTrend transactions={transactions} endMonth={monthKey(todayISO())} />
        </div>
      </div>
    </div>
  );
}
