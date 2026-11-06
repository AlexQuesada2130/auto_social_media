"use client";

import { useMemo, useState } from "react";
import { useMarketData, DASHBOARD_DATA } from "../_finanzas/data";
import { ErrorState, CoreFundCard, Watchlist } from "../_finanzas/components";
import { MyPortfolio } from "../_finanzas/portfolio-tracker";
import { FundsExplorer, EXTRA_FUNDS } from "../_finanzas/explorer";
import { InvestmentCalculator } from "../_finanzas/calculator";
import { TradingGuide } from "../_finanzas/trading-guide";
import { PlanFondos } from "../_finanzas/plan-fondos";
import { useVaultField } from "../_finanzas/campo";
import { Marco } from "../_finanzas/marco";

const POSICIONES_INICIALES = { world: { shares: 0, avgPrice: 0 }, em: { shares: 0, avgPrice: 0 } };
const PESTANAS = [
  { id: "plan", nombre: "Mi cartera" },
  { id: "analisis", nombre: "Comparador y calculadora" },
  { id: "aprende", nombre: "Aprende" },
];

function Cargando() {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-sm text-muted">
      <div className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
      Cargando datos del mercado…
    </div>
  );
}

function ConMercado({ children }) {
  const market = useMarketData(["0P0000WAHE.IR", "0P00018PHQ.IR"]);
  const [positions, setPositions] = useVaultField("positions", POSICIONES_INICIALES);
  const funds = useMemo(() => market.data?.map((f) => {
    const pos = positions[f.id] ?? { shares: 0, avgPrice: 0 };
    return { ...f, held: pos.shares, avgCost: pos.avgPrice || f.nav };
  }), [market.data, positions]);
  if (market.loading) return <Cargando />;
  if (market.error) return <ErrorState message={market.error} onRetry={market.refetch} />;
  return children({ funds, positions, setPositions, market });
}

export default function Inversiones() {
  const [pestana, setPestana] = useState("plan");
  return (
    <Marco titulo="Cartera de inversiones" subtitulo="Tus fondos de MyInvestor: reparto, aportaciones y traspasos."
      pestanas={PESTANAS} activa={pestana} onPestana={setPestana}>
      {pestana === "plan" && (
        <>
          <PlanFondos />
          <ConMercado>
            {({ funds, positions, setPositions }) => (
              <MyPortfolio funds={funds} positions={{ ...POSICIONES_INICIALES, ...positions }} setPositions={setPositions} extraCatalog={EXTRA_FUNDS} />
            )}
          </ConMercado>
        </>
      )}
      {pestana === "analisis" && (
        <ConMercado>
          {({ funds }) => (
            <>
              <FundsExplorer funds={funds} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {funds.map((f) => <CoreFundCard key={f.id} fund={f} />)}
              </div>
              <InvestmentCalculator funds={funds} />
              <Watchlist rows={DASHBOARD_DATA.watchlist} />
            </>
          )}
        </ConMercado>
      )}
      {pestana === "aprende" && <TradingGuide />}
    </Marco>
  );
}
