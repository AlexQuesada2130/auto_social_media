import React, { useState, useMemo } from 'react';
import {
  LineChart as FELineChart, Line as FELine,
  XAxis as FEX, YAxis as FEY, CartesianGrid as FEGrid,
  Tooltip as FETip, ResponsiveContainer as FEResp, ReferenceLine as FERef,
} from 'recharts';

// ── Generador determinista (mismo PRNG que data.js, simplificado) ──────────
function feHistory(startNAV, mean, vol, months, seed) {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const series = [];
  let nav = startNAV;
  const today = new Date(2026, 4, 1);
  for (let i = months; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    nav = nav * (1 + mean + vol * gauss());
    series.push({
      label: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
      nav: +nav.toFixed(4),
    });
  }
  return series;
}

// ── Catálogo de fondos extra (sintéticos pero coherentes) ──────────────────
export const EXTRA_FUNDS = [
  { id: "sp500", name: "Vanguard S&P 500", isin: "IE00BFMXXD54", tier: "rec", color: "#F59E0B", risk: "Medio", desc: "500 mayores empresas USA. El estándar del mercado.", mean: 0.0098, vol: 0.040, seed: 1111 },
  { id: "bonds", name: "iShares Global Aggregate Bond", isin: "IE00BDBRDM35", tier: "rec", color: "#A78BFA", risk: "Bajo", desc: "Bonos gobierno + corporativos globales. Estabilidad.", mean: 0.0028, vol: 0.012, seed: 2222 },
  { id: "euro", name: "Vanguard Eurozone Stock Idx", isin: "IE0008248795", tier: "rec", color: "#EC4899", risk: "Medio", desc: "Empresas grandes de la zona euro.", mean: 0.0068, vol: 0.041, seed: 3333 },
  { id: "ftseall", name: "Vanguard FTSE All-World", isin: "IE00BK5BQT80", tier: "rec", color: "#34D399", risk: "Medio", desc: "Mundo entero en un solo fondo: desarrollados + emergentes.", mean: 0.0087, vol: 0.039, seed: 8181 },
  { id: "msciacwi", name: "iShares MSCI ACWI", isin: "IE00B6R52259", tier: "rec", color: "#818CF8", risk: "Medio", desc: "All Country World Index. 47 países, 2.900+ empresas.", mean: 0.0089, vol: 0.040, seed: 9292 },
  { id: "small", name: "Vanguard Global Small-Cap", isin: "IE00B42W3S00", tier: "more", color: "#F472B6", risk: "Alto", desc: "Empresas pequeñas globales. Volátil pero potente.", mean: 0.0091, vol: 0.052, seed: 4444 },
  { id: "tech", name: "iShares NASDAQ 100", isin: "IE00B53SZB19", tier: "more", color: "#22D3EE", risk: "Alto", desc: "100 empresas tech USA. Crecimiento alto.", mean: 0.0125, vol: 0.061, seed: 5555 },
  { id: "reit", name: "Amundi FTSE EPRA REITs", isin: "LU1437018838", tier: "more", color: "#FB923C", risk: "Medio", desc: "Inmobiliario cotizado mundial. Renta + diversifica.", mean: 0.0054, vol: 0.045, seed: 6666 },
  { id: "gold", name: "Invesco Physical Gold ETC", isin: "IE00B579F325", tier: "more", color: "#FBBF24", risk: "Medio", desc: "Oro físico. Cobertura clásica contra crisis.", mean: 0.0061, vol: 0.038, seed: 7777 },
  { id: "japan", name: "iShares MSCI Japan", isin: "IE00B53QDK08", tier: "more", color: "#F87171", risk: "Medio", desc: "Bolsa japonesa. Diversificación geográfica.", mean: 0.0052, vol: 0.044, seed: 1313 },
  { id: "div", name: "Vanguard FTSE Hi-Div Yield", isin: "IE00B8GKDB10", tier: "more", color: "#FDE047", risk: "Medio", desc: "Empresas globales con alto dividendo.", mean: 0.0072, vol: 0.038, seed: 2424 },
];

EXTRA_FUNDS.forEach((f) => { f.series = feHistory(10, f.mean, f.vol, 60, f.seed); });

function buildMultiSeries(activeFunds, months) {
  if (!activeFunds.length) return [];
  const len = activeFunds[0].series.length;
  const start = Math.max(0, len - months - 1);
  const rows = [];
  for (let i = start; i < len; i++) {
    const row = { label: activeFunds[0].series[i].label };
    activeFunds.forEach((f) => {
      const base = f.series[start].nav;
      row[f.id] = +((f.series[i].nav / base) * 100).toFixed(2);
    });
    rows.push(row);
  }
  return rows;
}

