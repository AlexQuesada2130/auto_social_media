import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";

// Precio histórico de un fondo desde Yahoo Finance, para la sección de dinero.
// Va por el servidor porque Yahoo no admite peticiones desde el navegador.
// Solo se piden símbolos públicos: aquí no viaja nada del usuario.

export const runtime = "nodejs";

const CACHE = new Map();
const VIDA = 60 * 60 * 1000; // una hora por símbolo
const SIMBOLO = /^[A-Z0-9.^=-]{1,20}$/i;

export async function GET(req, { params }) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { simbolo } = await params;
  if (!SIMBOLO.test(simbolo)) return NextResponse.json({ error: "Símbolo no válido" }, { status: 400 });

  const guardado = CACHE.get(simbolo);
  if (guardado && Date.now() - guardado.ts < VIDA) return NextResponse.json(guardado.datos);

  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=5y&interval=1mo&includePrePost=false`,
      {
        headers: {
          // Yahoo rechaza agentes que no parecen un navegador.
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json",
          "Accept-Language": "es-ES,es;q=0.9",
          Referer: "https://finance.yahoo.com/",
        },
      }
    );
    if (!r.ok) return NextResponse.json({ error: `Yahoo HTTP ${r.status}` }, { status: 502 });
    const datos = await r.json();
    CACHE.set(simbolo, { datos, ts: Date.now() });
    return NextResponse.json(datos);
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error desconocido" }, { status: 502 });
  }
}
