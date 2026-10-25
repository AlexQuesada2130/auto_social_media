import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────
//  1. GENERADOR DE DATOS HISTÓRICOS (solo para construir el mock una vez)
// ─────────────────────────────────────────────────────────────────────────
function buildHistory(startNAV, monthlyMean, monthlyVol, months, seed) {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const closes = [];
  const opens = [];
  const highs = [];
  const lows = [];
  const volumes = [];
  const timestamps = [];
  let nav = startNAV;
  const today = new Date(2026, 4, 1);
  for (let i = months; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ret = monthlyMean + monthlyVol * gauss();
    const open = nav;
    nav = nav * (1 + ret);
    const high = Math.max(open, nav) * (1 + Math.abs(monthlyVol * 0.3 * rand()));
    const low = Math.min(open, nav) * (1 - Math.abs(monthlyVol * 0.3 * rand()));
    timestamps.push(Math.floor(d.getTime() / 1000));
    opens.push(+open.toFixed(4));
    closes.push(+nav.toFixed(4));
    highs.push(+high.toFixed(4));
    lows.push(+low.toFixed(4));
    volumes.push(Math.floor(50_000 + rand() * 250_000));
  }
  return { timestamps, opens, closes, highs, lows, volumes };
}

// ─────────────────────────────────────────────────────────────────────────
//  2. MOCK DE LA API DE YAHOO FINANCE
// ─────────────────────────────────────────────────────────────────────────
function buildYahooResponse(symbol, meta, hist) {
  return {
    chart: {
      result: [
        {
          meta: {
            currency: "EUR",
            symbol,
            instrumentType: "MUTUALFUND",
            firstTradeDate: hist.timestamps[0],
            regularMarketTime: hist.timestamps[hist.timestamps.length - 1],
            gmtoffset: 0,
            timezone: "Europe/Dublin",
            exchangeTimezoneName: "Europe/Dublin",
            regularMarketPrice: hist.closes[hist.closes.length - 1],
            chartPreviousClose: hist.closes[hist.closes.length - 2],
            priceHint: 4,
            fiftyTwoWeekHigh: Math.max(...hist.closes.slice(-12)),
            fiftyTwoWeekLow: Math.min(...hist.closes.slice(-12)),
            dataGranularity: "1mo",
            range: "5y",
            ...meta,
          },
          timestamp: hist.timestamps,
          indicators: {
            quote: [
              {
                open: hist.opens,
                close: hist.closes,
                high: hist.highs,
                low: hist.lows,
                volume: hist.volumes,
              },
            ],
            adjclose: [{ adjclose: hist.closes }],
          },
        },
      ],
      error: null,
    },
  };
}

const worldHist = buildHistory(10.0, 0.0085, 0.038, 60, 4321);
const emHist    = buildHistory(10.0, 0.0045, 0.052, 60, 9876);

export const YAHOO_API_MOCK = {
  "0P0000WAHE.IR": buildYahooResponse("0P0000WAHE.IR", {
    shortName: "Fidelity MSCI World Index P-ACC-EUR",
    longName: "Fidelity MSCI World Index Fund P-ACC-EUR",
    isin: "IE00BYXJY715",
    benchmark: "MSCI World Net Total Return EUR",
    domicile: "Irlanda",
    ter: 0.0012,
    holdings: 1480,
    replication: "Réplica física optimizada",
  }, worldHist),
  "0P00018PHQ.IR": buildYahooResponse("0P00018PHQ.IR", {
    shortName: "Fidelity MSCI EM Index P-ACC-EUR",
    longName: "Fidelity MSCI Emerging Markets Index Fund P-ACC-EUR",
    isin: "IE00BYXVGZ48",
    benchmark: "MSCI Emerging Markets Net TR EUR",
    domicile: "Irlanda",
    ter: 0.0020,
    holdings: 1240,
    replication: "Réplica física por muestreo",
  }, emHist),
};

