// Precios públicos de Kraken (sin cuenta ni claves).
//  - Cierres diarios en euros para calcular las señales.
//  - Último precio para "ejecutar" las operaciones en papel.

export const CESTA = [
  // [cripto, par en Kraken] · las 15 mayores por capitalización (nov-2026)
  // con par en euros, sin estables, fichas de exchanges ni oro tokenizado.
  ["BTC", "XXBTZEUR"], ["ETH", "XETHZEUR"], ["XRP", "XXRPZEUR"], ["SOL", "SOLEUR"], ["TRX", "TRXEUR"],
  ["ZEC", "XZECZEUR"], ["HYPE", "HYPEEUR"], ["DOGE", "XDGEUR"], ["LINK", "LINKEUR"], ["ADA", "ADAEUR"],
  ["XLM", "XXLMZEUR"], ["BCH", "BCHEUR"], ["NEAR", "NEAREUR"], ["UNI", "UNIEUR"], ["LTC", "XLTCZEUR"],
];

const BASE = "https://api.kraken.com/0/public";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(ruta) {
  // Sin respuesta en 8 s, se da por fallida: no se consume el tiempo de la función.
  const r = await fetch(`${BASE}/${ruta}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Kraken ${ruta}: HTTP ${r.status}`);
  const j = await r.json();
  if (j.error?.length) throw new Error(`Kraken ${ruta}: ${j.error.join(", ")}`);
  return j.result;
}

/** { BTC: { fechas: [...], cierres: [...] }, ... } solo con días ya cerrados. */
export async function cierresDiarios({ presupuestoMs = 40_000 } = {}) {
  const salida = {};
  const inicio = Date.now();
  for (const [cripto, par] of CESTA) {
    if (Date.now() - inicio > presupuestoMs) throw new Error("Kraken va lento: descarga de cierres cancelada");
    const res = await pedir(`OHLC?pair=${par}&interval=1440`);
    const velas = res[Object.keys(res).find((k) => k !== "last")];
    // La última vela es el día en curso: aún no ha cerrado.
    const cerradas = velas.slice(0, -1);
    salida[cripto] = {
      fechas: cerradas.map((v) => new Date(v[0] * 1000).toISOString().slice(0, 10)),
      cierres: cerradas.map((v) => Number(v[4])),
    };
    await espera(1100); // Kraken limita las peticiones públicas a ~1 por segundo
  }
  return salida;
}

/** { BTC: 64321.5, ... } último precio negociado. */
export async function preciosActuales() {
  const res = await pedir(`Ticker?pair=${CESTA.map(([, p]) => p).join(",")}`);
  const salida = {};
  for (const [cripto, par] of CESTA) {
    const t = res[par] ?? res[Object.keys(res).find((k) => k.includes(par))];
    const precio = Number(t?.c?.[0]);
    if (Number.isFinite(precio) && precio > 0) salida[cripto] = precio;
  }
  return salida;
}