export function FundRow({ fund, active, onToggle, isCore }) {
  const last = fund.series[fund.series.length - 1].nav;
  const first = fund.series[0].nav;
  const cagr = (Math.pow(last / first, 1 / 5) - 1) * 100;
  const riskColors = {
    Bajo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Medio: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Alto: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return (
    <button
      onClick={() => !isCore && onToggle(fund.id)}
      disabled={isCore}
      className={`group w-full text-left rounded-xl border p-3 transition ${active
          ? "border-slate-600 bg-slate-800/60"
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
        } ${isCore ? "cursor-default" : "cursor-pointer"}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: fund.color }}></span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{fund.name}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate">{fund.isin}</div>
          </div>
        </div>
        {isCore ? (
          <span className="text-[9px] uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5 flex-none">
            Tuyo
          </span>
        ) : (
          <span className={`flex h-5 w-9 items-center rounded-full border transition flex-none ${active ? "bg-emerald-500/30 border-emerald-500/50 justify-end" : "bg-slate-800 border-slate-700 justify-start"
            }`}>
            <span className={`h-3.5 w-3.5 m-0.5 rounded-full transition ${active ? "bg-emerald-300" : "bg-slate-600"}`}></span>
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className={`inline-block rounded border px-1.5 py-0.5 ${riskColors[fund.risk] || "bg-slate-800 text-slate-300 border-slate-700"}`}>
          {fund.risk}
        </span>
        <span className="text-slate-400">
          CAGR 5A <span className={`font-semibold ${cagr >= 0 ? "text-emerald-300" : "text-red-300"}`}>{cagr >= 0 ? "+" : ""}{cagr.toFixed(1)}%</span>
        </span>
      </div>
      {!isCore && (
        <div className="mt-1.5 text-[10px] text-slate-500 leading-snug">{fund.desc}</div>
      )}
    </button>
  );
}

export function FundsExplorer({ funds }) {
  const [world, em] = funds;
  const coreEntries = [
    { ...world, isCore: true, color: "#10B981", risk: "Medio", desc: "Tu fondo principal." },
    { ...em, isCore: true, color: "#60A5FA", risk: "Alto", desc: "Tu exposición a emergentes." },
  ];
  const allExtras = EXTRA_FUNDS;

  const [active, setActive] = useState({ sp500: true, bonds: true, euro: false });
  const [showMore, setShowMore] = useState(false);
  const [range, setRange] = useState("3A");

  const toggle = (id) => setActive((a) => ({ ...a, [id]: !a[id] }));

  const ranges = [
    { id: "1A", m: 12 }, { id: "3A", m: 36 }, { id: "5A", m: 60 },
  ];
  const months = ranges.find((r) => r.id === range)?.m ?? 60;

  const activeExtras = allExtras.filter((f) => active[f.id]);
  const chartFunds = [...coreEntries, ...activeExtras];
  const data = useMemo(() => buildMultiSeries(chartFunds, months), [chartFunds.map(f => f.id).join(","), months]);
  const last = data[data.length - 1] || {};

  const visibleExtras = showMore ? allExtras : allExtras.filter((f) => f.tier === "rec");
  const hiddenCount = allExtras.length - allExtras.filter((f) => f.tier === "rec").length;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            📈 Comparador de fondos
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Compara la evolución de tus fondos con otros recomendados. Activa los que quieras añadir al gráfico.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
          {ranges.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${range === r.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                }`}>
              {r.id}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="h-[420px] rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <FEResp width="100%" height="100%">
              <FELineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <FEGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                <FEX dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "#1e293b" }} tickLine={false}
                  interval={Math.max(0, Math.floor(data.length / 8) - 1)} />
                <FEY tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false}
                  domain={["dataMin - 5", "dataMax + 5"]} tickFormatter={(v) => v.toFixed(0)} />
                <FERef y={100} stroke="#334155" strokeDasharray="3 3" />
                <FETip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                  labelStyle={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}
                  formatter={(v, name) => {
                    const f = chartFunds.find((cf) => cf.id === name);
                    return [v.toFixed(2), f?.name ?? name];
                  }} />
                {chartFunds.map((f) => (
                  <FELine key={f.id} type="monotone" dataKey={f.id} stroke={f.color}
                    strokeWidth={f.isCore ? 2.5 : 1.8} dot={false} activeDot={{ r: 4 }} />
                ))}
              </FELineChart>
            </FEResp>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {chartFunds.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-2 text-[11px]">
                <span className="h-2 w-2 rounded-full" style={{ background: f.color }}></span>
                <span className="text-slate-300">{f.name.split(" ").slice(0, 3).join(" ")}</span>
                {last[f.id] && <span className="font-mono text-slate-500">{last[f.id].toFixed(1)}</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1">Mis fondos</div>
          {coreEntries.map((f) => (
            <FundRow key={f.id} fund={f} active={true} isCore onToggle={() => { }} />
          ))}
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mt-3 flex items-center gap-2">
            Recomendados <span className="h-px flex-1 bg-slate-800"></span>
            <span className="font-mono text-slate-600">Potentes & seguros</span>
          </div>
          {visibleExtras.map((f) => (
            <FundRow key={f.id} fund={f} active={!!active[f.id]} onToggle={toggle} />
          ))}
          <button onClick={() => setShowMore((v) => !v)}
            className="mt-1 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-800/40 hover:border-slate-600 px-3 py-2.5 text-xs font-medium text-slate-300 transition flex items-center justify-center gap-2">
            {showMore ? "▲ Ver menos" : `▼ Ver ${hiddenCount} fondos menos famosos`}
          </button>

          <a
            href="https://www.morningstar.es/es/screener/fund.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 px-3 py-2.5 text-xs font-medium text-emerald-300 transition flex items-center justify-center gap-2 group"
          >
            <span>🔎 Explorar más fondos en Morningstar</span>
            <span className="text-[10px] opacity-60 group-hover:opacity-100 transition">↗</span>
          </a>
          <div className="text-[10px] text-slate-500 leading-snug px-1 -mt-1">
            Buscador profesional con miles de fondos UCITS: filtros por categoría, TER, rentabilidad, domicilio…
          </div>
        </div>
      </div>
    </div>
  );
}
