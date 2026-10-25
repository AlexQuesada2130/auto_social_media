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
      border: "border-rule",
      bg: "bg-card",
      text: "text-ink",
      iconBg: "bg-rule-soft text-muted",
    },
    positive: {
      border: "border-accent",
      bg: "bg-gradient-to-br from-pos-bg to-transparent",
      text: "text-pos",
      iconBg: "bg-pos-bg text-pos",
    },
    negative: {
      border: "border-neg",
      bg: "bg-gradient-to-br from-neg-bg to-transparent",
      text: "text-neg",
      iconBg: "bg-neg-bg text-neg",
    },
    accent: {
      border: "border-accent",
      bg: "bg-gradient-to-br from-accent-bg to-transparent",
      text: "text-ink",
      iconBg: "bg-accent-bg text-accent",
    },
  };
  const t = tones[tone];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="text-[10px] uppercase tracking-wider text-muted flex items-center">
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
      {sub && <div className="mt-2 text-xs text-muted font-mono">{sub}</div>}
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
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
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
          className="w-full rounded-md border border-rule bg-field px-2.5 py-1.5 pr-8 text-sm font-mono font-semibold text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted font-mono pointer-events-none">
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
    <div className="rounded-xl border border-rule bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: fund.color ?? "var(--faint)" }}></span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink truncate">{fund.name}</div>
            <div className="text-[10px] text-muted font-mono">{fund.isin} · NAV {fund.nav.toFixed(4)} €</div>
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-[10px] uppercase tracking-wider text-muted hover:text-ink transition flex-none"
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
      <div className="mt-3 pt-3 border-t border-rule grid grid-cols-3 gap-2 text-[11px] font-mono">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted">Invertido</div>
          <div className="text-ink font-semibold">{eur(invested, 0)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted">Valor</div>
          <div className="text-ink font-semibold">{eur(value, 0)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted">P&L</div>
          <div className={`font-semibold ${positive ? "text-pos" : "text-neg"}`}>
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
    <div className="rounded-xl border border-accent bg-field backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-pos uppercase tracking-wider">
          Añadir un fondo a tu cartera
        </div>
        <button onClick={onClose} className="text-[10px] uppercase tracking-wider text-muted hover:text-ink">
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
          className="w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink placeholder-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted font-mono">
          {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-1">
        {filtered.length === 0 && (
          <div className="text-xs text-muted italic py-3 text-center">Sin coincidencias para "{q}".</div>
        )}
        {filtered.map((f) => (
          <button
            key={f.id}
            onClick={() => onPick(f.id)}
            className="group flex items-center justify-between gap-3 rounded-md border border-rule bg-card px-3 py-2 hover:border-accent hover:bg-pos-bg transition text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-2 w-2 rounded-full flex-none" style={{ background: f.color ?? "var(--faint)" }}></span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink truncate">{f.name}</div>
                <div className="text-[10px] text-muted font-mono truncate">{f.isin} · NAV {f.nav.toFixed(4)} €</div>
              </div>
            </div>
            <span className="text-[10px] font-medium text-pos opacity-0 group-hover:opacity-100 transition flex-none">
              + Añadir
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-rule text-[10px] text-muted leading-snug">
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
    <div className="rounded-2xl border border-rule bg-card backdrop-blur p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-pos-bg text-pos text-base">💼</span>
            Mi Cartera Real
          </h2>
          <p className="text-xs text-muted mt-1">
            Introduce tus participaciones y precio medio de compra. Se guardan cifradas en tu navegador — no van a ningún servidor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rule-soft px-2.5 py-1 text-[10px] font-medium text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-pos animate-pulse"></span>
            Cifrado local
          </span>
          {hasAny && (
            <button
              onClick={clearAll}
              className="text-[10px] uppercase tracking-wider text-muted hover:text-neg transition"
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
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-rule bg-card px-4 py-6 hover:border-accent hover:bg-pos-bg transition min-h-[180px]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-rule group-hover:border-accent text-2xl font-light text-muted group-hover:text-accent transition">
              +
            </span>
            <div className="text-xs font-semibold text-ink group-hover:text-accent transition">
              Añadir otro fondo
            </div>
            <div className="text-[10px] text-muted text-center max-w-[180px] leading-snug">
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