const HOLDINGS_META = {
  "0P0000WAHE.IR": {
    held: 184.527, avgCost: 12.84,
    color: "#10B981", id: "world",
    topRegions: [
      { name: "EE.UU.", w: 71.2 },
      { name: "Japón", w: 5.8 },
      { name: "Reino Unido", w: 3.7 },
      { name: "Francia", w: 3.0 },
      { name: "Otros DM", w: 16.3 },
    ],
  },
  "0P00018PHQ.IR": {
    held: 96.214, avgCost: 11.92,
    color: "#60A5FA", id: "em",
    topRegions: [
      { name: "China", w: 27.4 },
      { name: "India", w: 18.1 },
      { name: "Taiwán", w: 17.6 },
      { name: "Corea del Sur", w: 11.3 },
      { name: "Otros EM", w: 25.6 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────
//  Metadatos estáticos del fondo (ISIN, TER, benchmark, etc.)
//  Yahoo Finance NO devuelve estos campos en el endpoint /v8/chart para
//  fondos de inversión, así que los conservamos a mano. Si en el futuro
//  usas /v10/quoteSummary podrás obtener algunos dinámicamente.
// ─────────────────────────────────────────────────────────────────────────
const STATIC_FUND_META = {
  "0P0000WAHE.IR": {
    shortName: "Fidelity MSCI World Index P-ACC-EUR",
    longName: "Fidelity MSCI World Index Fund P-ACC-EUR",
    isin: "IE00BYXJY715",
    benchmark: "MSCI World Net Total Return EUR",
    domicile: "Irlanda",
    ter: 0.0012,
    holdings: 1480,
    replication: "Réplica física optimizada",
  },
  "0P00018PHQ.IR": {
    shortName: "Fidelity MSCI EM Index P-ACC-EUR",
    longName: "Fidelity MSCI Emerging Markets Index Fund P-ACC-EUR",
    isin: "IE00BYXVGZ48",
    benchmark: "MSCI Emerging Markets Net TR EUR",
    domicile: "Irlanda",
    ter: 0.0020,
    holdings: 1240,
    replication: "Réplica física por muestreo",
  },
};

export function adaptYahooToFund(symbol, yahooResponse) {
  const r = yahooResponse?.chart?.result?.[0];
  if (!r) throw new Error(`Sin datos para ${symbol}`);
  const meta = r.meta ?? {};

  // adjclose puede no venir en todos los símbolos -> fallback a close
  const adj = r.indicators?.adjclose?.[0]?.adjclose;
  const close = r.indicators?.quote?.[0]?.close;
  const navSeries = (adj && adj.some((v) => v != null)) ? adj : close;
  if (!navSeries || !r.timestamp) throw new Error(`Serie histórica vacía para ${symbol}`);

  const series = r.timestamp
    .map((t, i) => {
      const v = navSeries[i];
      if (v == null) return null; // Yahoo a veces inserta huecos
      const d = new Date(t * 1000);
      return {
        date: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
        nav: v,
      };
    })
    .filter(Boolean);

  if (series.length === 0) throw new Error(`Sin puntos válidos para ${symbol}`);

  // Combinamos lo que llega de Yahoo con los metadatos estáticos del fondo.
  // Yahoo gana cuando trae el dato; si no, usamos el estático.
  const stat = STATIC_FUND_META[symbol] ?? {};
  const extra = HOLDINGS_META[symbol] ?? {};

  const closes = series.map((p) => p.nav);
  const last12 = closes.slice(-12);
  const ter = meta.ter ?? stat.ter ?? 0; // fracción (ej. 0.0012 = 0,12 %)

  return {
    symbol,
    id: extra.id ?? symbol,
    name: meta.longName ?? stat.longName ?? meta.shortName ?? stat.shortName ?? symbol,
    shareClass: "P-ACC-EUR",
    isin: meta.isin ?? stat.isin ?? "—",
    benchmark: meta.benchmark ?? stat.benchmark ?? "—",
    domicile: meta.domicile ?? stat.domicile ?? "—",
    currency: meta.currency ?? "EUR",
    ter: ter * 100,
    nav: meta.regularMarketPrice ?? closes[closes.length - 1],
    navPrev: meta.chartPreviousClose ?? closes[closes.length - 2] ?? closes[closes.length - 1],
    holdings: meta.holdings ?? stat.holdings ?? null,
    replication: meta.replication ?? stat.replication ?? "—",
    week52High: meta.fiftyTwoWeekHigh ?? Math.max(...last12),
    week52Low: meta.fiftyTwoWeekLow ?? Math.min(...last12),
    series,
    ...extra,
  };
}

async function fetchYahooSymbol(symbol) {
  // Va por app/api/mercado/[simbolo]/route.js: Yahoo no admite peticiones
  // directas desde el navegador (CORS).
  try {
    const res = await fetch(`/api/mercado/${encodeURIComponent(symbol)}`);
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error) detail = errJson.error;
      } catch (_) { /* ignore */ }
      throw new Error(detail);
    }
    const data = await res.json();
    if (data?.chart?.error) {
      throw new Error(data.chart.error.description ?? 'Error Yahoo Finance');
    }
    return data;
  } catch (err) {
    // Fallback de desarrollo: si la API real falla (Yahoo bloquea por IP, sin
    // internet, etc.) y tenemos mock para este símbolo, lo usamos para que la
    // app siga funcionando. Lo avisamos por consola para no engañar al usuario.
    const mock = YAHOO_API_MOCK[symbol];
    if (mock) {
      // eslint-disable-next-line no-console
      console.warn(
        `[StadisticWallet] API real para ${symbol} no disponible (${err.message}). ` +
        `Usando datos mock como fallback.`
      );
      return mock;
    }
    throw new Error(`Error obteniendo ${symbol}: ${err.message}`);
  }
}

export async function fetchMarketData(symbols = Object.keys(YAHOO_API_MOCK)) {
  const responses = await Promise.all(symbols.map(fetchYahooSymbol));
  return responses.map((res, i) => adaptYahooToFund(symbols[i], res));
}

export function useMarketData(symbols) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
    lastFetch: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const funds = await fetchMarketData(symbols);
      setState({
        loading: false,
        error: null,
        data: funds,
        lastFetch: new Date(),
      });
    } catch (err) {
      setState({
        loading: false,
        error: err.message || "Error desconocido",
        data: null,
        lastFetch: new Date(),
      });
    }
  }, [JSON.stringify(symbols)]);

  useEffect(() => { load(); }, [load]);
  return { ...state, refetch: load };
}

