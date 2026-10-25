import React, { useState, useMemo, useEffect, useRef } from 'react';
import { eur, pct, lucide, InfoTip } from './components';

// ── Calcula totales agregados a partir de posiciones + fondos ──────────────
export function computePortfolioTotals(funds, positions) {
  let invested = 0, value = 0;
  funds.forEach((f) => {
    const pos = positions[f.id] ?? { shares: 0, avgPrice: 0 };
    invested += pos.shares * pos.avgPrice;
    value += pos.shares * f.nav;
  });
  const pnl = value - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  return { invested, value, pnl, pnlPct };
}

// ── Tarjeta de resumen grande ───────────────────────────────────────────────
export function SummaryCard({ label, value, sub, tone = "neutral", icon, tip }) {
  const tones = {
    neutral: {
      border: "border-slate-700",
      bg: "bg-slate-900/60",
      text: "text-white",
      iconBg: "bg-slate-800 text-slate-400",
    },
    positive: {
      border: "border-emerald-500/40",
      bg: "bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent",
      text: "text-emerald-300",
      iconBg: "bg-emerald-500/15 text-emerald-300",
    },
    negative: {
      border: "border-red-500/40",
      bg: "bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent",
      text: "text-red-300",
      iconBg: "bg-red-500/15 text-red-300",
    },
    accent: {
      border: "border-sky-500/40",
      bg: "bg-gradient-to-br from-sky-500/15 via-sky-500/5 to-transparent",
      text: "text-white",
      iconBg: "bg-sky-500/15 text-sky-300",
    },
  };
  const t = tones[tone];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center">
          {label} {tip && <InfoTip termKey={tip} />}
        </div>
        {icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.iconBg}`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`text-3xl font-semibold font-mono leading-none ${t.text}`}>
        {value}
      </div>
      {sub && <div className="mt-2 text-xs text-slate-400 font-mono">{sub}</div>}
    </div>
  );
}

// ── Input compacto para shares / avgPrice ──────────────────────────────────
export function CompactNumber({ label, value, onChange, suffix, step = 1, min = 0, max = 9_999_999 }) {
  const [raw, setRaw] = useState(String(value));
  // Sync externo (reset)
  useEffect(() => { setRaw(String(value)); }, [value]);
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={raw}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            setRaw(e.target.value);
            const n = e.target.value === "" ? 0 : Number(e.target.value);
            if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 pr-8 text-sm font-mono font-semibold text-white focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

// ── Fila de fondo en el formulario ──────────────────────────────────────────
export function FundPositionRow({ fund, position, onChange, onReset }) {
  const shares = position?.shares ?? 0;
  const avgPrice = position?.avgPrice ?? 0;
  const invested = shares * avgPrice;
  const value = shares * fund.nav;
  const pnl = value - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  const positive = pnl >= 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: fund.color }}></span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{fund.name}</div>
            <div className="text-[10px] text-slate-500 font-mono">{fund.isin} · NAV {fund.nav.toFixed(4)} €</div>
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition flex-none"
        >
          Borrar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CompactNumber
          label="Participaciones"
          value={shares}
          step={0.001}
          onChange={(v) => onChange({ shares: v, avgPrice })}
          suffix="part."
        />
        <CompactNumber
          label="Precio medio compra"
          value={avgPrice}
          step={0.01}
          onChange={(v) => onChange({ shares, avgPrice: v })}
          suffix="€"
        />
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-[11px] font-mono">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Invertido</div>
          <div className="text-slate-200 font-semibold">{eur(invested, 0)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Valor</div>
          <div className="text-slate-200 font-semibold">{eur(value, 0)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500">P&L</div>
          <div className={`font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {positive ? "+" : ""}{eur(pnl, 0)} <span className="text-[10px] opacity-80">({pct(pnlPct, 1)})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Picker de fondos: dropdown con búsqueda por nombre / ISIN ──────────────
export function FundPicker({ catalog, onPick, onClose }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const norm = (s) => (s || "").toLowerCase().trim();
  const filtered = catalog.filter((f) => {
    const query = norm(q);
    if (!query) return true;
    return norm(f.name).includes(query) || norm(f.isin).includes(query);
  });
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-slate-950/80 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
          Añadir un fondo a tu cartera
        </div>
        <button onClick={onClose} className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300">
          Cancelar
        </button>
      </div>
      <div className="relative mb-3">
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca por nombre o ISIN (ej. S&P 500, IE00B...)"
          className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
          {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-1">
        {filtered.length === 0 && (
          <div className="text-xs text-slate-500 italic py-3 text-center">Sin coincidencias para "{q}".</div>
        )}
        {filtered.map((f) => (
          <button
            key={f.id}
            onClick={() => onPick(f.id)}
            className="group flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-2 w-2 rounded-full flex-none" style={{ background: f.color }}></span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{f.name}</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">{f.isin} · NAV {f.nav.toFixed(4)} €</div>
              </div>
            </div>
            <span className="text-[10px] font-medium text-emerald-300 opacity-0 group-hover:opacity-100 transition flex-none">
              + Añadir
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500 leading-snug">
        ¿No encuentras tu fondo? Por ahora el catálogo se basa en el mock de datos. Cuando conectemos la API real podrás buscar cualquier fondo del mercado.
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
export function MyPortfolio({ funds, positions, setPositions, extraCatalog = [] }) {
  const coreIds = funds.map((f) => f.id);

  // Extras que el usuario ya añadió (cualquier id de positions que no sea core)
  const extraInUseFunds = Object.keys(positions)
    .filter((k) => !coreIds.includes(k))
    .map((id) => extraCatalog.find((f) => f.id === id))
    .filter(Boolean);

  const allFunds = [...funds, ...extraInUseFunds];
  const totals = useMemo(() => computePortfolioTotals(allFunds, positions), [allFunds, positions]);
  const positive = totals.pnl >= 0;
  const tone = totals.pnl > 0 ? "positive" : totals.pnl < 0 ? "negative" : "neutral";

  const [showPicker, setShowPicker] = useState(false);

  const availableToAdd = extraCatalog.filter((f) => !positions[f.id]);

  const update = (id) => (next) => {
    setPositions({ ...positions, [id]: next });
  };
  const reset = (id) => () => {
    if (coreIds.includes(id)) {
      setPositions({ ...positions, [id]: { shares: 0, avgPrice: 0 } });
    } else {
      const next = { ...positions };
      delete next[id];
      setPositions(next);
    }
  };
  const addExtra = (id) => {
    setPositions({ ...positions, [id]: { shares: 0, avgPrice: 0 } });
    setShowPicker(false);
  };
  const clearAll = () => {
    const empty = {};
    funds.forEach((f) => { empty[f.id] = { shares: 0, avgPrice: 0 }; });
    setPositions(empty);
    setShowPicker(false);
  };

  const hasAny = allFunds.some((f) => (positions[f.id]?.shares ?? 0) > 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 text-base">💼</span>
            Mi Cartera Real
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Introduce tus participaciones y precio medio de compra. Se guardan cifradas en tu navegador — no van a ningún servidor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Cifrado local
          </span>
          {hasAny && (
            <button
              onClick={clearAll}
              className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-red-400 transition"
            >
              Vaciar todo
            </button>
          )}
        </div>
      </div>

      {/* Resumen visual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          label="Total invertido"
          value={eur(totals.invested, 0)}
          sub={`Capital aportado de tu bolsillo`}
          tone="neutral"
          icon={<lucide.ShieldCheck size={16} />}
        />
        <SummaryCard
          label="Valor actual"
          value={eur(totals.value, 0)}
          sub={`Al NAV de hoy · ${funds.map(f=>f.nav.toFixed(2)).join(" / ")} €`}
          tone="accent"
          tip="NAV"
          icon={<lucide.Compass size={16} />}
        />
        <SummaryCard
          label="Rentabilidad total"
          value={`${positive ? "+" : ""}${eur(totals.pnl, 0)}`}
          sub={`${pct(totals.pnlPct, 2)} sobre tu inversión`}
          tone={tone}
          tip="PnL"
          icon={positive ? <lucide.TrendingUp size={16} /> : <lucide.TrendingDown size={16} />}
        />
      </div>

      {/* Formulario por fondo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {funds.map((f) => (
          <FundPositionRow
            key={f.id}
            fund={f}
            position={positions[f.id]}
            onChange={update(f.id)}
            onReset={reset(f.id)}
          />
        ))}
        {/* Fondos extra añadidos por el usuario vía el picker */}
        {extraInUseFunds.map((f) => (
          <FundPositionRow
            key={f.id}
            fund={{ ...f, nav: f.nav }}
            position={positions[f.id]}
            onChange={update(f.id)}
            onReset={reset(f.id)}
          />
        ))}

        {/* Botón "+" para añadir más fondos */}
        {!showPicker && availableToAdd.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 px-4 py-6 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition min-h-[180px]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-700 group-hover:border-emerald-500/60 text-2xl font-light text-slate-500 group-hover:text-emerald-300 transition">
              +
            </span>
            <div className="text-xs font-semibold text-slate-300 group-hover:text-emerald-300 transition">
              Añadir otro fondo
            </div>
            <div className="text-[10px] text-slate-500 text-center max-w-[180px] leading-snug">
              ¿Tienes más fondos en cartera? Búscalos por nombre o ISIN.
            </div>
          </button>
        )}
      </div>

      {/* Picker desplegable con búsqueda */}
      {showPicker && (
        <div className="mt-4">
          <FundPicker
            catalog={availableToAdd}
            onPick={addExtra}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  );
}
