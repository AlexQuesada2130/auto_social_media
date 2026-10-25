import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area,
  ComposedChart as CalcComposed,
  Line as CalcLine,
  XAxis as CalcXAxis,
  YAxis as CalcYAxis, CartesianGrid as CalcGrid,
  Tooltip as CalcTooltip, ResponsiveContainer as CalcResponsive,
} from 'recharts';
import { eur, pct, InfoTip } from './components';

// ── Cálculo de CAGR a partir de la serie histórica ──────────────────────────
export function computeCAGR(series) {
  if (!series || series.length < 2) return 0;
  const first = series[0].nav;
  const last = series[series.length - 1].nav;
  const years = (series.length - 1) / 12;
  return Math.pow(last / first, 1 / years) - 1;
}

// ── Proyección mes a mes ────────────────────────────────────────────────────
export function projectGrowth({ initial, monthly, years, annualRate }) {
  const months = Math.round(years * 12);
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  const points = [];
  let balance = initial;
  let invested = initial;
  points.push({ year: 0, balance, invested, gains: 0 });
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthly;
    invested += monthly;
    if (m % 12 === 0 || m === months) {
      points.push({
        year: +(m / 12).toFixed(2),
        balance: +balance.toFixed(2),
        invested: +invested.toFixed(2),
        gains: +(balance - invested).toFixed(2),
      });
    }
  }
  return { months, balance, invested, gains: balance - invested, points };
}

// ── Input numérico con etiqueta ─────────────────────────────────────────────
export function NumberInput({ label, value, onChange, suffix, min = 0, max = 999_999, step = 1, tip }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted flex items-center">
        {label} {tip && <InfoTip termKey={tip} />}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = e.target.value === "" ? 0 : Number(e.target.value);
            if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-full rounded-lg border border-rule bg-card px-3 py-2.5 pr-10 text-base font-mono font-semibold text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted font-mono pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

// ── Slider con valor en burbuja ────────────────────────────────────────────
export function YearsSlider({ value, onChange }) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted">Años a invertir</span>
        <span className="font-mono text-base font-semibold text-ink">{value}<span className="text-xs text-muted ml-1">años</span></span>
      </div>
      <input
        type="range"
        min={1}
        max={40}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-serie-1"
      />
      <div className="flex justify-between text-[10px] text-muted font-mono">
        <span>1A</span><span>10A</span><span>20A</span><span>30A</span><span>40A</span>
      </div>
    </label>
  );
}