export const watchlist = [
  { name: "Vanguard Global Stock Index",         isin: "IE00B03HCZ61", ter: 0.18, cat: "RV Global",        r1: 11.4, r3: 9.8, r5: 12.1 },
  { name: "iShares Developed World Index",       isin: "IE00BD0NCM55", ter: 0.12, cat: "RV Desarrollada",  r1: 12.0, r3: 10.4, r5: 12.6 },
  { name: "Vanguard Emerging Markets Stock",     isin: "IE0031786142", ter: 0.23, cat: "RV Emergente",     r1: 4.2,  r3: 2.8, r5: 5.1 },
  { name: "Vanguard Global Small-Cap Index",     isin: "IE00B42W3S00", ter: 0.29, cat: "RV Small Cap",     r1: 7.8,  r3: 5.6, r5: 9.4 },
];

export const glossary = {
  TER: { title: "TER (Total Expense Ratio)", body: "Lo que te cobra el fondo cada año por gestionarlo, expresado en %. Si tienes 10.000€ y el TER es 0,20%, te cobran 20€ al año. Cuanto más bajo, más dinero se queda en tu bolsillo." },
  NAV: { title: "Valor Liquidativo (NAV)", body: "Es el precio de una participación del fondo. Se calcula cada día sumando lo que valen todas las acciones que tiene el fondo y dividiendo entre el número de participaciones. Es como el 'precio por unidad'." },
  ISIN: { title: "ISIN", body: "El DNI internacional del fondo: 12 caracteres que lo identifican de forma única en cualquier banco o broker del mundo." },
  MSCIWorld: { title: "MSCI World", body: "Un índice que reúne unas 1.500 empresas grandes y medianas de 23 países desarrollados (EE.UU., Europa, Japón…). Si lo compras a través de un fondo, inviertes en todas a la vez." },
  MSCIEM: { title: "MSCI Emerging Markets", body: "Como el MSCI World pero con países emergentes: China, India, Brasil, Taiwán, Corea del Sur… Más volátil, pero con potencial de crecimiento mayor a largo plazo." },
  ACC: { title: "ACC (Acumulación)", body: "Los dividendos que reparten las empresas se reinvierten automáticamente dentro del fondo. No los recibes en tu cuenta, pero el valor de tus participaciones sube. Fiscalmente eficiente." },
  PnL: { title: "P&L (Pérdidas y Ganancias)", body: "Cuánto has ganado o perdido respecto a lo que invertiste. Si compraste a 12€ y ahora vale 15€, tienes 3€ de ganancia por participación." },
  CAGR: { title: "Rentabilidad anualizada (CAGR)", body: "Lo que has ganado de media cada año, como si el crecimiento fuera constante. Útil para comparar inversiones de distinta duración." },
  Benchmark: { title: "Índice de referencia", body: "El 'objetivo' que sigue el fondo. Si replica al MSCI World, debería subir y bajar casi lo mismo que ese índice. Un fondo indexado intenta seguirlo al milímetro." },
  Boglehead: { title: "Filosofía Boglehead", body: "Inspirada en John Bogle (fundador de Vanguard): invierte en fondos indexados baratos, diversifica el mundo entero, aporta de forma regular y mantén el rumbo durante décadas. Simple y eficaz." },
  Compound: { title: "Interés compuesto", body: "La 'magia' de invertir: los intereses que ganas un año, al año siguiente también generan intereses. Cuanto más tiempo lo dejes, más exponencial es el crecimiento. Einstein lo llamó la octava maravilla del mundo." },
  DCA: { title: "Aportación periódica (DCA)", body: "Invertir la misma cantidad cada mes, llueva o haga sol. Compras más participaciones cuando el precio está bajo y menos cuando está alto. Reduce el riesgo de comprar en el peor momento." },
};

export function buildComparisonSeries(funds) {
  if (!funds || funds.length < 2) return [];
  const [w, e] = funds;
  const baseW = w.series[0].nav;
  const baseE = e.series[0].nav;
  return w.series.map((p, i) => ({
    date: p.date,
    label: p.label,
    World: +((p.nav / baseW) * 100).toFixed(2),
    Emerging: +((e.series[i].nav / baseE) * 100).toFixed(2),
  }));
}

export const DASHBOARD_DATA = { glossary, watchlist };
