import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { eur, lucide } from './components';
import { SummaryCard } from './portfolio-tracker';
import { useVaultField } from './campo';
import { FINANZAS_INICIALES, resumenFinanzas, revisarReparto, hoyISO, repartoDe, patrimonio as calcularPatrimonio } from './saldo';

export const EXPENSE_CATEGORIES = [
  'Vivienda', 'Supermercado', 'Transporte', 'Restaurantes', 'Ocio', 'Suscripciones',
  'Salud', 'Ropa', 'Educación', 'Regalos', 'Viajes', 'Otros',
];
export const INCOME_CATEGORIES = ['Nómina', 'Bizum', 'Freelance', 'Inversiones', 'Ventas', 'Otros'];

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

// Lista editable de { id, nombre, <campo> } (cuentas, cargos pendientes, otros bienes).
function ListaImportes({ titulo, ayuda, items, setItems, campo, ejemplo }) {
  const cambiar = (id, c) => setItems(items.map((x) => (x.id === id ? { ...x, ...c } : x)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">{titulo}</span>
        <button onClick={() => setItems([...items, { id: newId(), nombre: '', [campo]: 0 }])} className="text-xs text-accent hover:underline">+ Añadir</button>
      </div>
      {ayuda && <p className="text-[11px] text-muted">{ayuda}</p>}
      {items.map((x) => (
        <div key={x.id} className="flex items-center gap-2">
          <input className={`${fieldCls} flex-1 min-w-0`} placeholder={ejemplo} value={x.nombre} aria-label={`Nombre (${titulo})`} onChange={(e) => cambiar(x.id, { nombre: e.target.value })} />
          <input className={`${fieldCls} w-28 font-mono text-right`} inputMode="decimal" placeholder="0 €" defaultValue={x[campo] ? String(x[campo]).replace('.', ',') : ''} aria-label={`Importe de ${x.nombre || titulo}`} onBlur={(e) => cambiar(x.id, { [campo]: num(e.target.value) })} />
          <button onClick={() => setItems(items.filter((y) => y.id !== x.id))} className="text-muted hover:text-neg" aria-label={`Quitar ${x.nombre}`}><lucide.Trash size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function Configurar({ f, guardar, onCancelar }) {
  const [cuentas, setCuentas] = useState(f.cuentas.length ? f.cuentas : [{ id: newId(), nombre: '', saldo: 0 }]);
  const [pendientes, setPendientes] = useState(f.pendientes);
  const [otros, setOtros] = useState(f.otros);
  const [sueldo, setSueldo] = useState(f.sueldo ? String(f.sueldo) : '');
  const [dia, setDia] = useState(f.diaCobro ?? 28);
  const listos = cuentas.some((c) => c.nombre && c.saldo);
  const limpio = (l, campo) => l.filter((x) => x.nombre || x[campo]);
  const empezar = () => {
    const hoy = hoyISO();
    const cs = limpio(cuentas, 'saldo').map((c) => ({ ...c, fecha: hoy }));
    guardar({ cuentas: cs, saldoInicial: cs.reduce((s, c) => s + c.saldo, 0), fechaSaldo: hoy, pendientes: limpio(pendientes, 'importe'), otros: limpio(otros, 'valor'), sueldo: num(sueldo), diaCobro: dia });
  };
  return (
    <div className="rounded-2xl border border-accent bg-card p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink">Tu dinero de hoy</h2>
        <p className="text-xs text-muted mt-1">Con lo que tienes hoy en cada cuenta la app lleva la cuenta sola: suma lo que entra y resta lo que sale, sin cortes por mes.</p>
      </div>
      <ListaImportes titulo="Cuentas" items={cuentas} setItems={setCuentas} campo="saldo" ejemplo="Santander" />
      <ListaImportes titulo="Cargos pendientes" ayuda="Cobros que el banco aún no ha pasado. Se restan de lo libre hasta que se cobren." items={pendientes} setItems={setPendientes} campo="importe" ejemplo="Cargo de la tarjeta" />
      <ListaImportes titulo="Otros bienes" ayuda="Lo que vale dinero pero no es para gastar: capital social, oro… Cuenta en tu patrimonio, no en lo libre." items={otros} setItems={setOtros} campo="valor" ejemplo="Oro en Revolut" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-rule pt-4">
        <label className="text-xs text-muted space-y-1"><span>Te entra al mes, más o menos (opcional)</span>
          <input className={`${fieldCls} w-full font-mono`} inputMode="decimal" placeholder="Lo calculo con tus ingresos" value={sueldo} onChange={(e) => setSueldo(e.target.value)} /></label>
        <label className="text-xs text-muted space-y-1"><span>Día en que suele llegar la nómina</span>
          <select className={`${fieldCls} w-full`} value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, d) => <option key={d + 1} value={d + 1}>{d + 1}</option>)}
          </select></label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={!listos} onClick={empezar} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text disabled:opacity-40">Guardar</button>
        {onCancelar && <button onClick={onCancelar} className="text-xs text-muted hover:text-ink">Cancelar</button>}
      </div>
    </div>
  );
}

function TuDinero({ r, patrimonio, onAjustar, onPagado }) {
  const { f } = r;
  return (
    <div className="rounded-2xl border border-rule bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted">Libre para gastar</div>
          <div className={`text-4xl font-semibold font-mono leading-tight ${r.libre < 0 ? 'text-neg' : 'text-ink'}`}>{eur(r.libre, 0)}</div>
          <div className="text-sm text-muted mt-1">
            {eur(r.porDia, 0)} al día durante {r.diasHastaCobro} día{r.diasHastaCobro === 1 ? '' : 's'}, hasta la nómina del {fechaCorta(r.proximoCobro)}
          </div>
        </div>
        <button onClick={onAjustar} className="text-xs text-accent hover:underline shrink-0">Ajustar</button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-field p-3"><div className="text-[10px] uppercase tracking-wider text-muted">En cuentas</div><div className="font-mono font-semibold text-ink">{eur(r.saldo, 0)}</div></div>
        <div className="rounded-xl bg-field p-3"><div className="text-[10px] uppercase tracking-wider text-muted">Reservado</div><div className="font-mono font-semibold text-ink">{eur(r.reservado, 0)}</div></div>
        <div className="rounded-xl bg-field p-3"><div className="text-[10px] uppercase tracking-wider text-muted">Pendiente</div><div className={`font-mono font-semibold ${r.pendiente > 0 ? 'text-warn' : 'text-ink'}`}>{r.pendiente > 0 ? '−' : ''}{eur(r.pendiente, 0)}</div></div>
      </div>
      {f.pendientes.length > 0 && (
        <ul className="space-y-1.5">
          {f.pendientes.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink">{p.nombre || 'Cargo pendiente'} <span className="font-mono text-muted">{eur(p.importe)}</span></span>
              <button onClick={() => onPagado(p)} className="text-xs text-accent hover:underline">Ya se ha cobrado</button>
            </li>
          ))}
        </ul>
      )}
      {r.vasPorEncima && (
        <p className="rounded-xl border border-warn bg-warn-bg p-3 text-sm text-ink">
          Vas por encima de lo previsto: llevas {eur(r.gastadoPeriodo, 0)} gastados desde el {fechaCorta(r.inicioPeriodo)} y a estas alturas tocaban unos {eur(r.previstoHastaHoy, 0)}.
        </p>
      )}
      <details className="rounded-xl border border-rule">
        <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
          <span className="text-muted">Patrimonio</span><span className="font-mono font-semibold text-ink">{eur(patrimonio.total, 0)}</span>
        </summary>
        <ul className="space-y-1 px-3 pb-3 text-xs">
          {f.cuentas.map((c) => <li key={c.id} className="flex justify-between"><span className="text-muted">{c.nombre}</span><span className="font-mono text-ink">{eur(c.saldo)}</span></li>)}
          {r.saldo !== f.cuentas.reduce((s, c) => s + c.saldo, 0) && <li className="flex justify-between"><span className="text-muted">Movimientos desde el {fechaCorta(f.fechaSaldo)}</span><span className="font-mono text-ink">{eur(r.saldo - f.cuentas.reduce((s, c) => s + c.saldo, 0))}</span></li>}
          {patrimonio.fondos > 0 && <li className="flex justify-between"><span className="text-muted">Fondos (MyInvestor)</span><span className="font-mono text-ink">{eur(patrimonio.fondos)}</span></li>}
          {f.otros.map((o) => <li key={o.id} className="flex justify-between"><span className="text-muted">{o.nombre}</span><span className="font-mono text-ink">{eur(o.valor)}</span></li>)}
          {r.pendiente > 0 && <li className="flex justify-between"><span className="text-muted">Cargos pendientes</span><span className="font-mono text-warn">−{eur(r.pendiente)}</span></li>}
        </ul>
      </details>
    </div>
  );
}

const TIPOS_INGRESO = [['Nómina', 'Nómina'], ['Bizum', 'Bizum'], ['Otros', 'Otro']];

function ApuntarIngreso({ r, guardar, onIngreso }) {
  const { f } = r;
  const [importe, setImporte] = useState('');
  const [tipo, setTipo] = useState('Nómina');
  const [repartir, setRepartir] = useState(true);
  const [nota, setNota] = useState('');
  const [hecho, setHecho] = useState('');
  const cantidad = num(importe);
  const reparto = repartoDe(cantidad, r);
  const cambiarPct = (id, porcentaje) => guardar({ apartados: f.apartados.map((a) => (a.id === id ? { ...a, porcentaje } : a)) });
  const apuntar = () => {
    onIngreso({ importe: cantidad, tipo, nota, reparto: repartir ? reparto : null });
    setHecho(`Apuntados ${eur(cantidad)}${repartir && cantidad - reparto.queda > 0.005 ? `; ${eur(cantidad - reparto.queda)} apartados` : ''}.`);
    setImporte(''); setNota('');
  };
  return (
    <div className="rounded-2xl border border-rule bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Apunta un ingreso</h3>
        <p className="text-xs text-muted mt-1">Nómina, Bizum o lo que entre: de cada ingreso se aparta primero un porcentaje. Lo que queda es lo que puedes gastar sin pensar.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className={`${fieldCls} w-32 font-mono`} inputMode="decimal" placeholder="0 €" value={importe} aria-label="Importe del ingreso" onChange={(e) => { setImporte(e.target.value); setHecho(''); }} />
        <div className="flex rounded-lg border border-rule p-0.5" role="radiogroup" aria-label="Tipo de ingreso">
          {TIPOS_INGRESO.map(([cat, txt]) => (
            <button key={cat} role="radio" aria-checked={tipo === cat} onClick={() => setTipo(cat)} className={`rounded-md px-3 py-1.5 text-xs ${tipo === cat ? 'bg-accent text-accent-text font-semibold' : 'text-muted'}`}>{txt}</button>
          ))}
        </div>
        <input className={`${fieldCls} flex-1 min-w-[8rem]`} placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
      <ul className="space-y-2">
        {f.apartados.map((a) => {
          const parte = reparto.apartados.find((x) => x.id === a.id)?.importe ?? 0;
          return (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink">{a.nombre} <span className="text-[11px] text-muted">{a.tipo === 'inversion' ? '· sale de la cuenta' : '· se queda reservado'}</span></span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                {cantidad > 0 && <span className="font-mono text-xs text-muted">{eur(parte)}</span>}
                <input className={`${fieldCls} w-16 font-mono text-right`} inputMode="decimal" defaultValue={a.porcentaje || ''} placeholder="0" aria-label={`Porcentaje para ${a.nombre}`} onBlur={(e) => cambiarPct(a.id, num(e.target.value))} /> %
              </span>
            </li>
          );
        })}
        {cantidad > 0 && reparto.metas.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink">Meta: {m.nombre} <span className="text-[11px] text-muted">· lo que falta este mes</span></span>
            <span className="font-mono text-xs text-muted">{eur(m.importe)}</span>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={repartir} onChange={(e) => setRepartir(e.target.checked)} /> Repartir este ingreso
      </label>
      {cantidad > 0 && (
        <div className="flex items-center justify-between border-t border-rule pt-3 text-sm">
          <span className="text-muted">Te queda libre de este ingreso</span>
          <span className="font-mono font-semibold text-ink">{eur(repartir ? reparto.queda : cantidad)}</span>
        </div>
      )}
      <button disabled={!(cantidad > 0)} onClick={apuntar} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text disabled:opacity-40">
        Apuntar{repartir ? ' y repartir' : ''}
      </button>
      {hecho && <p className="text-xs text-pos">✓ {hecho}</p>}
      <p className="text-[11px] text-muted">Apartas el {r.pctApartado.toLocaleString('es-ES')} % de cada ingreso.{r.ingresoMes > 0 && <> Con unos {eur(r.ingresoMes, 0)} al mes te quedan {eur(r.paraGastar, 0)} para gastar.</>}</p>
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
      {f.metas.length === 0 && <p className="text-xs text-muted">Navidad, un viaje, el seguro del coche… Pon cuánto y para cuándo, y te digo cuánto apartar cada mes.</p>}
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
              <span className="ml-auto text-ink">{pct >= 1 ? '✓ Conseguida' : `${eur(cuota, 0)} al mes`}</span>
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
  const [planFondos] = useVaultField('planFondos', null);
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const [editingId, setEditingId] = useState(null);
  const [dia, setDia] = useState(null);
  const [ajustando, setAjustando] = useState(false);

  const datos = { transactions, finanzas, planFondos };
  const r = resumenFinanzas(datos);
  const patrimonio = calcularPatrimonio(datos);
  const guardar = (cambios) => setFinanzas((f) => ({ ...r.f, ...f, ...cambios }));

  // Movimientos del periodo actual (desde el último cobro) para presupuestos.
  const periodoTx = useMemo(() => transactions.filter((t) => t.date >= r.inicioPeriodo), [transactions, r.inicioPeriodo]);
  const monthTx = useMemo(() => transactions.filter((t) => monthKey(t.date) === month), [transactions, month]);
  const recientes = useMemo(() => [...(dia ? transactions.filter((t) => t.date === dia) : transactions)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40), [transactions, dia]);

  const upsert = (tx) => {
    setTransactions((list) => (list.some((t) => t.id === tx.id) ? list.map((t) => (t.id === tx.id ? tx : t)) : [...list, tx]));
    setEditingId(null);
  };
  const remove = (id) => setTransactions((list) => list.filter((t) => t.id !== id));

  // Un ingreso: se apunta y, si se reparte, la inversión sale de la cuenta
  // como traspaso y el colchón y las metas quedan reservados.
  const apuntarIngreso = ({ importe, tipo, nota, reparto }) => {
    const hoy = todayISO();
    const nuevos = [{ id: newId(), type: 'income', amount: importe, category: tipo, date: hoy, note: nota || tipo }];
    if (reparto) {
      for (const a of reparto.apartados) if (a.tipo === 'inversion' && a.importe > 0) nuevos.push({ id: newId(), type: 'transfer', amount: a.importe, category: 'Inversión', date: hoy, note: a.nombre });
    }
    setTransactions((list) => [...list, ...nuevos]);
    if (!reparto) return;
    const colchon = reparto.apartados.find((a) => a.id === 'colchon')?.importe || 0;
    const metas = Object.fromEntries(reparto.metas.map((m) => [m.id, m.importe]));
    guardar({
      cobros: [...r.f.cobros, { fecha: hoy, importe, tipo, metas }],
      colchon: { ...r.f.colchon, ahorrado: (r.f.colchon.ahorrado || 0) + colchon },
      metas: r.f.metas.map((m) => ({ ...m, ahorrado: (m.ahorrado || 0) + (metas[m.id] || 0) })),
    });
  };
  // Un cargo pendiente que ya ha pasado: pasa a ser un gasto normal.
  const pagado = (p) => {
    setTransactions((list) => [...list, { id: newId(), type: 'expense', amount: p.importe, category: 'Otros', date: todayISO(), note: p.nombre || 'Cargo pendiente' }]);
    guardar({ pendientes: r.f.pendientes.filter((x) => x.id !== p.id) });
  };

  if (!r.configurado || ajustando) {
    return <Configurar f={r.f} guardar={(c) => { guardar(c); setAjustando(false); }} onCancelar={r.configurado ? () => setAjustando(false) : null} />;
  }

  return (
    <div className="space-y-6">
      <TuDinero r={r} patrimonio={patrimonio} onAjustar={() => setAjustando(true)} onPagado={pagado} />

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
          <ApuntarIngreso r={r} guardar={guardar} onIngreso={apuntarIngreso} />
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
