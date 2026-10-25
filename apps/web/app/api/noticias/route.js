import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { autorizado } from "@/lib/auth";

// Noticias de inversión (RSS de Rankia y El Economista) para "Aprende".

export const runtime = "nodejs";

const FEEDS = [
  "https://www.rankia.com/feed",
  "https://www.eleconomista.es/rss/rss-seleccion-bolsa.php",
];
const VIDA = 15 * 60 * 1000;
const cache = { ts: 0, datos: null };
// processEntities: false — no se expanden entidades del XML de terceros.
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: false });

const texto = (v) => (typeof v === "string" ? v : v?.["#text"] ?? "");

function enlace(l) {
  if (typeof l === "string") return l;
  if (Array.isArray(l)) return l[0]?.["@_href"] ?? texto(l[0]);
  return l?.["@_href"] ?? texto(l);
}

async function leerFeed(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Mesa RSS)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  const xml = parser.parse(await r.text());
  const crudos = xml?.rss?.channel?.item ?? xml?.feed?.entry ?? [];
  const items = Array.isArray(crudos) ? crudos : [crudos];
  const fuente = new URL(url).hostname.replace(/^www\./, "");
  return items.slice(0, 12).map((i) => ({
    title: String(texto(i.title)).trim(),
    link: String(enlace(i.link) || "").trim(),
    summary: String(texto(i.description) || texto(i.summary) || texto(i["content:encoded"]) || ""),
    pubDate: String(i.pubDate ?? i.updated ?? i.published ?? ""),
    source: fuente,
  }));
}

export async function GET(req) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (cache.datos && Date.now() - cache.ts < VIDA) return NextResponse.json(cache.datos);

  const resultados = await Promise.allSettled(FEEDS.map(leerFeed));
  const articulos = resultados
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    // Solo enlaces http(s): un "javascript:" en un feed ajeno no llega a un href.
    .filter((a) => a.title && /^https?:\/\//i.test(a.link))
    .sort((a, b) => (new Date(b.pubDate).getTime() || 0) - (new Date(a.pubDate).getTime() || 0))
    .slice(0, 24);

  cache.datos = articulos;
  cache.ts = Date.now();
  return NextResponse.json(articulos);
}