// ── Mix Allocator: dos sliders enlazados que suman SIEMPRE 100% ─────────────
export function AllocationSliders({ worldPct, onWorldChange, cagrW, cagrE }) {
  const emPct = 100 - worldPct;
  const blended = (worldPct / 100) * cagrW + (emPct / 100) * cagrE;
  const presets = [
    { label: "100/0", v: 100 },
    { label: "80/20", v: 80 },
    { label: "60/40", v: 60 },
    { label: "0/100", v: 0 },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rule bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted">
          Mix de cartera
        </span>
        <span className="text-[10px] font-mono text-muted">
          Ponderado: <span className="text-pos font-semibold">{(blended * 100).toFixed(2)}%</span> anual
        </span>
      </div>

      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-rule-soft">
        <div className="h-full rounded-l-full bg-serie-1 transition-all" style={{ width: `${worldPct}%` }}></div>
        <div className="h-full rounded-r-full bg-serie-2 transition-all" style={{ width: `${emPct}%` }}></div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink">
            <span className="h-2 w-2 rounded-full bg-serie-1"></span>
            MSCI World <InfoTip termKey="MSCIWorld" />
          </span>
          <span className="font-mono text-sm font-semibold text-ink">
            {worldPct}<span className="text-muted text-xs">%</span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={worldPct}
          onChange={(e) => onWorldChange(Number(e.target.value))}
          className="w-full accent-serie-1"
        />
        <div className="text-[10px] font-mono text-muted mt-0.5">
          CAGR histórico: {(cagrW * 100).toFixed(2)}%
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink">
            <span className="h-2 w-2 rounded-full bg-serie-2"></span>
            MSCI Emerging <InfoTip termKey="MSCIEM" />
          </span>
          <span className="font-mono text-sm font-semibold text-ink">
            {emPct}<span className="text-muted text-xs">%</span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={emPct}
          onChange={(e) => onWorldChange(100 - Number(e.target.value))}
          className="w-full accent-serie-2"
        />
        <div className="text-[10px] font-mono text-muted mt-0.5">
          CAGR histórico: {(cagrE * 100).toFixed(2)}%
        </div>
      </div>

      <div className="flex gap-1.5 pt-1">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onWorldChange(p.v)}
            className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-mono font-semibold transition ${worldPct === p.v
                ? "border-accent bg-pos-bg text-pos"
                : "border-rule bg-card text-muted hover:text-ink"
              }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Resultado destacado ─────────────────────────────────────────────────────
export function ResultHero({ invested, balance, gains, years, strategyLabel }) {
  const multiplier = balance / Math.max(invested, 1);
  const positive = gains >= 0;
  return (
    <div className="rounded-xl border border-accent bg-gradient-to-br from-pos-bg to-transparent p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div className="text-[10px] uppercase tracking-wider text-pos flex items-center">
          Proyección con interés compuesto
          <InfoTip termKey="Compound" />
        </div>
        <div className="text-[10px] text-muted font-mono">
          {strategyLabel} · {years}A
        </div>
      </div>
      <p className="text-sm leading-relaxed text-ink">
        En <span className="font-semibold text-ink">{years} años</span> habrás aportado{" "}
        <span className="font-mono font-semibold text-ink">{eur(invested, 0)}</span>,
        pero gracias al interés compuesto tendrás{" "}
        <span className="font-mono font-semibold text-pos text-base">{eur(balance, 0)}</span>.
        {positive && (
          <> Eso son <span className="font-mono font-semibold text-pos">{eur(gains, 0)}</span> de
            ganancias — tu dinero se habrá multiplicado <span className="font-mono font-semibold text-ink">×{multiplier.toFixed(2)}</span>. 🚀</>
        )}
      </p>
    </div>
  );
}

// ── KPI compacto ────────────────────────────────────────────────────────────
export function KPI({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg border border-rule bg-card p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold font-mono ${accent || "text-ink"}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Escenarios: pesimista / base / optimista ────────────────────────
export function ScenarioGrid({ initial, monthly, years, baseRate }) {
  const scenarios = [
    { id: "bear", label: "Mercado malo", desc: "Crisis / recesión", rate: Math.max(baseRate - 0.04, -0.005), tone: "red", emoji: "🐻" },
    { id: "base", label: "Mercado normal", desc: "Media histórica", rate: baseRate, tone: "emerald", emoji: "📊" },
    { id: "bull", label: "Mercado bueno", desc: "Vientos a favor", rate: baseRate + 0.03, tone: "sky", emoji: "🚀" },
  ];
  const tones = {
    red: { border: "border-neg", bg: "bg-neg-bg", text: "text-neg" },
    emerald: { border: "border-accent", bg: "bg-pos-bg", text: "text-pos" },
    sky: { border: "border-accent", bg: "bg-accent-bg", text: "text-accent" },
  };
  return (
    <div className="rounded-xl border border-rule bg-field p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-[11px] uppercase tracking-wider text-muted">
          Escenarios a {years} años · cómo afecta el mercado
        </div>
        <span className="text-[10px] text-muted font-mono">El mercado no sube en línea recta. Estas son 3 rutas posibles.</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {scenarios.map((s) => {
          const proj = projectGrowth({ initial, monthly, years, annualRate: s.rate });
          const t = tones[s.tone];
          const mult = proj.balance / Math.max(proj.invested, 1);
          return (
            <div key={s.id} className={`rounded-lg border ${t.border} ${t.bg} p-3`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-ink flex items-center gap-1">
                  <span>{s.emoji}</span> {s.label}
                </span>
                <span className={`text-[10px] font-mono ${t.text}`}>{(s.rate * 100).toFixed(1)}%</span>
              </div>
              <div className={`text-xl font-semibold font-mono ${t.text}`}>{eur(proj.balance, 0)}</div>
              <div className="text-[10px] text-muted font-mono mt-0.5">×{mult.toFixed(2)} · {s.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Escala temporal: balance proyectado en hitos intermedios ────────
export function ScenarioTimeline({ initial, monthly, years, baseRate }) {
  const candidates = [5, 10, 15, 20, 25, 30, 35, 40];
  const milestones = candidates.filter((y) => y <= years);
  if (milestones[milestones.length - 1] !== years) milestones.push(years);

  const scenarios = [
    { id: "bear", label: "Mercado malo", rate: Math.max(baseRate - 0.04, -0.005), tone: "red", emoji: "🐻" },
    { id: "base", label: "Mercado normal", rate: baseRate, tone: "emerald", emoji: "📊" },
    { id: "bull", label: "Mercado bueno", rate: baseRate + 0.03, tone: "sky", emoji: "🚀" },
  ];

  const tones = {
    red: { dot: "bg-serie-2", text: "text-neg", bg: "bg-neg-bg" },
    emerald: { dot: "bg-serie-1", text: "text-pos", bg: "bg-pos-bg" },
    sky: { dot: "bg-serie-3", text: "text-accent", bg: "bg-accent-bg" },
  };

  const rows = scenarios.map((s) => {
    const cells = milestones.map((y) => {
      const proj = projectGrowth({ initial, monthly, years: y, annualRate: s.rate });
      return {
        year: y,
        balance: proj.balance,
        invested: proj.invested,
        mult: proj.balance / Math.max(proj.invested, 1),
      };
    });
    return { ...s, cells };
  });

  return (
    <div className="rounded-xl border border-rule bg-field p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-[11px] uppercase tracking-wider text-muted">
          Escala temporal · cuánto tendrás en cada hito
        </div>
        <span className="text-[10px] text-muted font-mono">
          Hitos cada 5A hasta tu horizonte ({years}A)
        </span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[460px]">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `120px repeat(${milestones.length}, minmax(0, 1fr))` }}>
            <div className="text-[10px] uppercase tracking-wider text-muted self-end pb-1">Escenario</div>
            {milestones.map((y) => (
              <div key={y} className="text-[10px] font-mono text-muted text-right pr-1 pb-1">
                {y}A
              </div>
            ))}
            {rows.map((r) => {
              const t = tones[r.tone];
              return (
                <React.Fragment key={r.id}>
                  <div className="flex items-center gap-1.5 py-1.5">
                    <span className={`h-2 w-2 rounded-full ${t.dot}`}></span>
                    <span className="text-[11px] text-ink">{r.emoji} {r.label}</span>
                    <span className="text-[9px] font-mono text-muted ml-auto">{(r.rate * 100).toFixed(1)}%</span>
                  </div>
                  {r.cells.map((c, i) => (
                    <div key={i} className={`rounded-md ${t.bg} px-2 py-1.5 text-right`}>
                      <div className={`text-[12px] font-semibold font-mono ${t.text} leading-tight`}>
                        {eur(c.balance, 0)}
                      </div>
                      <div className="text-[9px] text-muted font-mono leading-tight">
                        ×{c.mult.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 text-[10px] text-muted leading-snug">
        Cada celda muestra el balance proyectado y el multiplicador sobre lo aportado.
        El mercado <span className="text-ink">no sube en línea recta</span>: la franja entre el escenario malo y bueno es el rango razonable de resultados posibles.
      </div>
    </div>
  );
}

export function InvestmentCalculator({ funds }) {
  const [world, em] = funds;
  const cagrW = useMemo(() => computeCAGR(world.series), [world]);
  const cagrE = useMemo(() => computeCAGR(em.series), [em]);

  const [initial, setInitial] = useState(5000);
  const [monthly, setMonthly] = useState(300);
  const [years, setYears] = useState(20);
  const [worldPct, setWorldPct] = useState(80);
  const emPct = 100 - worldPct;
  const blendedRate = (worldPct / 100) * cagrW + (emPct / 100) * cagrE;
  const strategyLabel = `Mix ${worldPct}/${emPct} (World/EM)`;

  const proj = useMemo(
    () => projectGrowth({ initial, monthly, years, annualRate: blendedRate }),
    [initial, monthly, years, blendedRate]
  );

  const fanData = useMemo(() => {
    const bearRate = Math.max(blendedRate - 0.04, -0.005);
    const bullRate = blendedRate + 0.03;
    const bear = projectGrowth({ initial, monthly, years, annualRate: bearRate }).points;
    const base = proj.points;
    const bull = projectGrowth({ initial, monthly, years, annualRate: bullRate }).points;
    return base.map((p, i) => ({
      year: p.year,
      invested: p.invested,
      bear: bear[i]?.balance ?? null,
      base: p.balance,
      bull: bull[i]?.balance ?? null,
    }));
  }, [initial, monthly, years, blendedRate, proj]);

  return (
    <div className="rounded-2xl border border-rule bg-card backdrop-blur p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center">
            🧮 Calculadora de Interés Compuesto
          </h2>
          <p className="text-xs text-muted mt-1">
            Proyecta cuánto valdrá tu cartera con aportaciones periódicas, usando la rentabilidad histórica real de tus fondos.
            <InfoTip termKey="DCA" />
          </p>
        </div>
        <span className="hidden md:inline-flex items-center gap-1.5 rounded-md bg-pos-bg border border-accent px-2.5 py-1 text-[11px] text-pos">
          ⚡ Killer feature
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <NumberInput
            label="Inversión inicial"
            value={initial}
            onChange={setInitial}
            suffix="€"
            min={0}
            max={1_000_000}
            step={100}
          />
          <NumberInput
            label="Aportación mensual"
            value={monthly}
            onChange={setMonthly}
            suffix="€/mes"
            min={0}
            max={10_000}
            step={50}
          />
          <YearsSlider value={years} onChange={setYears} />
          <AllocationSliders
            worldPct={worldPct}
            onWorldChange={setWorldPct}
            cagrW={cagrW}
            cagrE={cagrE}
          />
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <ResultHero
            invested={proj.invested}
            balance={proj.balance}
            gains={proj.gains}
            years={years}
            strategyLabel={strategyLabel}
          />

          <div className="grid grid-cols-3 gap-2">
            <KPI label="Aportado" value={eur(proj.invested, 0)} sub={`${monthly}€/mes`} />
            <KPI label="Ganancias" value={eur(proj.gains, 0)} accent="text-pos" sub={pct((proj.gains / Math.max(proj.invested, 1)) * 100, 0)} />
            <KPI label="Total final" value={eur(proj.balance, 0)} sub={`${(blendedRate * 100).toFixed(2)}% CAGR ponderado`} />
          </div>

          <ScenarioGrid initial={initial} monthly={monthly} years={years} baseRate={blendedRate} />
          <ScenarioTimeline initial={initial} monthly={monthly} years={years} baseRate={blendedRate} />

          <div className="rounded-lg border border-rule bg-field p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
              <span className="text-[11px] uppercase tracking-wider text-muted">
                Evolución mes a mes · abanico de mercado
              </span>
              <div className="flex items-center gap-3 text-[10px] font-mono text-muted">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-serie-2"></span>Malo</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-serie-1"></span>Normal</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-serie-3"></span>Bueno</span>
                <span className="inline-flex items-center gap-1"><span className="h-px w-4 bg-muted"></span>Aportado</span>
              </div>
            </div>
            <div className="h-60">
              <CalcResponsive width="100%" height="100%">
                <CalcComposed data={fanData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--muted)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--muted)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--serie-1)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--serie-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CalcGrid strokeDasharray="2 4" stroke="var(--rule-soft)" vertical={false} />
                  <CalcXAxis
                    dataKey="year"
                    tick={{ fill: "var(--muted)", fontSize: 10 }}
                    axisLine={{ stroke: "var(--rule-soft)" }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}A`}
                  />
                  <CalcYAxis
                    tick={{ fill: "var(--muted)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
                  />
                  <CalcTooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--rule)",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    labelFormatter={(v) => `Año ${v}`}
                    formatter={(v, name) => [eur(v, 0), name]}
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    name="Aportado"
                    stroke="var(--muted)"
                    strokeWidth={1.2}
                    strokeDasharray="4 4"
                    fill="url(#gradInvested)"
                  />
                  <Area
                    type="monotone"
                    dataKey="base"
                    name="Mercado normal"
                    stroke="var(--serie-1)"
                    strokeWidth={2}
                    fill="url(#gradBase)"
                  />
                  <CalcLine
                    type="monotone"
                    dataKey="bear"
                    name="Mercado malo"
                    stroke="var(--serie-2)"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="5 3"
                  />
                  <CalcLine
                    type="monotone"
                    dataKey="bull"
                    name="Mercado bueno"
                    stroke="var(--serie-3)"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="5 3"
                  />
                </CalcComposed>
              </CalcResponsive>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
