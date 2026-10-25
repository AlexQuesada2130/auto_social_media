import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';
import { eur, lucide } from './components';
import { SummaryCard } from './portfolio-tracker';
import { useVaultField } from './campo';

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
  "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none";

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
    <form onSubmit={submit} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
      <div className="flex gap-1 rounded-lg bg-slate-900 p-1 w-fit">
        {[['expense', 'Gasto'], ['income', 'Ingreso']].map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => switchType(t)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
              type === t
                ? t === 'expense' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                : 'text-slate-400 hover:text-white'
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
        <button type="submit" disabled={!valid} className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 transition px-4 py-1.5 text-xs font-semibold text-slate-950">
          {initial ? 'Guardar cambios' : 'Añadir'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white">
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Gasto por categoría</h3>
        {unbudgeted.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && setEditing(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-400">
            <option value="">+ Presupuesto</option>
            {unbudgeted.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
      </div>
      {rows.length === 0 && !editing && <p className="text-xs text-slate-500">Sin gastos este mes.</p>}
      <div className="space-y-3">
        {[...rows, ...(editing && !rows.some((r) => r.category === editing) ? [{ category: editing, spent: 0, budget: 0 }] : [])].map((r) => {
          const over = r.budget > 0 && r.spent > r.budget;
          return (
            <div key={r.category}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">{r.category}</span>
                {editing === r.category ? (
                  <form onSubmit={(e) => { e.preventDefault(); saveBudget(r.category, e.target.budget.value); }} className="flex items-center gap-1">
                    <input name="budget" autoFocus defaultValue={r.budget || ''} placeholder="Límite €" inputMode="decimal" className="w-20 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px] font-mono text-white" onBlur={(e) => saveBudget(r.category, e.target.value)} />
                  </form>
                ) : (
                  <button onClick={() => setEditing(r.category)} className={`font-mono ${over ? 'text-red-400' : 'text-slate-400'} hover:text-white`} title="Editar presupuesto">
                    {eur(r.spent, 0)}{r.budget > 0 && <span className="text-slate-600"> / {eur(r.budget, 0)}</span>}
                  </button>
                )}
              </div>
              <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className={`absolute inset-y-0 left-0 rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500/80'}`} style={{ width: `${(r.spent / max) * 100}%` }} />
                {r.budget > 0 && <div className="absolute inset-y-0 w-0.5 bg-white/60" style={{ left: `${(r.budget / max) * 100}%` }} />}
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Últimos 6 meses</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="mes" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : v)} />
            <RTooltip
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              formatter={(v) => eur(v, 0)}
            />
            <Bar dataKey="Ingresos" fill="#34d399" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────
export function MoneyManager() {
  const [transactions, setTransactions] = useVaultField('transactions', []);
  const [budgets, setBudgets] = useVaultField('budgets', {});
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const [editingId, setEditingId] = useState(null);

  const monthTx = useMemo(
    () => transactions.filter((t) => monthKey(t.date) === month).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, month]
  );
  const income = sumBy(monthTx, 'income');
  const expense = sumBy(monthTx, 'expense');
  const balance = income - expense;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

  const upsert = (tx) => {
    setTransactions((list) => (list.some((t) => t.id === tx.id) ? list.map((t) => (t.id === tx.id ? tx : t)) : [...list, tx]));
    setEditingId(null);
    setMonth(monthKey(tx.date));
  };
  const remove = (id) => setTransactions((list) => list.filter((t) => t.id !== id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:text-white" aria-label="Mes anterior">
            <lucide.ChevronLeft size={16} />
          </button>
          <h2 className="min-w-[10rem] text-center text-base font-semibold text-white">{monthLabel(month)}</h2>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:text-white" aria-label="Mes siguiente">
            <lucide.ChevronRight size={16} />
          </button>
        </div>
        {month !== monthKey(todayISO()) && (
          <button onClick={() => setMonth(monthKey(todayISO()))} className="text-xs text-slate-400 hover:text-white">Volver a este mes</button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Ingresos" value={eur(income, 0)} tone="positive" icon={<lucide.TrendingUp size={16} />} />
        <SummaryCard label="Gastos" value={eur(expense, 0)} tone="negative" icon={<lucide.TrendingDown size={16} />} />
        <SummaryCard label="Balance" value={`${balance >= 0 ? '+' : ''}${eur(balance, 0)}`} tone={balance >= 0 ? 'accent' : 'negative'} icon={<lucide.Wallet size={16} />} />
        <SummaryCard label="Tasa de ahorro" value={`${savingsRate.toFixed(0)}%`} sub="Balance / ingresos" tone="neutral" icon={<lucide.ShieldCheck size={16} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Movimientos</h3>
          <TransactionForm onSave={upsert} />
          {monthTx.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Todavía no hay movimientos en {monthLabel(month).toLowerCase()}.</p>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {monthTx.map((t) =>
                editingId === t.id ? (
                  <li key={t.id} className="py-3">
                    <TransactionForm initial={t} onSave={upsert} onCancel={() => setEditingId(null)} />
                  </li>
                ) : (
                  <li key={t.id} className="group flex items-center gap-3 py-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${t.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <button onClick={() => setEditingId(t.id)} className="flex-1 min-w-0 text-left">
                      <div className="text-sm text-slate-200 truncate">{t.note || t.category}</div>
                      <div className="text-[11px] text-slate-500">
                        {t.category} · {new Date(t.date + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </div>
                    </button>
                    <span className={`font-mono text-sm ${t.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {t.type === 'income' ? '+' : '−'}{eur(t.amount)}
                    </span>
                    <button onClick={() => remove(t.id)} className="text-slate-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-400 transition" aria-label="Borrar movimiento">
                      <lucide.Trash size={14} />
                    </button>
                  </li>
                )
              )}
            </ul>
          )}
        </div>
        <div className="xl:col-span-2 space-y-6">
          <CategoryBreakdown monthTx={monthTx} budgets={budgets} setBudgets={setBudgets} />
          <MonthlyTrend transactions={transactions} endMonth={month} />
        </div>
      </div>
    </div>
  );
}
