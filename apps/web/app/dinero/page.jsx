"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMarketData, DASHBOARD_DATA } from "./_m/data";
import { ErrorState, CoreFundCard, Watchlist, lucide } from "./_m/components";
import { MyPortfolio } from "./_m/portfolio-tracker";
import { FundsExplorer, EXTRA_FUNDS } from "./_m/explorer";
import { InvestmentCalculator } from "./_m/calculator";
import { TradingGuide } from "./_m/trading-guide";
import { MoneyManager } from "./_m/money";
import { AjustesDinero } from "./_m/ajustes";
import { useVaultField } from "./_m/campo";
import { useCandado } from "../candado";
import "./dinero.css";

const POSICIONES_INICIALES = {
  world: { shares: 0, avgPrice: 0 },
  em: { shares: 0, avgPrice: 0 },
};

const PESTANAS = [
  { id: "money", label: "Mi dinero" },
  { id: "invest", label: "Inversión" },
  { id: "learn", label: "Aprende" },
];

function Cargando() {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-400">
      <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
      Cargando datos del mercado…
    </div>
  );
}

function Inversion() {
  const market = useMarketData(["0P0000WAHE.IR", "0P00018PHQ.IR"]);
  const [positions, setPositions] = useVaultField("positions", POSICIONES_INICIALES);
  const { watchlist } = DASHBOARD_DATA;

  const funds = useMemo(() => {
    if (!market.data) return null;
    return market.data.map((f) => {
      const pos = positions[f.id] ?? { shares: 0, avgPrice: 0 };
      return { ...f, held: pos.shares, avgCost: pos.avgPrice || f.nav };
    });
  }, [market.data, positions]);

  if (market.loading) return <Cargando />;
  if (market.error) return <ErrorState message={market.error} onRetry={market.refetch} />;

  const hasPosition = funds.some((f) => f.held > 0);

  return (
    <div className="space-y-8">
      <MyPortfolio
        funds={funds}
        positions={{ ...POSICIONES_INICIALES, ...positions }}
        setPositions={setPositions}
        extraCatalog={EXTRA_FUNDS}
      />
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Fondos Core & Comparador</h2>
            <p className="text-xs text-slate-500 mt-1">
              Tus fondos a la izquierda en el gráfico, recomendados a la derecha. Pulsa "Ver más" para descubrir fondos menos famosos.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 font-mono">
            <span>{hasPosition ? "Posiciones reales cargadas" : "Sin posición — añádela arriba"}</span>
            {market.lastFetch && (
              <span>· Datos: {market.lastFetch.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </div>
        </div>
        <FundsExplorer funds={funds} />
      </section>
      <section>
        <div className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Detalle de mis fondos</div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {funds.map((f) => <CoreFundCard key={f.id} fund={f} />)}
        </div>
      </section>
      <InvestmentCalculator funds={funds} />
      <Watchlist rows={watchlist} />
    </div>
  );
}

export default function Dinero() {
  const { cerrar } = useCandado();
  const [pestana, setPestana] = useState("money");
  const [ajustes, setAjustes] = useState(false);

  return (
    <div id="dinero">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-30" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto max-w-7xl px-4 lg:px-10 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <lucide.ChevronLeft size={16} /> Panel
          </Link>
          <nav className="flex gap-1 rounded-xl bg-slate-900 p-1 order-last sm:order-none w-full sm:w-auto">
            {PESTANAS.map((t) => (
              <button
                key={t.id}
                onClick={() => setPestana(t.id)}
                className={`flex-1 sm:flex-none rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  pestana === t.id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <button onClick={cerrar} className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800" title="Bloquear" aria-label="Bloquear">
              <lucide.Lock size={16} />
            </button>
            <button onClick={() => setAjustes(true)} className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800" title="Ajustes del dinero" aria-label="Ajustes del dinero">
              <lucide.Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 lg:px-10 py-8 space-y-8">
        {pestana === "money" && <MoneyManager />}
        {pestana === "invest" && <Inversion />}
        {pestana === "learn" && <TradingGuide />}
        <footer className="pt-6 pb-2 flex items-center gap-2 text-[11px] text-slate-600">
          <lucide.ShieldCheck size={12} />
          <span>Cifrado en este dispositivo · Uso personal · No constituye asesoramiento financiero</span>
        </footer>
      </main>

      {ajustes && <AjustesDinero onCerrar={() => setAjustes(false)} />}
    </div>
  );
}
