import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { DASHBOARD_DATA } from './data';

// ---------- Iconos (SVG inline, estilo Lucide) ----------
const Icon = ({ size = 16, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}>
    {children}
  </svg>
);

export const lucide = {
  Info: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  ),
  Eye: (p) => (
    <Icon {...p}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  Compass: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </Icon>
  ),
  ShieldCheck: (p) => (
    <Icon {...p}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
  TrendingUp: (p) => (
    <Icon {...p}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </Icon>
  ),
  TrendingDown: (p) => (
    <Icon {...p}>
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </Icon>
  ),
  Lock: (p) => (
    <Icon {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  ),
  Settings: (p) => (
    <Icon {...p}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  Download: (p) => (
    <Icon {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </Icon>
  ),
  Upload: (p) => (
    <Icon {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </Icon>
  ),
  Wallet: (p) => (
    <Icon {...p}>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </Icon>
  ),
  Trash: (p) => (
    <Icon {...p}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </Icon>
  ),
  ChevronLeft: (p) => (
    <Icon {...p}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  ),
  ChevronRight: (p) => (
    <Icon {...p}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  ),
  X: (p) => (
    <Icon {...p}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  )
};

// ---------- Tooltip educativo ----------
export function InfoTip({ termKey, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const entry = DASHBOARD_DATA.glossary[termKey];
  if (!entry) return null;
  return (
    <span className="relative inline-flex items-center" ref={ref}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {e.stopPropagation();setOpen((v) => !v);}}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] font-semibold text-slate-400 hover:border-slate-400 hover:text-slate-200 transition"
        aria-label={`Información sobre ${entry.title}`}>
        <lucide.Info size={10} strokeWidth={2.5} />
      </button>
      {open && (
        <span className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-left text-xs font-normal text-slate-200 shadow-2xl shadow-black/50 ring-1 ring-black/20">
          <span className="block font-semibold text-white mb-1">{entry.title}</span>
          <span className="block text-slate-300 leading-relaxed">{entry.body}</span>
        </span>
      )}
    </span>
  );
}

// ---------- Sparkline pequeño dentro de tarjeta ----------
export function MiniSpark({ series, color }) {
  const data = series.slice(-24); // últimos 24 meses
  return (
    <ResponsiveContainer width="100%" height={64}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey="nav"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------- Métricas auxiliares ----------
export function pct(n, digits = 2) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}
export function eur(n, digits = 2) {
  return n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}
export function fundMetrics(fund) {
  const s = fund.series;
  const last = s[s.length - 1].nav;
  const first = s[0].nav;
  const m1 = s[s.length - 2].nav;
  const m12 = s[s.length - 13]?.nav ?? first;
  const m36 = s[s.length - 37]?.nav ?? first;
  const yearsTotal = (s.length - 1) / 12;
  const r1d = (last - m1) / m1 * 100;
  const r1y = (last - m12) / m12 * 100;
  const r3y = (Math.pow(last / m36, 1 / 3) - 1) * 100;
  const rTotalCagr = (Math.pow(last / first, 1 / yearsTotal) - 1) * 100;
  const invested = fund.held * fund.avgCost;
  const value = fund.held * last;
  const pnl = value - invested;
  const pnlPct = invested > 0 ? pnl / invested * 100 : 0;
  return { r1d, r1y, r3y, rTotalCagr, invested, value, pnl, pnlPct };
}

// ---------- Tarjeta de fondo Core ----------
export function CoreFundCard({ fund }) {
  const m = fundMetrics(fund);
  const positive = m.pnl >= 0;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 flex flex-col gap-5 hover:border-slate-700 transition">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: fund.color }}></span>
              Core
            </span>
            <span className="text-[11px] text-slate-500 font-mono">{fund.shareClass}</span>
            <InfoTip termKey="ACC" />
          </div>
          <h3 className="mt-2 text-lg font-semibold text-white leading-tight">{fund.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="font-mono">{fund.isin}</span>
            <InfoTip termKey="ISIN" />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center justify-end">
            NAV <InfoTip termKey="NAV" />
          </div>
          <div className="text-2xl font-semibold text-white font-mono mt-0.5">
            {fund.nav.toFixed(4)}
          </div>
          <div className={`text-xs font-medium ${m.r1d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {pct(m.r1d)} <span className="text-slate-500">último mes</span>
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="-mx-2">
        <MiniSpark series={fund.series} color={fund.color} />
      </div>

      {/* Posición */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Invertido</div>
          <div className="mt-1 text-base font-semibold text-white font-mono">{eur(m.invested)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{fund.held.toFixed(3)} part.</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Valor actual</div>
          <div className="mt-1 text-base font-semibold text-white font-mono">{eur(m.value)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">PMC {fund.avgCost.toFixed(2)} €</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center">
            P&L <InfoTip termKey="PnL" />
          </div>
          <div className={`mt-1 text-base font-semibold font-mono ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {positive ? "+" : ""}{eur(m.pnl)}
          </div>
          <div className={`text-[11px] font-mono mt-0.5 ${positive ? "text-emerald-400/80" : "text-red-400/80"}`}>
            {pct(m.pnlPct)}
          </div>
        </div>
      </div>

      {/* Stats fondo */}
      <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-800">
        <Stat label="TER" value={`${fund.ter.toFixed(2)}%`} tip="TER" />
        <Stat label="1A" value={pct(m.r1y, 1)} valueColor={m.r1y >= 0 ? "text-emerald-400" : "text-red-400"} />
        <Stat label="3A anual." value={pct(m.r3y, 1)} valueColor={m.r3y >= 0 ? "text-emerald-400" : "text-red-400"} tip="CAGR" />
        <Stat label="Holdings" value={fund.holdings.toLocaleString("es-ES")} />
      </div>

      {/* Distribución regional */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center">
            Distribución regional
            <InfoTip termKey={fund.id === "world" ? "MSCIWorld" : "MSCIEM"} />
          </div>
          <div className="text-[10px] text-slate-500 font-mono">{fund.benchmark}</div>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
          {fund.topRegions.map((r, i) => (
            <div
              key={r.name}
              className="h-full"
              style={{
                width: `${r.w}%`,
                background: `oklch(${78 - i * 8}% 0.08 ${fund.id === "world" ? 160 : 240})`
              }}
              title={`${r.name}: ${r.w}%`}>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {fund.topRegions.map((r, i) => (
            <span key={r.name} className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-sm"
                style={{ background: `oklch(${78 - i * 8}% 0.08 ${fund.id === "world" ? 160 : 240})` }}>
              </span>
              {r.name} <span className="font-mono text-slate-500">{r.w.toFixed(1)}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Stat({ label, value, valueColor = "text-white", tip }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center">
        {label} {tip && <InfoTip termKey={tip} />}
      </div>
      <div className={`mt-1 text-sm font-semibold font-mono ${valueColor}`}>{value}</div>
    </div>
  );
}

// ---------- Gráfico comparativo ----------
export function ComparisonChart({ data, range, onRange }) {
  const ranges = [
    { id: "1A", months: 12 },
    { id: "3A", months: 36 },
    { id: "5A", months: 60 },
    { id: "Todo", months: data.length }
  ];

  const months = ranges.find((r) => r.id === range)?.months ?? data.length;
  const slice = data.slice(-months);
  // Renormalizar a 100 al inicio del slice
  const baseW = slice[0].World;
  const baseE = slice[0].Emerging;
  const norm = slice.map((p) => ({
    ...p,
    World: +(p.World / baseW * 100).toFixed(2),
    Emerging: +(p.Emerging / baseE * 100).toFixed(2)
  }));
  const last = norm[norm.length - 1];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center">
            Evolución comparada
            <InfoTip termKey="Benchmark" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Base 100 al inicio del periodo. Compara cómo se han movido tus dos fondos lado a lado.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-xs">
            <LegendDot color="#10B981" label="MSCI World" value={last.World.toFixed(1)} />
            <LegendDot color="#60A5FA" label="MSCI Emerging" value={last.Emerging.toFixed(1)} />
          </div>
          <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            {ranges.map((r) => (
              <button
                key={r.id}
                onClick={() => onRange(r.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                  range === r.id ?
                  "bg-slate-700 text-white" :
                  "text-slate-400 hover:text-slate-200"}`
                }>
                {r.id}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={norm} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#1e293b" }}
              tickLine={false}
              interval={Math.max(0, Math.floor(norm.length / 8) - 1)} />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 5", "dataMax + 5"]}
              tickFormatter={(v) => v.toFixed(0)} />
            <ReferenceLine y={100} stroke="#334155" strokeDasharray="3 3" />
            <RTooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "12px"
              }}
              labelStyle={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}
              formatter={(v, name) => [v.toFixed(2), name]} />
            <Line
              type="monotone"
              dataKey="World"
              name="MSCI World"
              stroke="#10B981"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }} />
            <Line
              type="monotone"
              dataKey="Emerging"
              name="MSCI Emerging"
              stroke="#60A5FA"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LegendDot({ color, label, value }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color }}></span>
      <span className="text-slate-300">{label}</span>
      <span className="font-mono text-slate-500">{value}</span>
    </span>
  );
}

// ---------- Watchlist ----------
export function Watchlist({ rows }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-6 pb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Fondos constantes · Watchlist</h2>
          <p className="text-xs text-slate-400 mt-1">
            Fondos indexados de referencia que sigo para comparar. No los tengo en cartera.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300">
          <lucide.Eye size={12} /> Solo seguimiento
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-800">
              <th className="text-left font-medium px-6 py-2.5">Fondo</th>
              <th className="text-left font-medium px-3 py-2.5">ISIN</th>
              <th className="text-left font-medium px-3 py-2.5">Categoría</th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center justify-end">TER<InfoTip termKey="TER" /></span>
              </th>
              <th className="text-right font-medium px-3 py-2.5">1A</th>
              <th className="text-right font-medium px-3 py-2.5">
                <span className="inline-flex items-center justify-end">3A<InfoTip termKey="CAGR" /></span>
              </th>
              <th className="text-right font-medium px-6 py-2.5">5A</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.isin} className="border-b border-slate-800/70 last:border-b-0 hover:bg-slate-800/30 transition">
                <td className="px-6 py-3.5">
                  <div className="font-medium text-white">{f.name}</div>
                </td>
                <td className="px-3 py-3.5 font-mono text-xs text-slate-400">{f.isin}</td>
                <td className="px-3 py-3.5">
                  <span className="inline-block rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                    {f.cat}
                  </span>
                </td>
                <td className="px-3 py-3.5 text-right font-mono text-slate-200">{f.ter.toFixed(2)}%</td>
                <ReturnCell v={f.r1} />
                <ReturnCell v={f.r3} />
                <ReturnCell v={f.r5} pad />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReturnCell({ v, pad }) {
  const positive = v >= 0;
  return (
    <td className={`py-3.5 text-right font-mono ${pad ? "px-6" : "px-3"} ${positive ? "text-emerald-400" : "text-red-400"}`}>
      {pct(v, 1)}
    </td>
  );
}

// ---------- Estado de error (UI del hook useMarketData) ----------
export function ErrorState({ message, onRetry }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
          <lucide.Info size={22} />
        </div>
        <h2 className="text-base font-semibold text-white">No se pudieron cargar los datos</h2>
        <p className="text-sm text-slate-400 mt-2 font-mono break-all">{message}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 transition px-4 py-2 text-sm font-semibold text-slate-950">
          Reintentar
        </button>
      </div>
    </div>
  );
}