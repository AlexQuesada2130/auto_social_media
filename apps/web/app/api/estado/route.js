import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { listar, listarTokens, listarSubs, dondeGuarda } from "@/lib/store";
import { hayClaves } from "@/lib/webpush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Versión del servicio. Se compara con la que tenga cargada el navegador para
// avisar de que hay una versión nueva sin recargar.
export const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";

const HORA = 60 * 60 * 1000;

export async function GET(req) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [borradores, tokens, subs] = await Promise.all([
    listar(), listarTokens(), listarSubs(),
  ]);

  const ahora = Date.now();
  const automaticos = borradores.filter((b) => b.origen && b.origen !== "idea tuya");
  const ultimo = automaticos[0]?.creado ? new Date(automaticos[0].creado).getTime() : null;
  const horasDesde = ultimo ? (ahora - ultimo) / HORA : null;

  // El generador se considera sano si trajo algo en las últimas 72 horas. Con
  // un ritmo de 2-3 posts por semana, más silencio que eso es que algo falla.
  const generador = horasDesde === null
    ? { estado: "sin estrenar", detalle: "todavía no ha entrado ninguna propuesta automática" }
    : horasDesde <= 72
      ? { estado: "bien", detalle: `última hace ${Math.round(horasDesde)} h` }
      : { estado: "parado", detalle: `sin propuestas desde hace ${Math.round(horasDesde / 24)} días` };

  return NextResponse.json({
    version: VERSION,
    almacen: {
      estado: dondeGuarda === "upstash" ? "bien" : "aviso",
      detalle: dondeGuarda === "upstash"
        ? "Upstash conectado"
        : "archivo local: en Vercel esto se borraría entre peticiones",
    },
    avisos: {
      estado: (tokens.length + subs.length) > 0 && hayClaves ? "bien" : "aviso",
      detalle: `${subs.length} navegador(es), ${tokens.length} app(s)` +
               (hayClaves ? "" : " · faltan las claves VAPID"),
    },
    generador,
    cola: {
      pendientes: borradores.filter((b) => (b.estado || "pendiente") === "pendiente").length,
      aprobados: borradores.filter((b) => b.estado === "aprobado").length,
      total: borradores.length,
    },
    momento: new Date().toISOString(),
  });
}
